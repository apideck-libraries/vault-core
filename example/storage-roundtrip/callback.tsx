import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { postReport, readMode, readRun, storageKey } from './shared';

// Stand-in for the proposed vault `oauth/callback` behaviour: back on the
// vault origin (localhost), SAME TAB, after the COOP-serving provider. It
// answers the experiment's question directly:
//
//   - window.opener — today's channel. Expected NULL in severed mode (the
//     confirm_token would have been dropped right here).
//   - sessionStorage grant — the proposed channel. If it survived the
//     browsing-context-group swaps, the in-tab self-confirm works.
//
// The report POST is the stand-in for the in-tab `POST /confirm`
// (grant + confirm_token), and it is also how the widget — which nothing in
// this tab can reach directly — learns the verdict, exactly as the production
// widget would learn it by polling unify. In severed mode this page is itself
// served with COOP too (another context-group swap), since we don't control
// the real callback's effective policy either.

const mode = readMode();
const run = readRun();

const openerAlive = !!window.opener;

let storageReadable = true;
let grant: string | null = null;
try {
  const raw = sessionStorage.getItem(storageKey(run));
  if (raw) {
    grant = (JSON.parse(raw) as { grant?: string }).grant ?? null;
    // Single-use, like the real confirm secret.
    sessionStorage.removeItem(storageKey(run));
  }
} catch {
  storageReadable = false;
}

const grantSurvived = !!grant;

postReport({
  run,
  mode,
  stage: 'callback',
  ok: grantSurvived,
  grantSurvived,
  grant,
  openerAlive,
  storageReadable,
  userAgent: navigator.userAgent,
});

const verdict = grantSurvived
  ? mode === 'severed' && !openerAlive
    ? {
        color: '#15803d',
        title: 'GO ✅ — proposed channel works where today’s is dead',
        detail:
          'window.opener is null (today’s flow would drop the confirm_token here), but the grant survived the COOP browsing-context-group swaps in this tab’s vault-origin sessionStorage. The in-tab self-confirm just “fired” (reported to the dev server).',
      }
    : {
        color: '#15803d',
        title: 'Grant survived ✅',
        detail: `sessionStorage carried the grant through the chain. window.opener is ${
          openerAlive ? 'also alive (intact mode — both channels work)' : 'null'
        }.`,
      }
  : {
      color: '#b91c1c',
      title: 'NO-GO ❌ — grant did not survive',
      detail: storageReadable
        ? 'sessionStorage was readable but the grant was gone after the navigation chain. On this browser the design’s core assumption is falsified — record the user agent below.'
        : 'sessionStorage was not readable at the callback (blocked storage?). Production would need the legacy opener fallback here.',
    };

// Mirror the real callback: close shortly after a successful self-confirm;
// stay open on failure so the evidence can be inspected.
if (grantSurvived) {
  window.setTimeout(() => window.close(), 5000);
}

const App = () => (
  <div style={{ fontFamily: 'system-ui', padding: 24 }}>
    <h2 style={{ marginTop: 0 }}>Callback (proposed in-tab self-confirm)</h2>
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
          <td style={{ paddingRight: 12 }}>window.opener (today’s channel)</td>
          <td>
            <strong>{openerAlive ? 'LIVE' : 'null'}</strong>
          </td>
        </tr>
        <tr>
          <td style={{ paddingRight: 12 }}>grant via sessionStorage</td>
          <td>
            <strong>{grantSurvived ? `survived (${grant})` : 'MISSING'}</strong>
          </td>
        </tr>
        <tr>
          <td style={{ paddingRight: 12 }}>user agent</td>
          <td>
            <code style={{ fontSize: 11 }}>{navigator.userAgent}</code>
          </td>
        </tr>
      </tbody>
    </table>
    <p style={{ fontSize: 13, color: '#475569' }}>
      {grantSurvived
        ? 'This window closes itself in a few seconds, like the real callback.'
        : 'Left open for inspection.'}
    </p>
  </div>
);

ReactDOM.render(<App />, document.getElementById('root'));
