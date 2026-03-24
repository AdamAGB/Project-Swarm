import type { LLMProvider } from './llm-providers';
import { runAcrossProviders } from './llm-providers';
import type { PriorResult } from '../types/v2';
import type { PersonaVote, PersonaVoteResult, WriteInCluster, ConfidenceInterval } from './persona-vote-engine';

/* ------------------------------------------------------------------ */
/*  Multi-model option generation                                      */
/* ------------------------------------------------------------------ */

const OPTION_GEN_PROMPT = `You generate concise polling answer options for survey questions. Given a question, produce 4-6 short, distinct answer options that cover the realistic range of responses. Return JSON: { "options": ["Option 1", "Option 2", ...] }. Each option should be 1-5 words. Do not number them.

CRITICAL: Options must be specific, concrete things — not abstract categories or descriptions. For example:
- If asked about dog breeds, say "Golden Retriever" not "Medium-sized calm breed"
- If asked about movies, say "The Godfather" not "Classic crime drama"
- If asked about pizza, say "Pepperoni" not "Meat topping"
- If asked about cities, say "Austin, TX" not "Mid-size Southern city"

Always name real, specific things that someone could actually pick. Never generate options that sound like category labels or descriptions.

If the question is too vague, references something not provided (e.g. "this pitch", "the proposal" with no details), or lacks the context needed to form a meaningful opinion, include one option like "Need more context". Only do this when the question genuinely cannot be answered well.`;

export async function generateOptionsMultiModel(
  providers: LLMProvider[],
  question: string,
): Promise<string[]> {
  const results = await runAcrossProviders(providers, async (provider) => {
    const content = await provider.complete(
      [
        { role: 'system', content: OPTION_GEN_PROMPT },
        { role: 'user', content: question },
      ],
      { temperature: 0.3, jsonMode: true },
    );
    if (!content) return [];
    const parsed = JSON.parse(content);
    const opts = parsed.options;
    if (!Array.isArray(opts)) return [];
    return opts.filter((o: unknown) => typeof o === 'string' && (o as string).trim().length > 0).map((o: string) => o.trim());
  });

  // Merge and deduplicate across models
  const seen = new Map<string, string>(); // lowercase → original casing
  for (const { result } of results) {
    for (const opt of result) {
      const key = opt.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.set(key, opt);
      }
    }
  }

  const merged = Array.from(seen.values());

  // If we got too many, ask the primary model to pick the best ones
  if (merged.length > 8) {
    const primary = providers[0];
    const content = await primary.complete(
      [
        {
          role: 'system',
          content: 'Given a list of poll options (some may overlap or be redundant), select the best 5-6 distinct options that cover the widest range of realistic responses. Return JSON: { "options": ["Option 1", ...] }',
        },
        { role: 'user', content: `Options:\n${merged.map((o, i) => `${i + 1}. ${o}`).join('\n')}` },
      ],
      { temperature: 0, jsonMode: true },
    );
    if (content) {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed.options) && parsed.options.length >= 3) {
          return parsed.options.map((o: string) => o.trim());
        }
      } catch { /* fall through to merged */ }
    }
  }

  return merged.length >= 2 ? merged : merged.length > 0 ? merged : ['Yes', 'No', 'Maybe'];
}

/* ------------------------------------------------------------------ */
/*  Multi-model prior generation                                       */
/* ------------------------------------------------------------------ */

const PRIOR_PROMPT = `You estimate the baseline public response to a poll question — before considering any specific audience segment, personality, or demographic.

Given a question and answer options, return a probability distribution representing what the general public would likely choose.

Guidelines:
- Use your knowledge of real-world public opinion, cultural consensus, and known sentiment when relevant. For example, if a topic is widely loved or widely disliked, the prior should strongly reflect that — do not artificially balance it.
- For vague or context-free questions, assign higher probability to cautious or hedging options
- Be honest and direct — if something is widely disliked, the distribution should reflect that.
- Probabilities must be positive and sum to 1.0

Return JSON: { "priors": { "Option text": probability, ... } }`;

export async function generatePriorMultiModel(
  providers: LLMProvider[],
  question: string,
  options: string[],
): Promise<PriorResult> {
  const results = await runAcrossProviders(providers, async (provider) => {
    const content = await provider.complete(
      [
        { role: 'system', content: PRIOR_PROMPT },
        {
          role: 'user',
          content: `Question: "${question}"\nOptions:\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`,
        },
      ],
      { temperature: 0, jsonMode: true },
    );
    if (!content) return null;

    const parsed = JSON.parse(content);
    const priors = parsed.priors || parsed;
    if (!priors || typeof priors !== 'object') return null;

    const dist: Record<string, number> = {};
    let sum = 0;
    for (const opt of options) {
      const val = Number(priors[opt]);
      if (isNaN(val) || val < 0) return null;
      dist[opt] = val;
      sum += val;
    }
    if (sum <= 0) return null;
    for (const opt of options) dist[opt] /= sum;
    return dist;
  });

  const validDists = results.map((r) => r.result).filter((d): d is Record<string, number> => d !== null);

  if (validDists.length === 0) {
    // Uniform fallback
    const p = 1 / options.length;
    const distribution: Record<string, number> = {};
    for (const opt of options) distribution[opt] = p;
    return { distribution, confidence: 0 };
  }

  // Average the distributions
  const avgDist: Record<string, number> = {};
  for (const opt of options) {
    avgDist[opt] = validDists.reduce((sum, d) => sum + (d[opt] ?? 0), 0) / validDists.length;
  }

  // Confidence = inverse of disagreement between models
  // Compute mean absolute deviation across models for each option, then average
  let totalDeviation = 0;
  if (validDists.length > 1) {
    for (const opt of options) {
      const mean = avgDist[opt];
      const deviations = validDists.map((d) => Math.abs((d[opt] ?? 0) - mean));
      totalDeviation += deviations.reduce((s, v) => s + v, 0) / deviations.length;
    }
    totalDeviation /= options.length;
  }

  // Map deviation to confidence: 0 deviation → 1.0, 0.2+ deviation → ~0.0
  // deviation is in probability space (0-1), so 0.1 mean deviation is significant disagreement
  const confidence = validDists.length === 1
    ? 0.5 // single model, moderate confidence
    : Math.max(0, Math.min(1, 1 - totalDeviation * 5));

  return { distribution: avgDist, confidence };
}

/* ------------------------------------------------------------------ */
/*  Multi-model persona voting                                         */
/* ------------------------------------------------------------------ */
/*  Segment generation via provider                                    */
/* ------------------------------------------------------------------ */

interface SegmentSpec {
  name: string;
  description: string;
  populationShare: number;
}

const SEGMENT_PROMPT = `Given a poll question, answer options, and user-provided audience segment descriptions, generate a structured segment framework.

For each segment description provided, create a segment with:
- A short name (2-4 words)
- The user's description preserved
- A realistic population share (percentages summing to 100)

If only one segment is provided, give it 100% share.
Population shares should reflect realistic prevalence — one dominant segment is fine.

Return JSON: { "segments": [{ "name": "Short Name", "description": "User description", "populationShare": number }, ...] }`;

export async function generateSegmentsViaProvider(
  provider: LLMProvider,
  question: string,
  options: string[],
  segmentDescriptions: string[],
): Promise<SegmentSpec[] | null> {
  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const content = await provider.complete(
        [
          { role: 'system', content: SEGMENT_PROMPT },
          {
            role: 'user',
            content: `Question: "${question}"\nOptions: ${options.join(', ')}\n\nSegment descriptions:\n${segmentDescriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')}`,
          },
        ],
        { temperature: 0, jsonMode: true },
      );

      if (!content) continue;

      const parsed = JSON.parse(content);
      const segs = parsed.segments;
      if (!Array.isArray(segs) || segs.length < 1) continue;

      const result: SegmentSpec[] = segs.map((s: Record<string, unknown>) => ({
        name: String(s.name ?? ''),
        description: String(s.description ?? ''),
        populationShare: Number(s.populationShare) || Math.round(100 / segs.length),
      }));

      if (result.some((s) => !s.name.trim())) continue;

      // Normalize shares to sum to 1.0
      const total = result.reduce((sum, s) => sum + s.populationShare, 0);
      for (const s of result) s.populationShare = s.populationShare / total;

      return result;
    } catch (err) {
      console.warn(`[multi-model] Segment gen attempt ${attempt}:`, err);
    }
  }
  return null;
}

const VOTES_PER_CALL = 10;
const MAX_CONCURRENT = 20;

function shuffleArray<T>(arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

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

const BATCH_TEMPERATURES = [0.7, 0.9, 0.9, 1.1];

async function fetchVoteBatch(
  provider: LLMProvider,
  question: string,
  options: string[],
  count: number,
  batchId: number,
  temperature: number,
  segment?: SegmentSpec,
): Promise<PersonaVote[]> {
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
- Each persona gets a short "desc" (age and occupation, 5 words max, e.g. "34, marketing manager" or "22, college student")
- Vary the names, ages, occupations, and reasoning
- Be honest: if most people would reject an option, most personas should give it low probability
- Include diverse opinions — real groups are never unanimous
- Reasons should explain their top preference, 1 sentence, first-person, natural and conversational
- Do NOT start every reason with "I"
- Every persona MUST provide a write_in: a short, concrete suggestion (2-5 words) for a specific option they wish was on the list, or "nothing" if they're happy with the options. It should be a real, nameable thing — not an abstract description or theme.

Return JSON: { "votes": [{ "name": "First name", "desc": "Age, occupation", "distribution": { ${optionKeys}: probability, ... }, "reason": "Their reasoning", "write_in": "Short suggestion or null" }, ...] }`;

  const user = segment
    ? `Question: "${question}"\nOptions:\n${shuffled.map((o, i) => `${i + 1}. ${o}`).join('\n')}\n\nGenerate ${count} voters from the "${segment.name}" segment.`
    : `Question: "${question}"\nOptions:\n${shuffled.map((o, i) => `${i + 1}. ${o}`).join('\n')}\n\nGenerate ${count} voters.`;

  const content = await provider.complete(
    [{ role: 'system', content: system }, { role: 'user', content: user }],
    { temperature, jsonMode: true },
  );

  if (!content) return [];

  const parsed = JSON.parse(content);
  const votes = parsed.votes;
  if (!Array.isArray(votes)) return [];

  return votes
    .map((v: Record<string, unknown>) => {
      const rawDist = (v.distribution ?? {}) as Record<string, unknown>;
      const distribution: Record<string, number> = {};
      let distSum = 0;

      for (const opt of options) {
        let val = Number(rawDist[opt]);
        if (isNaN(val)) {
          const key = Object.keys(rawDist).find((k) => k.toLowerCase().trim() === opt.toLowerCase().trim());
          val = key ? Number(rawDist[key]) : 0;
        }
        val = Math.max(0, val || 0);
        distribution[opt] = val;
        distSum += val;
      }

      if (distSum > 0) {
        for (const opt of options) distribution[opt] /= distSum;
      } else {
        for (const opt of options) distribution[opt] = 1 / options.length;
      }

      const vote = sampleFromDistribution(distribution, options);

      const rawWriteIn = v.write_in ?? v.writeIn ?? null;
      let writeIn: string | null = null;
      if (rawWriteIn && typeof rawWriteIn === 'string' && rawWriteIn.toLowerCase() !== 'null') {
        const candidate = rawWriteIn.trim();
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
    .filter((v: PersonaVote) => options.includes(v.vote));
}

async function clusterWriteIns(
  provider: LLMProvider,
  writeIns: string[],
): Promise<WriteInCluster[]> {
  if (writeIns.length === 0) return [];
  try {
    const content = await provider.complete(
      [
        {
          role: 'system',
          content: 'You group similar write-in suggestions from a poll into clusters. Merge near-duplicates and variations. Return the top clusters sorted by count (most popular first), max 8 clusters. Return JSON: { "clusters": [{ "label": "Clean label", "count": number, "examples": ["raw write-in 1", ...] }, ...] }',
        },
        {
          role: 'user',
          content: `Here are ${writeIns.length} write-in suggestions:\n${writeIns.map((w, i) => `${i + 1}. ${w}`).join('\n')}`,
        },
      ],
      { temperature: 0, jsonMode: true },
    );
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
  } catch {
    return [];
  }
}

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

function computeConfidenceIntervals(
  personas: PersonaVote[],
  options: string[],
): Record<string, ConfidenceInterval> {
  const batches = new Map<number, PersonaVote[]>();
  for (const p of personas) {
    if (!batches.has(p.batchId)) batches.set(p.batchId, []);
    batches.get(p.batchId)!.push(p);
  }
  const batchList = Array.from(batches.values());
  const K = batchList.length;

  if (K < 2) {
    const empty: Record<string, ConfidenceInterval> = {};
    for (const opt of options) empty[opt] = { mean: 0, low: 0, high: 0, stdDev: 0 };
    return empty;
  }

  const result: Record<string, ConfidenceInterval> = {};
  for (const opt of options) {
    const batchMeans = batchList.map((batch) => {
      const sum = batch.reduce((s, p) => s + (p.distribution[opt] ?? 0), 0);
      return (sum / batch.length) * 100;
    });
    const mean = batchMeans.reduce((s, v) => s + v, 0) / K;
    const variance = batchMeans.reduce((s, v) => s + (v - mean) ** 2, 0) / (K - 1);
    const stdDev = Math.sqrt(variance);
    const stdErr = stdDev / Math.sqrt(K);
    result[opt] = {
      mean,
      low: Math.max(0, mean - 1.96 * stdErr),
      high: Math.min(100, mean + 1.96 * stdErr),
      stdDev,
    };
  }
  return result;
}

export async function runMultiModelVoting(
  providers: LLMProvider[],
  question: string,
  options: string[],
  segments: SegmentSpec[] | null,
  onProgress?: (completed: number, total: number) => void,
  totalVotes = 500,
): Promise<PersonaVoteResult> {
  // Build batch tasks
  const tasks: { segment?: SegmentSpec; count: number; batchId: number; providerIdx: number; temperature: number }[] = [];
  let batchId = 0;

  if (segments && segments.length > 0) {
    const totalShare = segments.reduce((sum, s) => sum + s.populationShare, 0);
    const segmentAllocations = segments.map((seg) => {
      const votes = Math.round((seg.populationShare / totalShare) * totalVotes);
      return { segment: seg, votes: Math.max(VOTES_PER_CALL, votes) };
    });
    const allocated = segmentAllocations.reduce((sum, a) => sum + a.votes, 0);
    const diff = totalVotes - allocated;
    if (diff !== 0) segmentAllocations[0].votes += diff;

    for (const { segment, votes } of segmentAllocations) {
      let remaining = votes;
      while (remaining > 0) {
        const batch = Math.min(VOTES_PER_CALL, remaining);
        tasks.push({ segment, count: batch, batchId: batchId++, providerIdx: 0, temperature: 0 });
        remaining -= batch;
      }
    }
  } else {
    let remaining = totalVotes;
    while (remaining > 0) {
      const batch = Math.min(VOTES_PER_CALL, remaining);
      tasks.push({ count: batch, batchId: batchId++, providerIdx: 0, temperature: 0 });
      remaining -= batch;
    }
  }

  // Distribute batches round-robin across providers and temperatures
  for (let i = 0; i < tasks.length; i++) {
    tasks[i].providerIdx = i % providers.length;
    tasks[i].temperature = BATCH_TEMPERATURES[i % BATCH_TEMPERATURES.length];
  }

  // Shuffle so providers and temperatures interleave
  const shuffledTasks = shuffleArray(tasks);

  let completed = 0;
  const totalTasks = shuffledTasks.length;

  const batchResults = await parallelWithLimit(
    shuffledTasks.map(({ segment, count, batchId: bid, providerIdx, temperature: temp }) => async () => {
      const provider = providers[providerIdx];
      try {
        const votes = await fetchVoteBatch(provider, question, options, count, bid, temp, segment);
        completed++;
        onProgress?.(completed, totalTasks);
        return votes;
      } catch (err) {
        console.warn(`[multi-model] Batch ${bid} failed on ${provider.name}:`, err);
        completed++;
        onProgress?.(completed, totalTasks);
        return [];
      }
    }),
    MAX_CONCURRENT,
  );

  const allPersonas = batchResults.flat();

  // Tally per segment
  const tallyGroups = segments && segments.length > 0
    ? segments
    : [{ name: 'General', description: 'General public', populationShare: 1 }];
  const totalShare = tallyGroups.reduce((sum, s) => sum + s.populationShare, 0);

  const segmentTallies = tallyGroups.map((seg) => {
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

  const rawCounts: Record<string, number> = {};
  for (const opt of options) rawCounts[opt] = 0;
  for (const v of allPersonas) {
    if (rawCounts[v.vote] !== undefined) rawCounts[v.vote]++;
  }

  const totalVotesActual = allPersonas.length;
  const finalPcts: Record<string, number> = {};
  for (const opt of options) {
    finalPcts[opt] = totalVotesActual > 0 ? (rawCounts[opt] / totalVotesActual) * 100 : 0;
  }

  // Winner based on raw vote counts, not percentages
  const winner = options.reduce((best, opt) =>
    (rawCounts[opt] ?? 0) > (rawCounts[best] ?? 0) ? opt : best,
  );

  const confidenceIntervals = computeConfidenceIntervals(allPersonas, options);

  const isUnstable = options.some((opt) => {
    const ci = confidenceIntervals[opt];
    return ci && (ci.high - ci.low) > 20;
  });

  // Cluster write-ins using primary provider
  const writeIns = allPersonas
    .map((p) => p.writeIn)
    .filter((w): w is string => w !== null && w.length > 0);
  const writeInClusters = writeIns.length > 0
    ? await clusterWriteIns(providers[0], writeIns)
    : [];

  return {
    totalVotes: totalVotesActual,
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
