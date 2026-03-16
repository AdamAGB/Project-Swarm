import type { Archetype, Persona } from '../types';
import { REGION_LABELS, URBANICITY_LABELS, INCOME_BAND_LABELS, EDUCATION_LABELS, HOUSEHOLD_LABELS } from './trait-distributions';
import { REGION_CITIES } from './name-bank';
import { SeededRandom } from '../engine/seeded-random';

interface BioTemplate {
  template: string;
  condition?: (p: Persona) => boolean;
}

const ARCHETYPE_TEMPLATES: Record<Archetype, BioTemplate[]> = {
  budget_conscious_pragmatist: [
    { template: '{name} is a {age} {urbanicity} {region} shopper who always looks for the best deal. {pronoun} compares prices carefully before buying.' },
    { template: 'A {age} {household} from {city}, {name} stretches every dollar. {pronoun} clips coupons and waits for sales.' },
    { template: '{name}, {age}, lives in {urbanicity} {region}. With {income} income, {pronoun_lower} prioritizes value over brand names.' },
    { template: 'From {city}, {name} ({age}) is practical and budget-minded. {pronoun} rarely buys on impulse and sticks to what works.' },
    { template: '{name} is a {age} {education} from the {region}. {pronoun} believes you don\'t need to overpay for quality.' },
    { template: 'As a {household} in {city}, {name} ({age}) is careful with money. {pronoun} reads reviews and hunts for bargains.' },
  ],
  premium_curious_trend_seeker: [
    { template: '{name} is a {age} trendsetter from {city} who loves discovering new products. {pronoun} doesn\'t mind paying more for something exciting.' },
    { template: 'A {age} {education} in {urbanicity} {region}, {name} is always the first to try new things. {pronoun} follows brands on social media.' },
    { template: '{name}, {age}, lives in {city} and keeps up with the latest trends. {pronoun} values quality and uniqueness over savings.' },
    { template: 'From {urbanicity} {region}, {name} ({age}) seeks out premium and innovative products. {pronoun} loves recommending discoveries to friends.' },
    { template: '{name} is a {age} {household} who gravitates toward premium brands. Living in {city}, {pronoun_lower} has a taste for the new and different.' },
    { template: 'As a {age} {region} resident, {name} is drawn to brands that stand out. {pronoun} enjoys the thrill of finding something unique.' },
  ],
  brand_loyal_mainstream_buyer: [
    { template: '{name} is a {age} {household} from {city} who sticks with brands {pronoun_lower} knows and trusts.' },
    { template: 'A {age} {urbanicity} {region} shopper, {name} has been buying the same brands for years. {pronoun} values reliability.' },
    { template: '{name}, {age}, lives in {city}. {pronoun} prefers familiar names and doesn\'t switch brands without a good reason.' },
    { template: 'From {urbanicity} {region}, {name} ({age}) is a loyal customer. When {pronoun_lower} finds something that works, {pronoun_lower} sticks with it.' },
    { template: '{name} is a {age} {education} who shops based on trust. Living in {city}, {pronoun_lower} recommends trusted brands to family.' },
    { template: 'As a {household} in the {region}, {name} ({age}) values consistency. {pronoun} buys what {pronoun_lower} knows will deliver.' },
  ],
  health_focused_skeptic: [
    { template: '{name} is a {age} health-conscious shopper from {city} who reads every label. {pronoun} is skeptical of marketing claims.' },
    { template: 'A {age} {education} in {urbanicity} {region}, {name} prioritizes health and quality. {pronoun} questions everything brands say.' },
    { template: '{name}, {age}, lives in {city} and takes wellness seriously. {pronoun} does deep research before trying anything new.' },
    { template: 'From {urbanicity} {region}, {name} ({age}) won\'t buy something just because it\'s popular. {pronoun} wants proof it\'s good for you.' },
    { template: '{name} is a {age} {household} who values organic and natural products. Living in {city}, {pronoun_lower} is wary of buzzwords.' },
    { template: 'As a {age} {region} resident, {name} trusts science over advertising. {pronoun} is picky about ingredients and sourcing.' },
  ],
  convenience_first_shopper: [
    { template: '{name} is a {age} {household} from {city} who values speed and ease. {pronoun} doesn\'t have time to overthink purchases.' },
    { template: 'A busy {age} in {urbanicity} {region}, {name} grabs what\'s convenient. {pronoun} prefers quick decisions over research.' },
    { template: '{name}, {age}, lives in {city} and shops for efficiency. If it\'s easy and available, {pronoun_lower} is buying it.' },
    { template: 'From {urbanicity} {region}, {name} ({age}) optimizes for time. {pronoun} uses delivery services and auto-reorders favorites.' },
    { template: '{name} is a {age} {education} who hates complicated shopping. Living in {city}, {pronoun_lower} picks what comes recommended and moves on.' },
    { template: 'As a {household} in {city}, {name} ({age}) doesn\'t have time to compare. {pronoun} buys what\'s familiar and fast.' },
  ],
};

function getPronoun(gender: string): { pronoun: string; pronoun_lower: string } {
  switch (gender) {
    case 'male': return { pronoun: 'He', pronoun_lower: 'he' };
    case 'female': return { pronoun: 'She', pronoun_lower: 'she' };
    default: return { pronoun: 'They', pronoun_lower: 'they' };
  }
}

export function generateBio(persona: Persona, rng: SeededRandom): string {
  const templates = ARCHETYPE_TEMPLATES[persona.archetype];
  const template = rng.pick(templates);

  const { pronoun, pronoun_lower } = getPronoun(persona.traits.gender);
  const city = rng.pick(REGION_CITIES[persona.traits.region] || ['a small town']);

  const bio = template.template
    .replace(/\{name\}/g, persona.name)
    .replace(/\{age\}/g, persona.traits.age_band)
    .replace(/\{urbanicity\}/g, URBANICITY_LABELS[persona.traits.urbanicity])
    .replace(/\{region\}/g, REGION_LABELS[persona.traits.region])
    .replace(/\{city\}/g, city)
    .replace(/\{household\}/g, HOUSEHOLD_LABELS[persona.traits.household_type].toLowerCase())
    .replace(/\{income\}/g, INCOME_BAND_LABELS[persona.traits.income_band])
    .replace(/\{education\}/g, EDUCATION_LABELS[persona.traits.education_level].toLowerCase())
    .replace(/\{pronoun\}/g, pronoun)
    .replace(/\{pronoun_lower\}/g, pronoun_lower);

  return bio;
}
