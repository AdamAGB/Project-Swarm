// @ts-nocheck
import type { Persona, NumericTraitKey, VoteResult, VoteAggregates } from '../types';
import type { ScoredOptions, OptionScoreVector } from '../types';
import type { QuestionFramework } from '../types/poll';
import { DEFAULT_TRAIT_WEIGHT_MATRIX, DEFAULT_BASELINE_WEIGHTS } from '../data/trait-weight-matrix';
import { SeededRandom } from './seeded-random';

function getNumericTrait(traits: Record<string, unknown>, key: NumericTraitKey): number {
  return (traits[key] as number) ?? 50;
}

function softmax(scores: Record<string, number>, temperature: number): Record<string, number> {
  const entries = Object.entries(scores);
  const maxScore = Math.max(...entries.map(([, s]) => s));
  const exps = entries.map(([k, s]) => [k, Math.exp((s - maxScore) / temperature)] as const);
  const sumExp = exps.reduce((sum, [, e]) => sum + e, 0);
  return Object.fromEntries(exps.map(([k, e]) => [k, e / sumExp]));
}

function computeScores(
  persona: Persona,
  scoredOptions: ScoredOptions,
  rng: SeededRandom,
  weightMatrix: Record<string, [NumericTraitKey, number][]>,
  baselineWeights: Record<string, number>,
): Record<string, number> {
  const optionKeys = Object.keys(scoredOptions.options);
  const dimensions = Object.keys(weightMatrix);
  const scores: Record<string, number> = {};

  for (const optionKey of optionKeys) {
    const optionScores: OptionScoreVector = scoredOptions.options[optionKey];
    let totalScore = 0;

    for (const dimension of dimensions) {
      const optionDimensionValue = (optionScores[dimension] ?? 50) / 100;
      const weights = weightMatrix[dimension];

      for (const [traitKey, multiplier] of weights) {
        const personaTraitValue = getNumericTrait(persona.traits, traitKey) / 100;
        totalScore += personaTraitValue * optionDimensionValue * multiplier;
      }

      const baseline = baselineWeights[dimension] ?? 0;
      if (baseline !== 0) {
        totalScore += optionDimensionValue * baseline;
      }
    }

    const noise = rng.gaussian(0, (getNumericTrait(persona.traits, 'response_randomness') / 100) * 0.12);
    scores[optionKey] = totalScore + noise;
  }

  // Contrarian flip
  if (rng.next() < (getNumericTrait(persona.traits, 'contrarian_tendency') / 100) * 0.08) {
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    if (sorted.length >= 2) {
      const temp = scores[sorted[0][0]];
      scores[sorted[0][0]] = scores[sorted[sorted.length - 1][0]];
      scores[sorted[sorted.length - 1][0]] = temp;
    }
  }

  return scores;
}

export function computeVotes(
  personas: Persona[],
  scoredOptions: ScoredOptions,
  rng: SeededRandom,
  allowMultiple: boolean = false,
  temperature: number = 0.6,
  framework?: QuestionFramework,
): VoteResult[] {
  const weightMatrix = framework?.weightMatrix ?? DEFAULT_TRAIT_WEIGHT_MATRIX;
  const baselineWeights = framework?.baselineWeights ?? DEFAULT_BASELINE_WEIGHTS;

  return personas.map((persona) => {
    const scores = computeScores(persona, scoredOptions, rng, weightMatrix, baselineWeights);
    const probabilities = softmax(scores, temperature);

    if (allowMultiple) {
      // Multi-response: each option is independently selected based on its probability
      // Use a threshold: select options with probability above average, plus some noise
      const avgProb = 1 / Object.keys(probabilities).length;
      const threshold = avgProb * 0.7; // slightly below average so personas pick 1-3 options typically
      const selected: string[] = [];

      for (const [option, prob] of Object.entries(probabilities)) {
        // Higher probability = higher chance of being selected
        // Add persona-specific noise
        const noisy = prob + rng.gaussian(0, 0.08);
        if (noisy >= threshold) {
          selected.push(option);
        }
      }

      // Ensure at least one selection
      if (selected.length === 0) {
        const best = Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0][0];
        selected.push(best);
      }

      const primaryOption = selected.sort((a, b) => probabilities[b] - probabilities[a])[0];

      return {
        personaId: persona.id,
        selectedOption: primaryOption,
        selectedOptions: selected,
        score: scores[primaryOption],
        probability: probabilities[primaryOption],
      };
    } else {
      // Single response: sample one vote
      const selectedOption = rng.weightedChoice(
        Object.entries(probabilities).map(([option, prob]) => ({
          value: option,
          weight: prob,
        }))
      );

      return {
        personaId: persona.id,
        selectedOption,
        selectedOptions: [selectedOption],
        score: scores[selectedOption],
        probability: probabilities[selectedOption],
      };
    }
  });
}

export function computeAggregates(
  votes: VoteResult[],
  options: string[],
  allowMultiple: boolean = false,
): VoteAggregates {
  const voteCounts: Record<string, number> = {};
  for (const opt of options) voteCounts[opt] = 0;

  for (const vote of votes) {
    for (const opt of vote.selectedOptions) {
      voteCounts[opt] = (voteCounts[opt] || 0) + 1;
    }
  }

  const totalPersonas = votes.length;
  // For multi-response, percentages are "% of personas who selected this"
  const votePercentages: Record<string, number> = {};
  for (const opt of options) {
    votePercentages[opt] = totalPersonas > 0 ? (voteCounts[opt] / totalPersonas) * 100 : 0;
  }

  const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0);
  const winner = Object.entries(voteCounts).sort((a, b) => b[1] - a[1])[0][0];

  return {
    totalVotes,
    totalPersonas,
    voteCounts,
    votePercentages,
    winner,
    winnerCount: voteCounts[winner],
    winnerPercentage: votePercentages[winner],
    allowMultiple,
  };
}
