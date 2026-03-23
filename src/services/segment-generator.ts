import type OpenAI from 'openai';
import type { SegmentFramework, Sensitivity } from '../types/v2';
import type { Attachment } from '../types/attachments';
import { buildUserContent } from './attachments';

const VALID_SENSITIVITIES = new Set<string>(['HIGH', 'MEDIUM', 'LOW']);

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'is', 'it', 'as', 'be', 'are', 'was', 'were',
  'that', 'this', 'from', 'not', 'no', 'so', 'if', 'its', 'do', 'has',
  'who', 'how', 'what', 'when', 'where', 'which', 'their', 'they', 'we',
  'our', 'all', 'more', 'very', 'most', 'each', 'every', 'than', 'over',
]);

const SYSTEM_PROMPT = `You generate audience segment frameworks for poll questions.

Given a question and answer options, follow this process:

1. **Identify the target audience** — who would actually face this decision?
2. **Assess heterogeneity** — how differently do people approach this? A niche expert question might only need 2–3 segments. A mass-market consumer question might need 5–6. Never force segments that don't represent meaningfully different decision-making styles.
3. **Generate only the minimum segments needed** (2–8) — each must represent a meaningfully different decision-making style that would lead to different option rankings. If a hypothetical segment wouldn't change the outcome, don't include it. Segments are decision-making styles, NOT audience demographics or single-trait proxies.
4. **Assign realistic population shares** — percentages reflecting estimated real-world prevalence. A dominant segment at 60–80% is fine. Avoid artificially even splits. Shares must sum to 100.
5. **Generate exactly 6 variables** spanning genuinely different evaluation dimensions. Always 6 — even if there are only 2–3 segments, a rich 6-variable space captures multiple dimensions of preference. Each variable has a snake_case key, a human label, and a description explaining what 0 means vs what 100 means.
   - **Distinctness**: Each variable must measure a fundamentally different thing. Apply a "could I score high on one and low on the other?" test — if two variables would almost always move together (e.g. edginess/creativity, memorability/catchiness), they are redundant. Keep only the one that best captures the underlying dimension.
   - **At least one negative axis**: At least one variable must measure a downside, cost, or risk (e.g. confusion risk, alienation potential, implementation difficulty, polarization). Real decisions involve both attraction and rejection — an option can score high on appeal AND high on risk. Without negative axes the framework only captures "which positive traits matter most" and misses the tradeoffs that actually drive decisions.
6. **Build the sensitivity matrix** — for each segment, assign HIGH, MEDIUM, or LOW for each variable.
7. **Write a reasoning field** — a short paragraph explaining WHY this many segments, what makes each distinct enough to keep, and why the population shares are set as they are.

CRITICAL RULES:
- Segment names must NOT echo variable names. If a variable is "Emotional Depth", you cannot name a segment "Depth Seekers" or "Emotional Thinkers".
- Each segment must have at least 3 HIGH or MEDIUM sensitivities. Real people care about multiple things.
- Variables must be conceptually distinct — not synonyms, not near-synonyms, and not two framings of the same quality. If you can't explain how someone would score high on variable A but low on variable B, they are too similar. Merge or replace.
- At least one variable must be a clear negative axis — something where scoring HIGH is a downside (risk, confusion, cost, alienation, etc.), not just the absence of a positive.
- No sensitivity value of NONE — use LOW as the minimum.

Return JSON with this exact structure:
{
  "reasoning": "A short paragraph explaining why this many segments, what makes each distinct, and why the population shares are set as they are.",
  "segments": [
    { "name": "Segment Name", "description": "1-2 sentence description of this decision-making style", "populationShare": 55 }
  ],
  "variables": [
    { "key": "snake_case_key", "label": "Human Label", "description": "0 = low end meaning, 100 = high end meaning" }
  ],
  "weights": {
    "Segment Name": {
      "variable_key": "HIGH",
      "other_key": "MEDIUM"
    }
  }
}

Rules:
- 2–8 segments (as many as genuinely needed), exactly 6 variables always
- populationShare values are percentages that must sum to 100
- Sensitivity values must be exactly "HIGH", "MEDIUM", or "LOW" (strings, not numbers)
- Every segment must have a sensitivity for every variable
- Segment names in the weights object must exactly match the segment names array
- Variable keys in the weights must exactly match the variable keys array`;

/** Extract significant words from a string (lowercase, no stop words, length > 2) */
function significantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
  );
}

function validateFramework(raw: Record<string, unknown>, minSegments = 2): SegmentFramework | null {
  try {
    // --- Check reasoning ---
    const reasoning = typeof raw.reasoning === 'string' ? raw.reasoning : '';

    // --- Check segments ---
    const rawSegments = raw.segments;
    if (!Array.isArray(rawSegments) || rawSegments.length < minSegments || rawSegments.length > 8) return null;
    const segments = rawSegments.map((s: Record<string, unknown>) => ({
      name: String(s.name),
      description: String(s.description),
      populationShare: Number(s.populationShare) || 0,
    }));

    // --- Validate population shares ---
    if (segments.some((s) => s.populationShare <= 0)) return null;
    const shareSum = segments.reduce((sum, s) => sum + s.populationShare, 0);
    if (shareSum < 80 || shareSum > 120) return null;
    // Normalize to sum to 1.0
    for (const seg of segments) {
      seg.populationShare = seg.populationShare / shareSum;
    }

    // --- Check variables ---
    const rawVars = raw.variables;
    if (!Array.isArray(rawVars) || rawVars.length !== 6) return null;
    const variables = rawVars.map((v: Record<string, unknown>) => ({
      key: String(v.key),
      label: String(v.label),
      description: String(v.description),
    }));

    // --- Check variable redundancy: no two variables share >50% significant words ---
    const varWordSets = variables.map((v) => significantWords(v.label));
    for (let i = 0; i < varWordSets.length; i++) {
      for (let j = i + 1; j < varWordSets.length; j++) {
        const setA = varWordSets[i];
        const setB = varWordSets[j];
        const shared = [...setA].filter((w) => setB.has(w)).length;
        const minSize = Math.min(setA.size, setB.size);
        if (minSize > 0 && shared / minSize > 0.5) return null;
      }
    }

    // --- Check segment-variable name mirroring (per pair, >50% overlap) ---
    for (const seg of segments) {
      const segWords = significantWords(seg.name);
      if (segWords.size === 0) continue;
      for (const varWs of varWordSets) {
        if (varWs.size === 0) continue;
        const shared = [...segWords].filter((w) => varWs.has(w)).length;
        const minSize = Math.min(segWords.size, varWs.size);
        if (minSize > 0 && shared / minSize > 0.5) return null;
      }
    }

    // --- Check weights matrix ---
    const rawWeights = raw.weights as Record<string, Record<string, unknown>>;
    if (!rawWeights || typeof rawWeights !== 'object') return null;

    const weights: Record<string, Record<string, Sensitivity>> = {};
    for (const seg of segments) {
      const segWeights = rawWeights[seg.name];
      if (!segWeights || typeof segWeights !== 'object') return null;
      weights[seg.name] = {};

      let highOrMediumCount = 0;

      for (const v of variables) {
        const val = String(segWeights[v.key]).toUpperCase();
        if (!VALID_SENSITIVITIES.has(val)) return null;
        const sensitivity = val as Sensitivity;
        weights[seg.name][v.key] = sensitivity;

        if (sensitivity === 'HIGH' || sensitivity === 'MEDIUM') { highOrMediumCount++; }
      }

      // Must have at least 3 HIGH or MEDIUM sensitivities
      if (highOrMediumCount < 3) return null;
    }

    return { reasoning, segments, variables, weights };
  } catch {
    return null;
  }
}

const MAX_ATTEMPTS = 3;

export async function generateSegmentsAndVariables(
  client: OpenAI,
  question: string,
  options: string[],
  attachments: Attachment[] = [],
  userSegmentDescriptions?: string[],
): Promise<SegmentFramework | null> {
  const hasUserSegments = userSegmentDescriptions && userSegmentDescriptions.length > 0;

  const userSegmentClause = hasUserSegments
    ? `\n\nThe user has defined the following audience segments. You MUST use exactly these segments (give each a short name and use their descriptions). Do not add, remove, or merge them:\n${userSegmentDescriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')}`
    : '';

  // Allow 1 segment when user-defined
  const minSegments = hasUserSegments ? userSegmentDescriptions.length : 2;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const questionText = `Question: "${question}"\nOptions: ${options.join(', ')}${userSegmentClause}`;
      const response = await client.chat.completions.create({
        model: 'gpt-5.4-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: buildUserContent(questionText, attachments),
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.warn(`[segment-gen] Attempt ${attempt}: empty response`);
        continue;
      }

      const parsed = JSON.parse(content);
      const result = validateFramework(parsed, minSegments);
      if (result) return result;

      console.warn(`[segment-gen] Attempt ${attempt}: validation failed`);
    } catch (err) {
      console.warn(`[segment-gen] Attempt ${attempt}: error`, err);
    }
  }
  return null;
}
