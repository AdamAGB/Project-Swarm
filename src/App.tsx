import { useState } from 'react';
import './App.css';
import { ApiKeyInput } from './components/ApiKeyInput';
import { MarketDescriptionForm } from './components/MarketDescriptionForm';
import { PersonaList } from './components/PersonaList';
import { QuestionForm } from './components/QuestionForm';
import { ResultsChart } from './components/ResultsChart';
import { OpenAIService } from './services/openai';
import type { Persona, VotingStatistics, VotingResult } from './types';
import { calculateVotingStatistics } from './utils/statistics';

function App() {
  const [apiKey, setApiKey] = useState('');
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [statistics, setStatistics] = useState<VotingStatistics | null>(null);
  const [votingResults, setVotingResults] = useState<VotingResult[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentOptions, setCurrentOptions] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [votingProgress, setVotingProgress] = useState<{ current: number; total: number } | undefined>();
  const [error, setError] = useState('');

  const handleGeneratePersonas = async (description: string) => {
    if (!apiKey) {
      setError('Please enter your OpenAI API key first');
      return;
    }

    setIsGenerating(true);
    setError('');
    setPersonas([]);
    setStatistics(null);
    setVotingResults([]);
    setCurrentQuestion('');
    setCurrentOptions([]);

    try {
      const service = new OpenAIService(apiKey);
      const generatedPersonas = await service.generatePersonas(description);
      setPersonas(generatedPersonas);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate personas');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVote = async (question: string, options: string[]) => {
    if (!apiKey) {
      setError('Please enter your OpenAI API key first');
      return;
    }

    if (personas.length === 0) {
      setError('Please generate personas first');
      return;
    }

    if (options.length < 2) {
      setError('Please provide at least 2 options');
      return;
    }

    setIsVoting(true);
    setError('');
    setStatistics(null);
    setVotingResults([]);
    setCurrentQuestion(question);
    setCurrentOptions(options);
    setVotingProgress({ current: 0, total: personas.length });

    try {
      const service = new OpenAIService(apiKey);
      const results = await service.collectVotes(personas, question, options, (current, total) => {
        setVotingProgress({ current, total });
      });

      setVotingResults(results);
      const stats = calculateVotingStatistics(results);
      setStatistics(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to collect votes');
    } finally {
      setIsVoting(false);
      setVotingProgress(undefined);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>AI Persona Voting</h1>
        <p className="subtitle">
          Generate 50 AI personas and have them vote on multiple choice questions
        </p>
      </header>

      <main className="app-main">
        <ApiKeyInput onApiKeyChange={setApiKey} />

        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        <MarketDescriptionForm
          onGenerate={handleGeneratePersonas}
          isLoading={isGenerating}
          disabled={!apiKey}
        />

        {personas.length > 0 && (
          <>
            <PersonaList personas={personas} />

            <QuestionForm
              onVote={handleVote}
              isLoading={isVoting}
              disabled={!apiKey || personas.length === 0}
              progress={votingProgress}
            />

            {statistics && currentQuestion && (
              <ResultsChart
                statistics={statistics}
                question={currentQuestion}
                options={currentOptions}
                votingResults={votingResults}
                personas={personas}
              />
            )}
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>
          Powered by OpenAI GPT-4o-mini • Built with React + TypeScript + Chart.js
        </p>
      </footer>
    </div>
  );
}

export default App;
