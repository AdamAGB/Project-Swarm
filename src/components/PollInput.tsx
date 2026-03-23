import { useState, useEffect, useRef } from 'react';
import type { AudienceConfig, AudienceMode } from '../types/poll';

export interface PollSubmission {
  question: string;
  options: string[];
  allowMultiple: boolean;
  audienceConfig: AudienceConfig;
}

type AudienceSource = 'default' | 'user' | 'inferred';

interface Props {
  onSubmit: (submission: PollSubmission) => void;
  disabled: boolean;
  isLoading: boolean;
  onInferAudience?: (question: string) => Promise<string | null>;
  onGenerateOptions?: (question: string) => Promise<string[] | null>;
}

const EXAMPLES: { question: string; options: string[] }[] = [
  {
    question: "I'm starting an organic cat food company. Which name is best?",
    options: ['Whiskers', 'Meowmix', 'ChocolatePetFood'],
  },
  {
    question: 'Which name sounds best for a premium coffee brand?',
    options: ['Ember Roast', 'Morning Ritual', 'Bean & Bold'],
  },
  {
    question: "I'm naming a kids' coding school. Which name?",
    options: ['CodeSprouts', 'ByteSize Academy', 'Little Hackers'],
  },
];

const AUDIENCE_MODE_LABELS: Record<AudienceMode, string> = {
  general: 'General Population',
  single: 'Single Segment',
  multi: 'Multiple Segments',
};

export function PollInput({ onSubmit, disabled, isLoading, onInferAudience, onGenerateOptions }: Props) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [suggestedOptions, setSuggestedOptions] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('general');
  const [segmentDescriptions, setSegmentDescriptions] = useState<string[]>(['']);
  const [segmentWeights, setSegmentWeights] = useState<number[]>([1]);
  const [audienceSource, setAudienceSource] = useState<AudienceSource>('default');
  const [isInferring, setIsInferring] = useState(false);
  const latestQuestionRef = useRef(question);

  useEffect(() => {
    latestQuestionRef.current = question;
    setSuggestedOptions([]);
  }, [question]);

  useEffect(() => {
    if (!onInferAudience || audienceSource === 'user' || question.trim().length < 15) return;

    const timer = setTimeout(async () => {
      const currentQuestion = question;
      setIsInferring(true);
      try {
        const description = await onInferAudience(currentQuestion);
        if (latestQuestionRef.current !== currentQuestion) return;
        if (description) {
          setAudienceMode('single');
          setSegmentDescriptions([description]);
          setSegmentWeights([1]);
          setAudienceSource('inferred');
        } else if (audienceSource === 'inferred') {
          setAudienceMode('general');
          setSegmentDescriptions(['']);
          setSegmentWeights([1]);
          setAudienceSource('default');
        }
      } finally {
        if (latestQuestionRef.current === currentQuestion) {
          setIsInferring(false);
        }
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [question, onInferAudience, audienceSource]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (question.trim() && !disabled && !isLoading) {
      const audienceConfig = buildAudienceConfig();
      onSubmit({
        question: question.trim(),
        options: cleanOptions,
        allowMultiple,
        audienceConfig,
      });
    }
  };

  const buildAudienceConfig = (): AudienceConfig => {
    if (audienceMode === 'general') {
      return { mode: 'general', segments: [] };
    }

    const descs = audienceMode === 'single'
      ? [segmentDescriptions[0]]
      : segmentDescriptions;

    const weights = audienceMode === 'single'
      ? [1]
      : segmentWeights.slice(0, descs.length);

    const totalWeight = weights.reduce((a, b) => a + b, 0);

    return {
      mode: audienceMode,
      segments: descs
        .filter((d) => d.trim())
        .map((d, i) => ({
          description: d.trim(),
          weight: totalWeight > 0 ? weights[i] / totalWeight : 1 / descs.length,
          label: d.trim().slice(0, 30),
        })),
    };
  };

  const handleOptionChange = (index: number, value: string) => {
    const next = [...options];
    next[index] = value;
    setOptions(next);
  };

  const addOption = () => {
    if (suggestedOptions.length > 0) {
      const [next, ...rest] = suggestedOptions;
      setSuggestedOptions(rest);
      setOptions([...options, next]);
    } else {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleExample = (ex: { question: string; options: string[] }) => {
    setQuestion(ex.question);
    setOptions([...ex.options]);
    setAudienceSource('default');
    setAudienceMode('general');
    setSegmentDescriptions(['']);
    setSegmentWeights([1]);
  };

  const handleGenerate = async () => {
    if (!onGenerateOptions || isGenerating) return;
    setIsGenerating(true);
    try {
      const result = await onGenerateOptions(question);
      if (result && result.length > 0) {
        const visible = result.slice(0, 3);
        const buffered = result.slice(3);
        setOptions(visible);
        setSuggestedOptions(buffered);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAudienceModeChange = (mode: AudienceMode) => {
    setAudienceMode(mode);
    setAudienceSource('user');
    if (mode === 'single') {
      setSegmentDescriptions([segmentDescriptions[0] || '']);
      setSegmentWeights([1]);
    } else if (mode === 'multi' && segmentDescriptions.length < 2) {
      setSegmentDescriptions([segmentDescriptions[0] || '', '']);
      setSegmentWeights([50, 50]);
    }
  };

  const handleSegmentDescChange = (index: number, value: string) => {
    const next = [...segmentDescriptions];
    next[index] = value;
    setSegmentDescriptions(next);
    setAudienceSource('user');
  };

  const handleSegmentWeightChange = (index: number, value: number) => {
    const next = [...segmentWeights];
    next[index] = Math.max(1, Math.min(100, value));
    setSegmentWeights(next);
  };

  const addSegment = () => {
    setSegmentDescriptions([...segmentDescriptions, '']);
    // New segment gets equal weight as average of existing
    const avgWeight = segmentWeights.reduce((a, b) => a + b, 0) / segmentWeights.length;
    setSegmentWeights([...segmentWeights, Math.round(avgWeight)]);
  };

  const removeSegment = (index: number) => {
    if (segmentDescriptions.length <= 2) return;
    setSegmentDescriptions(segmentDescriptions.filter((_, i) => i !== index));
    setSegmentWeights(segmentWeights.filter((_, i) => i !== index));
  };

  const dismissInferredAudience = () => {
    setAudienceMode('general');
    setSegmentDescriptions(['']);
    setSegmentWeights([1]);
    setAudienceSource('user');
  };

  const filledOptions = options.filter((o) => o.trim().length > 0);
  const hasValidSegments = audienceMode === 'general' ||
    (audienceMode === 'single' && segmentDescriptions[0]?.trim()) ||
    (audienceMode === 'multi' && segmentDescriptions.filter((d) => d.trim()).length >= 2);
  const canSubmit = question.trim().length > 0 && filledOptions.length >= 2 && hasValidSegments && !disabled && !isLoading;

  const totalWeight = segmentWeights.reduce((a, b) => a + b, 0);

  return (
    <div className="poll-input-section">
      <form onSubmit={handleSubmit} className="poll-form">
        <label className="form-label">Your Question</label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What do you want to ask 5,000 personas?"
          className="poll-textarea"
          rows={3}
          disabled={isLoading}
        />

        <div className="form-label-row">
          <label className="form-label">Answer Options</label>
          {onGenerateOptions && question.trim().length > 5 && (
            <button
              type="button"
              className="btn-generate-options"
              onClick={handleGenerate}
              disabled={isLoading || isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate'}
            </button>
          )}
        </div>
        <div className="options-list">
          {options.map((opt, i) => (
            <div key={i} className="option-row">
              <span className="option-number">{i + 1}</span>
              <input
                type="text"
                value={opt}
                onChange={(e) => handleOptionChange(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                className="option-input"
                disabled={isLoading}
              />
              {options.length > 2 && (
                <button
                  type="button"
                  className="btn-remove-option"
                  onClick={() => removeOption(i)}
                  disabled={isLoading}
                  title="Remove option"
                >
                  &times;
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="btn-add-option"
            onClick={addOption}
            disabled={isLoading}
          >
            + Add Option
          </button>
        </div>

        <div className="response-mode-toggle">
          <span className="toggle-label">Response mode:</span>
          <div className="toggle-buttons">
            <button
              type="button"
              className={`toggle-btn ${!allowMultiple ? 'active' : ''}`}
              onClick={() => setAllowMultiple(false)}
              disabled={isLoading}
            >
              Pick One
            </button>
            <button
              type="button"
              className={`toggle-btn ${allowMultiple ? 'active' : ''}`}
              onClick={() => setAllowMultiple(true)}
              disabled={isLoading}
            >
              Pick Multiple
            </button>
          </div>
        </div>

        {/* Audience Targeting */}
        <label className="form-label">
          Audience
          {isInferring && <span className="audience-inferring-indicator"> (detecting...)</span>}
        </label>
        <div className="audience-section">
          <div className="audience-mode-toggle">
            {(['general', 'single', 'multi'] as AudienceMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`toggle-btn ${audienceMode === mode ? 'active' : ''}`}
                onClick={() => handleAudienceModeChange(mode)}
                disabled={isLoading}
              >
                {AUDIENCE_MODE_LABELS[mode]}
              </button>
            ))}
          </div>

          {audienceMode === 'single' && (
            <div className="segment-inputs">
              {audienceSource === 'inferred' && (
                <div className="inferred-badge">
                  <span className="inferred-badge-text">Suggested audience</span>
                  <button
                    type="button"
                    className="inferred-badge-dismiss"
                    onClick={dismissInferredAudience}
                    title="Dismiss suggestion"
                  >
                    &times;
                  </button>
                </div>
              )}
              <input
                type="text"
                value={segmentDescriptions[0] || ''}
                onChange={(e) => handleSegmentDescChange(0, e.target.value)}
                placeholder="Describe your target audience (e.g., 'Health-conscious millennials in urban areas')"
                className="segment-description-input"
                disabled={isLoading}
              />
            </div>
          )}

          {audienceMode === 'multi' && (
            <div className="segment-inputs">
              {segmentDescriptions.map((desc, i) => (
                <div key={i} className="segment-entry">
                  <div className="segment-entry-main">
                    <span className="segment-number">{i + 1}</span>
                    <input
                      type="text"
                      value={desc}
                      onChange={(e) => handleSegmentDescChange(i, e.target.value)}
                      placeholder="Describe this segment..."
                      className="segment-description-input"
                      disabled={isLoading}
                    />
                    {segmentDescriptions.length > 2 && (
                      <button
                        type="button"
                        className="btn-remove-option"
                        onClick={() => removeSegment(i)}
                        disabled={isLoading}
                        title="Remove segment"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                  <div className="segment-weight-row">
                    <label className="weight-label">Weight:</label>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={segmentWeights[i] || 50}
                      onChange={(e) => handleSegmentWeightChange(i, Number(e.target.value))}
                      className="weight-slider"
                      disabled={isLoading}
                    />
                    <span className="weight-value">
                      {totalWeight > 0 ? Math.round(((segmentWeights[i] || 0) / totalWeight) * 100) : 0}%
                    </span>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="btn-add-option"
                onClick={addSegment}
                disabled={isLoading}
              >
                + Add Segment
              </button>
            </div>
          )}
        </div>

        <button
          type="submit"
          className="btn-primary btn-large btn-run"
          disabled={!canSubmit}
        >
          {isLoading ? (
            <span className="btn-loading">
              <span className="spinner" />
              Running Poll...
            </span>
          ) : (
            <>Run Poll &mdash; 5,000 Personas</>
          )}
        </button>
      </form>

      <div className="examples">
        <span className="examples-label">Try an example:</span>
        <div className="example-chips">
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              className="chip"
              onClick={() => handleExample(ex)}
              disabled={isLoading}
            >
              {ex.question.length > 50 ? ex.question.slice(0, 47) + '...' : ex.question}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
