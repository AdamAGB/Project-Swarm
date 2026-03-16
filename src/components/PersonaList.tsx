import type { Persona } from '../types';

interface PersonaListProps {
  personas: Persona[];
}

export function PersonaList({ personas }: PersonaListProps) {
  if (personas.length === 0) {
    return null;
  }

  return (
    <div className="persona-list">
      <h2>2. Generated Personas ({personas.length})</h2>
      <div className="persona-grid">
        {personas.map((persona) => (
          <div key={persona.id} className="persona-card">
            <div className="persona-header">
              <strong>{persona.name}</strong>
              <span className="persona-age">Age {persona.age}</span>
            </div>
            <div className="persona-details">
              <div className="detail-row">
                <span className="label">Income:</span>
                <span>${persona.householdIncome.toLocaleString()}</span>
              </div>
              <div className="detail-row">
                <span className="label">Occupation:</span>
                <span>{persona.demographics.occupation}</span>
              </div>
              <div className="detail-row">
                <span className="label">Education:</span>
                <span>{persona.demographics.education}</span>
              </div>
              <div className="detail-row">
                <span className="label">Location:</span>
                <span>{persona.demographics.location}</span>
              </div>
            </div>
            <p className="persona-background">{persona.background}</p>
            <div className="personality-bars">
              <div className="personality-trait">
                <span className="trait-name">Openness</span>
                <div className="trait-bar">
                  <div
                    className="trait-fill"
                    style={{ width: `${persona.personality.openness}%` }}
                  />
                </div>
              </div>
              <div className="personality-trait">
                <span className="trait-name">Conscientiousness</span>
                <div className="trait-bar">
                  <div
                    className="trait-fill"
                    style={{ width: `${persona.personality.conscientiousness}%` }}
                  />
                </div>
              </div>
              <div className="personality-trait">
                <span className="trait-name">Extraversion</span>
                <div className="trait-bar">
                  <div
                    className="trait-fill"
                    style={{ width: `${persona.personality.extraversion}%` }}
                  />
                </div>
              </div>
              <div className="personality-trait">
                <span className="trait-name">Agreeableness</span>
                <div className="trait-bar">
                  <div
                    className="trait-fill"
                    style={{ width: `${persona.personality.agreeableness}%` }}
                  />
                </div>
              </div>
              <div className="personality-trait">
                <span className="trait-name">Neuroticism</span>
                <div className="trait-bar">
                  <div
                    className="trait-fill"
                    style={{ width: `${persona.personality.neuroticism}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
