import type OpenAI from 'openai';
import type { PriorResult } from '../types/v2';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface PersonaVote {
  name: string;
  description: string;
  segment: string;
  vote: string;
  reason: string;
  writeIn: string | null;
  distribution: Record<string, number>;
  batchId: number;
}

export interface WriteInCluster {
  label: string;
  count: number;
  examples: string[];
}

export interface SegmentVoteTally {
  segmentName: string;
  segmentDescription: string;
  populationShare: number;
  voteCounts: Record<string, number>;
  votePercentages: Record<string, number>;
  totalVotes: number;
  winnerInSegment: string;
  personas: PersonaVote[];
}

export interface ConfidenceInterval {
  mean: number;
  low: number;
  high: number;
  stdDev: number;
}

export interface PersonaVoteResult {
  totalVotes: number;
  voteCounts: Record<string, number>;
  votePercentages: Record<string, number>;
  confidenceIntervals: Record<string, ConfidenceInterval>;
  isUnstable: boolean;
  winner: string;
  segmentTallies: SegmentVoteTally[];
  allPersonas: PersonaVote[];
  writeInClusters: WriteInCluster[];
}

interface SegmentSpec {
  name: string;
  description: string;
  populationShare: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DEFAULT_TOTAL_VOTES = 500;
const VOTES_PER_CALL = 10;
const MAX_CONCURRENT = 20;

/* ------------------------------------------------------------------ */
/*  Batch voting prompt                                                */
/* ------------------------------------------------------------------ */

function shuffleArray<T>(arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildVotingPrompt(
  question: string,
  options: string[],
  count: number,
  segment?: SegmentSpec,
): { system: string; user: string } {
  // Shuffle option order per batch to neutralize position bias
  const shuffled = shuffleArray(options);
  const optionKeys = shuffled.map((o) => `"${o}"`).join(', ');

  const segmentClause = segment
    ? `You are simulating ${count} diverse people who all belong to this audience segment:\n\n"${segment.name}: ${segment.description}"\n\nAssign probabilities realistically based on what people in this segment would actually think.`
    : `You are simulating ${count} diverse people from the general public — a realistic mix of ages, backgrounds, and perspectives.`;

  const system = `${segmentClause}

Each person should express their preference on the poll question below as a probability distribution across the options. These are real people with real opinions — they will NOT all agree.

Rules:
- Generate exactly ${count} personas
- Each persona provides a probability distribution over ALL options (values must sum to 1.0, use EXACT option text as keys)
- A persona who strongly prefers one option might be 0.8/0.1/0.1. Someone torn might be 0.4/0.35/0.25. Someone who'd never pick an option should give it 0.0 or near-zero.
- Vary the names, personalities, and reasoning
- Be honest: if most people would reject an option, most personas should give it low probability
- Include diverse opinions — real groups are never unanimous
- Reasons should explain their top preference, 1 sentence, first-person, natural and conversational
- Do NOT start every reason with "I"
- Every persona MUST provide a write_in: a short, concrete suggestion (2-5 words) for a specific option they wish was on the list, or "nothing" if they're happy with the options. It should be a real, nameable thing — not an abstract description or theme. For example, if the question is about favorite movies, write in an actual movie title, not "action-packed sequel" or "underdog story". If the question is about pizza toppings, write "Hawaiian" not "tropical fruit combination".

Return JSON: { "votes": [{ "name": "First name", "distribution": { ${optionKeys}: probability, ... }, "reason": "Their reasoning", "write_in": "Short suggestion or null" }, ...] }`;

  const user = segment
    ? `Question: "${question}"\nOptions:\n${shuffled.map((o, i) => `${i + 1}. ${o}`).join('\n')}\n\nGenerate ${count} voters from the "${segment.name}" segment.`
    : `Question: "${question}"\nOptions:\n${shuffled.map((o, i) => `${i + 1}. ${o}`).join('\n')}\n\nGenerate ${count} voters.`;

  return { system, user };
}

/* ------------------------------------------------------------------ */
/*  Sampling + statistics                                              */
/* ------------------------------------------------------------------ */

function sampleFromDistribution(
  distribution: Record<string, number>,
  options: string[],
): string {
  const r = Math.random();
  let cumulative = 0;
  for (const opt of options) {
    cumulative += distribution[opt] ?? 0;
    if (r <= cumulative) return opt;
  }
  return options[options.length - 1];
}

function computeConfidenceIntervals(
  personas: PersonaVote[],
  options: string[],
): Record<string, ConfidenceInterval> {
  // Group personas by batch
  const batches = new Map<number, PersonaVote[]>();
  for (const p of personas) {
    if (!batches.has(p.batchId)) batches.set(p.batchId, []);
    batches.get(p.batchId)!.push(p);
  }

  const batchList = Array.from(batches.values());
  const K = batchList.length; // number of independent batches

  if (K < 2) {
    const empty: Record<string, ConfidenceInterval> = {};
    for (const opt of options) {
      empty[opt] = { mean: 0, low: 0, high: 0, stdDev: 0 };
    }
    return empty;
  }

  const result: Record<string, ConfidenceInterval> = {};

  for (const opt of options) {
    // Compute batch-level means (each batch is one independent observation)
    const batchMeans = batchList.map((batch) => {
      const sum = batch.reduce((s, p) => s + (p.distribution[opt] ?? 0), 0);
      return (sum / batch.length) * 100;
    });

    const mean = batchMeans.reduce((s, v) => s + v, 0) / K;
    const variance = batchMeans.reduce((s, v) => s + (v - mean) ** 2, 0) / (K - 1);
    const stdDev = Math.sqrt(variance);
    const stdErr = stdDev / Math.sqrt(K);

    // 95% confidence interval
    result[opt] = {
      mean,
      low: Math.max(0, mean - 1.96 * stdErr),
      high: Math.min(100, mean + 1.96 * stdErr),
      stdDev,
    };
  }

  return result;
}

/* ------------------------------------------------------------------ */
/*  Single batch call                                                  */
/* ------------------------------------------------------------------ */

async function fetchVoteBatch(
  client: OpenAI,
  question: string,
  options: string[],
  count: number,
  batchId: number,
  segment?: SegmentSpec,
): Promise<PersonaVote[]> {
  const { system, user } = buildVotingPrompt(question, options, count, segment);

  const response = await client.chat.completions.create({
    model: 'gpt-5.4-mini',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.9,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return [];

  const parsed = JSON.parse(content);
  const votes = parsed.votes;
  if (!Array.isArray(votes)) return [];

  return votes
    .map((v: Record<string, unknown>) => {
      // Parse and normalize distribution
      const rawDist = (v.distribution ?? {}) as Record<string, unknown>;
      const distribution: Record<string, number> = {};
      let distSum = 0;

      for (const opt of options) {
        // Try exact match first, then case-insensitive
        let val = Number(rawDist[opt]);
        if (isNaN(val)) {
          const key = Object.keys(rawDist).find((k) => k.toLowerCase().trim() === opt.toLowerCase().trim());
          val = key ? Number(rawDist[key]) : 0;
        }
        val = Math.max(0, val || 0);
        distribution[opt] = val;
        distSum += val;
      }

      // Normalize distribution to sum to 1
      if (distSum > 0) {
        for (const opt of options) {
          distribution[opt] /= distSum;
        }
      } else {
        // Fallback: uniform
        for (const opt of options) {
          distribution[opt] = 1 / options.length;
        }
      }

      // Sample vote from distribution
      const vote = sampleFromDistribution(distribution, options);

      const rawWriteIn = v.write_in ?? v.writeIn ?? null;
      let writeIn: string | null = null;
      if (rawWriteIn && typeof rawWriteIn === 'string' && rawWriteIn.toLowerCase() !== 'null') {
        const candidate = rawWriteIn.trim();
        // Only filter exact duplicates of existing options
        const optionsLower = new Set(options.map((o) => o.toLowerCase().trim()));
        const skip = new Set(['nothing', 'none', 'n/a', 'na', 'no', 'null', 'no suggestion', 'none needed']);
        if (candidate.length > 0 && !optionsLower.has(candidate.toLowerCase()) && !skip.has(candidate.toLowerCase())) {
          writeIn = candidate;
        }
      }

      return {
        name: String(v.name ?? 'Anonymous'),
        description: String(v.desc ?? v.description ?? ''),
        segment: segment?.name ?? 'General',
        vote,
        reason: String(v.reason ?? ''),
        writeIn,
        distribution,
        batchId,
      };
    })
    .filter((v) => options.includes(v.vote));
}

/* ------------------------------------------------------------------ */
/*  Concurrency-limited parallel execution                             */
/* ------------------------------------------------------------------ */

async function parallelWithLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function runNext(): Promise<void> {
    while (nextIndex < tasks.length) {
      const i = nextIndex++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => runNext());
  await Promise.all(workers);
  return results;
}

/* ------------------------------------------------------------------ */
/*  Bayesian smoothing with prior                                      */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Write-in clustering                                                */
/* ------------------------------------------------------------------ */

async function clusterWriteIns(
  client: OpenAI,
  writeIns: string[],
): Promise<WriteInCluster[]> {
  if (writeIns.length === 0) return [];

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-5.4-mini',
      messages: [
        {
          role: 'system',
          content: `You group similar write-in suggestions from a poll into clusters. Merge near-duplicates and variations (e.g. "Hawaiian pizza", "hawaiian", "Pineapple pizza" → one cluster). Return the top clusters sorted by count (most popular first), max 8 clusters. For each cluster, provide a clean label and 1-3 example raw write-ins.

Return JSON: { "clusters": [{ "label": "Clean label", "count": number, "examples": ["raw write-in 1", ...] }, ...] }`,
        },
        {
          role: 'user',
          content: `Here are ${writeIns.length} write-in suggestions:\n${writeIns.map((w, i) => `${i + 1}. ${w}`).join('\n')}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    const clusters = parsed.clusters;
    if (!Array.isArray(clusters)) return [];

    return clusters
      .filter((c: Record<string, unknown>) => typeof c.label === 'string' && typeof c.count === 'number')
      .map((c: Record<string, unknown>) => ({
        label: String(c.label),
        count: Number(c.count),
        examples: Array.isArray(c.examples) ? c.examples.map(String).slice(0, 3) : [],
      }));
  } catch (err) {
    console.warn('[persona-vote-engine] Write-in clustering failed:', err);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Bayesian smoothing with prior                                      */
/* ------------------------------------------------------------------ */

function applyBayesianPrior(
  rawCounts: Record<string, number>,
  _totalVotes: number,
  options: string[],
  prior: PriorResult,
): { counts: Record<string, number>; percentages: Record<string, number> } {
  // Pseudo-count strength scales with prior confidence
  // At confidence=1.0, prior adds ~50 pseudo-votes (10% of 500)
  // At confidence=0.0, prior adds 0 pseudo-votes (no effect)
  const pseudoTotal = Math.round(prior.confidence * 50);

  const smoothedCounts: Record<string, number> = {};
  let smoothedTotal = 0;

  for (const opt of options) {
    const raw = rawCounts[opt] ?? 0;
    const pseudo = pseudoTotal * (prior.distribution[opt] ?? 1 / options.length);
    smoothedCounts[opt] = raw + pseudo;
    smoothedTotal += smoothedCounts[opt];
  }

  const percentages: Record<string, number> = {};
  for (const opt of options) {
    percentages[opt] = smoothedTotal > 0
      ? (smoothedCounts[opt] / smoothedTotal) * 100
      : 0;
  }

  return { counts: smoothedCounts, percentages };
}

/* ------------------------------------------------------------------ */
/*  Main entry point                                                   */
/* ------------------------------------------------------------------ */

export async function runPersonaVoting(
  client: OpenAI,
  question: string,
  options: string[],
  segments: SegmentSpec[] | null,
  prior: PriorResult | null,
  onProgress?: (completed: number, total: number) => void,
  totalVotesOverride?: number,
): Promise<PersonaVoteResult> {
  const TARGET_TOTAL_VOTES = totalVotesOverride ?? DEFAULT_TOTAL_VOTES;
  // Build batch tasks
  const tasks: { segment?: SegmentSpec; count: number; batchId: number }[] = [];
  let batchId = 0;

  if (segments && segments.length > 0) {
    // Segment mode: allocate votes proportional to population share
    const totalShare = segments.reduce((sum, s) => sum + s.populationShare, 0);
    const segmentAllocations = segments.map((seg) => {
      const votes = Math.round((seg.populationShare / totalShare) * TARGET_TOTAL_VOTES);
      return { segment: seg, votes: Math.max(VOTES_PER_CALL, votes) };
    });

    // Adjust to hit TARGET_TOTAL_VOTES exactly
    const allocated = segmentAllocations.reduce((sum, a) => sum + a.votes, 0);
    const diff = TARGET_TOTAL_VOTES - allocated;
    if (diff !== 0) {
      segmentAllocations[0].votes += diff;
    }

    for (const { segment, votes } of segmentAllocations) {
      let remaining = votes;
      while (remaining > 0) {
        const batch = Math.min(VOTES_PER_CALL, remaining);
        tasks.push({ segment, count: batch, batchId: batchId++ });
        remaining -= batch;
      }
    }
  } else {
    // No segments: general population batches
    let remaining = TARGET_TOTAL_VOTES;
    while (remaining > 0) {
      const batch = Math.min(VOTES_PER_CALL, remaining);
      tasks.push({ count: batch, batchId: batchId++ });
      remaining -= batch;
    }
  }

  // Shuffle tasks so segments are interleaved rather than sequential
  for (let i = tasks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tasks[i], tasks[j]] = [tasks[j], tasks[i]];
  }

  let completed = 0;
  const totalTasks = tasks.length;

  // Execute all batches with concurrency limit
  const batchResults = await parallelWithLimit(
    tasks.map(({ segment, count, batchId: bid }) => async () => {
      const votes = await fetchVoteBatch(client, question, options, count, bid, segment);
      completed++;
      onProgress?.(completed, totalTasks);
      return votes;
    }),
    MAX_CONCURRENT,
  );

  // Flatten all votes
  const allPersonas = batchResults.flat();

  // Tally per segment (or single "General" tally if no segments)
  const tallyGroups = segments && segments.length > 0
    ? segments
    : [{ name: 'General', description: 'General public', populationShare: 1 }];
  const totalShare = tallyGroups.reduce((sum, s) => sum + s.populationShare, 0);

  const segmentTallies: SegmentVoteTally[] = tallyGroups.map((seg) => {
    const segVotes = allPersonas.filter((p) => p.segment === seg.name);
    const counts: Record<string, number> = {};
    for (const opt of options) counts[opt] = 0;
    for (const v of segVotes) {
      if (counts[v.vote] !== undefined) counts[v.vote]++;
    }

    const total = segVotes.length;
    const pcts: Record<string, number> = {};
    for (const opt of options) {
      pcts[opt] = total > 0 ? (counts[opt] / total) * 100 : 0;
    }

    const winner = options.reduce((best, opt) =>
      (counts[opt] ?? 0) > (counts[best] ?? 0) ? opt : best,
    );

    return {
      segmentName: seg.name,
      segmentDescription: seg.description,
      populationShare: seg.populationShare / totalShare,
      voteCounts: counts,
      votePercentages: pcts,
      totalVotes: total,
      winnerInSegment: winner,
      personas: segVotes,
    };
  });

  // Tally overall
  const rawCounts: Record<string, number> = {};
  for (const opt of options) rawCounts[opt] = 0;
  for (const v of allPersonas) {
    if (rawCounts[v.vote] !== undefined) rawCounts[v.vote]++;
  }

  const totalVotes = allPersonas.length;

  // Apply Bayesian prior smoothing if available
  let finalPcts: Record<string, number>;
  if (prior && prior.confidence > 0) {
    const smoothed = applyBayesianPrior(rawCounts, totalVotes, options, prior);
    finalPcts = smoothed.percentages;
  } else {
    finalPcts = {};
    for (const opt of options) {
      finalPcts[opt] = totalVotes > 0 ? (rawCounts[opt] / totalVotes) * 100 : 0;
    }
  }

  const winner = options.reduce((best, opt) =>
    (finalPcts[opt] ?? 0) > (finalPcts[best] ?? 0) ? opt : best,
  );

  // Compute confidence intervals from distributions
  const confidenceIntervals = computeConfidenceIntervals(allPersonas, options);

  // Cluster write-ins
  const writeIns = allPersonas
    .map((p) => p.writeIn)
    .filter((w): w is string => w !== null && w.length > 0);

  const writeInClusters = writeIns.length > 0
    ? await clusterWriteIns(client, writeIns)
    : [];

  // Flag as unstable if any option's CI spans more than ±10 percentage points
  const isUnstable = options.some((opt) => {
    const ci = confidenceIntervals[opt];
    return ci && (ci.high - ci.low) > 20;
  });

  return {
    totalVotes,
    voteCounts: rawCounts,
    votePercentages: finalPcts,
    confidenceIntervals,
    isUnstable,
    winner,
    segmentTallies,
    allPersonas,
    writeInClusters,
  };
}
