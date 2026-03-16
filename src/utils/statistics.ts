import type { RatingResult, Statistics, VotingResult, VotingStatistics } from '../types';

export function calculateStatistics(ratings: RatingResult[]): Statistics {
  if (ratings.length === 0) {
    return {
      mean: 0,
      median: 0,
      stdev: 0,
      mode: 0,
      distribution: {},
    };
  }

  const values = ratings.map(r => r.rating);

  // Calculate mean
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;

  // Calculate median
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];

  // Calculate standard deviation
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  const stdev = Math.sqrt(variance);

  // Calculate mode and distribution
  const distribution: { [key: number]: number } = {};
  values.forEach(val => {
    distribution[val] = (distribution[val] || 0) + 1;
  });

  let mode = values[0];
  let maxCount = 0;
  Object.entries(distribution).forEach(([value, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mode = Number(value);
    }
  });

  return {
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
    stdev: Math.round(stdev * 100) / 100,
    mode,
    distribution,
  };
}

export function calculateVotingStatistics(votes: VotingResult[]): VotingStatistics {
  const voteCounts: { [option: string]: number } = {};
  const totalVotes = votes.length;

  votes.forEach(vote => {
    const option = vote.selectedOption;
    voteCounts[option] = (voteCounts[option] || 0) + 1;
  });

  const votePercentages: { [option: string]: number } = {};
  Object.entries(voteCounts).forEach(([option, count]) => {
    votePercentages[option] = Math.round((count / totalVotes) * 100 * 100) / 100;
  });

  return {
    totalVotes,
    voteCounts,
    votePercentages,
  };
}
