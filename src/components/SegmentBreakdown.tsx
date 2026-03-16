import type { SegmentAnalysis } from '../types';
import { ARCHETYPE_COLORS } from '../types/persona';

const ARCHETYPE_COLOR_MAP: Record<string, string> = {
  'Budget Conscious Pragmatist': ARCHETYPE_COLORS.budget_conscious_pragmatist,
  'Premium Curious Trend Seeker': ARCHETYPE_COLORS.premium_curious_trend_seeker,
  'Brand Loyal Mainstream Buyer': ARCHETYPE_COLORS.brand_loyal_mainstream_buyer,
  'Health-Focused Skeptic': ARCHETYPE_COLORS.health_focused_skeptic,
  'Convenience-First Shopper': ARCHETYPE_COLORS.convenience_first_shopper,
};

const CUSTOM_SEGMENT_COLORS = [
  '#0ea5e9', '#f97316', '#a855f7', '#14b8a6', '#e11d48', '#84cc16',
];

interface Props {
  segments: SegmentAnalysis;
  options: string[];
}

const OPTION_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#3b82f6',
];

export function SegmentBreakdown({ segments, options }: Props) {
  return (
    <div className="segment-section">
      <h2 className="section-title">Segment Breakdown</h2>

      {/* By Custom Segment (shown first when present) */}
      {segments.byCustomSegment && segments.byCustomSegment.length > 0 && (
        <div className="segment-group">
          <h3 className="segment-group-title">By Your Target Segments</h3>
          <div className="segment-table">
            {segments.byCustomSegment.map((seg, idx) => {
              const segColor = CUSTOM_SEGMENT_COLORS[idx % CUSTOM_SEGMENT_COLORS.length];
              return (
                <div key={seg.segmentValue} className="segment-row">
                  <div className="segment-label">
                    <span className="segment-dot" style={{ backgroundColor: segColor }} />
                    <span className="segment-name">{seg.segmentValue}</span>
                    <span className="segment-count">n={seg.totalInSegment}</span>
                  </div>
                  <div className="segment-bars">
                    {options.map((opt, i) => {
                      const pct = seg.votePercentages[opt] || 0;
                      return (
                        <div key={opt} className="segment-bar-item">
                          <div className="segment-bar-track">
                            <div
                              className="segment-bar-fill"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: OPTION_COLORS[i % OPTION_COLORS.length],
                              }}
                            />
                          </div>
                          <span className="segment-bar-pct">{pct.toFixed(0)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="segment-legend">
            {options.map((opt, i) => (
              <span key={opt} className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: OPTION_COLORS[i % OPTION_COLORS.length] }} />
                {opt}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* By Archetype */}
      <div className="segment-group">
        <h3 className="segment-group-title">By Archetype</h3>
        <div className="segment-table">
          {segments.byArchetype.map((seg) => {
            const archColor = ARCHETYPE_COLOR_MAP[seg.segmentValue] || '#6b7280';
            return (
              <div key={seg.segmentValue} className="segment-row">
                <div className="segment-label">
                  <span className="segment-dot" style={{ backgroundColor: archColor }} />
                  <span className="segment-name">{seg.segmentValue}</span>
                  <span className="segment-count">n={seg.totalInSegment}</span>
                </div>
                <div className="segment-bars">
                  {options.map((opt, i) => {
                    const pct = seg.votePercentages[opt] || 0;
                    return (
                      <div key={opt} className="segment-bar-item">
                        <div className="segment-bar-track">
                          <div
                            className="segment-bar-fill"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: OPTION_COLORS[i % OPTION_COLORS.length],
                            }}
                          />
                        </div>
                        <span className="segment-bar-pct">{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {/* Only show legend if custom segments didn't already show it */}
        {(!segments.byCustomSegment || segments.byCustomSegment.length === 0) && (
          <div className="segment-legend">
            {options.map((opt, i) => (
              <span key={opt} className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: OPTION_COLORS[i % OPTION_COLORS.length] }} />
                {opt}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* By Trait - show selected highlights */}
      <div className="segment-group">
        <h3 className="segment-group-title">By Consumer Trait</h3>
        <div className="segment-table">
          {segments.byTrait
            .filter((seg) => seg.totalInSegment >= 15)
            .map((seg) => (
              <div key={seg.segmentValue} className="segment-row compact">
                <div className="segment-label">
                  <span className="segment-name">{seg.segmentValue}</span>
                  <span className="segment-count">n={seg.totalInSegment}</span>
                </div>
                <div className="segment-bars">
                  {options.map((opt, i) => {
                    const pct = seg.votePercentages[opt] || 0;
                    return (
                      <div key={opt} className="segment-bar-item">
                        <div className="segment-bar-track">
                          <div
                            className="segment-bar-fill"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: OPTION_COLORS[i % OPTION_COLORS.length],
                            }}
                          />
                        </div>
                        <span className="segment-bar-pct">{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
