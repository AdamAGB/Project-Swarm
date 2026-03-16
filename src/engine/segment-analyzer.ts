import type { Persona, Archetype, NumericTraitKey, VoteResult, SegmentResult, SegmentAnalysis } from '../types';
import { ARCHETYPE_LABELS } from '../types';

function aggregateSegment(
  segmentName: string,
  segmentValue: string,
  personas: Persona[],
  voteMap: Map<number, string[]>,
  options: string[],
): SegmentResult {
  const voteCounts: Record<string, number> = {};
  for (const opt of options) voteCounts[opt] = 0;

  let total = 0;
  for (const p of personas) {
    const selected = voteMap.get(p.id);
    if (selected) {
      total++;
      for (const opt of selected) {
        voteCounts[opt] = (voteCounts[opt] || 0) + 1;
      }
    }
  }

  const votePercentages: Record<string, number> = {};
  for (const opt of options) {
    votePercentages[opt] = total > 0 ? (voteCounts[opt] / total) * 100 : 0;
  }

  return {
    segmentName,
    segmentValue,
    voteCounts,
    votePercentages,
    totalInSegment: total,
  };
}

const SEGMENTED_TRAITS: { key: NumericTraitKey; label: string }[] = [
  { key: 'novelty_seeking', label: 'Novelty Seeking' },
  { key: 'trust_in_brands', label: 'Trust in Brands' },
  { key: 'premium_willingness', label: 'Premium Willingness' },
  { key: 'price_sensitivity', label: 'Price Sensitivity' },
  { key: 'health_consciousness', label: 'Health Consciousness' },
  { key: 'risk_tolerance', label: 'Risk Tolerance' },
  { key: 'brand_loyalty', label: 'Brand Loyalty' },
  { key: 'convenience_orientation', label: 'Convenience Orientation' },
];

export function analyzeSegments(
  personas: Persona[],
  votes: VoteResult[],
  options: string[],
): SegmentAnalysis {
  const voteMap = new Map(votes.map((v) => [v.personaId, v.selectedOptions]));

  const archetypes: Archetype[] = [
    'budget_conscious_pragmatist',
    'premium_curious_trend_seeker',
    'brand_loyal_mainstream_buyer',
    'health_focused_skeptic',
    'convenience_first_shopper',
  ];

  const byArchetype = archetypes.map((arch) => {
    const filtered = personas.filter((p) => p.archetype === arch);
    return aggregateSegment('Archetype', ARCHETYPE_LABELS[arch], filtered, voteMap, options);
  });

  const byTrait: SegmentResult[] = [];
  for (const { key, label } of SEGMENTED_TRAITS) {
    const high = personas.filter((p) => (p.traits[key] as number) >= 60);
    const low = personas.filter((p) => (p.traits[key] as number) < 40);

    byTrait.push(
      aggregateSegment(label, `High ${label}`, high, voteMap, options),
      aggregateSegment(label, `Low ${label}`, low, voteMap, options),
    );
  }

  // Custom segment analysis
  const customSegmentLabels = new Set<string>();
  for (const p of personas) {
    if (p.customSegment) customSegmentLabels.add(p.customSegment);
  }

  let byCustomSegment: SegmentResult[] | undefined;
  if (customSegmentLabels.size > 0) {
    byCustomSegment = Array.from(customSegmentLabels).map((label) => {
      const filtered = personas.filter((p) => p.customSegment === label);
      return aggregateSegment('Custom Segment', label, filtered, voteMap, options);
    });
  }

  return { byArchetype, byTrait, byCustomSegment };
}

export function selectRepresentativePersonas(
  personas: Persona[],
  votes: VoteResult[],
  count: number = 10,
): Persona[] {
  const voteMap = new Map(votes.map((v) => [v.personaId, v.selectedOption]));
  const selected: Persona[] = [];

  const archetypes: Archetype[] = [
    'budget_conscious_pragmatist',
    'premium_curious_trend_seeker',
    'brand_loyal_mainstream_buyer',
    'health_focused_skeptic',
    'convenience_first_shopper',
  ];

  // Find overall winner
  const optionCounts: Record<string, number> = {};
  for (const v of votes) {
    for (const opt of v.selectedOptions) {
      optionCounts[opt] = (optionCounts[opt] || 0) + 1;
    }
  }
  const winner = Object.entries(optionCounts).sort((a, b) => b[1] - a[1])[0][0];

  for (const arch of archetypes) {
    const archPersonas = personas.filter((p) => p.archetype === arch);
    if (archPersonas.length === 0) continue;

    const majorityVoter = archPersonas.find((p) => voteMap.get(p.id) === winner);
    if (majorityVoter && selected.length < count) {
      selected.push(majorityVoter);
    }

    const minorityVoter = archPersonas.find((p) => voteMap.get(p.id) !== winner);
    if (minorityVoter && selected.length < count) {
      selected.push(minorityVoter);
    }
  }

  return selected;
}
