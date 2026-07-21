import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { grantStorageKey } from './origins';

// REAL vault `oauth/launch` stand-in — the popup's FIRST document, on the vault
// origin (localhost), served WITHOUT COOP (the /oauth/launch rewrite in
// ../vite.config.ts never attaches COOP here). Because we control this page's
// headers, window.opener is intact by construction, even in severed mode:
// severance happens LATER, when the tab lands on the COOP-served callback.
//
// It speaks the PRODUCTION grant-handoff protocol (src/types/OAuthGrantHandoff.ts):
//   - popup -> widget: { type: 'oauth_launch_ready' }         (repeated until answered)
//   - widget -> popup: { type: 'oauth_launch_start', grant, authorizeUrl }
//
// Sequence:
//   1. refuse without an opener (anti-phishing guardrail)
//   2. write-read self-test sessionStorage
//   3. post oauth_launch_ready to the opener every ~250ms until answered
//   4. on oauth_launch_start: stash the grant in this tab's vault-origin
//      sessionStorage (NEVER a URL), then navigate the tab to authorizeUrl —
//      the REAL unify authorize URL the widget posted (redirect_uri back to our
//      /oauth/callback + nonce). No local provider hop exists.

const { useEffect, useState } = React;

const params = new URLSearchParams(window.location.search);
const serviceId = params.get('service_id') ?? 'unknown';

type Status =
  | 'starting'
  | 'no-opener'
  | 'no-storage'
  | 'waiting-grant'
  | 'grant-timeout'
  | 'navigating';

const App = () => {
  const [status, setStatus] = useState<Status>('starting');

  useEffect(() => {
    // Guardrail 1: no opener ⇒ no flow (a handed-out launcher link must go
    // nowhere). This is also what a COOP: same-origin embedding page would trip.
    if (!window.opener) {
      setStatus('no-opener');
      return;
    }

    // Guardrail 2: storage must demonstrably work before we rely on it.
    try {
      const probe = grantStorageKey('__selftest__');
      sessionStorage.setItem(probe, '1');
      if (sessionStorage.getItem(probe) !== '1') throw new Error('mismatch');
      sessionStorage.removeItem(probe);
    } catch {
      setStatus('no-storage');
      return;
    }

    const timeout = window.setTimeout(() => setStatus('grant-timeout'), 8000);

    // Repeat the ready ping until the widget answers with oauth_launch_start.
    // The ping carries no secret, so '*' as targetOrigin is fine; the grant
    // comes back with an explicit targetOrigin from the widget side.
    let answered = false;
    const ping = () => {
      if (answered) return;
      (window.opener as Window).postMessage(
        { type: 'oauth_launch_ready' },
        '*'
      );
    };
    ping();
    const pinger = window.setInterval(ping, 250);

    const onMessage = (event: MessageEvent) => {
      const data = event.data as
        | { type?: string; grant?: unknown; authorizeUrl?: unknown }
        | undefined;
      if (data?.type !== 'oauth_launch_start') return;
      if (typeof data.grant !== 'string') return;
      if (typeof data.authorizeUrl !== 'string') return;

      answered = true;
      window.clearInterval(pinger);
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);

      // The grant now lives ONLY in this tab's vault-origin sessionStorage — no
      // URL ever carries it. The callback (also localhost) reads it back.
      sessionStorage.setItem(grantStorageKey(serviceId), data.grant);
      setStatus('navigating');

      // Navigate the tab to the REAL unify authorize URL. Whatever COOP unify /
      // QuickBooks apply along the way is irrelevant now — the grant is already
      // safe in sessionStorage; only the final callback needs the opener-null
      // condition, which our dev server injects there.
      window.location.replace(data.authorizeUrl);
    };
    window.addEventListener('message', onMessage);

    setStatus('waiting-grant');

    return () => {
      window.clearInterval(pinger);
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
    };
  }, []);

  const text: Record<Status, { msg: string; color: string }> = {
    starting: { msg: 'starting…', color: '#475569' },
    'no-opener': {
      msg: 'REFUSED — window.opener is null at launch, so no grant can be delivered and the flow must not start (phished launcher link, or COOP on the embedding page itself).',
      color: '#b91c1c',
    },
    'no-storage': {
      msg: 'REFUSED — sessionStorage is unavailable. Production would fall back to the legacy opener path instead of proceeding.',
      color: '#b91c1c',
    },
    'waiting-grant': {
      msg: 'opener is LIVE — posting oauth_launch_ready, waiting for oauth_launch_start with the grant…',
      color: '#b45309',
    },
    'grant-timeout': {
      msg: 'no grant arrived — the widget did not complete the handshake.',
      color: '#b91c1c',
    },
    navigating: {
      msg: 'grant stashed in vault-origin sessionStorage — navigating the tab to REAL unify authorize…',
      color: '#15803d',
    },
  };

  return (
    <div style={{ fontFamily: 'system-ui', padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>vault oauth/launch (real stand-in)</h2>
      <div
        style={{
          padding: '10px 14px',
          borderRadius: 6,
          color: '#fff',
          background: text[status].color,
        }}
      >
        <strong>{text[status].msg}</strong>
      </div>
      <p style={{ fontSize: 13, color: '#475569' }}>
        service_id <code>{serviceId}</code> · origin{' '}
        <code>{window.location.origin}</code> · served WITHOUT COOP, so the
        opener link is intact here by construction.
      </p>
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById('root'));
