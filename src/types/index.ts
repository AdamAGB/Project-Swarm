export interface Persona {
  id: number;
  name: string;
  age: number;
  householdIncome: number;
  personality: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  background: string;
  demographics: {
    education: string;
    occupation: string;
    location: string;
  };
}

export interface RatingResult {
  personaId: number;
  rating: number;
  reasoning?: string;
}

export interface Statistics {
  mean: number;
  median: number;
  stdev: number;
  mode: number;
  distribution: { [key: number]: number };
}

export interface VotingResult {
  personaId: number;
  selectedOption: string;
  reasoning?: string;
}

export interface VotingStatistics {
  totalVotes: number;
  voteCounts: { [option: string]: number };
  votePercentages: { [option: string]: number };
}
