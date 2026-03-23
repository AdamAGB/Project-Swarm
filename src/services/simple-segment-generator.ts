import type OpenAI from 'openai';

export interface SimpleSegment {
  name: string;
  description: string;
  populationShare: number;
}

const MAX_ATTEMPTS = 3;

const SYSTEM_PROMPT = `Given a poll question and its options, identify 3 groups of people who would answer this question differently from each other.

Think about it like this: if you asked this question to 100 random people, what are the 3 main "camps" they'd fall into? Not marketing personas or corporate segments — just plain groups of real people with different perspectives.

Rules:
- Exactly 3 groups
- CRITICAL: Group names and descriptions must NEVER reference any of the poll options. The groups describe WHO is answering, not WHAT they'd answer. "Rocky IV fans" is banned if "Rocky IV" is an option. "Action movie lovers" is fine. "People who saw them all in theaters" is fine.
- Names should be simple and human (e.g. "People who grew up with it", "Casual viewers", "Never seen it") — NOT corporate jargon like "Value-Oriented Pragmatists"
- Descriptions should be 1 sentence, conversational, like you're explaining to a friend
- Population shares must be realistic percentages that sum to 100. One group can be much bigger than the others if that's realistic.
- The groups should actually disagree on the question — if two groups would vote the same way, merge them

Return JSON: { "segments": [{ "name": "Group name", "description": "Who they are in plain English", "populationShare": 55 }, ...] }`;

export async function generateSimpleSegments(
  client: OpenAI,
  question: string,
  options: string[],
): Promise<SimpleSegment[]> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: 'gpt-5.4-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Question: "${question}"\nOptions: ${options.join(', ')}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.warn(`[simple-segment-gen] Attempt ${attempt}: empty response`);
        continue;
      }

      const parsed = JSON.parse(content);
      const segments = parsed.segments;

      if (!Array.isArray(segments) || segments.length !== 3) {
        console.warn(`[simple-segment-gen] Attempt ${attempt}: expected 3 segments, got ${segments?.length}`);
        continue;
      }

      const result: SimpleSegment[] = segments.map((s: Record<string, unknown>) => ({
        name: String(s.name ?? ''),
        description: String(s.description ?? ''),
        populationShare: Number(s.populationShare) || 33,
      }));

      // Validate all have names
      if (result.some((s) => s.name.trim().length === 0)) {
        console.warn(`[simple-segment-gen] Attempt ${attempt}: empty segment name`);
        continue;
      }

      // Reject if any segment name contains an option (biased segment)
      const optionsLower = options.map((o) => o.toLowerCase().trim());
      const hasBias = result.some((s) => {
        const nameLower = s.name.toLowerCase();
        return optionsLower.some((o) => nameLower.includes(o) || o.includes(nameLower));
      });
      if (hasBias) {
        console.warn(`[simple-segment-gen] Attempt ${attempt}: segment name references an option, retrying`);
        continue;
      }

      // Normalize shares to sum to 1.0
      const total = result.reduce((sum, s) => sum + s.populationShare, 0);
      for (const s of result) {
        s.populationShare = s.populationShare / total;
      }

      return result;
    } catch (err) {
      console.warn(`[simple-segment-gen] Attempt ${attempt}: error`, err);
    }
  }

  // Fallback: generic three-way split
  return [
    { name: 'Enthusiasts', description: 'People who are excited about this topic', populationShare: 0.4 },
    { name: 'Skeptics', description: 'People who are cautious or doubtful', populationShare: 0.35 },
    { name: 'Indifferent', description: 'People who don\'t have a strong opinion either way', populationShare: 0.25 },
  ];
}
