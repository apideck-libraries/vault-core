import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { ORIGINS, OPENER_COOKIE, readMode } from './origins';

// Top-level host page. It embeds the middle frame from a DIFFERENT origin
// ([::1]), which in turn embeds the widget from a third origin (127.0.0.1) —
// reproducing OCTA's nested cross-origin iframe chain with real browser
// isolation. The ?opener=severed | intact mode is threaded down to every frame
// via the iframe src query; in severed mode the Vite dev middleware attaches
// `Cross-Origin-Opener-Policy: same-origin` to the OAuth popup's callback page
// so the popup's window.opener is genuinely null at callback time — exactly the
// production condition.
//
// The point this harness makes (vs ../opener-severed-confirm/, where severed
// mode strands the connection): the NEW grant-handoff flow reaches state
// `callable` in BOTH modes, because the vault callback self-confirms in-tab
// with the grant it read from sessionStorage — it no longer needs the opener.

const mode = readMode();
const severed = mode === 'severed';

// Real unify redirects the browser back to /oauth/callback WITHOUT our ?opener
// param, so the dev server can't read the mode off the callback request's query.
// Persist it in a localhost cookie instead: outer and the callback are both
// localhost, and a SameSite=Lax cookie is sent on the top-level navigation unify
// triggers, surviving the real-unify round-trip. The dev server reads it to
// decide whether to apply COOP to the callback (see grantHandoffPlugin).
if (typeof document !== 'undefined') {
  document.cookie = `${OPENER_COOKIE}=${mode}; path=/; SameSite=Lax`;
}

const middleSrc = `${ORIGINS.middle}/grant-handoff/middle.html?opener=${mode}`;

const link = (m: string, label: string) => (
  <a
    href={`?opener=${m}`}
    style={{
      color: '#fff',
      fontWeight: mode === m ? 700 : 400,
      textDecoration: mode === m ? 'underline' : 'none',
    }}
  >
    {label}
  </a>
);

const App = () => (
  <div style={{ fontFamily: 'system-ui', margin: 0 }}>
    <div
      style={{
        padding: '10px 16px',
        color: '#fff',
        background: severed ? '#b91c1c' : '#15803d',
        font: '13px/1.5 system-ui',
      }}
    >
      <strong>
        NEW grant-handoff flow · window.opener:{' '}
        {severed ? 'SEVERED (COOP: same-origin)' : 'intact'}
      </strong>{' '}
      — top <code>{ORIGINS.outer}</code> ▸ iframe <code>{ORIGINS.middle}</code>{' '}
      ▸ iframe <code>{ORIGINS.widget}</code> · {link('intact', 'intact')} |{' '}
      {link('severed', 'severed (OCTA repro)')}
      <div style={{ marginTop: 4, opacity: 0.9 }}>
        {severed
          ? 'The OAuth popup completes the REAL unify + QuickBooks round-trip, then lands on our /oauth/callback served with COOP: same-origin, cross-origin to the widget → window.opener is null. The OLD channel that would have carried the confirm_token back is dead — yet the callback self-confirms in-tab with the grant, so the connection still reaches callable.'
          : 'Happy path: the opener survives the whole chain, but the callback still self-confirms in-tab with the grant (never uses the opener) — the connection reaches callable.'}
      </div>
    </div>
    <iframe
      title="middle"
      src={middleSrc}
      style={{ width: '100%', height: 'calc(100vh - 62px)', border: 'none' }}
    />
  </div>
);

ReactDOM.render(<App />, document.getElementById('root'));
