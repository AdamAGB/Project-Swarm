import type { PollResults, Persona } from '../types';
import { VoteChart } from './VoteChart';
import { SegmentBreakdown } from './SegmentBreakdown';
import { PersonaCards } from './PersonaCards';
import { CommentsList } from './CommentsList';
import { PollSummary } from './PollSummary';

interface Props {
  results: PollResults;
  personas: Persona[];
}

export function ResultsDashboard({ results, personas }: Props) {
  return (
    <div className="results-dashboard">
      <div className="results-header">
        <h2 className="results-question">"{results.poll.original_question}"</h2>
        <div className="results-meta">
          <span className="meta-badge">{results.aggregates.totalVotes} votes</span>
          <span className="meta-badge">{results.poll.poll_type.replace(/_/g, ' ')}</span>
          <span className="meta-badge">{results.poll.category}</span>
        </div>
      </div>

      <VoteChart aggregates={results.aggregates} />

      {results.summary && <PollSummary summary={results.summary} />}

      <SegmentBreakdown segments={results.segments} options={results.poll.options} framework={results.framework} />

      {results.comments.length > 0 && <CommentsList comments={results.comments} />}

      <PersonaCards personas={personas} votes={results.votes} framework={results.framework} />
    </div>
  );
}
