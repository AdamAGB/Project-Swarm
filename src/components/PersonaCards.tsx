import { useState } from 'react';
import type { Persona, VoteResult } from '../types';
import { ARCHETYPE_LABELS, ARCHETYPE_COLORS } from '../types/persona';

interface Props {
  personas: Persona[];
  votes: VoteResult[];
}

const OPTION_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#3b82f6',
];

export function PersonaCards({ personas, votes }: Props) {
  const [showAll, setShowAll] = useState(false);
  const voteMap = new Map(votes.map((v) => [v.personaId, v.selectedOptions]));

  // Build option color map
  const optionSet = [...new Set(votes.flatMap((v) => v.selectedOptions))];
  const optionColorMap: Record<string, string> = {};
  optionSet.forEach((opt, i) => {
    optionColorMap[opt] = OPTION_COLORS[i % OPTION_COLORS.length];
  });

  // Show 8 diverse personas by default, or all
  const displayPersonas = showAll ? personas : selectDiverse(personas, 8);

  return (
    <div className="persona-cards-section">
      <h2 className="section-title">
        Sample Personas
        <span className="section-subtitle">{personas.length} in the swarm</span>
      </h2>
      <div className="persona-grid">
        {displayPersonas.map((p) => {
          const votedFor = voteMap.get(p.id) || [];
          const archColor = ARCHETYPE_COLORS[p.archetype];
          return (
            <div key={p.id} className="persona-card">
              <div className="persona-card-header">
                <div className="persona-avatar" style={{ borderColor: archColor }}>
                  {p.name[0]}
                </div>
                <div className="persona-info">
                  <span className="persona-name">{p.name}</span>
                  <span className="persona-age">{p.traits.age_band}</span>
                </div>
              </div>
              <span
                className="archetype-badge"
                style={{ backgroundColor: archColor + '20', color: archColor }}
              >
                {ARCHETYPE_LABELS[p.archetype]}
              </span>
              <p className="persona-bio">{p.bio}</p>
              {votedFor.length > 0 && (
                <div className="persona-votes">
                  {votedFor.map((opt) => (
                    <div
                      key={opt}
                      className="persona-vote"
                      style={{ backgroundColor: optionColorMap[opt] + '18', borderColor: optionColorMap[opt] }}
                    >
                      <strong>{opt}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button className="btn-secondary btn-show-more" onClick={() => setShowAll(!showAll)}>
        {showAll ? 'Show Less' : `Show All ${personas.length} Personas`}
      </button>
    </div>
  );
}

function selectDiverse(personas: Persona[], count: number): Persona[] {
  const byArchetype: Record<string, Persona[]> = {};
  for (const p of personas) {
    if (!byArchetype[p.archetype]) byArchetype[p.archetype] = [];
    byArchetype[p.archetype].push(p);
  }
  const selected: Persona[] = [];
  const archetypes = Object.keys(byArchetype);
  let i = 0;
  while (selected.length < count && i < 100) {
    for (const arch of archetypes) {
      if (selected.length >= count) break;
      const pool = byArchetype[arch];
      if (pool.length > 0) {
        selected.push(pool.shift()!);
      }
    }
    i++;
  }
  return selected;
}
