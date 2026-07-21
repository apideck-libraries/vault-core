import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Vault } from '../../.';
import '../../dist/styles.css';
import {
  ORIGINS,
  SERVICE_ID,
  UNIFIED_API,
  UNIFY_BASE_URL,
  readMode,
} from './origins';

// The innermost frame, served from 127.0.0.1 — nested two cross-origin iframes
// deep (see outer.tsx / middle.tsx). It renders the REAL @apideck/react-vault
// <Vault> on the NEW grant-handoff code path (openGrantHandoffPopup +
// watchPopupCloseAndPoll in src/utils/oauthGrantHandoff.ts, wired from
// src/components/AuthorizeButton.tsx). Nothing about window.open is patched;
// the opener severance is produced by real browser isolation (COOP on the
// popup's callback page), exactly as in OCTA.
//
// This is a REAL end-to-end run against REAL local unify (https://localhost:3050):
//   - <Vault> mints a REAL grant   → POST {unify}/vault/connections/accounting/quickbooks/grant
//   - opens {vault}/oauth/launch   → our COOP-free stand-in (localhost)
//   - hands the grant over via the production postMessage handshake
//   - launch navigates the tab to the REAL unify authorize_url → REAL QuickBooks
//   - unify mints a confirm_token, redirects to {vault}/oauth/callback
//   - our callback self-confirms in-tab against REAL unify
// Nothing here is stubbed.

const { useEffect, useState } = React;

const mode = readMode();
const severed = mode === 'severed';

// REAL unify-issued session JWT (mint with grant-handoff/mint-session.sh, which
// writes VITE_VAULT_TOKEN into example/.env). Its top-level `redirect_uri` claim
// is load-bearing: deriveLaunchUrl takes its origin (http://localhost:1234) as
// launchOrigin and opens http://localhost:1234/oauth/launch?service_id=…, so the
// launch page is served from the same origin the handshake pins.
const env = (import.meta as any).env ?? {};
const token: string = env.VITE_VAULT_TOKEN ?? '';
const unifiedApi: string = UNIFIED_API;
const serviceId: string = SERVICE_ID;
const unifyBaseUrl: string = UNIFY_BASE_URL;

// App + consumer for the live-state poll headers (see example/.env / mint recipe).
const APP_ID = '2222';
const CONSUMER_ID = 'test-consumer';

type ConnState = 'loading' | 'error' | string;

// Optional live view of the REAL unify connection state (added → callable),
// polled directly from the widget with the session JWT headers. Purely
// diagnostic — the actual pass/fail is unify flipping the connection to
// `callable` after the in-tab self-confirm.
const StatusPanel = () => {
  const [state, setState] = useState<ConnState>('loading');

  useEffect(() => {
    if (!token) return;
    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch(
          `${unifyBaseUrl}/vault/connections/${unifiedApi}/${serviceId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'X-APIDECK-APP-ID': APP_ID,
              'X-APIDECK-CONSUMER-ID': CONSUMER_ID,
            },
          }
        );
        const body = await res.json();
        if (!stop) setState(body?.data?.state ?? 'unknown');
      } catch {
        if (!stop) setState('error');
      }
    };
    poll();
    const id = window.setInterval(poll, 1500);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, []);

  const callable = state === 'callable';
  const bg = callable ? '#15803d' : state === 'loading' ? '#475569' : '#b45309';

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 2147483647,
        background: bg,
        color: '#fff',
        font: '13px/1.5 system-ui',
        padding: '10px 16px',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.25)',
      }}
    >
      <strong>
        Live connection state (real unify):{' '}
        {callable ? 'callable ✅ (PASS)' : `${state} (waiting…)`}
      </strong>
      <div style={{ marginTop: 4, opacity: 0.95 }}>
        {callable
          ? severed
            ? 'PASS — window.opener was severed by COOP on the callback (old channel dead) yet the connection reached callable: the vault callback self-confirmed in-tab with the grant. This is exactly what the grant-handoff fix buys.'
            : 'PASS — connection reached callable via the in-tab self-confirm (the opener was never needed).'
          : `Polling ${unifyBaseUrl}/vault/connections/${unifiedApi}/${serviceId} every 1.5s. Click Authorize, complete the REAL QuickBooks consent, and this flips to callable.`}
      </div>
    </div>
  );
};

const App = () => (
  <div style={{ fontFamily: 'system-ui', padding: '16px 16px 96px' }}>
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
      <strong>widget</strong> · <code>{ORIGINS.widget}</code> · opener{' '}
      <strong>{severed ? 'SEVERED' : 'intact'}</strong> · REAL unify E2E — NEW
      grant-handoff flow · unify <code>{unifyBaseUrl}</code>
    </div>

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
          No <code>VITE_VAULT_TOKEN</code> set. Mint a REAL unify session token
          (it must carry a top-level <code>redirect_uri</code> claim of{' '}
          <code>http://localhost:1234/oauth/callback</code>) and write it into{' '}
          <code>example/.env</code>:
        </p>
        <pre
          style={{
            background: '#0f172a',
            color: '#e2e8f0',
            padding: 12,
            borderRadius: 6,
            fontSize: 12,
            overflowX: 'auto',
          }}
        >
          UNIFY_ADMIN_API_KEY=… ./grant-handoff/mint-session.sh
        </pre>
        <p>
          then restart <code>yarn start</code>. See{' '}
          <code>grant-handoff/README.md</code>.
        </p>
      </div>
    )}

    <StatusPanel />
  </div>
);

ReactDOM.render(<App />, document.getElementById('root'));
