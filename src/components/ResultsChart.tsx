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
import type { VotingStatistics, VotingResult, Persona } from '../types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface ResultsChartProps {
  statistics: VotingStatistics;
  question: string;
  options: string[];
  votingResults: VotingResult[];
  personas: Persona[];
}

export function ResultsChart({ statistics, question, options, votingResults, personas }: ResultsChartProps) {
  const colors = [
    'rgba(59, 130, 246, 0.7)',
    'rgba(16, 185, 129, 0.7)',
    'rgba(245, 158, 11, 0.7)',
    'rgba(239, 68, 68, 0.7)',
    'rgba(139, 92, 246, 0.7)',
    'rgba(236, 72, 153, 0.7)',
    'rgba(14, 165, 233, 0.7)',
    'rgba(34, 197, 94, 0.7)',
  ];

  const data = {
    labels: options,
    datasets: [
      {
        label: 'Number of Votes',
        data: options.map(option => statistics.voteCounts[option] || 0),
        backgroundColor: options.map((_, idx) => colors[idx % colors.length]),
        borderColor: options.map((_, idx) => colors[idx % colors.length].replace('0.7', '1')),
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Voting Results',
        font: {
          size: 16,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
        title: {
          display: true,
          text: 'Number of Votes',
        },
      },
      x: {
        title: {
          display: true,
          text: 'Options',
        },
      },
    },
  };

  // Find the winning option
  const sortedOptions = [...options].sort((a, b) =>
    (statistics.voteCounts[b] || 0) - (statistics.voteCounts[a] || 0)
  );
  const winner = sortedOptions[0];

  return (
    <div className="results-chart">
      <h2>4. Voting Results</h2>
      <div className="question-display">
        <strong>Question:</strong> {question}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{statistics.totalVotes}</div>
          <div className="stat-label">Total Votes</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{winner}</div>
          <div className="stat-label">Most Popular</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{statistics.voteCounts[winner] || 0}</div>
          <div className="stat-label">Votes for Winner</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{statistics.votePercentages[winner]?.toFixed(1) || 0}%</div>
          <div className="stat-label">Winner Percentage</div>
        </div>
      </div>

      <div className="chart-container">
        <Bar data={data} options={chartOptions} />
      </div>

      <div className="distribution-table">
        <h3>Vote Breakdown</h3>
        <table>
          <thead>
            <tr>
              <th>Option</th>
              <th>Votes</th>
              <th>Percentage</th>
            </tr>
          </thead>
          <tbody>
            {sortedOptions.map((option) => {
              const count = statistics.voteCounts[option] || 0;
              const percentage = statistics.votePercentages[option]?.toFixed(1) || '0.0';
              return (
                <tr key={option}>
                  <td>{option}</td>
                  <td>{count}</td>
                  <td>{percentage}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="persona-summaries">
        <h3>Individual Persona Votes</h3>
        <div className="summaries-list">
          {votingResults
            .map((result) => {
              const persona = personas.find(p => p.id === result.personaId);
              if (!persona) return null;

              return (
                <div key={result.personaId} className="summary-item">
                  <div className="summary-header">
                    <span className="persona-name">{persona.name}</span>
                    <span className="rating-badge">{result.selectedOption}</span>
                  </div>
                  <div className="summary-text">"{result.reasoning}"</div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
