import type OpenAI from 'openai';
import type { SegmentFramework, V2SegmentVoteResult } from '../types/v2';

export interface GeneratedPersona {
  name: string;
  segment: string;
  vote: string;
  comment: string;
}

export async function generatePersonas(
  client: OpenAI,
  question: string,
  options: string[],
  segmentVotes: V2SegmentVoteResult[],
  framework: SegmentFramework,
): Promise<GeneratedPersona[]> {
  const totalPersonas = Math.min(segmentVotes.length * 3, 15);

  const segmentDescriptions = segmentVotes.map((sv) => {
    const seg = framework.segments.find((s) => s.name === sv.segmentName);
    const voteBreakdown = options
      .map((opt) => `${opt}: ${sv.votePercentages[opt]?.toFixed(1) ?? 0}%`)
      .join(', ');
    return `- ${sv.segmentName} (${Math.round(sv.populationShare * 100)}% of population): ${seg?.description ?? ''}\n  Votes: ${voteBreakdown}`;
  }).join('\n');

  const personasPerSegment = segmentVotes.map((sv) => {
    const count = Math.max(2, Math.round(sv.populationShare * totalPersonas));
    return `${sv.segmentName}: ${count} personas`;
  }).join(', ');

  const response = await client.chat.completions.create({
    model: 'gpt-5.4-mini',
    messages: [
      {
        role: 'system',
        content: `You generate fictional survey respondents who give short first-person opinions explaining their vote.

For each persona, provide:
- A realistic first name
- Their segment
- Which option they voted for (distribute votes roughly proportional to that segment's vote percentages)
- A 1-2 sentence first-person comment that feels natural and conversational

Vary the tone: some enthusiastic, some practical, some reluctant. Comments should reference specific qualities of their chosen option. Do NOT start every comment with "I".

Return JSON: { "personas": [{ "name": string, "segment": string, "vote": string, "comment": string }, ...] }`,
      },
      {
        role: 'user',
        content: `Question: "${question}"
Options: ${options.join(', ')}

Segments and vote distributions:
${segmentDescriptions}

Generate approximately this many per segment: ${personasPerSegment}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.8,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from persona generator');

  const parsed = JSON.parse(content);
  return (parsed.personas || []) as GeneratedPersona[];
}
