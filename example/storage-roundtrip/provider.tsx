import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { ORIGINS, postReport, readMode, readRun, storageKey } from './shared';

// Provider stand-in, served from [::1] — cross-origin to the launcher and the
// callback (both localhost). In `?opener=severed` the Vite middleware serves
// THIS page with `Cross-Origin-Opener-Policy: same-origin`, which swaps the
// tab's browsing-context group and severs window.opener — the mid-chain
// severance a real provider can cause and that the proposed design must
// survive. After a short "consent" pause it navigates on to the callback,
// like a provider redirecting to the OAuth redirect_uri.

const mode = readMode();
const run = readRun();
const severed = mode === 'severed';
const openerAlive = !!window.opener;

// A different origin means a different sessionStorage bucket: the grant the
// launcher stored on localhost must be invisible here. Read it to prove it.
let grantVisibleHere = false;
try {
  grantVisibleHere = sessionStorage.getItem(storageKey(run)) !== null;
} catch {
  grantVisibleHere = false;
}

// Progress ping: proves the provider hop loaded (Safari, notably, cannot load
// literal-IPv6 origins at all — see shared.ts).
postReport({
  run,
  mode,
  stage: 'provider',
  ok: true,
  reason: 'provider reached',
  openerAlive,
});

window.setTimeout(() => {
  window.location.replace(
    `${ORIGINS.vault}/storage-roundtrip/callback.html?opener=${mode}&run=${run}`
  );
}, 1200);

const App = () => (
  <div style={{ fontFamily: 'system-ui', padding: 24 }}>
    <h2 style={{ marginTop: 0 }}>Provider (consent stand-in)</h2>
    <div
      style={{
        padding: '10px 14px',
        borderRadius: 6,
        color: '#fff',
        background: severed ? '#b91c1c' : '#15803d',
      }}
    >
      <strong>
        served {severed ? 'WITH COOP: same-origin' : 'without COOP'} ·
        window.opener is {openerAlive ? 'LIVE' : 'null'}
      </strong>
      <div style={{ marginTop: 6, fontSize: 13, opacity: 0.95 }}>
        {severed
          ? 'The browsing-context group just swapped — the opener channel is dead for the rest of this tab’s life. The experiment asks whether sessionStorage survives this.'
          : 'No COOP anywhere — the opener survives the whole chain (today’s happy path).'}
      </div>
    </div>
    <p style={{ fontSize: 13, color: '#475569' }}>
      run <code>{run}</code> · origin <code>{window.location.origin}</code> ·
      grant visible from this origin:{' '}
      <strong>{grantVisibleHere ? 'YES (unexpected!)' : 'no'}</strong> — it
      lives in another origin’s sessionStorage bucket, so the provider can’t
      read it.
    </p>
    <p style={{ fontSize: 13, color: '#475569' }}>Redirecting to the callback…</p>
  </div>
);

ReactDOM.render(<App />, document.getElementById('root'));
