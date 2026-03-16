import type OpenAI from 'openai';
import type { ParsedPoll, VoteAggregates, SegmentAnalysis, PollSummaryText } from '../types';

const SYSTEM_PROMPT = `You summarize AI swarm poll results in an engaging, insightful way.

Write:
- A punchy headline (10-15 words max)
- A 2-3 paragraph body explaining why the winner won and what the results reveal
- 3-5 key insight bullet points

Be specific about which segments preferred what and why. Reference the data provided.
Make it feel like a real analyst wrote this, not generic filler.

Return JSON: { "headline": string, "body": string, "keyInsights": ["...", "...", ...] }`;

function formatSegmentsForPrompt(segments: SegmentAnalysis): string {
  const lines: string[] = [];

  lines.push('BY ARCHETYPE:');
  for (const seg of segments.byArchetype) {
    const topOption = Object.entries(seg.votePercentages)
      .sort((a, b) => b[1] - a[1])[0];
    lines.push(`  ${seg.segmentValue} (n=${seg.totalInSegment}): top pick "${topOption[0]}" at ${topOption[1].toFixed(1)}%`);
  }

  lines.push('\nBY TRAIT SEGMENT (selected):');
  for (const seg of segments.byTrait.filter((s) => s.totalInSegment > 20)) {
    const topOption = Object.entries(seg.votePercentages)
      .sort((a, b) => b[1] - a[1])[0];
    lines.push(`  ${seg.segmentValue} (n=${seg.totalInSegment}): top pick "${topOption[0]}" at ${topOption[1].toFixed(1)}%`);
  }

  return lines.join('\n');
}

export async function generateSummary(
  client: OpenAI,
  poll: ParsedPoll,
  aggregates: VoteAggregates,
  segments: SegmentAnalysis,
): Promise<PollSummaryText> {
  const segmentSummary = formatSegmentsForPrompt(segments);

  const voteSummary = Object.entries(aggregates.voteCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([opt, count]) => `"${opt}": ${count} votes (${aggregates.votePercentages[opt].toFixed(1)}%)`)
    .join(', ');

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Poll context: "${poll.context}"\nPoll type: ${poll.poll_type}\nResponse mode: ${poll.allowMultiple ? 'multiple selections allowed' : 'single choice'}\nTotal personas: ${aggregates.totalPersonas}\n\nResults: ${voteSummary}\nMost selected: "${aggregates.winner}" with ${aggregates.winnerPercentage.toFixed(1)}% of personas\n\nSegment breakdown:\n${segmentSummary}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from summary generator');

  const parsed = JSON.parse(content);

  return {
    headline: String(parsed.headline || 'Poll Complete'),
    body: String(parsed.body || 'Results have been tallied.'),
    keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights.map(String) : [],
  };
}
