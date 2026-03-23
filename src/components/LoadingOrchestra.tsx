import type { PollProgress } from '../types';

interface Props {
  progress: PollProgress;
  rollingCounts: Record<string, number>;
  visibleVoteCount: number;
}

const STAGE_ORDER = [
  'parsing_question',
  'parsing_audience',
  'generating_framework',
  'scoring_options',
  'generating_personas',
  'voting',
  'analyzing_segments',
  'generating_comments',
  'generating_summary',
] as const;

const STAGE_ICONS: Record<string, string> = {
  parsing_question: '🧠',
  parsing_audience: '🎯',
  generating_framework: '🧬',
  scoring_options: '📊',
  generating_personas: '👥',
  voting: '🗳️',
  analyzing_segments: '🔍',
  generating_comments: '💬',
  generating_summary: '📝',
};

const STAGE_SHORT_LABELS: Record<string, string> = {
  parsing_question: 'Parse',
  parsing_audience: 'Audience',
  generating_framework: 'Framework',
  scoring_options: 'Score',
  generating_personas: 'Generate',
  voting: 'Vote',
  analyzing_segments: 'Analyze',
  generating_comments: 'Comments',
  generating_summary: 'Summary',
};

function getStageIndex(stage: string): number {
  return STAGE_ORDER.indexOf(stage as typeof STAGE_ORDER[number]);
}

export function LoadingOrchestra({ progress, rollingCounts, visibleVoteCount }: Props) {
  const currentIndex = getStageIndex(progress.stage);
  const isVoting = progress.stage === 'voting';
  const options = Object.keys(rollingCounts);

  if (progress.stage === 'error') {
    return (
      <div className="loading-orchestra error">
        <div className="error-icon">⚠️</div>
        <p className="error-message">{progress.errorMessage || 'Something went wrong'}</p>
      </div>
    );
  }

  if (progress.stage === 'complete' || progress.stage === 'idle') return null;

  return (
    <div className="loading-orchestra">
      {/* Stage stepper */}
      <div className="stage-stepper">
        {STAGE_ORDER.map((stage, i) => (
          <div
            key={stage}
            className={`stage-step ${
              i < currentIndex ? 'completed' : i === currentIndex ? 'active' : 'pending'
            }`}
          >
            <span className="stage-icon">{STAGE_ICONS[stage]}</span>
            <span className="stage-short-label">{STAGE_SHORT_LABELS[stage]}</span>
          </div>
        ))}
      </div>

      {/* Current stage label */}
      <div className="stage-label-container">
        <p className="stage-label">{progress.stageLabel}</p>
      </div>

      {/* Live vote counter during voting stage */}
      {isVoting && (
        <div className="vote-counter-section">
          <div className="vote-counter">
            <span className="vote-count">{visibleVoteCount}</span>
            <span className="vote-total">/ {progress.totalVotes}</span>
          </div>
          <div className="rolling-bars">
            {options.map((opt) => {
              const count = rollingCounts[opt] || 0;
              const pct = visibleVoteCount > 0 ? (count / visibleVoteCount) * 100 : 0;
              return (
                <div key={opt} className="rolling-bar-row">
                  <span className="rolling-bar-label">{opt}</span>
                  <div className="rolling-bar-track">
                    <div
                      className="rolling-bar-fill"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="rolling-bar-count">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Non-voting stage spinner */}
      {!isVoting && (
        <div className="stage-spinner-container">
          <div className="pulse-ring" />
        </div>
      )}
    </div>
  );
}
