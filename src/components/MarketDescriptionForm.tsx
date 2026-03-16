import { useState } from 'react';

interface MarketDescriptionFormProps {
  onGenerate: (description: string) => void;
  isLoading: boolean;
  disabled: boolean;
}

export function MarketDescriptionForm({ onGenerate, isLoading, disabled }: MarketDescriptionFormProps) {
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim()) {
      onGenerate(description);
    }
  };

  const exampleDescriptions = [
    'Tech-savvy millennials in urban areas with $50k-$150k household income',
    'Parents with young children, suburban areas, middle-income households',
    'Retired professionals aged 60-75 with substantial savings',
    'College students and recent graduates, entry-level income',
  ];

  return (
    <div className="market-form">
      <h2>1. Describe Your Market</h2>
      <form onSubmit={handleSubmit}>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the market you want to research... (e.g., demographics, income range, interests, location)"
          rows={4}
          disabled={isLoading || disabled}
          className="market-textarea"
        />
        <div className="examples">
          <strong>Examples:</strong>
          <ul>
            {exampleDescriptions.map((example, idx) => (
              <li key={idx}>
                <button
                  type="button"
                  onClick={() => setDescription(example)}
                  disabled={isLoading || disabled}
                  className="example-btn"
                >
                  {example}
                </button>
              </li>
            ))}
          </ul>
        </div>
        {isLoading && (
          <div className="progress-bar">
            <div className="progress-fill-animated" />
            <span className="progress-text">Generating 50 personas...</span>
          </div>
        )}
        <button
          type="submit"
          disabled={!description.trim() || isLoading || disabled}
          className="btn-primary btn-large"
        >
          {isLoading ? 'Generating Personas...' : 'Generate 50 Personas'}
        </button>
      </form>
    </div>
  );
}
