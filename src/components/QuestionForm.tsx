import { useState } from 'react';

interface QuestionFormProps {
  onVote: (question: string, options: string[]) => void;
  isLoading: boolean;
  disabled: boolean;
  progress?: { current: number; total: number };
}

export function QuestionForm({ onVote, isLoading, disabled, progress }: QuestionFormProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '', '', '']);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const filledOptions = options.filter(opt => opt.trim() !== '');
    if (question.trim() && filledOptions.length >= 2) {
      onVote(question, filledOptions);
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const addOption = () => {
    setOptions([...options, '']);
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const exampleQuestions = [
    { question: 'What is your preferred price point?', options: ['$10/month', '$25/month', '$50/month', '$100/month'] },
    { question: 'Which feature would you use most?', options: ['Analytics', 'Automation', 'Collaboration', 'Integrations'] },
    { question: 'When would you likely make this purchase?', options: ['Within a week', 'Within a month', 'Within 3 months', 'Not sure yet'] },
  ];

  return (
    <div className="question-form">
      <h2>3. Ask a Voting Question</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Enter your voting question..."
          disabled={isLoading || disabled}
          className="question-input"
        />

        <div className="options-section">
          <h3>Options (at least 2 required)</h3>
          {options.map((option, idx) => (
            <div key={idx} className="option-input-group">
              <input
                type="text"
                value={option}
                onChange={(e) => handleOptionChange(idx, e.target.value)}
                placeholder={`Option ${idx + 1}`}
                disabled={isLoading || disabled}
                className="option-input"
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(idx)}
                  disabled={isLoading || disabled}
                  className="btn-remove"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            disabled={isLoading || disabled}
            className="btn-secondary"
          >
            + Add Option
          </button>
        </div>

        <div className="examples">
          <strong>Examples:</strong>
          <ul>
            {exampleQuestions.map((example, idx) => (
              <li key={idx}>
                <button
                  type="button"
                  onClick={() => {
                    setQuestion(example.question);
                    setOptions(example.options);
                  }}
                  disabled={isLoading || disabled}
                  className="example-btn"
                >
                  {example.question}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {progress && (
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
            <span className="progress-text">
              {progress.current} / {progress.total} personas voted
            </span>
          </div>
        )}

        <button
          type="submit"
          disabled={!question.trim() || options.filter(o => o.trim()).length < 2 || isLoading || disabled}
          className="btn-primary btn-large"
        >
          {isLoading ? 'Collecting Votes...' : 'Collect Votes from All Personas'}
        </button>
      </form>
    </div>
  );
}
