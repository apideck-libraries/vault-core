import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {
  SERVICE_ID,
  UNIFIED_API,
  UNIFY_BASE_URL,
  grantStorageKey,
  readMode,
  readRun,
} from './origins';

// REAL vault `oauth/callback` self-confirm stand-in — back on the vault origin
// (localhost), SAME TAB, after the REAL unify → QuickBooks round-trip. In
// ?opener=severed the Vite middleware serves THIS page with COOP: same-origin
// (a browsing-context-group swap), since in production we don't control the
// real callback's effective policy either → window.opener goes null here.
//
// It answers the whole point of the harness:
//   - window.opener — the OLD channel. Expected NULL in severed mode (the
//     confirm_token would have been dropped right here in the legacy flow).
//   - the grant — read back from the tab's vault-origin sessionStorage and
//     single-use-deleted, then POSTed UNAUTHENTICATED with the confirm_token to
//     REAL unify's confirm endpoint (the in-tab self-confirm). No opener needed.

const { useEffect, useState } = React;

const mode = readMode();
const run = readRun();
const serviceId = SERVICE_ID;
const unifiedApi = UNIFIED_API;

// unify delivers the confirm_token in the redirect back to redirect_uri. The
// sequence diagrams (2026-07-16-oauth-confirm-handoff-sequence-diagrams.md) show
// it in the URL FRAGMENT (`…/oauth/callback#nonce&confirm_token&service_id`),
// but the exact carrier (query vs hash) and casing depend on the real unify
// build — so be tolerant: scan BOTH the query string and the hash, accept a few
// common names, and log what actually arrived for in-browser inspection.
function readConfirmToken(): { token: string | null; from: string } {
  const names = ['confirm_token', 'confirmToken', 'confirm-token', 'token'];
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  for (const n of names) {
    const q = search.get(n);
    if (q) return { token: q, from: `query:${n}` };
  }
  for (const n of names) {
    const h = hash.get(n);
    if (h) return { token: h, from: `hash:${n}` };
  }
  return { token: null, from: 'none' };
}

const { token: confirmToken, from: confirmTokenFrom } = readConfirmToken();

// Log the raw URL parts so a human can see exactly how unify delivered the
// token (param name, query vs fragment) if our tolerant scan misses it.
// eslint-disable-next-line no-console
console.log('[grant-handoff callback] location', {
  search: window.location.search,
  hash: window.location.hash,
  confirmToken,
  confirmTokenFrom,
});

const openerAlive = !!window.opener;

let storageReadable = true;
let grant: string | null = null;
try {
  grant = sessionStorage.getItem(grantStorageKey(serviceId));
  if (grant !== null) {
    // Single-use, like the real confirm secret.
    sessionStorage.removeItem(grantStorageKey(serviceId));
  }
} catch {
  storageReadable = false;
}

const grantSurvived = grant !== null;

type Phase = 'confirming' | 'confirmed' | 'confirm-failed' | 'no-grant';

const App = () => {
  const [phase, setPhase] = useState<Phase>(
    grantSurvived && confirmToken ? 'confirming' : 'no-grant'
  );
  const [errorText, setErrorText] = useState<string>('');

  useEffect(() => {
    if (!grantSurvived || !confirmToken) {
      setPhase('no-grant');
      return;
    }
    // In-tab self-confirm against REAL unify: UNAUTHENTICATED body (no Bearer),
    // cross-origin from this localhost page to unify (https://localhost:3050),
    // so a CORS preflight fires — unify handles its own CORS.
    fetch(
      `${UNIFY_BASE_URL}/vault/connections/${unifiedApi}/${serviceId}/confirm`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm_token: confirmToken, grant }),
      }
    )
      .then(async (res) => {
        if (res.ok) {
          setPhase('confirmed');
          window.setTimeout(() => window.close(), 2000);
        } else {
          const body = await res.text().catch(() => '');
          setErrorText(`HTTP ${res.status} ${body.slice(0, 300)}`);
          setPhase('confirm-failed');
        }
      })
      .catch((err) => {
        setErrorText(String(err));
        setPhase('confirm-failed');
      });
  }, []);

  const verdict =
    phase === 'confirmed'
      ? mode === 'severed' && !openerAlive
        ? {
            color: '#15803d',
            title: 'GO ✅ — opener null but self-confirm fired',
            detail:
              'window.opener is null (the legacy flow would have dropped the confirm_token right here), yet the grant survived in the tab’s vault-origin sessionStorage and the in-tab POST /confirm to REAL unify succeeded. The connection will go callable — this is the fix.',
          }
        : {
            color: '#15803d',
            title: 'Self-confirm fired ✅',
            detail: `POST /confirm to REAL unify succeeded in-tab. window.opener is ${
              openerAlive ? 'also alive (intact mode)' : 'null'
            } — the flow never used it. The connection will go callable.`,
          }
      : phase === 'confirming'
      ? {
          color: '#b45309',
          title: 'Confirming in-tab…',
          detail:
            'POSTing { confirm_token, grant } to REAL unify’s confirm endpoint (unauthenticated).',
        }
      : phase === 'confirm-failed'
      ? {
          color: '#b91c1c',
          title: 'Confirm POST failed ❌',
          detail: `The grant survived but the in-tab POST /confirm did not succeed. Left open for inspection. ${errorText}`,
        }
      : {
          color: '#b91c1c',
          title: 'NO-GO ❌ — grant/confirm_token missing',
          detail: storageReadable
            ? `sessionStorage was readable but the grant (${
                grantSurvived ? 'present' : 'MISSING'
              }) or confirm_token (${
                confirmToken ? 'present' : 'MISSING'
              }) was gone. Check the console log for how unify delivered the token.`
            : 'sessionStorage was not readable at the callback (blocked storage?).',
        };

  return (
    <div style={{ fontFamily: 'system-ui', padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>
        vault oauth/callback (in-tab self-confirm)
      </h2>
      <div
        style={{
          padding: '10px 14px',
          borderRadius: 6,
          color: '#fff',
          background: verdict.color,
        }}
      >
        <strong>{verdict.title}</strong>
        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.95 }}>
          {verdict.detail}
        </div>
      </div>
      <table style={{ marginTop: 16, fontSize: 13, color: '#334155' }}>
        <tbody>
          <tr>
            <td style={{ paddingRight: 12 }}>mode</td>
            <td>
              <code>{mode}</code>
            </td>
          </tr>
          <tr>
            <td style={{ paddingRight: 12 }}>window.opener (old channel)</td>
            <td>
              <strong>{openerAlive ? 'LIVE' : 'null'}</strong>
            </td>
          </tr>
          <tr>
            <td style={{ paddingRight: 12 }}>grant via sessionStorage</td>
            <td>
              <strong>{grantSurvived ? 'survived' : 'MISSING'}</strong>
            </td>
          </tr>
          <tr>
            <td style={{ paddingRight: 12 }}>confirm_token</td>
            <td>
              <code>{confirmToken ?? '(none)'}</code> ({confirmTokenFrom})
            </td>
          </tr>
          <tr>
            <td style={{ paddingRight: 12 }}>run</td>
            <td>
              <code>{run}</code>
            </td>
          </tr>
        </tbody>
      </table>
      <p style={{ fontSize: 13, color: '#475569' }}>
        {phase === 'confirmed'
          ? 'This window closes itself shortly, like the real callback. The widget’s status panel flips to callable.'
          : 'Left open for inspection. See the browser console for the raw callback URL unify redirected to.'}
      </p>
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById('root'));
