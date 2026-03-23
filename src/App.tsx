import { useCallback } from 'react';
import { useApiKey } from './hooks/useApiKey';
import { usePollOrchestrator } from './hooks/usePollOrchestrator';
import { ApiKeyInput } from './components/ApiKeyInput';
import { PollInput } from './components/PollInput';
import { LoadingOrchestra } from './components/LoadingOrchestra';
import { ResultsDashboard } from './components/ResultsDashboard';
import { createOpenAIClient } from './services/openai';
import { inferAudience } from './services/audience-inferrer';
import { generateOptions } from './services/option-generator';
import './App.css';

function App() {
  const { apiKey, saveKey, clearKey, hasKey } = useApiKey();
  const { personas, progress, results, runPoll, animatedVoting } = usePollOrchestrator(apiKey);

  const isLoading = progress.stage !== 'idle' && progress.stage !== 'complete' && progress.stage !== 'error';

  const handleInferAudience = useCallback(async (question: string): Promise<string | null> => {
    if (!apiKey) return null;
    try {
      const client = createOpenAIClient(apiKey);
      const result = await inferAudience(client, question);
      return result.shouldTarget ? result.segmentDescription : null;
    } catch {
      return null;
    }
  }, [apiKey]);

  const handleGenerateOptions = useCallback(async (question: string): Promise<string[] | null> => {
    if (!apiKey) return null;
    try {
      const client = createOpenAIClient(apiKey);
      return await generateOptions(client, question);
    } catch {
      return null;
    }
  }, [apiKey]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">
            <span className="title-icon">🐝</span>
            Swarm Poll
          </h1>
          <p className="app-subtitle">5,000 synthetic personas. 5 AI calls. Instant insights.</p>
        </div>
      </header>

      <main className="app-main">
        <ApiKeyInput apiKey={apiKey} onSave={saveKey} onClear={clearKey} />

        {hasKey && (
          <PollInput onSubmit={runPoll} disabled={!hasKey} isLoading={isLoading} onInferAudience={handleInferAudience} onGenerateOptions={handleGenerateOptions} />
        )}

        {isLoading && (
          <LoadingOrchestra
            progress={progress}
            rollingCounts={animatedVoting.rollingCounts}
            visibleVoteCount={animatedVoting.visibleVoteCount}
          />
        )}

        {progress.stage === 'error' && (
          <div className="error-banner">
            <span>⚠️</span>
            <p>{progress.errorMessage}</p>
          </div>
        )}

        {results && personas && (
          <ResultsDashboard results={results} personas={personas} />
        )}
      </main>

      <footer className="app-footer">
        <p>Swarm Poll — Synthetic consumer research powered by structured simulation</p>
      </footer>
    </div>
  );
}

export default App;
