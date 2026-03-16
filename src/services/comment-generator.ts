import type OpenAI from 'openai';
import type { Persona, ParsedPoll, VoteResult, GeneratedComment } from '../types';
import { ARCHETYPE_LABELS } from '../types';

const SYSTEM_PROMPT = `You generate short first-person comments from synthetic survey respondents explaining their vote.

Each respondent has a name, archetype (personality type), and their vote choice. Write 1-2 sentence comments that:
- Are in first person ("I picked..." or "I like..." or "I'd go with...")
- Match their personality archetype
- Reference specific qualities of their chosen option
- Feel natural and conversational, not robotic
- Vary in tone — some enthusiastic, some practical, some skeptical

Budget Conscious Pragmatists focus on value, deals, and practical concerns.
Premium Curious Trend Seekers focus on novelty, branding, and excitement.
Brand Loyal Mainstream Buyers focus on familiarity, trust, and reliability.
Health-Focused Skeptics focus on safety, ingredients, transparency, and are wary of marketing.
Convenience-First Shoppers focus on simplicity, speed, and ease of understanding.

Return JSON: { "comments": [{ "personaId": number, "comment": string }, ...] }`;

export async function generateComments(
  client: OpenAI,
  poll: ParsedPoll,
  representativePersonas: Persona[],
  votes: VoteResult[],
): Promise<GeneratedComment[]> {
  const voteMap = new Map(votes.map((v) => [v.personaId, v.selectedOption]));

  const personaDescriptions = representativePersonas
    .map((p) => {
      const votedFor = voteMap.get(p.id) || 'Unknown';
      return `ID:${p.id} Name:"${p.name}" Archetype:"${ARCHETYPE_LABELS[p.archetype]}" Voted:"${votedFor}"`;
    })
    .join('\n');

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Question context: "${poll.context}"\nOptions: ${poll.options.join(', ')}\n\nRespondents:\n${personaDescriptions}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.8,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from comment generator');

  const parsed = JSON.parse(content);
  const rawComments: { personaId: number; comment: string }[] = parsed.comments || [];

  return rawComments.map((rc) => {
    const persona = representativePersonas.find((p) => p.id === rc.personaId);
    return {
      personaId: rc.personaId,
      personaName: persona?.name || 'Unknown',
      archetype: persona ? ARCHETYPE_LABELS[persona.archetype] : 'Unknown',
      votedFor: voteMap.get(rc.personaId) || 'Unknown',
      comment: rc.comment,
    };
  });
}
