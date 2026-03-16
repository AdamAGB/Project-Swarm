import type { AgeBand, Gender, Region, Urbanicity, IncomeBand, EducationLevel, HouseholdType, ChannelPreference } from '../types';
import type { WeightedOption } from '../engine/seeded-random';

export const AGE_BAND_DISTRIBUTION: WeightedOption<AgeBand>[] = [
  { value: '18-24', weight: 0.13 },
  { value: '25-34', weight: 0.22 },
  { value: '35-44', weight: 0.20 },
  { value: '45-54', weight: 0.18 },
  { value: '55-64', weight: 0.15 },
  { value: '65+', weight: 0.12 },
];

export const GENDER_DISTRIBUTION: WeightedOption<Gender>[] = [
  { value: 'male', weight: 0.48 },
  { value: 'female', weight: 0.48 },
  { value: 'non_binary', weight: 0.04 },
];

export const REGION_DISTRIBUTION: WeightedOption<Region>[] = [
  { value: 'northeast', weight: 0.17 },
  { value: 'southeast', weight: 0.24 },
  { value: 'midwest', weight: 0.21 },
  { value: 'southwest', weight: 0.12 },
  { value: 'west', weight: 0.16 },
  { value: 'pacific', weight: 0.10 },
];

export const URBANICITY_DISTRIBUTION: WeightedOption<Urbanicity>[] = [
  { value: 'urban', weight: 0.31 },
  { value: 'suburban', weight: 0.52 },
  { value: 'rural', weight: 0.17 },
];

export const INCOME_BAND_DISTRIBUTION: WeightedOption<IncomeBand>[] = [
  { value: 'under_25k', weight: 0.12 },
  { value: '25k_50k', weight: 0.20 },
  { value: '50k_75k', weight: 0.22 },
  { value: '75k_100k', weight: 0.18 },
  { value: '100k_150k', weight: 0.16 },
  { value: '150k_plus', weight: 0.12 },
];

export const EDUCATION_LEVEL_DISTRIBUTION: WeightedOption<EducationLevel>[] = [
  { value: 'high_school', weight: 0.27 },
  { value: 'some_college', weight: 0.20 },
  { value: 'bachelors', weight: 0.32 },
  { value: 'masters', weight: 0.14 },
  { value: 'doctorate', weight: 0.07 },
];

export const HOUSEHOLD_TYPE_DISTRIBUTION: WeightedOption<HouseholdType>[] = [
  { value: 'single', weight: 0.28 },
  { value: 'couple_no_kids', weight: 0.15 },
  { value: 'young_family', weight: 0.18 },
  { value: 'established_family', weight: 0.16 },
  { value: 'empty_nester', weight: 0.12 },
  { value: 'retired', weight: 0.11 },
];

export const CHANNEL_PREFERENCE_DISTRIBUTION: WeightedOption<ChannelPreference>[] = [
  { value: 'online_only', weight: 0.15 },
  { value: 'online_preferred', weight: 0.30 },
  { value: 'no_preference', weight: 0.25 },
  { value: 'store_preferred', weight: 0.20 },
  { value: 'store_only', weight: 0.10 },
];

export const AGE_BAND_LABELS: Record<AgeBand, string> = {
  '18-24': '18-24',
  '25-34': '25-34',
  '35-44': '35-44',
  '45-54': '45-54',
  '55-64': '55-64',
  '65+': '65+',
};

export const REGION_LABELS: Record<Region, string> = {
  northeast: 'Northeast',
  southeast: 'Southeast',
  midwest: 'Midwest',
  southwest: 'Southwest',
  west: 'West',
  pacific: 'Pacific',
};

export const URBANICITY_LABELS: Record<Urbanicity, string> = {
  urban: 'urban',
  suburban: 'suburban',
  rural: 'rural',
};

export const INCOME_BAND_LABELS: Record<IncomeBand, string> = {
  under_25k: 'Under $25K',
  '25k_50k': '$25K-$50K',
  '50k_75k': '$50K-$75K',
  '75k_100k': '$75K-$100K',
  '100k_150k': '$100K-$150K',
  '150k_plus': '$150K+',
};

export const EDUCATION_LABELS: Record<EducationLevel, string> = {
  high_school: 'High School',
  some_college: 'Some College',
  bachelors: "Bachelor's",
  masters: "Master's",
  doctorate: 'Doctorate',
};

export const HOUSEHOLD_LABELS: Record<HouseholdType, string> = {
  single: 'Single',
  couple_no_kids: 'Couple, No Kids',
  young_family: 'Young Family',
  established_family: 'Established Family',
  empty_nester: 'Empty Nester',
  retired: 'Retired',
};
