import type { GeneratedComment } from '../types';

interface Props {
  comments: GeneratedComment[];
}

const OPTION_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#3b82f6',
];

export function CommentsList({ comments }: Props) {
  // Build color map from unique voted options
  const optionSet = [...new Set(comments.map((c) => c.votedFor))];
  const optionColorMap: Record<string, string> = {};
  optionSet.forEach((opt, i) => {
    optionColorMap[opt] = OPTION_COLORS[i % OPTION_COLORS.length];
  });

  return (
    <div className="comments-section">
      <h2 className="section-title">What the Swarm Said</h2>
      <div className="comments-grid">
        {comments.map((c, i) => {
          const color = optionColorMap[c.votedFor] || '#6b7280';
          return (
            <div key={i} className="comment-card">
              <div className="comment-header">
                <span className="comment-name">{c.personaName}</span>
                <span className="comment-archetype">{c.archetype}</span>
              </div>
              <p className="comment-text">"{c.comment}"</p>
              <span
                className="comment-vote-badge"
                style={{ backgroundColor: color + '18', color, borderColor: color }}
              >
                {c.votedFor}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
