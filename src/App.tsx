import { useApiKey } from './hooks/useApiKey';
import { usePollOrchestrator } from './hooks/usePollOrchestrator';
import { ApiKeyInput } from './components/ApiKeyInput';
import { PollInput } from './components/PollInput';
import { LoadingOrchestra } from './components/LoadingOrchestra';
import { ResultsDashboard } from './components/ResultsDashboard';
import './App.css';

function App() {
  const { apiKey, saveKey, clearKey, hasKey } = useApiKey();
  const { personas, progress, results, runPoll, animatedVoting } = usePollOrchestrator(apiKey);

  const isLoading = progress.stage !== 'idle' && progress.stage !== 'complete' && progress.stage !== 'error';

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">
            <span className="title-icon">🐝</span>
            Swarm Poll
          </h1>
          <p className="app-subtitle">1,000 synthetic personas. 4 AI calls. Instant insights.</p>
        </div>
      </header>

      <main className="app-main">
        <ApiKeyInput apiKey={apiKey} onSave={saveKey} onClear={clearKey} />

        {hasKey && (
          <PollInput onSubmit={runPoll} disabled={!hasKey} isLoading={isLoading} />
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
