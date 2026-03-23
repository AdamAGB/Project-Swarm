import type OpenAI from 'openai';
import type {
  SegmentFramework,
  Sensitivity,
  PriorResult,
  OptionScoreResult,
  V2SegmentVoteResult,
  V2VoteAggregates,
  VariableDriver,
  SegmentDriver,
  DriverDecomposition,
  V2Narrative,
  V2AggregationResult,
} from '../types/v2';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SENSITIVITY_WEIGHT: Record<Sensitivity, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

const TOTAL_VOTES = 10_000;
const SOFTMAX_TEMP = 10;
// Dynamic alpha range: segment weight varies by prior confidence
// Low confidence (0) → segments dominate (alpha = MAX)
// High confidence (1) → prior dominates (alpha = MIN)
const SEGMENT_ALPHA_MAX = 0.85; // segments dominate when prior is uncertain
const SEGMENT_ALPHA_MIN = 0.35; // prior dominates when prior is confident

function computeAlpha(priorConfidence: number): number {
  // Linear interpolation: high confidence → low segment alpha (prior wins)
  return SEGMENT_ALPHA_MAX - priorConfidence * (SEGMENT_ALPHA_MAX - SEGMENT_ALPHA_MIN);
}

/* ------------------------------------------------------------------ */
/*  Layer 1: Weighted Rank Scores                                      */
/* ------------------------------------------------------------------ */

export function computeSegmentScores(
  framework: SegmentFramework,
  rankings: Record<string, Record<string, number>>,
  options: string[],
): Record<string, Record<string, number>> {
  const N = options.length;
  const result: Record<string, Record<string, number>> = {};

  for (const seg of framework.segments) {
    const segScores: Record<string, number> = {};
    for (const option of options) {
      let score = 0;
      for (const v of framework.variables) {
        const sens = framework.weights[seg.name]?.[v.key] ?? 'LOW';
        const weight = SENSITIVITY_WEIGHT[sens];
        const rank = rankings[option]?.[v.key] ?? N;
        score += weight * (N + 1 - rank);
      }
      segScores[option] = score;
    }
    result[seg.name] = segScores;
  }

  return result;
}

export function computeWeightedScores(
  segmentScores: Record<string, Record<string, number>>,
  framework: SegmentFramework,
  options: string[],
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const option of options) {
    let score = 0;
    for (const seg of framework.segments) {
      score += seg.populationShare * (segmentScores[seg.name]?.[option] ?? 0);
    }
    result[option] = score;
  }
  return result;
}

/* ------------------------------------------------------------------ */
/*  Layer 2: Vote Simulation (10K)                                     */
/* ------------------------------------------------------------------ */

function softmax(
  scores: Record<string, number>,
  temperature: number,
): Record<string, number> {
  const entries = Object.entries(scores);
  const maxScore = Math.max(...entries.map(([, s]) => s));
  const exps = entries.map(
    ([k, s]) => [k, Math.exp((s - maxScore) / temperature)] as const,
  );
  const sumExp = exps.reduce((sum, [, e]) => sum + e, 0);
  return Object.fromEntries(exps.map(([k, e]) => [k, e / sumExp]));
}

let _priorDebugLogged = false;

function simulateSegmentVotes(
  segPreferenceScores: Record<string, number>,
  votesToCast: number,
  options: string[],
  prior?: PriorResult,
): Record<string, number> {
  let finalScores = segPreferenceScores;

  if (prior && prior.confidence > 0) {
    const alpha = computeAlpha(prior.confidence);

    // Convert prior probabilities to log-scores (inverse softmax)
    const priorScores: Record<string, number> = {};
    for (const opt of options) {
      const p = prior.distribution[opt] ?? (1 / options.length);
      priorScores[opt] = SOFTMAX_TEMP * Math.log(Math.max(p, 1e-10));
    }

    // Blend: alpha * segment_scores + (1 - alpha) * prior_scores
    const blended: Record<string, number> = {};
    for (const opt of options) {
      blended[opt] =
        alpha * (segPreferenceScores[opt] ?? 0) +
        (1 - alpha) * (priorScores[opt] ?? 0);
    }
    finalScores = blended;

    // Debug: log the blending for the first segment only
    if (!_priorDebugLogged) {
      console.log('[vote-engine] Prior blending debug:', {
        confidence: prior.confidence,
        alpha,
        priorDistribution: prior.distribution,
        priorScores,
        segPreferenceScores,
        blended,
      });
      _priorDebugLogged = true;
    }
  }

  const probs = softmax(finalScores, SOFTMAX_TEMP);
  const counts: Record<string, number> = {};
  for (const opt of options) counts[opt] = 0;

  // Multinomial sampling via CDF walk
  const sortedOptions = options.slice();
  for (let i = 0; i < votesToCast; i++) {
    const r = Math.random();
    let cumulative = 0;
    let picked = sortedOptions[sortedOptions.length - 1];
    for (const opt of sortedOptions) {
      cumulative += probs[opt] ?? 0;
      if (r <= cumulative) {
        picked = opt;
        break;
      }
    }
    counts[picked]++;
  }

  return counts;
}

export function simulateAllVotes(
  segmentScores: Record<string, Record<string, number>>,
  framework: SegmentFramework,
  options: string[],
  prior?: PriorResult,
): { aggregates: V2VoteAggregates; segmentVotes: V2SegmentVoteResult[] } {
  _priorDebugLogged = false;

  // Allocate votes per segment, adjusting largest so total = TOTAL_VOTES
  const rawAllocations = framework.segments.map((seg) => ({
    seg,
    votes: Math.round(seg.populationShare * TOTAL_VOTES),
  }));
  const allocated = rawAllocations.reduce((sum, a) => sum + a.votes, 0);
  const diff = TOTAL_VOTES - allocated;
  if (diff !== 0) {
    // Adjust the largest segment
    let largestIdx = 0;
    for (let i = 1; i < rawAllocations.length; i++) {
      if (rawAllocations[i].votes > rawAllocations[largestIdx].votes) {
        largestIdx = i;
      }
    }
    rawAllocations[largestIdx].votes += diff;
  }

  const totalCounts: Record<string, number> = {};
  for (const opt of options) totalCounts[opt] = 0;

  const segmentVotes: V2SegmentVoteResult[] = [];

  for (const { seg, votes } of rawAllocations) {
    const segScores = segmentScores[seg.name] ?? {};
    const counts = simulateSegmentVotes(segScores, votes, options, prior);

    // Add to total
    for (const opt of options) {
      totalCounts[opt] += counts[opt];
    }

    // Per-segment percentages
    const segPcts: Record<string, number> = {};
    for (const opt of options) {
      segPcts[opt] = votes > 0 ? (counts[opt] / votes) * 100 : 0;
    }

    const segWinner = options.reduce((best, opt) =>
      counts[opt] > counts[best] ? opt : best,
    );

    segmentVotes.push({
      segmentName: seg.name,
      populationShare: seg.populationShare,
      votesAllocated: votes,
      voteCounts: counts,
      votePercentages: segPcts,
      preferenceScores: segScores,
      winnerInSegment: segWinner,
    });
  }

  // Compute total percentages
  const totalPcts: Record<string, number> = {};
  for (const opt of options) {
    totalPcts[opt] = (totalCounts[opt] / TOTAL_VOTES) * 100;
  }

  // Sort to find winner and runner-up
  const sorted = options.slice().sort((a, b) => totalCounts[b] - totalCounts[a]);
  const winner = sorted[0];
  const runnerUp = sorted.length > 1 ? sorted[1] : sorted[0];

  const aggregates: V2VoteAggregates = {
    totalVotes: TOTAL_VOTES,
    voteCounts: totalCounts,
    votePercentages: totalPcts,
    winner,
    winnerCount: totalCounts[winner],
    winnerPercentage: totalPcts[winner],
    runnerUp,
    runnerUpCount: totalCounts[runnerUp],
    runnerUpPercentage: totalPcts[runnerUp],
  };

  return { aggregates, segmentVotes };
}

/* ------------------------------------------------------------------ */
/*  Layer 3: Driver Decomposition                                      */
/* ------------------------------------------------------------------ */

export function decomposeDrivers(
  winner: string,
  runnerUp: string,
  weightedScores: Record<string, number>,
  segmentScores: Record<string, Record<string, number>>,
  rankings: Record<string, Record<string, number>>,
  framework: SegmentFramework,
  options: string[],
  variableLabels: Record<string, string>,
): DriverDecomposition {
  const N = options.length;
  const totalAdvantage = (weightedScores[winner] ?? 0) - (weightedScores[runnerUp] ?? 0);
  const isTie = Math.abs(totalAdvantage) < 0.001;

  // By-variable decomposition
  const byVariable: VariableDriver[] = [];
  for (const v of framework.variables) {
    let contrib = 0;
    for (const seg of framework.segments) {
      const sens = framework.weights[seg.name]?.[v.key] ?? 'LOW';
      const weight = SENSITIVITY_WEIGHT[sens];
      const winnerRank = rankings[winner]?.[v.key] ?? N;
      const runnerUpRank = rankings[runnerUp]?.[v.key] ?? N;
      contrib += seg.populationShare * weight * ((N + 1 - winnerRank) - (N + 1 - runnerUpRank));
    }
    byVariable.push({
      variableKey: v.key,
      variableLabel: variableLabels[v.key] ?? v.key,
      contribution: contrib,
      contributionShare: isTie ? 0 : contrib / totalAdvantage,
      winnerScore: rankings[winner]?.[v.key] ?? N,
      runnerUpScore: rankings[runnerUp]?.[v.key] ?? N,
    });
  }

  // Sort by |contributionShare| descending
  byVariable.sort((a, b) => Math.abs(b.contributionShare) - Math.abs(a.contributionShare));

  // By-segment decomposition
  const bySegment: SegmentDriver[] = [];
  for (const seg of framework.segments) {
    const winnerSeg = segmentScores[seg.name]?.[winner] ?? 0;
    const runnerUpSeg = segmentScores[seg.name]?.[runnerUp] ?? 0;
    const delta = winnerSeg - runnerUpSeg;
    const contrib = seg.populationShare * delta;
    bySegment.push({
      segmentName: seg.name,
      populationShare: seg.populationShare,
      contribution: contrib,
      contributionShare: isTie ? 0 : contrib / totalAdvantage,
      winnerScore: winnerSeg,
      runnerUpScore: runnerUpSeg,
      delta,
    });
  }

  bySegment.sort((a, b) => Math.abs(b.contributionShare) - Math.abs(a.contributionShare));

  return {
    winner,
    runnerUp,
    totalAdvantage,
    byVariable,
    bySegment,
  };
}

/* ------------------------------------------------------------------ */
/*  Layer 3: Narrative Generation                                      */
/* ------------------------------------------------------------------ */

export async function generateNarrative(
  client: OpenAI,
  question: string,
  options: string[],
  weightedScores: Record<string, number>,
  aggregates: V2VoteAggregates,
  drivers: DriverDecomposition,
  segmentVotes: V2SegmentVoteResult[],
  framework: SegmentFramework,
): Promise<V2Narrative> {
  const topVarDrivers = drivers.byVariable.slice(0, 3);
  const topSegDrivers = drivers.bySegment.slice(0, 3);

  const userMessage = `Question: "${question}"
Options: ${options.join(', ')}

Weighted Scores: ${JSON.stringify(weightedScores, null, 2)}

Vote Simulation (${aggregates.totalVotes.toLocaleString()} votes):
Winner: ${aggregates.winner} — ${aggregates.winnerCount} votes (${aggregates.winnerPercentage.toFixed(1)}%)
Runner-Up: ${aggregates.runnerUp} — ${aggregates.runnerUpCount} votes (${aggregates.runnerUpPercentage.toFixed(1)}%)
All Counts: ${JSON.stringify(aggregates.voteCounts)}

Top Variable Drivers (why ${drivers.winner} beats ${drivers.runnerUp}):
${topVarDrivers.map((d) => `- ${d.variableLabel}: ${(d.contributionShare * 100).toFixed(1)}% of advantage (winner rank ${d.winnerScore} vs ${d.runnerUpScore})`).join('\n')}

Top Segment Drivers:
${topSegDrivers.map((d) => `- ${d.segmentName} (${(d.populationShare * 100).toFixed(0)}% pop): ${(d.contributionShare * 100).toFixed(1)}% of advantage`).join('\n')}

Segments: ${framework.segments.map((s) => `${s.name} (${(s.populationShare * 100).toFixed(0)}%)`).join(', ')}

Segment vote winners: ${segmentVotes.map((sv) => `${sv.segmentName} → ${sv.winnerInSegment}`).join(', ')}`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-5.4-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a research analyst summarizing structured audience simulation results. Return JSON with exactly three fields: "headline" (one punchy sentence), "body" (2-3 sentence paragraph explaining the result), and "keyInsights" (array of 3-4 short bullet strings highlighting the most interesting findings). Be specific with numbers. Do not use markdown formatting.',
        },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      if (
        typeof parsed.headline === 'string' &&
        typeof parsed.body === 'string' &&
        Array.isArray(parsed.keyInsights)
      ) {
        return {
          headline: parsed.headline,
          body: parsed.body,
          keyInsights: parsed.keyInsights.map(String),
        };
      }
    }
  } catch (err) {
    console.warn('[vote-engine-v2] Narrative generation failed:', err);
  }

  // Fallback
  return {
    headline: `${aggregates.winner} wins with ${aggregates.winnerPercentage.toFixed(1)}% of the vote`,
    body: `In a simulation of ${aggregates.totalVotes.toLocaleString()} votes across ${framework.segments.length} audience segments, ${aggregates.winner} emerged as the winner with ${aggregates.winnerCount.toLocaleString()} votes (${aggregates.winnerPercentage.toFixed(1)}%), ahead of runner-up ${aggregates.runnerUp} at ${aggregates.runnerUpPercentage.toFixed(1)}%.`,
    keyInsights: [
      `${aggregates.winner} leads in ${segmentVotes.filter((sv) => sv.winnerInSegment === aggregates.winner).length} of ${segmentVotes.length} segments`,
      `Margin of victory: ${(aggregates.winnerPercentage - aggregates.runnerUpPercentage).toFixed(1)} percentage points`,
    ],
  };
}

/* ------------------------------------------------------------------ */
/*  Main Entry Point                                                   */
/* ------------------------------------------------------------------ */

export async function runV2Aggregation(
  client: OpenAI,
  question: string,
  options: string[],
  framework: SegmentFramework,
  scoreResult: OptionScoreResult,
  prior?: PriorResult,
): Promise<V2AggregationResult> {
  // Build variable label map
  const variableLabels: Record<string, string> = {};
  for (const v of framework.variables) {
    variableLabels[v.key] = v.label;
  }

  // Layer 1: Compute scores
  const segmentScores = computeSegmentScores(framework, scoreResult.rankings, options);
  const weightedScores = computeWeightedScores(segmentScores, framework, options);

  // Layer 2: Vote simulation
  const { aggregates, segmentVotes } = simulateAllVotes(segmentScores, framework, options, prior);

  // Layer 3: Driver decomposition (sync)
  const drivers = decomposeDrivers(
    aggregates.winner,
    aggregates.runnerUp,
    weightedScores,
    segmentScores,
    scoreResult.rankings,
    framework,
    options,
    variableLabels,
  );

  // Layer 3: Narrative (async LLM call)
  const narrative = await generateNarrative(
    client,
    question,
    options,
    weightedScores,
    aggregates,
    drivers,
    segmentVotes,
    framework,
  );

  return {
    weightedScores,
    segmentScores,
    aggregates,
    segmentVotes,
    drivers,
    narrative,
  };
}
