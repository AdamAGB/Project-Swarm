import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import type { VoteAggregates } from '../types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const OPTION_COLORS = [
  'rgba(99, 102, 241, 0.85)',
  'rgba(236, 72, 153, 0.85)',
  'rgba(245, 158, 11, 0.85)',
  'rgba(16, 185, 129, 0.85)',
  'rgba(139, 92, 246, 0.85)',
  'rgba(59, 130, 246, 0.85)',
];

const OPTION_BORDERS = [
  'rgba(99, 102, 241, 1)',
  'rgba(236, 72, 153, 1)',
  'rgba(245, 158, 11, 1)',
  'rgba(16, 185, 129, 1)',
  'rgba(139, 92, 246, 1)',
  'rgba(59, 130, 246, 1)',
];

interface Props {
  aggregates: VoteAggregates;
}

export function VoteChart({ aggregates }: Props) {
  const options = Object.keys(aggregates.voteCounts);

  const data = {
    labels: options,
    datasets: [
      {
        data: options.map((opt) => aggregates.voteCounts[opt]),
        backgroundColor: options.map((_, i) => OPTION_COLORS[i % OPTION_COLORS.length]),
        borderColor: options.map((_, i) => OPTION_BORDERS[i % OPTION_BORDERS.length]),
        borderWidth: 2,
        borderRadius: 8,
        maxBarThickness: 100,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: { y: number } }) => {
            const val = ctx.parsed.y;
            const pct = ((val / aggregates.totalPersonas) * 100).toFixed(1);
            return aggregates.allowMultiple
              ? `${val} personas (${pct}%)`
              : `${val} votes (${pct}%)`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: { font: { size: 13 } },
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 14, weight: 600 as const } },
      },
    },
  };

  return (
    <div className="vote-chart-section">
      <h2 className="section-title">
        Vote Results
        {aggregates.allowMultiple && <span className="section-subtitle">multiple selections per persona</span>}
      </h2>
      <div className="vote-stats-row">
        {options.map((opt, i) => {
          const isWinner = opt === aggregates.winner;
          return (
            <div key={opt} className={`vote-stat-card ${isWinner ? 'winner' : ''}`}>
              {isWinner && <span className="winner-badge">Winner</span>}
              <span className="stat-option" style={{ color: OPTION_BORDERS[i % OPTION_BORDERS.length] }}>{opt}</span>
              <span className="stat-count">{aggregates.voteCounts[opt]}</span>
              <span className="stat-pct">{aggregates.votePercentages[opt].toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
      <div className="chart-container">
        <Bar data={data} options={chartOptions} />
      </div>
    </div>
  );
}
