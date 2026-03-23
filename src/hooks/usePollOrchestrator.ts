import { useState, useCallback, useRef } from 'react';
import type { Persona, PollProgress, PollResults } from '../types';
import type { PollSubmission } from '../components/PollInput';
import { generatePersonas } from '../engine/persona-generator';
import type { SegmentConfig } from '../engine/persona-generator';
import { computeVotes, computeAggregates } from '../engine/decision-engine';
import { analyzeSegments, selectRepresentativePersonas } from '../engine/segment-analyzer';
import { SeededRandom } from '../engine/seeded-random';
import { createOpenAIClient } from '../services/openai';
import { parseQuestion } from '../services/question-parser';
import { scoreOptions } from '../services/option-scorer';
import { generateComments } from '../services/comment-generator';
import { generateSummary } from '../services/summary-generator';
import { generateQuestionFramework } from '../services/question-framework';
import { parseAudienceSegments } from '../services/audience-parser';
import { useAnimatedVoting } from './useAnimatedVoting';

const PERSONA_COUNT = 5000;

const STAGE_LABELS: Record<string, string[]> = {
  parsing_question: ['Understanding your question...', 'Reading between the lines...', 'Decoding your poll...'],
  parsing_audience: ['Profiling your target audience...', 'Building audience segments...', 'Mapping demographic overrides...'],
  generating_framework: ['Designing evaluation framework...', 'Calibrating dimensions for your domain...', 'Building the scoring lens...'],
  scoring_options: ['Analyzing how each option feels...', 'Sizing up the options...', 'Running perceptual analysis...'],
  generating_personas: ['Assembling the swarm...', `Waking up ${PERSONA_COUNT.toLocaleString()} synthetic minds...`, 'Building your audience...'],
  voting: ['The swarm is voting!', 'Ballots are flying in!', 'Counting every voice...'],
  analyzing_segments: ['Crunching the segments...', 'Finding patterns in the votes...', 'Breaking down the demographics...'],
  generating_comments: ['Personas are writing their thoughts...', 'Hearing from the crowd...', 'Gathering hot takes...'],
  generating_summary: ['Writing the final analysis...', 'Distilling the insights...', 'Preparing your report...'],
};

function getStageLabel(stage: string): string {
  const labels = STAGE_LABELS[stage];
  if (!labels) return '';
  return labels[Math.floor(Math.random() * labels.length)];
}

export function usePollOrchestrator(apiKey: string) {
  const [progress, setProgress] = useState<PollProgress>({
    stage: 'idle',
    stageLabel: '',
    votesCompleted: 0,
    totalVotes: PERSONA_COUNT,
  });
  const [results, setResults] = useState<PollResults | null>(null);
  const personasRef = useRef<Persona[] | null>(null);
  const votesRef = useRef<import('../types').VoteResult[] | null>(null);
  const optionsRef = useRef<string[]>([]);

  const animatedVoting = useAnimatedVoting(
    votesRef.current,
    optionsRef.current,
    progress.stage === 'voting',
  );

  const runPoll = useCallback(async (submission: PollSubmission) => {
    const client = createOpenAIClient(apiKey);
    const rng = new SeededRandom(Date.now());

    setResults(null);
    votesRef.current = null;

    try {
      // Stage 1: Parse question
      setProgress({ stage: 'parsing_question', stageLabel: getStageLabel('parsing_question'), votesCompleted: 0, totalVotes: PERSONA_COUNT });
      const poll = await parseQuestion(client, submission.question, submission.options, submission.allowMultiple);
      poll.audienceConfig = submission.audienceConfig;
      optionsRef.current = poll.options;

      // Stage 2: Parse audience (only if targeting is active)
      let segmentConfig: SegmentConfig | undefined;
      if (submission.audienceConfig.mode !== 'general' && submission.audienceConfig.segments.length > 0) {
        setProgress({ stage: 'parsing_audience', stageLabel: getStageLabel('parsing_audience'), votesCompleted: 0, totalVotes: PERSONA_COUNT });
        const descriptions = submission.audienceConfig.segments.map((s) => s.description);
        const overrides = await parseAudienceSegments(client, descriptions);
        segmentConfig = {
          overrides,
          weights: submission.audienceConfig.segments.map((s) => s.weight),
        };
      }

      // Stage 3: Generate question framework (LLM call)
      setProgress({ stage: 'generating_framework', stageLabel: getStageLabel('generating_framework'), votesCompleted: 0, totalVotes: PERSONA_COUNT });
      const framework = await generateQuestionFramework(client, poll);

      // Stage 4: Score options
      setProgress({ stage: 'scoring_options', stageLabel: getStageLabel('scoring_options'), votesCompleted: 0, totalVotes: PERSONA_COUNT });
      const scoredOptions = await scoreOptions(client, poll, framework);

      // Stage 5: Generate personas (instant, no LLM)
      setProgress({ stage: 'generating_personas', stageLabel: getStageLabel('generating_personas'), votesCompleted: 0, totalVotes: PERSONA_COUNT });
      const personas = generatePersonas(PERSONA_COUNT, undefined, segmentConfig, framework);
      personasRef.current = personas;

      await new Promise((r) => setTimeout(r, 600));

      // Stage 6: Run decision engine (instant, no LLM) + animate
      setProgress({ stage: 'voting', stageLabel: getStageLabel('voting'), votesCompleted: 0, totalVotes: PERSONA_COUNT });
      const votes = computeVotes(personas, scoredOptions, rng, poll.allowMultiple, 0.6, framework);
      votesRef.current = votes;

      await animatedVoting.startAnimation();

      // Stage 7: Analyze segments (instant)
      setProgress({ stage: 'analyzing_segments', stageLabel: getStageLabel('analyzing_segments'), votesCompleted: PERSONA_COUNT, totalVotes: PERSONA_COUNT });
      const aggregates = computeAggregates(votes, poll.options, poll.allowMultiple);
      const segments = analyzeSegments(personas, votes, poll.options, framework);

      await new Promise((r) => setTimeout(r, 400));

      // Stage 8: Generate comments (LLM call)
      setProgress({ stage: 'generating_comments', stageLabel: getStageLabel('generating_comments'), votesCompleted: PERSONA_COUNT, totalVotes: PERSONA_COUNT });
      const representativePersonas = selectRepresentativePersonas(personas, votes);
      const comments = await generateComments(client, poll, representativePersonas, votes, framework);

      // Stage 9: Generate summary (LLM call)
      setProgress({ stage: 'generating_summary', stageLabel: getStageLabel('generating_summary'), votesCompleted: PERSONA_COUNT, totalVotes: PERSONA_COUNT });
      const summary = await generateSummary(client, poll, aggregates, segments, framework);

      const pollResults: PollResults = {
        poll,
        framework,
        scoredOptions,
        votes,
        aggregates,
        segments,
        comments,
        summary,
      };

      setResults(pollResults);
      setProgress({ stage: 'complete', stageLabel: 'Done!', votesCompleted: PERSONA_COUNT, totalVotes: PERSONA_COUNT });
    } catch (err) {
      setProgress({
        stage: 'error',
        stageLabel: 'Something went wrong',
        votesCompleted: 0,
        totalVotes: PERSONA_COUNT,
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [apiKey, animatedVoting]);

  return {
    personas: personasRef.current,
    progress,
    results,
    runPoll,
    animatedVoting,
  };
}
