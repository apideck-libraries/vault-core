import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { PROBE_MESSAGE, readMode } from './origins';

// This page stands in for vault's real oauth/callback (vault/src/pages/oauth/
// callback.tsx). It runs the identical guarded handoff:
//
//   if (window.opener) window.opener.postMessage({ confirm_token, ... }, '*')
//   else               // token silently dropped
//
// It is opened as a popup by the widget ([::1]) and is itself served from
// localhost — cross-origin to the opener. In `?opener=severed` the Vite dev
// middleware serves THIS page with `Cross-Origin-Opener-Policy: same-origin`;
// because the opener is cross-origin, the browser puts the popup in its own
// browsing-context group and `window.opener` is null. No JS override — this is
// the real COOP mechanism, and it's the same header a provider/vault page can
// set in production to cause the "spotty" OCTA failure.

const mode = readMode();
const hasOpener = !!window.opener;

// Mirror the callback guard exactly.
if (hasOpener) {
  window.opener.postMessage(
    {
      type: PROBE_MESSAGE,
      confirmToken: 'probe-confirm-token',
      serviceId: 'probe',
      success: true,
    },
    '*'
  );
}

const App = () => (
  <div style={{ fontFamily: 'system-ui', padding: 24 }}>
    <h2 style={{ marginTop: 0 }}>OAuth callback (probe)</h2>
    <div
      style={{
        padding: '10px 14px',
        borderRadius: 6,
        color: '#fff',
        background: hasOpener ? '#15803d' : '#b91c1c',
      }}
    >
      <strong>
        window.opener is {hasOpener ? 'LIVE' : 'null'} (mode: {mode})
      </strong>
      <div style={{ marginTop: 6, fontSize: 13, opacity: 0.95 }}>
        {hasOpener
          ? 'Posted the confirm_token back to the opener — the widget receives it and would call POST /confirm.'
          : 'No opener to postMessage to → the confirm_token is dropped, just like vault/src/pages/oauth/callback.tsx. The connection would stay pending_confirmation.'}
      </div>
    </div>
    <p style={{ fontSize: 13, color: '#475569' }}>
      You can close this window.
    </p>
    <button onClick={() => window.close()} style={{ padding: '6px 12px' }}>
      Close
    </button>
  </div>
);

ReactDOM.render(<App />, document.getElementById('root'));

// In the working case, auto-close shortly after handing back the token so the
// popup behaves like the real callback (which calls window.close()).
if (hasOpener) {
  window.setTimeout(() => window.close(), 1200);
}
