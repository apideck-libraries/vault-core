import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Vault } from '../../.';
import '../../dist/styles.css';

// This page is meant to be loaded *inside* an iframe (see iframe.html).
//
// To reproduce GH-9546 faithfully we keep the frame SAME-ORIGIN — so Vault
// loads, its Unify API calls succeed (real Origin, not `null`), and the
// Authorize button renders — and then sever ONLY sessionStorage, the way a
// storage-partitioned / storage-blocked third-party iframe does in production.
//
//   ?storage=normal  → untouched (control)
//   ?storage=noop    → severed: writes are dropped, reads return null
//                      (reproduces "nonce never matches → stuck unconfirmed")
//   ?storage=throw   → denied: every sessionStorage op throws SecurityError
//                      (reproduces the pre-fix generateAndStoreNonce crash)
//
// Config comes from the same example/.env (see .env.example):
//   VITE_VAULT_TOKEN, VITE_VAULT_UNIFIED_API, VITE_VAULT_SERVICE_ID,
//   VITE_VAULT_UNIFY_BASE_URL (optional, e.g. staging)

type StorageMode = 'normal' | 'noop' | 'throw';

const storageMode = ((): StorageMode => {
  const m = new URLSearchParams(window.location.search).get('storage');
  return m === 'noop' || m === 'throw' ? m : 'normal';
})();

// Replace window.sessionStorage with a shim. We only touch sessionStorage (not
// localStorage) to keep the blast radius tight — the shim's getter still
// returns an object, so `typeof sessionStorage`/existence checks keep working;
// only the actual read/write ops change behaviour.
function installStorageShim(mode: StorageMode): boolean {
  if (mode === 'normal') return true;

  const denied = () => {
    throw new DOMException(
      "Failed to execute on 'Storage': access is denied for this document.",
      'SecurityError'
    );
  };

  const shim: Storage =
    mode === 'throw'
      ? ({
          length: 0,
          clear: denied,
          getItem: denied,
          key: denied,
          removeItem: denied,
          setItem: denied,
        } as unknown as Storage)
      : ({
          // "severed" partition: writes silently dropped, reads always null.
          length: 0,
          clear: () => undefined,
          getItem: () => null,
          key: () => null,
          removeItem: () => undefined,
          setItem: () => undefined,
        } as unknown as Storage);

  try {
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get: () => shim,
    });
    return true;
  } catch {
    return false;
  }
}

const shimInstalled = installStorageShim(storageMode);

const env = (import.meta as any).env ?? {};
const token: string = env.VITE_VAULT_TOKEN ?? '';
const unifiedApi: string = env.VITE_VAULT_UNIFIED_API ?? 'crm';
const serviceId: string = env.VITE_VAULT_SERVICE_ID ?? 'hubspot';
const unifyBaseUrl: string | undefined = env.VITE_VAULT_UNIFY_BASE_URL;

// Probe what sessionStorage actually does in this frame, post-shim.
function probeStorage(): { ok: boolean; detail: string } {
  try {
    const k = '__vault_iframe_probe__';
    window.sessionStorage.setItem(k, '1');
    const readBack = window.sessionStorage.getItem(k);
    window.sessionStorage.removeItem(k);
    if (readBack !== '1') {
      return { ok: false, detail: 'writes are dropped (read-back is null)' };
    }
    return { ok: true, detail: 'sessionStorage reads/writes work' };
  } catch (err) {
    return {
      ok: false,
      detail: `sessionStorage threw: ${(err as Error)?.name}: ${
        (err as Error)?.message
      }`,
    };
  }
}

const StorageBanner = () => {
  const probe = probeStorage();
  return (
    <div
      style={{
        fontFamily: 'system-ui',
        fontSize: 13,
        padding: '6px 12px',
        color: '#fff',
        background: probe.ok ? '#15803d' : '#b91c1c',
      }}
      data-testid="storage-banner"
    >
      <strong>{probe.ok ? 'storage: AVAILABLE' : 'storage: BLOCKED'}</strong>
      {' — mode='}
      <code>{storageMode}</code>
      {shimInstalled ? '' : ' (shim install FAILED)'}
      {' · '}
      {probe.detail}
    </div>
  );
};

const App = () => {
  if (!token) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h1>No JWT configured</h1>
        <p>
          Create <code>example/.env</code> with <code>VITE_VAULT_TOKEN=…</code>{' '}
          (see <code>.env.example</code>) and restart <code>yarn start</code>.
        </p>
      </div>
    );
  }

  return (
    <>
      <StorageBanner />
      <Vault
        token={token}
        open
        unifiedApi={unifiedApi}
        serviceId={serviceId}
        unifyBaseUrl={unifyBaseUrl}
      />
    </>
  );
};

ReactDOM.render(<App />, document.getElementById('root'));
