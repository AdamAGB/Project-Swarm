import { useState, useRef, useMemo } from 'react';
import { getAvailableProviders, getDemoProviders, getSubscriberProviders } from '../../services/llm-providers';
import { generateOptionsMultiModel, generateSegmentsViaProvider, runMultiModelVoting } from '../../services/multi-model';
import { fetchWebContext } from '../../services/web-context';
import type { PersonaVoteResult, PersonaVote } from '../../services/persona-vote-engine';
import { VoteParticleViz, SEGMENT_COLORS } from '../v2/VoteParticleViz';
import type {
  SegmentFramework,
  Segment,
  V2SegmentVoteResult,
  V2VoteAggregates,
} from '../../types/v2';
import type { Attachment } from '../../types/attachments';
import { isAcceptedFile, readFileAsAttachment, ACCEPTED_FILE_TYPES } from '../../services/attachments';
import '../../App.css';
import '../v2/V2App.css';
import '../v3/V3App.css';
import './V4App.css';

type Step = 'input' | 'loading' | 'edit-options' | 'edit-segments' | 'results' | 'error';

/* Hero viz mock data */
const HERO_OPTIONS = ['Red', 'Blue', 'Clear', 'Orange', 'Brown'];
const heroMockData = (() => {
  const counts: Record<string, number> = { 'Red': 72, 'Blue': 48, 'Clear': 38, 'Orange': 28, 'Brown': 14 };
  const total = Object.values(counts).reduce((s, v) => s + v, 0);
  const pcts: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) pcts[k] = (v / total) * 100;
  return {
    segmentVotes: [{
      segmentName: 'General', populationShare: 1, votesAllocated: total,
      voteCounts: counts, votePercentages: pcts, preferenceScores: counts, winnerInSegment: 'Red',
    }] as V2SegmentVoteResult[],
    aggregates: {
      totalVotes: total, voteCounts: counts, votePercentages: pcts,
      winner: 'Red', winnerCount: 72, winnerPercentage: pcts['Red'],
      runnerUp: 'Blue', runnerUpCount: 48, runnerUpPercentage: pcts['Blue'],
    } as V2VoteAggregates,
  };
})();

function formatShare(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/** Convert PersonaVoteResult to V2-compatible types for VoteParticleViz */
function toV2VoteData(result: PersonaVoteResult): {
  segmentVotes: V2SegmentVoteResult[];
  aggregates: V2VoteAggregates;
} {
  const segmentVotes: V2SegmentVoteResult[] = result.segmentTallies.map((t) => ({
    segmentName: t.segmentName,
    populationShare: t.populationShare,
    votesAllocated: t.totalVotes,
    voteCounts: t.voteCounts,
    votePercentages: t.votePercentages,
    preferenceScores: t.voteCounts, // not used by viz
    winnerInSegment: t.winnerInSegment,
  }));

  // Winner determined by raw vote counts, not smoothed percentages
  const sorted = Object.entries(result.voteCounts).sort(([, a], [, b]) => b - a);
  const winner = sorted[0]?.[0] ?? '';
  const runnerUp = sorted[1]?.[0] ?? winner;

  const aggregates: V2VoteAggregates = {
    totalVotes: result.totalVotes,
    voteCounts: result.voteCounts,
    votePercentages: result.votePercentages,
    winner,
    winnerCount: result.voteCounts[winner] ?? 0,
    winnerPercentage: result.votePercentages[winner] ?? 0,
    runnerUp,
    runnerUpCount: result.voteCounts[runnerUp] ?? 0,
    runnerUpPercentage: result.votePercentages[runnerUp] ?? 0,
  };

  return { segmentVotes, aggregates };
}

export function V4App() {
  // Handle Stripe redirect
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('subscribed') === 'true') {
    // User just subscribed — they need to verify email again to activate
    window.history.replaceState({}, '', '/');
  }

  // Multi-model API keys
  // API key mode
  const [keys, setKeys] = useState<{ openai: string; anthropic: string; gemini: string }>(() => ({
    openai: localStorage.getItem('openai_api_key') ?? '',
    anthropic: localStorage.getItem('anthropic_api_key') ?? '',
    gemini: localStorage.getItem('gemini_api_key') ?? '',
  }));
  const [showKeys, setShowKeys] = useState(false);

  function saveKey(provider: 'openai' | 'anthropic' | 'gemini', value: string) {
    localStorage.setItem(`${provider}_api_key`, value);
    setKeys((prev) => ({ ...prev, [provider]: value }));
  }

  // Demo mode
  // demoMode derived from authMode
  const [demoValidated, setDemoValidated] = useState(() => localStorage.getItem('demo_validated') === 'true');
  const [inviteCode, setInviteCode] = useState(() => localStorage.getItem('invite_code') ?? '');
  const [inviteError, setInviteError] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  // BYOK mode
  const [byokValidated, setByokValidated] = useState(() => localStorage.getItem('byok_validated') === 'true');
  const [byokError, setByokError] = useState('');
  const [byokLoading, setByokLoading] = useState(false);

  function saveInviteCode(code: string) {
    localStorage.setItem('invite_code', code);
    setInviteCode(code);
    setInviteError('');
  }

  async function validateInviteCode() {
    if (!inviteCode.trim()) return;
    setInviteLoading(true);
    setInviteError('');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteCode: inviteCode.trim(),
          provider: 'openai',
          messages: [{ role: 'user', content: 'test' }],
          maxTokens: 1,
        }),
      });
      if (res.status === 403) {
        setInviteError('Invalid invite code');
      } else {
        // Any other response (200, 429, 502) means the code is valid
        setDemoValidated(true);
        localStorage.setItem('demo_validated', 'true');
      }
    } catch {
      setInviteError('Could not validate. Try again.');
    }
    setInviteLoading(false);
  }

  async function validateByokKeys() {
    const testProviders = getAvailableProviders(keys);
    if (testProviders.length === 0) return;
    setByokLoading(true);
    setByokError('');
    try {
      const result = await testProviders[0].complete(
        [{ role: 'user', content: 'test' }],
        { maxTokens: 1 },
      );
      if (result !== null || result === null) {
        // Any response (even null) means the key connected
        setByokValidated(true);
        localStorage.setItem('byok_validated', 'true');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      if (msg.includes('401') || msg.includes('invalid') || msg.includes('Unauthorized')) {
        setByokError('Invalid API key. Check and try again.');
      } else {
        // Other errors (rate limit, etc.) mean the key is valid
        setByokValidated(true);
        localStorage.setItem('byok_validated', 'true');
      }
    }
    setByokLoading(false);
  }

  // Subscriber mode
  const [authMode, setAuthMode] = useState<'demo' | 'byok' | 'subscriber'>(() => {
    if (localStorage.getItem('subscriber_email')) return 'subscriber';
    if (localStorage.getItem('demo_validated') === 'true') return 'demo';
    if (localStorage.getItem('byok_validated') === 'true') return 'byok';
    return 'demo';
  });
  const [subscriberEmail, setSubscriberEmail] = useState(() => localStorage.getItem('subscriber_email') ?? '');
  const [emailInput, setEmailInput] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationSignature, setVerificationSignature] = useState('');
  const [authStep, setAuthStep] = useState<'email' | 'code' | 'subscribe' | 'done'>(() =>
    localStorage.getItem('subscriber_email') ? 'done' : 'email'
  );
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  async function sendVerificationCode() {
    if (!emailInput.trim() || !emailInput.includes('@')) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send code');
      setVerificationSignature(data.signature);
      setAuthStep('code');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Failed to send code');
    }
    setAuthLoading(false);
  }

  async function verifyCodeAndCheck() {
    if (!verificationCode.trim()) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.trim(),
          code: verificationCode.trim(),
          signature: verificationSignature,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      if (!data.verified) throw new Error('Invalid code');

      if (data.subscribed) {
        // Active subscriber — grant access
        localStorage.setItem('subscriber_email', emailInput.trim().toLowerCase());
        setSubscriberEmail(emailInput.trim().toLowerCase());
        setAuthStep('done');
      } else {
        // Verified but not subscribed — show subscribe button
        setAuthStep('subscribe');
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Verification failed');
    }
    setAuthLoading(false);
  }

  async function startSubscription() {
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/auth/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start checkout');
      window.location.href = data.url;
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Failed to start checkout');
      setAuthLoading(false);
    }
  }

  async function openPortal() {
    try {
      const res = await fetch('/api/auth/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: subscriberEmail }),
      });
      const data = await res.json();
      if (res.ok && data.url) window.location.href = data.url;
    } catch { /* ignore */ }
  }

  const byokProviders = useMemo(() => byokValidated ? getAvailableProviders(keys) : [], [keys, byokValidated]);
  const demoProviders = useMemo(() => (demoValidated && inviteCode) ? getDemoProviders(inviteCode) : [], [demoValidated, inviteCode]);
  const subscriberProviders = useMemo(() => subscriberEmail ? getSubscriberProviders(subscriberEmail) : [], [subscriberEmail]);
  const providers = authMode === 'subscriber' ? subscriberProviders : authMode === 'demo' ? demoProviders : byokProviders;
  const hasKey = providers.length > 0;

  const [step, setStep] = useState<Step>('input');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [progressLabel, setProgressLabel] = useState('');
  const [voteResult, setVoteResult] = useState<PersonaVoteResult | null>(null);
  const [resultKey, setResultKey] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const [, setAdvanced] = useState(false);
  const [framework, setFramework] = useState<SegmentFramework | null>(null);
  const [loadingLabel, setLoadingLabel] = useState('');
  const [optionPool, setOptionPool] = useState<string[]>([]);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showAllWriteIns, setShowAllWriteIns] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_ATTACHMENTS = 10;

  async function handleFilesSelected(files: FileList | null) {
    if (!files) return;
    const remaining = MAX_ATTACHMENTS - attachments.length;
    const accepted = Array.from(files).filter(isAcceptedFile).slice(0, remaining);
    const newAttachments = await Promise.all(accepted.map(readFileAsAttachment));
    setAttachments((prev) => [...prev, ...newAttachments]);
  }

  function handleRemoveAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    handleFilesSelected(e.dataTransfer.files);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  // --- Core pipeline: generate segments then run multi-model persona voting ---
  async function runVotingPipeline(
    q: string,
    opts: string[],
    segmentDescriptions?: string[],
    userShares?: number[],
  ) {
    if (!segmentDescriptions || segmentDescriptions.length === 0) {
      throw new Error('No segment descriptions provided');
    }

    // Step 1: Build segments via any available provider
    setProgressLabel('Building audience segments\u2026');
    const segs = await generateSegmentsViaProvider(providers[0], q, opts, segmentDescriptions);
    if (!segs) throw new Error('Failed to generate audience segments');

    // Apply user population shares if provided
    let segments = segs;
    if (userShares && userShares.length > 1) {
      const totalShare = userShares.reduce((sum, s) => sum + s, 0);
      segments = segs.map((s, i) => ({
        ...s,
        populationShare: totalShare > 0 && i < userShares.length
          ? userShares[i] / totalShare
          : s.populationShare,
      }));
    }

    // Step 2: Fetch context + run persona voting (multi-model)
    setProgressLabel('Gathering context\u2026');
    const webContext = await fetchWebContext(providers[0], q, opts, keys.gemini || undefined, { inviteCode: inviteCode || undefined, subscriberEmail: subscriberEmail || undefined });

    setProgressLabel(`Polling 500 voters across ${providers.length} model${providers.length > 1 ? 's' : ''}\u2026`);
    const result = await runMultiModelVoting(providers, q, opts, segments, (done, total) => {
      setProgressLabel(`Polling voters\u2026 ${Math.round((done / total) * 100)}%`);
    }, 500, webContext);

    return result;
  }

  // Normal mode: no segments, multi-model
  async function handleSubmit() {
    const q = question.trim();
    if (!q || providers.length === 0) return;

    setAdvanced(false);
    setStep('loading');
    setProgressLabel(`Generating options across ${providers.length} model${providers.length > 1 ? 's' : ''}\u2026`);
    setErrorMsg('');
    setVoteResult(null);
    setFramework(null);

    try {
      // Generate options from all models and merge
      const opts = await generateOptionsMultiModel(providers, q);
      setOptions(opts);

      // Fetch current context if needed
      setProgressLabel('Gathering context\u2026');
      const webContext = await fetchWebContext(providers[0], q, opts, keys.gemini || undefined, { inviteCode: inviteCode || undefined, subscriberEmail: subscriberEmail || undefined });

      // Run persona voting — no segments
      setProgressLabel(`Polling 200 voters across ${providers.length} model${providers.length > 1 ? 's' : ''}\u2026`);
      const result = await runMultiModelVoting(providers, q, opts, null, (done, total) => {
        setProgressLabel(`Polling voters\u2026 ${Math.round((done / total) * 100)}%`);
      }, 200, webContext);

      setVoteResult(result);
      setResultKey((k) => k + 1);
      setStep('results');
    } catch (err) {
      console.error('[V4App] Pipeline error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
      setStep('error');
    }
  }

  // Advanced mode: generate options then pause
  async function handleAdvancedSubmit() {
    const q = question.trim();
    if (!q) return;

    setAdvanced(true);
    setStep('loading');
    setLoadingLabel('Generating polling options\u2026');
    setErrorMsg('');
    setVoteResult(null);
    setFramework(null);
    setOptionPool([]);

    try {
      const opts = await generateOptionsMultiModel(providers, q);
      setOptions(opts);
      setOptionPool([]);
      setStep('edit-options');
    } catch (err) {
      console.error('[V4App] Advanced options error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
      setStep('error');
    }
  }

  // Advanced mode: show empty segment editor
  function handleContinueFromOptions() {
    const emptySeg: Segment = { name: 'Segment 1', description: '', populationShare: 1 };
    setFramework({
      reasoning: '',
      segments: [emptySeg],
      variables: [],
      weights: {},
    });
    setStep('edit-segments');
  }

  // Advanced mode: run persona voting, with or without segments
  async function handleContinueFromSegments() {
    if (!framework) return;

    const descriptions = framework.segments.map((s) => s.description.trim()).filter(Boolean);
    const hasDescriptions = descriptions.length > 0;
    const userShares = framework.segments.map((s) => s.populationShare);

    setStep('loading');
    setLoadingLabel('');

    try {
      let result: PersonaVoteResult;

      if (hasDescriptions) {
        setProgressLabel('Building segments from your descriptions\u2026');
        result = await runVotingPipeline(
          question.trim(),
          options,
          descriptions,
          userShares,
        );
      } else {
        // No segments — gather context + run general population voting
        setProgressLabel('Gathering context\u2026');
        const webCtx = await fetchWebContext(providers[0], question.trim(), options, keys.gemini || undefined, { inviteCode: inviteCode || undefined, subscriberEmail: subscriberEmail || undefined });
        setProgressLabel(`Polling 200 voters across ${providers.length} model${providers.length > 1 ? 's' : ''}\u2026`);
        result = await runMultiModelVoting(providers, question.trim(), options, null, (done, total) => {
          setProgressLabel(`Polling voters\u2026 ${Math.round((done / total) * 100)}%`);
        }, 200, webCtx);
      }
      setVoteResult(result);
      setResultKey((k) => k + 1);
      setStep('results');
    } catch (err) {
      console.error('[V4App] Advanced simulation error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
      setStep('error');
    }
  }

  // Regenerate options (advanced mode)
  async function handleRegenerateOptions() {
    setStep('loading');
    setLoadingLabel('Regenerating options\u2026');

    try {
      const opts = await generateOptionsMultiModel(providers, question.trim());
      setOptions(opts);
      setOptionPool([]);
      setStep('edit-options');
    } catch (err) {
      console.error('[V4App] Regenerate options error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
      setStep('error');
    }
  }

  // --- Edit Options helpers ---
  function handleOptionChange(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  }

  function handleOptionDelete(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  function handleOptionAdd() {
    if (options.length < 10) {
      setOptions((prev) => [...prev, '']);
    }
  }

  function handleOptionRefresh(index: number) {
    if (optionPool.length === 0) return;
    const next = optionPool[0];
    const old = options[index];
    setOptions((prev) => prev.map((o, i) => (i === index ? next : o)));
    setOptionPool((prev) => [...prev.slice(1), old]);
  }

  // --- Edit Segments helpers ---
  function handleSegmentDescChange(index: number, value: string) {
    if (!framework) return;
    const newSegments = framework.segments.map((s, i) =>
      i === index ? { ...s, description: value } : s
    );
    setFramework({ ...framework, segments: newSegments });
  }

  const SPLIT_PRESETS: Record<number, { label: string; shares: number[] }[]> = {
    2: [
      { label: 'Even', shares: [50, 50] },
      { label: '60 / 40', shares: [60, 40] },
      { label: '70 / 30', shares: [70, 30] },
      { label: '80 / 20', shares: [80, 20] },
    ],
    3: [
      { label: 'Even', shares: [34, 33, 33] },
      { label: '50 / 30 / 20', shares: [50, 30, 20] },
      { label: '60 / 25 / 15', shares: [60, 25, 15] },
    ],
    4: [
      { label: 'Even', shares: [25, 25, 25, 25] },
      { label: '40 / 25 / 20 / 15', shares: [40, 25, 20, 15] },
      { label: '50 / 20 / 20 / 10', shares: [50, 20, 20, 10] },
    ],
  };

  function handleApplySplit(shares: number[]) {
    if (!framework) return;
    const newSegments = framework.segments.map((s, i) => ({
      ...s,
      populationShare: (shares[i] ?? shares[shares.length - 1]) / 100,
    }));
    setFramework({ ...framework, segments: newSegments });
  }

  function currentSplitLabel(): string {
    if (!framework || framework.segments.length <= 1) return '';
    return framework.segments.map((s) => Math.round(s.populationShare * 100)).join(' / ');
  }

  function handleSegmentDelete(index: number) {
    if (!framework || framework.segments.length <= 1) return;
    const newSegments = framework.segments.filter((_, i) => i !== index);
    setFramework({ ...framework, segments: newSegments });
  }

  function handleSegmentAdd() {
    if (!framework) return;
    const newSeg: Segment = {
      name: `Segment ${framework.segments.length + 1}`,
      description: '',
      populationShare: 0.1,
    };
    setFramework({
      ...framework,
      segments: [...framework.segments, newSeg],
    });
  }

  function handleReset() {
    setStep('input');
    setOptions([]);
    setVoteResult(null);
    setErrorMsg('');
    setAdvanced(false);
    setFramework(null);
    setLoadingLabel('');
    setOptionPool([]);
    setAttachments([]);
    setProgressLabel('');
    setShowAllWriteIns(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
  }

  const validOptions = options.filter((o) => o.trim().length > 0);
  const canContinueFromOptions = validOptions.length >= 2;

  // Can always continue — segments are optional. If segments have text, all must be filled.
  const filledSegments = framework?.segments.filter((s) => s.description.trim().length > 0) ?? [];
  const canContinueFromSegments =
    framework !== null &&
    (filledSegments.length === 0 || filledSegments.length === framework.segments.length);

  // Are there real segments (not just "General")?
  const hasSegments = voteResult
    ? voteResult.segmentTallies.length > 1 || (voteResult.segmentTallies.length === 1 && voteResult.segmentTallies[0].segmentName !== 'General')
    : false;

  // Derived view data (memoized to prevent VoteParticleViz re-animation)
  const v2Data = useMemo(
    () => voteResult ? toV2VoteData(voteResult) : null,
    [voteResult],
  );

  // Group personas by segment for display
  const personasBySegment: Record<string, PersonaVote[]> = {};
  if (voteResult) {
    for (const p of voteResult.allPersonas) {
      if (!personasBySegment[p.segment]) personasBySegment[p.segment] = [];
      personasBySegment[p.segment].push(p);
    }
  }

  return (
    <div>
      {!hasKey ? (
        /* ---- Onboarding: split-screen layout (Mint Fresh) ---- */
        <div style={{ minHeight: '100vh', background: '#f2f8f6', display: 'flex', flexDirection: 'column' }}>
          {/* Top bar with title */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #d8ece4', background: '#f4faf8' }}>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#0a1f18' }}>Decision Wolf</span>
          </div>

          {/* Main split content */}
          <div className="v4-onboarding-grid" style={{ flex: 1 }}>
            {/* Left: copy + auth */}
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#059669', marginBottom: '14px', fontWeight: 600 }}>
                Synthetic Audience Intelligence
              </div>
              <h1 style={{ fontSize: '34px', fontWeight: 800, lineHeight: 1.15, marginBottom: '16px', color: '#0a1f18' }}>
                Unleash the pack<br />on any question.
              </h1>
              <p style={{ fontSize: '15px', color: '#3d6858', lineHeight: 1.6, marginBottom: '28px' }}>
                Hundreds of AI-driven voters hunt down the answer to your question across three independent models. Define your audience, sharpen your options, and let the pack decide.
              </p>

              <p style={{ fontSize: '13px', color: '#7aaa98', marginBottom: '10px' }}>
                Choose how to get started:
              </p>

              {/* Auth mode cards */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {([
                  { mode: 'subscriber' as const, label: 'Subscribe', sub: '$10/mo — all models' },
                  { mode: 'demo' as const, label: 'Invite Code', sub: 'Free with code' },
                  { mode: 'byok' as const, label: 'Your API Keys', sub: 'Bring your own' },
                ] as const).map(({ mode, label, sub }) => (
                  <button
                    key={mode}
                    onClick={() => { setAuthMode(mode); setShowKeys(true); }}
                    style={{
                      flex: '1 1 120px', padding: '12px 10px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                      border: (authMode === mode && showKeys) ? '2px solid #059669' : '1px solid #d8ece4',
                      background: (authMode === mode && showKeys) ? '#e6f5ef' : '#ffffff',
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1f18', marginBottom: '2px' }}>{label} <span style={{ fontSize: '11px' }}>&#8250;</span></div>
                    <div style={{ fontSize: '11px', color: '#7aaa98', lineHeight: 1.3 }}>{sub}</div>
                  </button>
                ))}
              </div>

              {/* Auth inputs */}
              {showKeys && (
                <div style={{ marginTop: '4px' }}>
                  {authMode === 'subscriber' ? (
                    <div>
                      {authStep === 'email' && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="email"
                              value={emailInput}
                              onChange={(e) => { setEmailInput(e.target.value); setAuthError(''); }}
                              onKeyDown={(e) => { if (e.key === 'Enter') sendVerificationCode(); }}
                              placeholder="Enter your email"
                              autoFocus
                              style={{
                                flex: 1, padding: '10px 14px', fontSize: '14px',
                                background: '#f6fbf9', borderRadius: '8px', color: '#0a1f18',
                                border: authError ? '1px solid #dc2626' : '1px solid #c8e0d6',
                              }}
                            />
                            <button
                              onClick={sendVerificationCode}
                              disabled={!emailInput.includes('@') || authLoading}
                              style={{
                                padding: '10px 20px', fontSize: '14px', fontWeight: 600,
                                borderRadius: '8px', border: 'none', cursor: 'pointer',
                                background: emailInput.includes('@') ? '#059669' : '#c8e0d6', color: '#fff',
                                opacity: authLoading ? 0.6 : 1,
                              }}
                            >
                              {authLoading ? '...' : 'Send Code'}
                            </button>
                          </div>
                          <p style={{ color: '#7aaa98', fontSize: '11px', margin: '6px 0 0' }}>
                            We'll send a verification code to your email.
                          </p>
                        </div>
                      )}
                      {authStep === 'code' && (
                        <div>
                          <p style={{ color: '#3d6858', fontSize: '13px', marginBottom: '8px' }}>
                            Code sent to <strong>{emailInput}</strong>
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="text"
                              value={verificationCode}
                              onChange={(e) => { setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setAuthError(''); }}
                              onKeyDown={(e) => { if (e.key === 'Enter') verifyCodeAndCheck(); }}
                              placeholder="6-digit code"
                              autoFocus
                              maxLength={6}
                              style={{
                                width: '140px', padding: '10px 14px', fontSize: '18px', letterSpacing: '4px',
                                background: '#f6fbf9', borderRadius: '8px', color: '#0a1f18', textAlign: 'center',
                                border: authError ? '1px solid #dc2626' : '1px solid #c8e0d6',
                              }}
                            />
                            <button
                              onClick={verifyCodeAndCheck}
                              disabled={verificationCode.length !== 6 || authLoading}
                              style={{
                                padding: '10px 20px', fontSize: '14px', fontWeight: 600,
                                borderRadius: '8px', border: 'none', cursor: 'pointer',
                                background: verificationCode.length === 6 ? '#059669' : '#c8e0d6', color: '#fff',
                                opacity: authLoading ? 0.6 : 1,
                              }}
                            >
                              {authLoading ? '...' : 'Verify'}
                            </button>
                          </div>
                        </div>
                      )}
                      {authStep === 'subscribe' && (
                        <div>
                          <p style={{ color: '#3d6858', fontSize: '13px', marginBottom: '12px' }}>
                            Email verified! Subscribe to access all 3 AI models.
                          </p>
                          <button
                            onClick={startSubscription}
                            disabled={authLoading}
                            style={{
                              padding: '12px 24px', fontSize: '15px', fontWeight: 600,
                              borderRadius: '8px', border: 'none', cursor: 'pointer',
                              background: '#059669', color: '#fff',
                              opacity: authLoading ? 0.6 : 1,
                            }}
                          >
                            {authLoading ? 'Redirecting...' : 'Subscribe — $10/month'}
                          </button>
                        </div>
                      )}
                      {authError && (
                        <p style={{ color: '#dc2626', fontSize: '12px', margin: '6px 0 0' }}>{authError}</p>
                      )}
                    </div>
                  ) : authMode === 'demo' ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="text"
                          value={inviteCode}
                          onChange={(e) => saveInviteCode(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') validateInviteCode(); }}
                          placeholder="Enter invite code"
                          autoFocus
                          style={{
                            flex: 1, padding: '10px 14px', fontSize: '14px',
                            background: '#f6fbf9', borderRadius: '8px', color: '#0a1f18',
                            border: inviteError ? '1px solid #dc2626' : inviteCode ? '1px solid #059669' : '1px solid #c8e0d6',
                          }}
                        />
                        <button
                          onClick={validateInviteCode}
                          disabled={!inviteCode.trim() || inviteLoading}
                          style={{
                            padding: '10px 20px', fontSize: '14px', fontWeight: 600,
                            borderRadius: '8px', border: 'none', cursor: 'pointer',
                            background: '#059669', color: '#fff',
                            opacity: inviteLoading ? 0.6 : 1,
                          }}
                        >
                          {inviteLoading ? '...' : 'Continue'}
                        </button>
                      </div>
                      {inviteError && (
                        <p style={{ color: '#dc2626', fontSize: '12px', margin: '6px 0 0' }}>{inviteError}</p>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {([
                        { key: 'openai' as const, label: 'OpenAI', placeholder: 'sk-...', url: 'https://platform.openai.com/api-keys' },
                        { key: 'anthropic' as const, label: 'Anthropic', placeholder: 'sk-ant-...', url: 'https://console.anthropic.com/settings/keys' },
                        { key: 'gemini' as const, label: 'Gemini', placeholder: 'AI...', url: 'https://aistudio.google.com/apikey' },
                      ]).map(({ key: k, label, placeholder, url }) => (
                        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <a href={url} target="_blank" rel="noopener noreferrer"
                            style={{ color: '#3d6858', fontSize: '12px', minWidth: '74px', textDecoration: 'none' }}>
                            {label} <span style={{ fontSize: '9px', opacity: 0.5 }}>↗</span>
                          </a>
                          <input type="password" value={keys[k]} onChange={(e) => saveKey(k, e.target.value)}
                            placeholder={placeholder}
                            style={{
                              flex: 1, padding: '8px 10px', fontSize: '12px',
                              background: '#f6fbf9', borderRadius: '6px', color: '#0a1f18',
                              border: keys[k] ? '1px solid #059669' : '1px solid #c8e0d6',
                            }}
                          />
                          {keys[k] && <span style={{ color: '#059669', fontSize: '13px' }}>✓</span>}
                        </div>
                      ))}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                        <button
                          onClick={validateByokKeys}
                          disabled={!keys.openai && !keys.anthropic && !keys.gemini || byokLoading}
                          style={{
                            padding: '10px 20px', fontSize: '14px', fontWeight: 600,
                            borderRadius: '8px', border: 'none', cursor: 'pointer',
                            background: (keys.openai || keys.anthropic || keys.gemini) ? '#059669' : '#c8e0d6',
                            color: '#fff',
                            opacity: byokLoading ? 0.6 : 1,
                          }}
                        >
                          {byokLoading ? 'Validating...' : 'Continue'}
                        </button>
                        <span style={{ color: '#7aaa98', fontSize: '11px' }}>At least one key required</span>
                      </div>
                      {byokError && (
                        <p style={{ color: '#dc2626', fontSize: '12px', margin: '6px 0 0' }}>{byokError}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: live viz demo */}
            <div style={{
              background: '#ffffff', borderRadius: '14px',
              padding: '20px 12px', border: '1px solid #d8ece4',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              display: 'flex', flexDirection: 'column',
            }}>
              <p style={{ textAlign: 'center', fontSize: '16px', fontWeight: 600, color: '#0a1f18', margin: '0 0 12px' }}>
                What's the best gummy bear color?
              </p>
              <VoteParticleViz
                segmentVotes={heroMockData.segmentVotes}
                aggregates={heroMockData.aggregates}
                options={HERO_OPTIONS}
                hideHeader
              />
              <p style={{ textAlign: 'center', fontSize: '12px', color: '#7aaa98', margin: '4px 0 0' }}>
                Vote Results — 200 voters
              </p>
            </div>
          </div>

          {/* Bottom: feature highlights */}
          <div className="v4-features-grid" style={{ borderTop: '1px solid #d8ece4' }}>
            {[
              {
                title: 'Three Minds, One Verdict',
                desc: 'GPT, Claude, and Gemini vote independently. Their combined judgment is sharper than any single model alone.',
              },
              {
                title: 'Your Audience, Your Rules',
                desc: 'Define custom segments — "budget-conscious parents," "skeptical engineers," "Gen Z foodies" — and see how each group votes differently.',
              },
              {
                title: 'Not Just a Vote — a Signal',
                desc: 'Every voter gives a full probability distribution. You get confidence intervals, not just a winner.',
              },
              {
                title: 'The Options You Missed',
                desc: 'Every voter writes in what they wish was on the ballot. See what your blind spots look like, clustered and ranked.',
              },
            ].map((f) => (
              <div key={f.title}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#0a1f18', marginBottom: '6px' }}>{f.title}</div>
                <div style={{ fontSize: '13px', color: '#3d6858', lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      ) : step === 'input' ? (
        <div style={{ minHeight: '100vh', background: '#f2f8f6', display: 'flex', flexDirection: 'column' }}>
          {/* Header bar */}
          <div style={{
            padding: '12px 24px', display: 'flex', alignItems: 'center',
            borderBottom: '1px solid #d8ece4', background: '#f4faf8',
            position: 'relative', zIndex: 10,
          }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#0a1f18' }}>Decision Wolf</span>
            <div style={{ flex: 1 }} />
            {subscriberEmail && (
              <button
                type="button"
                onClick={openPortal}
                style={{
                  background: 'none', border: 'none', color: '#7aaa98',
                  fontSize: '12px', cursor: 'pointer', padding: '4px 8px',
                }}
              >
                Manage Subscription
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                localStorage.clear();
                document.location.href = document.location.origin + '/?logout=' + Date.now();
              }}
              style={{
                background: 'none', border: 'none', color: '#059669',
                fontSize: '12px', cursor: 'pointer', padding: '4px 8px',
              }}
            >
              Log Out
            </button>
          </div>

          {/* Centered input */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', marginTop: '-60px' }}>
            <p style={{ fontSize: '20px', color: '#0a1f18', fontWeight: 300, marginBottom: '20px' }}>
              Ask a question, let the pack decide
            </p>
            <div style={{ width: '100%', maxWidth: 600 }} className="v3-input-wrapper">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. Which tagline resonates best for our rebrand?"
                style={{ background: '#f6fbf9', border: '1px solid #c8e0d6', borderRadius: '10px', color: '#0a1f18' }}
              />
            <div
              className="v3-attachment-zone"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              {attachments.length >= MAX_ATTACHMENTS
                ? 'Max attachments reached'
                : 'Drop files here or click to attach (PDF, DOCX, images, JSON, HTML, TXT, CSV)'}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_FILE_TYPES}
              style={{ display: 'none' }}
              onChange={(e) => {
                handleFilesSelected(e.target.files);
                e.target.value = '';
              }}
            />
            {attachments.length > 0 && (
              <div className="v3-attachment-chips">
                {attachments.map((att) => (
                  <span key={att.id} className="v3-attachment-chip">
                    <span className="v3-attachment-chip-icon">
                      {att.type === 'image' ? '\ud83d\uddbc' : '\ud83d\udcc4'}
                    </span>
                    <span className="v3-attachment-chip-name">{att.name}</span>
                    <button
                      className="v3-attachment-chip-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveAttachment(att.id);
                      }}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '12px', justifyContent: 'center' }}>
              <button
                disabled={!question.trim()}
                onClick={handleAdvancedSubmit}
                style={{
                  padding: '11px 28px', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
                  border: 'none', cursor: 'pointer',
                  background: '#059669', color: '#fff',
                  opacity: question.trim() ? 1 : 0.5,
                }}
              >
                Choose Options
              </button>
              <button
                disabled={!question.trim()}
                onClick={handleSubmit}
                style={{
                  padding: '11px 20px', borderRadius: '8px', fontSize: '14px',
                  border: '1px solid #c8e0d6', cursor: 'pointer',
                  background: '#eaf5f0', color: '#0a1f18',
                  opacity: question.trim() ? 1 : 0.5,
                }}
              >
                I'm Feeling Lucky
              </button>
            </div>
          </div>
          </div>
        </div>
      ) : step === 'loading' ? (
        <div className="v3-app v3-loading">
          <div className="v2-spinner" />
          <p className="v3-loading-label">{loadingLabel || progressLabel}</p>
        </div>
      ) : step === 'edit-options' ? (
        <div className="v3-app v3-edit-screen">
          <button className="v3-back-btn" onClick={handleReset}>&larr; Back</button>
          <h2 className="v3-edit-header">Edit Options</h2>
          <p className="v3-edit-question">{question}</p>
          <div className="v3-edit-list">
            {options.map((opt, i) => (
              <div key={i} className="v3-edit-item">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => handleOptionChange(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                />
                <button
                  className="v3-edit-refresh"
                  onClick={() => handleOptionRefresh(i)}
                  disabled={optionPool.length === 0}
                  title={optionPool.length > 0 ? 'Swap for a different suggestion' : 'No more suggestions'}
                >
                  &#x21bb;
                </button>
                <button
                  className="v3-edit-delete"
                  onClick={() => handleOptionDelete(i)}
                  disabled={options.length <= 2}
                  title="Remove option"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
          <div className="v3-edit-actions">
            <button
              className="btn-secondary"
              onClick={handleOptionAdd}
              disabled={options.length >= 10}
            >
              Add Option
            </button>
            <button
              className="btn-secondary"
              onClick={handleRegenerateOptions}
            >
              Regenerate
            </button>
            <button
              className="btn-primary"
              onClick={handleContinueFromOptions}
              disabled={!canContinueFromOptions}
            >
              Continue
            </button>
          </div>
        </div>
      ) : step === 'edit-segments' && framework ? (
        <div className="v3-app v3-edit-screen">
          <button className="v3-back-btn" onClick={() => setStep('edit-options')}>&larr; Back</button>
          <h2 className="v3-edit-header">
            <span style={{ color: '#666', fontSize: '12px', fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '8px', verticalAlign: 'middle' }}>Optional</span>
            Audience Segments
          </h2>
          <p style={{ color: '#999', fontSize: '14px', margin: '0 0 16px' }}>
            Describe specific audience segments, or skip to poll the general public.
          </p>
          {framework.segments.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <span style={{ color: '#888', fontSize: '13px' }}>Split:</span>
              {(SPLIT_PRESETS[framework.segments.length] ?? [{ label: 'Even', shares: framework.segments.map(() => Math.round(100 / framework.segments.length)) }]).map((preset) => {
                const isActive = currentSplitLabel() === preset.shares.join(' / ');
                return (
                  <button
                    key={preset.label}
                    onClick={() => handleApplySplit(preset.shares)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '12px',
                      borderRadius: '12px',
                      border: isActive ? '1px solid #4a9eff' : '1px solid #444',
                      background: isActive ? 'rgba(74, 158, 255, 0.15)' : 'transparent',
                      color: isActive ? '#4a9eff' : '#aaa',
                      cursor: 'pointer',
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
              <span style={{ color: '#666', fontSize: '12px', marginLeft: '4px' }}>
                {currentSplitLabel()}
              </span>
            </div>
          )}
          <div className="v3-edit-list">
            {framework.segments.map((seg, i) => (
              <div key={i} className="v3-segment-edit-card" style={{ position: 'relative' }}>
                <textarea
                  className="v3-segment-desc-input"
                  value={seg.description}
                  onChange={(e) => handleSegmentDescChange(i, e.target.value)}
                  placeholder={`e.g. "Budget-conscious parents who prioritize value and practicality"`}
                  rows={3}
                  style={{ width: '100%', paddingRight: framework.segments.length > 1 ? '36px' : undefined }}
                />
                {framework.segments.length > 1 && (
                  <button
                    className="v3-edit-delete"
                    onClick={() => handleSegmentDelete(i)}
                    title="Remove segment"
                    style={{ position: 'absolute', top: '8px', right: '8px' }}
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="v3-edit-actions">
            <button
              className="btn-secondary"
              onClick={handleSegmentAdd}
            >
              + Add Segment
            </button>
            <button
              className="btn-primary"
              onClick={handleContinueFromSegments}
              disabled={!canContinueFromSegments}
            >
              {filledSegments.length > 0 ? 'Continue with segments' : 'Skip — poll general public'}
            </button>
          </div>
        </div>
      ) : step === 'error' ? (
        <div className="v3-app v3-error">
          <p>{errorMsg || 'Something failed. Check your API key and try again.'}</p>
          <button className="btn-primary" onClick={handleReset}>Try Again</button>
        </div>
      ) : step === 'results' && v2Data ? (
        <div className="v3-app v3-results">
          <div className="v3-results-header">
            <h1>{question}</h1>
            <button className="btn-secondary" onClick={handleReset}>New Question</button>
          </div>

          {voteResult?.isUnstable && (
            <div style={{
              padding: '10px 14px',
              marginBottom: '12px',
              background: 'rgba(255, 180, 50, 0.1)',
              border: '1px solid rgba(255, 180, 50, 0.3)',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#e0b040',
            }}>
              Results may not be conclusive — high variance across voter batches. Consider adding more specific segment descriptions or simplifying the options.
            </div>
          )}

          <VoteParticleViz
            key={resultKey}
            segmentVotes={v2Data.segmentVotes}
            aggregates={v2Data.aggregates}
            options={options}
          />

          <div className="v2-vote-stats-row">
            {options.map((opt) => {
              const ranked = [...options].sort((a, b) => (voteResult?.voteCounts[b] ?? 0) - (voteResult?.voteCounts[a] ?? 0));
              const rank = ranked.indexOf(opt);
              const label = rank === 0 ? 'Winner' : rank === 1 ? '2nd Place' : rank === 2 ? '3rd Place' : null;
              return (
                <div key={opt} className={`v2-vote-stat-card ${rank === 0 ? 'winner' : ''}`}>
                  {label && <span className="v2-winner-badge">{label}</span>}
                  <span className="v2-stat-option">{opt}</span>
                  <span className="v2-stat-count">
                    {(voteResult?.voteCounts[opt] ?? 0).toLocaleString()} votes
                  </span>
                  <span className="v2-stat-pct">
                    {(v2Data.aggregates.votePercentages[opt] ?? 0).toFixed(1)}%
                  </span>
                  {voteResult?.confidenceIntervals[opt] && (
                    <span style={{ fontSize: '11px', color: '#888' }}>
                      {voteResult.confidenceIntervals[opt].low.toFixed(1)}–{voteResult.confidenceIntervals[opt].high.toFixed(1)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {hasSegments && (
            <div className="v2-segment-color-legend">
              {v2Data.segmentVotes.map((sv, i) => (
                <span key={sv.segmentName} className="v2-segment-color-legend-item">
                  <span
                    className="v2-legend-dot"
                    style={{ backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
                  />
                  {sv.segmentName} ({formatShare(sv.populationShare)} — {sv.winnerInSegment})
                </span>
              ))}
            </div>
          )}

          {/* Prior debug hidden — enable by setting showPriorDebug */}

          {voteResult && voteResult.writeInClusters.length > 0 && (
            <div style={{ margin: '20px 0', padding: '16px', background: '#1a1a2e', borderRadius: '10px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '15px', color: '#ccc' }}>
                Write-ins — what voters wished was an option
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(showAllWriteIns ? voteResult.writeInClusters : voteResult.writeInClusters.slice(0, 5)).map((cluster) => (
                  <div key={cluster.label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      background: '#2a2a4a',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: '#e0e0e0',
                      fontWeight: 500,
                      minWidth: '40px',
                      textAlign: 'center',
                    }}>
                      {cluster.count}
                    </span>
                    <span style={{ fontSize: '14px', color: '#ddd' }}>{cluster.label}</span>
                    {cluster.examples.length > 0 && (
                      <span style={{ fontSize: '12px', color: '#666' }}>
                        ({cluster.examples.slice(0, 2).join(', ')})
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#555' }}>
                  {voteResult.allPersonas.filter((p) => p.writeIn).length} of {voteResult.totalVotes} voters suggested a write-in
                </p>
                {voteResult.writeInClusters.length > 5 && (
                  <button
                    onClick={() => setShowAllWriteIns(!showAllWriteIns)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#4a9eff',
                      fontSize: '12px',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {showAllWriteIns ? 'Show less' : `Show all ${voteResult.writeInClusters.length}`}
                  </button>
                )}
              </div>
            </div>
          )}

          {voteResult && hasSegments ? (
            <div className="v3-persona-section">
              {voteResult.segmentTallies.map((tally, segIdx) => {
                const segPersonas = personasBySegment[tally.segmentName];
                if (!segPersonas || segPersonas.length === 0) return null;
                const sample = segPersonas.slice(0, 6);
                return (
                  <div key={tally.segmentName} className="v3-persona-group">
                    <h3 className="v3-persona-group-header">
                      <span
                        className="v2-legend-dot"
                        style={{ backgroundColor: SEGMENT_COLORS[segIdx % SEGMENT_COLORS.length] }}
                      />
                      {tally.segmentName}
                      <span style={{ fontWeight: 400, color: '#888', fontSize: '13px', marginLeft: '8px' }}>
                        {tally.totalVotes} voters
                      </span>
                    </h3>
                    {sample.map((p, i) => (
                      <div
                        key={`${p.name}-${i}`}
                        className="v3-persona-card"
                        style={{ animationDelay: `${(segIdx * 6 + i) * 0.05}s` }}
                      >
                        <div className="v3-persona-header">
                          <span className="v3-persona-name">{p.name}{p.description && <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: '6px', fontSize: '12px' }}>{p.description}</span>}</span>
                          <span className="v3-persona-vote-pill">{Object.entries(p.distribution).sort(([,a], [,b]) => b - a)[0]?.[0] ?? p.vote}</span>
                        </div>
                        <p className="v3-persona-comment">{p.reason}</p>
                      </div>
                    ))}
                    {segPersonas.length > 6 && (
                      <p style={{ color: '#666', fontSize: '13px', margin: '4px 0 0 12px' }}>
                        +{segPersonas.length - 6} more voters in this segment
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : voteResult ? (
            <div className="v3-persona-section">
              <h3 style={{ margin: '0 0 12px', fontSize: '15px', color: '#ccc' }}>
                Sample voters
                <span style={{ fontWeight: 400, color: '#888', fontSize: '13px', marginLeft: '8px' }}>
                  {voteResult.totalVotes} total
                </span>
              </h3>
              {voteResult.allPersonas.slice(0, 12).map((p, i) => (
                <div
                  key={`${p.name}-${i}`}
                  className="v3-persona-card"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className="v3-persona-header">
                    <span className="v3-persona-name">{p.name}</span>
                    <span className="v3-persona-vote-pill">{Object.entries(p.distribution).sort(([,a], [,b]) => b - a)[0]?.[0] ?? p.vote}</span>
                  </div>
                  <p className="v3-persona-comment">{p.reason}</p>
                </div>
              ))}
              {voteResult.allPersonas.length > 12 && (
                <p style={{ color: '#666', fontSize: '13px', margin: '4px 0 0 12px' }}>
                  +{voteResult.allPersonas.length - 12} more voters
                </p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
