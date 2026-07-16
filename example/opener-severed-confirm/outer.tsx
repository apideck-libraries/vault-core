import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { ORIGINS, readMode } from './origins';

// Top-level host page ("OctaFlow"). It embeds the middle frame from a DIFFERENT
// origin ([::1]), which in turn embeds the widget from a third origin
// (127.0.0.1) — reproducing OCTA's nested cross-origin iframe chain with real
// browser isolation, not a window.open override.
//
// The ?opener=severed | intact mode is threaded down to every frame via the
// iframe src query, and (for severed) the Vite dev middleware attaches
// `Cross-Origin-Opener-Policy: same-origin` to the popup's landing page so the
// popup's window.opener is genuinely null.

const mode = readMode();
const severed = mode === 'severed';
const middleSrc = `${ORIGINS.middle}/opener-severed-confirm/middle.html?opener=${mode}`;

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
        window.opener: {severed ? 'SEVERED (COOP: same-origin)' : 'intact'}
      </strong>{' '}
      — top <code>{ORIGINS.outer}</code> ▸ iframe <code>{ORIGINS.middle}</code>{' '}
      ▸ iframe <code>{ORIGINS.widget}</code> · {link('intact', 'intact')} |{' '}
      {link('severed', 'severed (OCTA)')}
      <div style={{ marginTop: 4, opacity: 0.9 }}>
        {severed
          ? 'The OAuth popup lands on a page served with COOP: same-origin, cross-origin to the widget → window.opener is null → vault would drop the confirm_token → stuck pending_confirmation.'
          : 'The OAuth popup keeps its opener → vault postMessages the confirm_token back → widget calls /confirm → callable.'}
      </div>
    </div>
    <iframe
      title="middle (OctaCore)"
      src={middleSrc}
      style={{ width: '100%', height: 'calc(100vh - 62px)', border: 'none' }}
    />
  </div>
);

ReactDOM.render(<App />, document.getElementById('root'));
