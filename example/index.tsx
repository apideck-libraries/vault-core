import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Vault } from '../.';

// Configure via example/.env (see .env.example):
//   VITE_VAULT_TOKEN, VITE_VAULT_UNIFIED_API, VITE_VAULT_SERVICE_ID,
//   VITE_VAULT_UNIFY_BASE_URL (optional, e.g. staging)
const env = (import.meta as any).env ?? {};
const token: string = env.VITE_VAULT_TOKEN ?? '';
const unifiedApi: string = env.VITE_VAULT_UNIFIED_API ?? 'crm';
const serviceId: string = env.VITE_VAULT_SERVICE_ID ?? 'hubspot';
const unifyBaseUrl: string | undefined = env.VITE_VAULT_UNIFY_BASE_URL;

const App = () => {
  if (!token) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h1>No JWT configured</h1>
        <p>
          Create <code>example/.env</code> with{' '}
          <code>VITE_VAULT_TOKEN=…</code> (see <code>.env.example</code>) and
          restart <code>yarn start</code>.
        </p>
      </div>
    );
  }

  return (
    <Vault
      token={token}
      open
      unifiedApi={unifiedApi}
      serviceId={serviceId}
      unifyBaseUrl={unifyBaseUrl}
    />
  );
};

ReactDOM.render(<App />, document.getElementById('root'));
