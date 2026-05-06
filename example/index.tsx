import * as React from 'react';
import { useEffect, useState } from 'react';
import * as ReactDOM from 'react-dom';
import { Vault } from '../.';

const STORAGE_KEY = 'vault-core-example-config';

interface Config {
  token: string;
  unifiedApi: string;
  serviceId: string;
  unifyBaseUrl: string;
  showButtonLayout: boolean;
}

const defaultConfig: Config = {
  token: '',
  unifiedApi: 'crm',
  serviceId: 'hubspot',
  unifyBaseUrl: '',
  showButtonLayout: false,
};

const loadConfig = (): Config => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultConfig;
    return { ...defaultConfig, ...JSON.parse(raw) };
  } catch {
    return defaultConfig;
  }
};

const saveConfig = (cfg: Config) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
};

const listNonceKeys = (): { key: string; value: string }[] => {
  const out: { key: string; value: string }[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k && k.startsWith('apideck_oauth_nonce_')) {
      out.push({ key: k, value: sessionStorage.getItem(k) ?? '' });
    }
  }
  return out;
};

const App = () => {
  const [config, setConfig] = useState<Config>(loadConfig());
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [nonces, setNonces] = useState<{ key: string; value: string }[]>(
    listNonceKeys()
  );

  const log = (line: string) => {
    setLogs((l) => [`[${new Date().toISOString().slice(11, 23)}] ${line}`, ...l]);
    setNonces(listNonceKeys());
  };

  const update = (patch: Partial<Config>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    saveConfig(next);
  };

  // Capture every oauth_* postMessage and surface it
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e?.data;
      if (
        data &&
        (data.type === 'oauth_complete' || data.type === 'oauth_error')
      ) {
        log(`postMessage ${data.type} from ${e.origin} :: ${JSON.stringify(data)}`);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Refresh nonce list periodically so the dev can watch it appear/disappear
  useEffect(() => {
    const id = setInterval(() => setNonces(listNonceKeys()), 500);
    return () => clearInterval(id);
  }, []);

  const tokenLooksValid = config.token.split('.').length === 3;

  return (
    <div
      style={{
        padding: 24,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: 960,
      }}
    >
      <h1 style={{ marginTop: 0 }}>Vault CSRF tester</h1>
      <p style={{ color: '#555' }}>
        Use a session JWT from an account in unify's <code>oauthCsrf</code>{' '}
        allowlist (<code>22222222</code>, <code>11111111</code>,{' '}
        <code>cm3mogvfz004ebogk8rqdbgpi</code>) to exercise the full nonce →
        postMessage → /confirm flow. Any other account exercises the
        backwards-compat <code>child.closed</code> fallback.
      </p>

      <fieldset style={{ display: 'grid', gap: 8, padding: 12 }}>
        <legend>Config (persisted to localStorage)</legend>
        <label>
          JWT&nbsp;
          <input
            value={config.token}
            onChange={(e) => update({ token: e.target.value })}
            placeholder="eyJhbGciOi..."
            style={{ width: '100%', fontFamily: 'monospace' }}
          />
          {!config.token ? null : tokenLooksValid ? (
            <span style={{ color: 'green' }}> ✓ JWT shape</span>
          ) : (
            <span style={{ color: 'red' }}> ✗ not a JWT (need a.b.c)</span>
          )}
        </label>
        <label>
          Unified API&nbsp;
          <input
            value={config.unifiedApi}
            onChange={(e) => update({ unifiedApi: e.target.value })}
          />
        </label>
        <label>
          Service ID&nbsp;
          <input
            value={config.serviceId}
            onChange={(e) => update({ serviceId: e.target.value })}
          />
        </label>
        <label>
          unifyBaseUrl (blank = production)&nbsp;
          <input
            value={config.unifyBaseUrl}
            onChange={(e) => update({ unifyBaseUrl: e.target.value })}
            placeholder="https://unify.apideck.com"
            style={{ width: 360 }}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={config.showButtonLayout}
            onChange={(e) => update({ showButtonLayout: e.target.checked })}
          />{' '}
          showButtonLayout (exercises ButtonLayoutMenu's authorize/re-authorize
          paths)
        </label>
      </fieldset>

      <div style={{ marginTop: 12 }}>
        <button
          onClick={() => setOpen(true)}
          disabled={!config.token}
          style={{ padding: '8px 16px', fontSize: 14 }}
        >
          Open Vault
        </button>
        &nbsp;
        <button
          onClick={() => {
            listNonceKeys().forEach(({ key }) => sessionStorage.removeItem(key));
            setNonces([]);
            log('cleared all apideck_oauth_nonce_* keys');
          }}
        >
          Clear nonces
        </button>
        &nbsp;
        <button onClick={() => setLogs([])}>Clear log</button>
      </div>

      <Vault
        token={config.token}
        open={open}
        onClose={() => {
          setOpen(false);
          log('Vault closed');
        }}
        unifiedApi={config.unifiedApi}
        serviceId={config.serviceId}
        unifyBaseUrl={config.unifyBaseUrl || undefined}
        showButtonLayout={config.showButtonLayout}
        onConnectionChange={(c: any) => {
          log(
            `onConnectionChange :: state=${c?.state} health=${
              c?.health ?? '—'
            } enabled=${c?.enabled}`
          );
        }}
      />

      <h2>SessionStorage nonces</h2>
      {nonces.length === 0 ? (
        <p style={{ color: '#888' }}>(none)</p>
      ) : (
        <ul style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {nonces.map((n) => (
            <li key={n.key}>
              <strong>{n.key}</strong> = {n.value}
            </li>
          ))}
        </ul>
      )}

      <h2>Event log</h2>
      <pre
        style={{
          background: '#111',
          color: '#0f0',
          padding: 12,
          maxHeight: 400,
          overflow: 'auto',
          fontSize: 12,
        }}
      >
        {logs.length ? logs.join('\n') : '(no events yet — click Authorize)'}
      </pre>

      <h2>What to look for</h2>
      <ol style={{ color: '#444' }}>
        <li>
          Click <em>Open Vault</em> → Authorize the connector. The popup URL
          should contain <code>&amp;nonce=…</code>.
        </li>
        <li>
          Watch <em>SessionStorage nonces</em>: the key{' '}
          <code>apideck_oauth_nonce_{config.serviceId}</code> should appear when
          the popup opens and disappear after the confirm round-trip.
        </li>
        <li>
          When the popup closes, look for a postMessage entry in the log
          (<code>oauth_complete</code> or <code>oauth_error</code>). On
          allowlisted accounts only.
        </li>
        <li>
          Network tab → <code>POST /vault/connections/{config.unifiedApi}/
          {config.serviceId}/confirm</code> should fire with body{' '}
          <code>{`{ "confirm_token": "..." }`}</code>.
        </li>
        <li>
          <code>onConnectionChange</code> should land with{' '}
          <code>state=callable</code>. If it shows{' '}
          <code>health=pending_confirmation</code> briefly, the badge logic is
          working.
        </li>
      </ol>
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById('root'));
