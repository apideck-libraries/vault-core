import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {
  GRANT_MESSAGE,
  ORIGINS,
  READY_MESSAGE,
  postReport,
  readMode,
  readRun,
  storageKey,
} from './shared';

// Stand-in for the proposed vault `oauth/launch` page — the popup's FIRST
// document, on the vault origin (localhost), served WITHOUT COOP. Because we
// control this page's headers, `window.opener` is intact here by construction,
// even in severed mode: severance only happens later, when the tab navigates
// through the COOP-serving provider stand-in.
//
// Sequence (mirrors the proposed design exactly):
//   1. refuse to proceed without an opener — the anti-phishing guardrail: a
//      bare handed-out link to this page must go nowhere
//   2. write-read probe sessionStorage (feature detection)
//   3. announce readiness to the opener (the ping carries no secret), receive
//      the grant via postMessage — never via URL
//   4. store the grant in this tab's vault-origin sessionStorage
//   5. navigate the tab to the provider

const mode = readMode();
const run = readRun();

const { useEffect, useState } = React;

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
    // Guardrail 1: no opener ⇒ no flow. In production this is what makes a
    // phished launcher link useless — and what a customer top-level page with
    // COOP: same-origin would trip, loudly, before any consent screen.
    if (!window.opener) {
      setStatus('no-opener');
      postReport({ run, mode, stage: 'launch', ok: false, reason: 'no-opener' });
      return;
    }

    // Guardrail 2: storage must demonstrably work before we rely on it.
    try {
      sessionStorage.setItem(storageKey('selftest'), '1');
      if (sessionStorage.getItem(storageKey('selftest')) !== '1') {
        throw new Error('write-read mismatch');
      }
      sessionStorage.removeItem(storageKey('selftest'));
    } catch {
      setStatus('no-storage');
      postReport({
        run,
        mode,
        stage: 'launch',
        ok: false,
        reason: 'storage-unavailable',
      });
      return;
    }

    const timeout = window.setTimeout(() => {
      setStatus('grant-timeout');
      postReport({
        run,
        mode,
        stage: 'launch',
        ok: false,
        reason: 'grant-timeout',
      });
    }, 5000);

    const onMessage = (event: MessageEvent) => {
      const data = event.data as any;
      if (
        data?.type !== GRANT_MESSAGE ||
        data.run !== run ||
        typeof data.grant !== 'string'
      ) {
        return;
      }
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
      // From here the grant lives ONLY in this tab's vault-origin
      // sessionStorage — the provider (different origin, different bucket)
      // cannot read it, and no URL ever carries it.
      sessionStorage.setItem(
        storageKey(run),
        JSON.stringify({ grant: data.grant, storedAt: window.location.origin })
      );
      setStatus('navigating');
      // Progress ping: if the chain stalls after this (e.g. the provider
      // origin doesn't load in this browser), the widget can say so.
      postReport({
        run,
        mode,
        stage: 'launch',
        ok: true,
        reason: `navigating to ${ORIGINS.provider}`,
      });
      window.location.replace(
        `${ORIGINS.provider}/storage-roundtrip/provider.html?opener=${mode}&run=${run}`
      );
    };
    window.addEventListener('message', onMessage);

    (window.opener as Window).postMessage({ type: READY_MESSAGE, run }, '*');
    setStatus('waiting-grant');

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
    };
  }, []);

  const text: Record<Status, { msg: string; color: string }> = {
    starting: { msg: 'starting…', color: '#475569' },
    'no-opener': {
      msg:
        'REFUSED — window.opener is null at launch, so no grant can be delivered and the flow must not start. (Phished launcher link, or COOP on the embedding page itself.)',
      color: '#b91c1c',
    },
    'no-storage': {
      msg:
        'REFUSED — sessionStorage is unavailable. Production would fall back to the legacy opener path instead of proceeding.',
      color: '#b91c1c',
    },
    'waiting-grant': {
      msg: 'opener is LIVE — announced ready, waiting for the grant handshake…',
      color: '#b45309',
    },
    'grant-timeout': {
      msg: 'no grant arrived within 5s — refusing to continue to the provider.',
      color: '#b91c1c',
    },
    navigating: {
      msg:
        'grant stored in vault-origin sessionStorage — navigating to the provider…',
      color: '#15803d',
    },
  };

  return (
    <div style={{ fontFamily: 'system-ui', padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>Launcher (proposed vault oauth/launch)</h2>
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
        run <code>{run}</code> · mode <code>{mode}</code> · origin{' '}
        <code>{window.location.origin}</code> · served without COOP, so the
        opener link is intact here by construction.
      </p>
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById('root'));
