import type OpenAI from 'openai';
import type { Persona, ParsedPoll, VoteResult, GeneratedComment } from '../types';
import { getArchetypeLabels } from '../types';
import type { QuestionFramework } from '../types/poll';
import { CONSUMER_FALLBACK_FRAMEWORK } from './question-framework';

function buildSystemPrompt(framework: QuestionFramework): string {
  const labels = framework.archetypeLabels;
  const descs = framework.archetypeDescriptions;

  const archetypeLines = Object.entries(labels)
    .map(([key, label]) => `${label}: ${descs[key as keyof typeof descs]}`)
    .join('\n');

  return `You generate short first-person comments from synthetic survey respondents explaining their vote.

Each respondent has a name, archetype (personality type), and their vote choice. Write 1-2 sentence comments that:
- Are in first person ("I picked..." or "I like..." or "I'd go with...")
- Match their personality archetype
- Reference specific qualities of their chosen option
- Feel natural and conversational, not robotic
- Vary in tone — some enthusiastic, some practical, some skeptical

${archetypeLines}

Return JSON: { "comments": [{ "personaId": number, "comment": string }, ...] }`;
}

export async function generateComments(
  client: OpenAI,
  poll: ParsedPoll,
  representativePersonas: Persona[],
  votes: VoteResult[],
  framework?: QuestionFramework,
): Promise<GeneratedComment[]> {
  const fw = framework ?? CONSUMER_FALLBACK_FRAMEWORK;
  const labels = getArchetypeLabels(fw);
  const voteMap = new Map(votes.map((v) => [v.personaId, v.selectedOption]));

  const personaDescriptions = representativePersonas
    .map((p) => {
      const votedFor = voteMap.get(p.id) || 'Unknown';
      return `ID:${p.id} Name:"${p.name}" Archetype:"${labels[p.archetype]}" Voted:"${votedFor}"`;
    })
    .join('\n');

  const response = await client.chat.completions.create({
    model: 'gpt-5.4-mini',
    messages: [
      { role: 'system', content: buildSystemPrompt(fw) },
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
      archetype: persona ? labels[persona.archetype] : 'Unknown',
      votedFor: voteMap.get(rc.personaId) || 'Unknown',
      comment: rc.comment,
    };
  });
}
