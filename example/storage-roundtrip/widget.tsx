import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {
  GRANT_MESSAGE,
  ORIGINS,
  READY_MESSAGE,
  REPORT_API,
  RunReport,
  randomId,
  readMode,
} from './shared';

// The embedded-widget stand-in (127.0.0.1, cross-origin iframe). Plays
// vault-core's role in the proposed design:
//
//   1. open the vault-origin launcher popup SYNCHRONOUSLY on click (popup
//      blockers require the user gesture)
//   2. on the launcher's ready ping, deliver a freshly minted grant via
//      postMessage with an EXPLICIT targetOrigin (the vault origin it just
//      opened — derived from configuration, not an inbound-origin allowlist)
//   3. learn the outcome by polling the server (here: the dev middleware's
//      report endpoint; in production: the connection state at unify) — no
//      secret ever travels popup → widget

const { useEffect, useRef, useState } = React;

const mode = readMode();

type State =
  | { phase: 'idle' }
  | { phase: 'pending'; note: string }
  | { phase: 'done'; report: RunReport }
  | { phase: 'timeout'; lastProgress: string };

const App = () => {
  const [state, setState] = useState<State>({ phase: 'idle' });
  const runRef = useRef<string | null>(null);
  const grantRef = useRef<string>('');
  const pollRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as any;
      if (
        data?.type !== READY_MESSAGE ||
        data.run !== runRef.current ||
        !event.source
      ) {
        return;
      }
      // The grant crosses the live opener link exactly once, aimed at the
      // vault origin only. This postMessage is the whole security story: a
      // handed-out URL cannot carry it.
      (event.source as Window).postMessage(
        { type: GRANT_MESSAGE, run: data.run, grant: grantRef.current },
        ORIGINS.vault
      );
      setState({
        phase: 'pending',
        note:
          'handshake complete — grant delivered over the live opener link; waiting for the callback report…',
      });
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  const runExperiment = () => {
    const run = randomId();
    runRef.current = run;
    grantRef.current = `grant-${randomId()}`;
    setState({
      phase: 'pending',
      note: 'popup opened — waiting for the launcher’s ready ping…',
    });
    // Synchronous open inside the click handler; the run id in the URL is a
    // non-secret correlation id.
    window.open(
      `${ORIGINS.vault}/storage-roundtrip/launch.html?opener=${mode}&run=${run}`,
      'storage-roundtrip',
      'width=560,height=680'
    );

    if (pollRef.current) window.clearInterval(pollRef.current);
    const startedAt = Date.now();
    let lastProgress = 'no report received at all';
    pollRef.current = window.setInterval(async () => {
      try {
        const res = await fetch(`${REPORT_API}/result?run=${run}`);
        if (res.ok) {
          const report = (await res.json()) as RunReport;
          // 'launch'/'provider' with ok are progress pings; only a callback
          // report or an explicit refusal ends the run.
          const final =
            report.stage === 'callback' ||
            (report.stage === 'launch' && !report.ok);
          if (final) {
            window.clearInterval(pollRef.current);
            setState({ phase: 'done', report });
            return;
          }
          lastProgress = `last completed hop: ${report.stage} (${report.reason})`;
          setState({
            phase: 'pending',
            note: `popup progress — ${lastProgress}; waiting for the callback report…`,
          });
        }
      } catch {
        // dev server hiccup — keep polling until the deadline
      }
      if (Date.now() - startedAt > 30000) {
        window.clearInterval(pollRef.current);
        setState(s =>
          s.phase === 'done' ? s : { phase: 'timeout', lastProgress }
        );
      }
    }, 500);
  };

  const renderReport = (report: RunReport) => {
    if (report.stage === 'launch') {
      return (
        <div style={{ color: '#b91c1c' }}>
          <strong>Launcher refused: {report.reason}</strong> — the flow never
          reached the provider. {report.reason === 'no-opener'
            ? 'The opener was dead at open time (the one COOP case the design converts from silent strand to loud failure).'
            : ''}
        </div>
      );
    }
    if (report.grantSurvived) {
      const openerDead = !report.openerAlive;
      return (
        <div style={{ color: '#15803d' }}>
          <strong>
            {mode === 'severed' && openerDead
              ? 'GO ✅ — grant survived the COOP swaps; opener was dead.'
              : 'Grant survived ✅.'}
          </strong>{' '}
          The callback self-confirmed in-tab
          {openerDead
            ? ' where today’s opener channel would have dropped the token.'
            : '; the opener channel was also alive (both channels work in this mode).'}
        </div>
      );
    }
    return (
      <div style={{ color: '#b91c1c' }}>
        <strong>NO-GO ❌ — the grant did not survive to the callback.</strong>{' '}
        {report.storageReadable === false
          ? 'sessionStorage was unreadable at the callback.'
          : 'sessionStorage was readable but the grant was gone.'}{' '}
        Design assumption falsified on: <code>{report.userAgent}</code>
      </div>
    );
  };

  return (
    <div style={{ fontFamily: 'system-ui', padding: 16 }}>
      <div
        style={{
          padding: '8px 12px',
          color: '#fff',
          borderRadius: 6,
          marginBottom: 16,
          background: '#0f172a',
          fontSize: 13,
        }}
      >
        <strong>widget</strong> · <code>{ORIGINS.widget}</code> (cross-origin
        iframe) · popup chain mode <strong>{mode}</strong> · provider origin{' '}
        <code>{ORIGINS.provider}</code>
        {ORIGINS.provider.includes('127.0.0.1')
          ? ' (Safari fallback — WebKit can’t load literal-IPv6 URLs)'
          : ''}
      </div>

      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: 16,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          sessionStorage round-trip (proposed confirm-handoff fix, step 0)
        </div>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#475569' }}>
          Opens the vault-origin launcher popup, delivers a grant over the live
          opener link at open time, then the popup navigates{' '}
          <code>launcher → provider{mode === 'severed' ? ' (COOP)' : ''} →
          callback</code> in one tab. The callback reads the grant from
          sessionStorage and reports here via the dev server — the production
          analog of the widget polling unify.
        </p>
        <button
          onClick={runExperiment}
          style={{ padding: '8px 14px', cursor: 'pointer' }}
        >
          Run experiment
        </button>
        <div style={{ marginTop: 12, fontSize: 13 }}>
          {state.phase === 'idle' && (
            <span style={{ color: '#475569' }}>not run yet</span>
          )}
          {state.phase === 'pending' && (
            <span style={{ color: '#b45309' }}>{state.note}</span>
          )}
          {state.phase === 'timeout' && (
            <span style={{ color: '#b91c1c' }}>
              No callback report within 30s ({state.lastProgress}). Popup
              blocked, closed early — or the next hop's origin doesn't load in
              this browser (check what the popup shows). Allow popups for this
              host and re-run.
            </span>
          )}
          {state.phase === 'done' && renderReport(state.report)}
        </div>
      </div>
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById('root'));
