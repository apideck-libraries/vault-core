import * as React from 'react';
import * as ReactDOM from 'react-dom';

// Host page that embeds the Vault (/vault.html) inside an iframe to reproduce
// GH-9546: Vault running in a storage-partitioned third-party iframe where
// sessionStorage is unavailable and the client nonce check fails.
//
// The iframe is kept SAME-ORIGIN on purpose. A sandbox without
// `allow-same-origin` gives the frame an opaque origin, which not only blocks
// storage but also sends `Origin: null` to Unify (CORS-rejected) and breaks
// React init — so Vault never renders and you can't reach an Authorize button
// to observe the nonce failure at all. Instead we keep the frame functional and
// sever ONLY sessionStorage inside it (see vault.tsx ?storage=...), which is the
// behaviour partitioning actually produces.

const { useState } = React;

type StorageMode = 'normal' | 'noop' | 'throw';

const MODES: { value: StorageMode; label: string; hint: string }[] = [
  { value: 'noop', label: 'Severed (drops writes, reads null)', hint: 'reproduces stuck "unconfirmed" — nonce never matches' },
  { value: 'throw', label: 'Denied (throws SecurityError)', hint: 'reproduces the pre-fix generateAndStoreNonce crash' },
  { value: 'normal', label: 'Normal (control)', hint: 'storage works — both builds succeed' },
];

const App = () => {
  const [mode, setMode] = useState<StorageMode>('noop');
  // Bump to force a fresh iframe (re-mount) when the mode changes.
  const [reloadKey, setReloadKey] = useState(0);

  const current = MODES.find((m) => m.value === mode)!;
  // Relative so it resolves under /iframe-test/ alongside this host page.
  const src = `vault.html?storage=${mode}`;

  return (
    <div style={{ fontFamily: 'system-ui', maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <h1 style={{ marginBottom: 4 }}>Vault iframe embedding test</h1>
      <p style={{ color: '#475569', marginTop: 0 }}>
        Reproduces GH-9546: Vault embedded in a storage-partitioned iframe where{' '}
        <code>sessionStorage</code> is unavailable and the client nonce check
        fails. The frame stays same-origin so Vault loads and you can click
        Authorize; only its <code>sessionStorage</code> is severed.
      </p>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: 12,
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          marginBottom: 8,
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>sessionStorage:</span>
          <select
            value={mode}
            onChange={(e) => {
              setMode(e.target.value as StorageMode);
              setReloadKey((k) => k + 1);
            }}
          >
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => setReloadKey((k) => k + 1)}>Reload iframe</button>
        <code style={{ fontSize: 12, color: '#64748b' }}>{src}</code>
      </div>

      <div style={{ marginBottom: 8, fontSize: 13, color: '#475569' }}>
        Current mode — <strong>{current.label}</strong>: {current.hint}.
      </div>

      <iframe
        key={reloadKey}
        title="vault"
        src={src}
        style={{
          width: '100%',
          height: 720,
          border: '2px solid #cbd5e1',
          borderRadius: 8,
        }}
      />
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById('root'));
