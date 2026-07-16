import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { ORIGINS, readMode } from './shared';

// Top-level customer-page stand-in (localhost). Embeds the widget from a
// different origin (127.0.0.1) so the widget → popup handshake crosses a real
// origin boundary, like an embedded vault-core widget. Deeper nesting is
// deliberately omitted: ../opener-severed-confirm/ already established that
// nesting depth is irrelevant to opener severance, and it is equally
// irrelevant to what happens inside the popup tab.

const mode = readMode();
const severed = mode === 'severed';
const widgetSrc = `${ORIGINS.widget}/storage-roundtrip/widget.html?opener=${mode}`;

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
        sessionStorage round-trip experiment · popup chain COOP:{' '}
        {severed ? 'same-origin (severed)' : 'none (intact)'}
      </strong>{' '}
      — {link('intact', 'intact')} | {link('severed', 'severed (the OCTA condition)')}
      <div style={{ marginTop: 4, opacity: 0.9 }}>
        Tests the proposed confirm-handoff fix: grant handed into the popup at
        open time, stored in the tab’s vault-origin sessionStorage, read back
        by the callback after {severed ? 'COOP-swapping' : 'plain'} cross-origin
        navigations. Expected in severed mode: opener DEAD, grant ALIVE.
      </div>
    </div>
    <iframe
      title="widget"
      src={widgetSrc}
      style={{ width: '100%', height: 'calc(100vh - 78px)', border: 'none' }}
    />
  </div>
);

ReactDOM.render(<App />, document.getElementById('root'));
