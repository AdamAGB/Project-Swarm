import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  getAvailableProviders,
  getDemoProviders,
  getSubscriberProviders,
  type LLMProvider,
} from '../../services/llm-providers';
import './EffectsApp.css';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Effect {
  category: string;
  title: string;
  description: string;
  timeframe: string;
  likelihood: 'high' | 'medium' | 'low';
  triggers: string[]; // titles of effects that cause this one
}

interface EffectsResult {
  first: Effect[];
  second: Effect[];
  third: Effect[];
}

/* ------------------------------------------------------------------ */
/*  LLM prompt                                                         */
/* ------------------------------------------------------------------ */

async function analyzeEffects(
  provider: LLMProvider,
  news: string,
): Promise<EffectsResult> {
  const system = `You are a world-class strategic analyst. Given a news item, map out its cascading effects across three orders of impact.

Rules:
- 1st order: 4-5 direct, immediate consequences of this news
- 2nd order: 5-6 effects caused by the 1st-order effects
- 3rd order: 5-6 downstream effects caused by the 2nd-order effects
- Each effect needs: category (e.g. "Markets", "Geopolitics", "Technology", "Labor", "Consumer", "Regulation", "Culture", "Environment", "Security"), title (short, punchy, 3-8 words), description (1-2 sentences explaining the mechanism), timeframe (e.g. "Days", "Weeks", "1-3 months", "6-12 months", "1-3 years"), likelihood ("high", "medium", or "low")
- 2nd and 3rd order effects must include a "triggers" array with the exact title(s) of the upstream effect(s) that cause them
- 1st order effects have an empty triggers array
- Be specific and concrete, not generic. Name companies, sectors, regions where relevant.
- Think creatively about non-obvious cascading consequences

Return JSON: { "first": [...], "second": [...], "third": [...] }
Each effect: { "category": "...", "title": "...", "description": "...", "timeframe": "...", "likelihood": "high|medium|low", "triggers": ["upstream title", ...] }`;

  const content = await provider.complete(
    [
      { role: 'system', content: system },
      { role: 'user', content: `News: "${news}"` },
    ],
    { temperature: 0.8, jsonMode: true, maxTokens: 4096 },
  );

  if (!content) throw new Error('No response from model');
  const parsed = JSON.parse(content);
  return parsed as EffectsResult;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function EffectsApp() {
  // Auth state (mirrors V4App pattern)
  const [keys, setKeys] = useState<{ openai: string; anthropic: string; gemini: string }>(() => ({
    openai: localStorage.getItem('openai_api_key') ?? '',
    anthropic: localStorage.getItem('anthropic_api_key') ?? '',
    gemini: localStorage.getItem('gemini_api_key') ?? '',
  }));

  const [authMode, setAuthMode] = useState<'demo' | 'byok'>(() => {
    if (localStorage.getItem('byok_validated') === 'true') return 'byok';
    return 'demo';
  });

  const [inviteCode, setInviteCode] = useState(() => localStorage.getItem('invite_code') ?? '');
  const demoValidated = localStorage.getItem('demo_validated') === 'true';
  const byokValidated = localStorage.getItem('byok_validated') === 'true';
  const subscriberEmail = localStorage.getItem('subscriber_email') ?? '';

  const providers = useMemo(() => {
    if (subscriberEmail) return getSubscriberProviders(subscriberEmail);
    if (authMode === 'demo' && demoValidated && inviteCode) return getDemoProviders(inviteCode);
    if (authMode === 'byok' && byokValidated) return getAvailableProviders(keys);
    return [];
  }, [authMode, demoValidated, byokValidated, inviteCode, subscriberEmail, keys]);

  // App state
  const [news, setNews] = useState('');
  const [step, setStep] = useState<'input' | 'loading' | 'results' | 'error'>('input');
  const [result, setResult] = useState<EffectsResult | null>(null);
  const [submittedNews, setSubmittedNews] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Auth input state (for unauthenticated users)
  const [authTab, setAuthTab] = useState<'demo' | 'byok'>('demo');
  const [codeInput, setCodeInput] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [authError, setAuthError] = useState('');

  async function handleSubmit() {
    const trimmed = news.trim();
    if (!trimmed || providers.length === 0) return;

    setSubmittedNews(trimmed);
    setStep('loading');
    setErrorMsg('');
    setResult(null);

    try {
      // Use Gemini if available (fastest), otherwise first provider
      const geminiProvider = providers.find((p) => p.name === 'Gemini');
      const provider = geminiProvider ?? providers[0];
      const data = await analyzeEffects(provider, trimmed);
      setResult(data);
      setStep('results');
    } catch (err) {
      console.error('[EffectsApp] Analysis error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
      setStep('error');
    }
  }

  function handleReset() {
    setStep('input');
    setNews('');
    setResult(null);
  }

  function handleQuickAuth() {
    if (authTab === 'demo' && codeInput.trim()) {
      localStorage.setItem('invite_code', codeInput.trim());
      localStorage.setItem('demo_validated', 'true');
      setInviteCode(codeInput.trim());
      setAuthMode('demo');
      setAuthError('');
      window.location.reload();
    } else if (authTab === 'byok' && keyInput.trim()) {
      // Assume it's a Gemini key for simplicity (fastest provider)
      localStorage.setItem('gemini_api_key', keyInput.trim());
      localStorage.setItem('byok_validated', 'true');
      setKeys((prev) => ({ ...prev, gemini: keyInput.trim() }));
      setAuthMode('byok');
      setAuthError('');
      window.location.reload();
    }
  }

  const needsAuth = providers.length === 0;

  return (
    <div className="effects-page">
      <Link to="/" className="effects-back">&larr; Back to polls</Link>

      <div className="effects-header">
        <h1>Cascade Effects</h1>
        <p>Map the ripple effects of any news event across three orders of impact</p>
      </div>

      {/* Auth gate */}
      {needsAuth && (
        <div className="effects-auth">
          <div className="effects-auth-card">
            <h3>Connect to get started</h3>
            <p>Use your existing credentials from the polling app</p>
            <div className="effects-auth-tabs">
              <button
                className={`effects-auth-tab ${authTab === 'demo' ? 'active' : ''}`}
                onClick={() => setAuthTab('demo')}
              >
                Invite Code
              </button>
              <button
                className={`effects-auth-tab ${authTab === 'byok' ? 'active' : ''}`}
                onClick={() => setAuthTab('byok')}
              >
                API Key
              </button>
            </div>
            {authTab === 'demo' ? (
              <>
                <input
                  className="effects-key-input"
                  type="password"
                  placeholder="Enter invite code"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuickAuth()}
                />
              </>
            ) : (
              <>
                <input
                  className="effects-key-input"
                  type="password"
                  placeholder="Gemini API key (recommended — fastest)"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuickAuth()}
                />
              </>
            )}
            {authError && <div className="effects-auth-error">{authError}</div>}
            <button
              className="effects-submit-btn"
              style={{ width: '100%' }}
              onClick={handleQuickAuth}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      {!needsAuth && step === 'input' && (
        <div className="effects-input-section">
          <div className="effects-input-wrap">
            <textarea
              className="effects-textarea"
              placeholder="Paste a news headline or describe an event...&#10;&#10;e.g. &quot;NVIDIA announces 50% price cut on all consumer GPUs&quot;"
              value={news}
              onChange={(e) => setNews(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
              }}
            />
            <div className="effects-input-footer">
              <span>{news.length > 0 ? `${news.length} chars` : 'Cmd+Enter to submit'}</span>
              <button
                className="effects-submit-btn"
                disabled={!news.trim()}
                onClick={handleSubmit}
              >
                Analyze Effects
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {step === 'loading' && (
        <div className="effects-loading">
          <div className="effects-loading-text">Mapping cascading effects...</div>
          <div className="effects-loading-bar" />
        </div>
      )}

      {/* Error */}
      {step === 'error' && (
        <div className="effects-error">
          <div className="effects-error-msg">{errorMsg}</div>
          <button className="effects-retry-btn" onClick={() => setStep('input')}>
            Try again
          </button>
        </div>
      )}

      {/* Results */}
      {step === 'results' && result && (
        <div className="effects-results">
          <div className="effects-news-banner">
            <span className="effects-news-label">Analyzing</span>
            <span className="effects-news-text">{submittedNews}</span>
            <button className="effects-new-btn" onClick={handleReset}>New analysis</button>
          </div>

          <div className="effects-cascade">
            {/* 1st Order */}
            <div className="effects-column">
              <div className="effects-column-header">
                <div className="effects-order-badge order-1">1</div>
                <div>
                  <div className="effects-column-title order-1">1st Order Effects</div>
                  <div className="effects-column-subtitle">Direct & immediate</div>
                </div>
              </div>
              {result.first.map((effect, i) => (
                <EffectCard key={i} effect={effect} order={1} />
              ))}
            </div>

            {/* 2nd Order */}
            <div className="effects-column">
              <div className="effects-column-header">
                <div className="effects-order-badge order-2">2</div>
                <div>
                  <div className="effects-column-title order-2">2nd Order Effects</div>
                  <div className="effects-column-subtitle">Downstream reactions</div>
                </div>
              </div>
              {result.second.map((effect, i) => (
                <EffectCard key={i} effect={effect} order={2} />
              ))}
            </div>

            {/* 3rd Order */}
            <div className="effects-column">
              <div className="effects-column-header">
                <div className="effects-order-badge order-3">3</div>
                <div>
                  <div className="effects-column-title order-3">3rd Order Effects</div>
                  <div className="effects-column-subtitle">Long-tail consequences</div>
                </div>
              </div>
              {result.third.map((effect, i) => (
                <EffectCard key={i} effect={effect} order={3} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Effect card                                                        */
/* ------------------------------------------------------------------ */

function EffectCard({ effect, order }: { effect: Effect; order: 1 | 2 | 3 }) {
  const orderClass = `order-${order}`;
  return (
    <div className={`effects-card ${orderClass}`}>
      <div className={`effects-card-category ${orderClass}`}>{effect.category}</div>
      <div className="effects-card-title">{effect.title}</div>
      <div className="effects-card-description">{effect.description}</div>
      <div className="effects-card-meta">
        <span className="effects-tag effects-tag-timeframe">{effect.timeframe}</span>
        <span className={`effects-tag effects-tag-likelihood ${effect.likelihood}`}>
          {effect.likelihood} likelihood
        </span>
      </div>
      {effect.triggers.length > 0 && (
        <div className="effects-card-links">
          {effect.triggers.map((t, i) => (
            <span key={i} className="effects-link-pill">&larr; {t}</span>
          ))}
        </div>
      )}
    </div>
  );
}
