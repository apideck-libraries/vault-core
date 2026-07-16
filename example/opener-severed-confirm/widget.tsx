import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Vault } from '../../.';
import '../../dist/styles.css';
import { ORIGINS, PROBE_MESSAGE, readMode } from './origins';

// The innermost frame ("vaultjs"), served from 127.0.0.1 — nested two cross-origin
// iframes deep (see outer.tsx / middle.tsx). It renders the REAL
// @apideck/react-vault <Vault> against the REAL Unify service. Nothing about
// window.open is patched here — the opener severance is produced by real
// browser isolation (COOP on the popup's landing page), exactly as in OCTA.
//
// Two things run on this page:
//
// 1. The real <Vault>. If you have a JWT (example/.env) you can drive the full
//    OAuth → confirm flow. Whether the REAL vault callback's opener survives is
//    environment-dependent (that's the production "spotty"); the probe below
//    makes the failure deterministic without a login.
//
// 2. An opener probe. It replays the SHAPE of vault's oauth/callback handoff —
//    open a cross-origin popup, then `window.opener.postMessage(token)` — but
//    against our own probe.html, whose COOP header we control, and with its own
//    message type so the real <Vault> listener never sees it. It demonstrates
//    the browser mechanism, not vault-core's code path: in severed mode the
//    popup's window.opener is null, the message is dropped, and the widget
//    shows exactly what would strand the connection at pending_confirmation.

const { useEffect, useRef, useState } = React;

const mode = readMode();
const severed = mode === 'severed';

const env = (import.meta as any).env ?? {};
const token: string = env.VITE_VAULT_TOKEN ?? '';
const unifiedApi: string = env.VITE_VAULT_UNIFIED_API ?? 'crm';
const serviceId: string = env.VITE_VAULT_SERVICE_ID ?? 'hubspot';
const unifyBaseUrl: string | undefined =
  env.VITE_VAULT_UNIFY_BASE_URL || undefined;

type ProbeResult = 'idle' | 'pending' | 'delivered' | 'dropped';

const OpenerProbe = () => {
  const [result, setResult] = useState<ProbeResult>('idle');
  const resultRef = useRef<ProbeResult>('idle');
  resultRef.current = result;

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if ((event.data as any)?.type === PROBE_MESSAGE) {
        setResult('delivered');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const runProbe = () => {
    setResult('pending');
    // Cross-origin to this widget ([::1] → localhost) and, in severed mode,
    // served with COOP: same-origin — the exact shape of vault's real callback.
    const url = `${ORIGINS.probe}/opener-severed-confirm/probe.html?opener=${mode}`;
    window.open(url, 'opener-probe', 'width=520,height=600');
    // No opener message within the grace window ⇒ it was dropped (severed).
    window.setTimeout(() => {
      if (resultRef.current === 'pending') setResult('dropped');
    }, 3000);
  };

  const status: Record<ProbeResult, { text: string; color: string }> = {
    idle: { text: 'not run yet', color: '#475569' },
    pending: { text: 'waiting for the popup to hand back the token…', color: '#b45309' },
    delivered: {
      text: 'DELIVERED ✅ — window.opener was live, postMessage arrived, /confirm would fire',
      color: '#15803d',
    },
    dropped: {
      text: 'DROPPED ❌ — window.opener was null in the popup, token lost, /confirm never fires → stuck pending_confirmation',
      color: '#b91c1c',
    },
  };

  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        Opener handoff probe (no login required)
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#475569' }}>
        Replays the shape of vault's <code>oauth/callback</code> handoff
        against <code>probe.html</code> — opens a cross-origin popup, then{' '}
        <code>window.opener.postMessage(token)</code>. Demonstrates the browser
        mechanism (no OAuth login needed); it does not exercise the real{' '}
        <code>&lt;Vault&gt;</code> listener.
      </p>
      <button onClick={runProbe} style={{ padding: '8px 14px', cursor: 'pointer' }}>
        Test opener handoff
      </button>
      <div style={{ marginTop: 12, fontSize: 13, color: status[result].color }}>
        <strong>Handoff:</strong> {status[result].text}
      </div>
    </div>
  );
};

const App = () => (
  <div style={{ fontFamily: 'system-ui', padding: 16 }}>
    <div
      style={{
        padding: '8px 12px',
        color: '#fff',
        borderRadius: 6,
        marginBottom: 16,
        background: severed ? '#b91c1c' : '#15803d',
        fontSize: 13,
      }}
    >
      <strong>vaultjs</strong> · <code>{ORIGINS.widget}</code> · opener{' '}
      <strong>{severed ? 'SEVERED' : 'intact'}</strong> · real Unify{' '}
      <code>{unifyBaseUrl ?? 'https://unify.apideck.com'}</code>
    </div>

    <OpenerProbe />

    {token ? (
      <Vault
        token={token}
        open
        unifiedApi={unifiedApi}
        serviceId={serviceId}
        unifyBaseUrl={unifyBaseUrl}
        showButtonLayout
      />
    ) : (
      <div style={{ fontSize: 14, color: '#334155' }}>
        <p>
          No <code>VITE_VAULT_TOKEN</code> set — the probe above still
          demonstrates the opener severance. To also drive the real{' '}
          <code>&lt;Vault&gt;</code> OAuth flow, set a JWT in{' '}
          <code>example/.env</code> (an account in unify's <code>oauthCsrf</code>{' '}
          allowlist, OAuth connector) and restart <code>yarn start</code>.
        </p>
      </div>
    )}
  </div>
);

ReactDOM.render(<App />, document.getElementById('root'));
