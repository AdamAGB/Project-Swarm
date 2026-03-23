import type OpenAI from 'openai';
import type { Variable, ScoringPass, OptionScoreResult } from '../types/v2';

/* ------------------------------------------------------------------ */
/*  Lens definitions                                                   */
/* ------------------------------------------------------------------ */

const LENSES = [
  {
    name: 'Baseline Consumer',
    instruction:
      'Score the options using plain common-sense perception from a neutral average respondent, focusing on how the option would generally be interpreted without overthinking or specialized knowledge.',
  },
  {
    name: 'Strict Literal',
    instruction:
      "Score the options by applying each variable definition as literally and narrowly as possible, resisting vibes, metaphor, or loose associations, so a score only goes high if the option clearly and directly fits that variable's definition.",
  },
  {
    name: 'Critical/Skeptical',
    instruction:
      'Score the options while actively looking for reasons a score may be overstated, inflated, or misleading, pushing back on overly generous interpretations and checking whether the option really deserves to rank high on that variable rather than merely seeming somewhat related to it.',
  },
] as const;

const MAX_ATTEMPTS = 3;

/* ------------------------------------------------------------------ */
/*  Fuzzy option-key matching (kept from prior version)                */
/* ------------------------------------------------------------------ */

function findOptionInArray(arr: unknown[], option: string): boolean {
  const lower = option.toLowerCase().trim();
  for (const item of arr) {
    const s = String(item).toLowerCase().trim();
    if (s === lower) return true;
    const stripped = s.replace(/^\d+[\.\)]\s*/, '').trim();
    if (stripped === lower) return true;
  }
  return false;
}

/** Map a raw array of option names (from LLM) to canonical option order, returning the rank for each. */
function resolveRankArray(
  rawArray: unknown[],
  options: string[],
): Record<string, number> | null {
  if (!Array.isArray(rawArray) || rawArray.length !== options.length) return null;

  // Verify every canonical option appears in the array
  for (const option of options) {
    if (!findOptionInArray(rawArray, option)) return null;
  }

  const result: Record<string, number> = {};
  for (const option of options) {
    const lower = option.toLowerCase().trim();
    const rank = rawArray.findIndex((item) => {
      const s = String(item).toLowerCase().trim();
      if (s === lower) return true;
      return s.replace(/^\d+[\.\)]\s*/, '').trim() === lower;
    });
    result[option] = rank + 1; // 1-indexed
  }
  return result;
}

/* ------------------------------------------------------------------ */
/*  Step 1 — Generate baseline variable definitions                    */
/* ------------------------------------------------------------------ */

function buildDefinitionsPrompt(
  question: string,
  options: string[],
  variables: Variable[],
): string {
  const varList = variables
    .map((v) => `- ${v.key} (${v.label}): ${v.description}`)
    .join('\n');

  return `You are establishing baseline definitions for evaluation variables that will be used to rank poll options.

Question: "${question}"
Options: ${options.map((o, i) => `${i + 1}. ${o}`).join(', ')}

The following variables have been identified for evaluating these options:
${varList}

For each variable, write a precise, 1-2 sentence operational definition that:
- Makes clear what "ranking high" vs "ranking low" means for that specific variable
- Is grounded in the specific context of this question and these options
- Avoids vague or subjective language — make it concrete enough that two independent raters would agree

Return JSON: { "definitions": { "variable_key": "Your operational definition here.", ... } }`;
}

async function generateDefinitions(
  client: OpenAI,
  question: string,
  options: string[],
  variables: Variable[],
): Promise<Record<string, string> | null> {
  const variableKeys = variables.map((v) => v.key);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const prompt = buildDefinitionsPrompt(question, options, variables);
      const response = await client.chat.completions.create({
        model: 'gpt-5.4-mini',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: 'Define the variables now.' },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.warn(`[option-scorer-v2] definitions attempt ${attempt}: empty response`);
        continue;
      }

      const parsed = JSON.parse(content);
      const raw = parsed.definitions || parsed;

      if (!raw || typeof raw !== 'object') {
        console.warn(`[option-scorer-v2] definitions attempt ${attempt}: bad shape`, raw);
        continue;
      }

      // Validate every variable key has a string definition
      const definitions: Record<string, string> = {};
      let valid = true;
      for (const key of variableKeys) {
        if (typeof raw[key] !== 'string' || raw[key].trim().length === 0) {
          console.warn(`[option-scorer-v2] definitions attempt ${attempt}: missing key "${key}"`);
          valid = false;
          break;
        }
        definitions[key] = raw[key].trim();
      }
      if (valid) return definitions;
    } catch (err) {
      console.warn(`[option-scorer-v2] definitions attempt ${attempt}: error`, err);
    }
  }

  console.warn('[option-scorer-v2] All definition attempts failed');
  return null;
}

/* ------------------------------------------------------------------ */
/*  Step 2 — Rank options under one lens                               */
/* ------------------------------------------------------------------ */

function buildRankingPrompt(
  lens: { name: string; instruction: string },
  question: string,
  options: string[],
  variables: Variable[],
  definitions: Record<string, string>,
): string {
  const defLines = variables
    .map((v) => `- ${v.key} (${v.label}): ${definitions[v.key]}`)
    .join('\n');

  return `You are ranking poll answer options on evaluation variables using a specific analytical lens.

YOUR LENS: ${lens.name}
${lens.instruction}

Question: "${question}"
Options: ${options.map((o, i) => `${i + 1}. ${o}`).join(', ')}

Variable Definitions (apply these consistently):
${defLines}

TASK: For EACH variable, produce a strict ranking of ALL options from best (rank 1) to worst (rank ${options.length}).
- Every option must appear exactly once per variable.
- No ties are allowed — force a ranking even when options seem similar.
- Apply your lens (${lens.name}) when making judgment calls.
- Use the EXACT option text as array elements.

Return JSON: { "rankings": { "variable_key": ["Best option text", "Second best", ...], ... } }`;
}

function parseRankingResponse(
  content: string,
  options: string[],
  variableKeys: string[],
): Record<string, Record<string, number>> | null {
  try {
    const parsed = JSON.parse(content);
    const raw = parsed.rankings || parsed;

    if (!raw || typeof raw !== 'object') return null;

    const result: Record<string, Record<string, number>> = {};
    // Initialize option → variable map
    for (const option of options) {
      result[option] = {};
    }

    for (const key of variableKeys) {
      const arr = raw[key];
      if (!Array.isArray(arr)) {
        console.warn(`[option-scorer-v2] Variable "${key}" is not an array:`, arr);
        return null;
      }

      const ranks = resolveRankArray(arr, options);
      if (!ranks) {
        console.warn(`[option-scorer-v2] Could not resolve ranks for "${key}". Array: ${JSON.stringify(arr)}, Options: ${JSON.stringify(options)}`);
        return null;
      }

      for (const option of options) {
        result[option][key] = ranks[option];
      }
    }

    return result;
  } catch (err) {
    console.warn('[option-scorer-v2] Failed to parse ranking response:', err);
    return null;
  }
}

async function rankOneLens(
  client: OpenAI,
  lens: { name: string; instruction: string },
  question: string,
  options: string[],
  variables: Variable[],
  definitions: Record<string, string>,
): Promise<ScoringPass | null> {
  const variableKeys = variables.map((v) => v.key);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const prompt = buildRankingPrompt(lens, question, options, variables, definitions);
      const response = await client.chat.completions.create({
        model: 'gpt-5.4-mini',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: 'Rank the options now.' },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.warn(`[option-scorer-v2] ${lens.name} attempt ${attempt}: empty response`);
        continue;
      }

      const rankings = parseRankingResponse(content, options, variableKeys);
      if (!rankings) {
        console.warn(`[option-scorer-v2] ${lens.name} attempt ${attempt}: failed to parse rankings`);
        continue;
      }

      return {
        lens: lens.name,
        description: lens.instruction,
        rankings,
      };
    } catch (err) {
      console.warn(`[option-scorer-v2] ${lens.name} attempt ${attempt}: error`, err);
    }
  }

  console.warn(`[option-scorer-v2] ${lens.name}: all ${MAX_ATTEMPTS} attempts failed`);
  return null;
}

/* ------------------------------------------------------------------ */
/*  Step 3 — Average rankings across lenses                            */
/* ------------------------------------------------------------------ */

function averageRankings(
  passes: ScoringPass[],
  options: string[],
  variableKeys: string[],
): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};

  for (const option of options) {
    result[option] = {};
    for (const key of variableKeys) {
      let sum = 0;
      let count = 0;
      for (const pass of passes) {
        const rank = pass.rankings[option]?.[key];
        if (rank != null) {
          sum += rank;
          count++;
        }
      }
      result[option][key] = count > 0 ? Math.round((sum / count) * 10) / 10 : options.length;
    }
  }

  return result;
}

/* ------------------------------------------------------------------ */
/*  Main entry point                                                   */
/* ------------------------------------------------------------------ */

export async function scoreOptionsV2(
  client: OpenAI,
  question: string,
  options: string[],
  variables: Variable[],
): Promise<OptionScoreResult | null> {
  const variableKeys = variables.map((v) => v.key);

  // Step 1: Generate baseline definitions
  const definitions = await generateDefinitions(client, question, options, variables);
  if (!definitions) return null;

  // Step 2: Run all 3 lenses in parallel
  const results = await Promise.all(
    LENSES.map((lens) =>
      rankOneLens(client, lens, question, options, variables, definitions),
    ),
  );

  const passes = results.filter((r): r is ScoringPass => r !== null);

  if (passes.length === 0) {
    console.warn('[option-scorer-v2] All lens ranking calls failed');
    return null;
  }

  // Step 3: Average rankings
  const rankings = averageRankings(passes, options, variableKeys);

  return {
    rankings,
    definitions,
    passes,
  };
}
