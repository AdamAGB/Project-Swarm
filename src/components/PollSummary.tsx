import type { PollSummaryText } from '../types';

interface Props {
  summary: PollSummaryText;
}

export function PollSummary({ summary }: Props) {
  return (
    <div className="summary-section">
      <h2 className="section-title">Analysis</h2>
      <div className="summary-card">
        <h3 className="summary-headline">{summary.headline}</h3>
        <div className="summary-body">
          {summary.body.split('\n\n').map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
        {summary.keyInsights.length > 0 && (
          <div className="summary-insights">
            <h4>Key Insights</h4>
            <ul>
              {summary.keyInsights.map((insight, i) => (
                <li key={i}>{insight}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="summary-footnote">
          Generated from 1,000 synthetic persona votes using structured simulation.
        </p>
      </div>
    </div>
  );
}
