// sessionStorage round-trip experiment — step 0 of the proposed OAuth-confirm
// handoff redesign (see ../../thoughts/shared/research/2026-07-14-oauth-confirm-
// iframe-context.md for the problem; ../opener-severed-confirm/ for the repro
// of today's failure).
//
// The proposed design: the widget delivers a single-use "grant" into the OAuth
// popup at OPEN time over the then-guaranteed window.opener link; the popup's
// vault-origin launcher stores it in the tab's sessionStorage; after the
// provider redirect chain the vault-origin callback reads it back and
// self-confirms in-tab — no dependency on window.opener at callback time.
//
// The design's single unverified assumption, which this harness tests:
//
//   Does a tab's vault-origin sessionStorage survive the browsing-context-
//   group swaps that COOP: same-origin pages cause mid-chain?
//
// Same three-loopback-origin trick as ../opener-severed-confirm/ — one Vite
// dev server (`server.host: true`), three distinct origins:
//
//   host     (localhost)  top-level customer page stand-in
//   widget   (127.0.0.1)  cross-origin iframe, runs the experiment
//   launch   (localhost)  popup page 1 — vault-origin launcher, NO COOP
//   provider ([::1])      popup page 2 — COOP: same-origin in severed mode
//   callback (localhost)  popup page 3 — vault origin again, reads the grant
//                         (also COOP-served in severed mode: we don't control
//                         the real callback's effective policy either)

const PORT =
  typeof window !== 'undefined' && window.location.port
    ? window.location.port
    : '1234';

// Safari cannot load literal-IPv6 URLs (http://[::1]:…) — a long-standing
// WebKit/Safari networking limitation that Chrome, Firefox and DuckDuckGo
// handle fine. On Safari-like browsers the provider falls back to 127.0.0.1.
// That makes the provider share the WIDGET's origin, which is cosmetically
// less realistic but mechanically irrelevant to the experiment: the tested
// storage bucket is the popup tab's localhost (vault) one, and 127.0.0.1 is
// still cross-origin to it, so the COOP context-group swap still happens.
const isSafariLike =
  typeof navigator !== 'undefined' &&
  /safari/i.test(navigator.userAgent) &&
  !/chrome|chromium|crios|firefox|fxios|edg/i.test(navigator.userAgent);

export const ORIGINS = {
  host: `http://localhost:${PORT}`,
  widget: `http://127.0.0.1:${PORT}`,
  vault: `http://localhost:${PORT}`,
  provider: isSafariLike
    ? `http://127.0.0.1:${PORT}`
    : `http://[::1]:${PORT}`,
};

export type OpenerMode = 'intact' | 'severed';

export function readMode(): OpenerMode {
  const m = new URLSearchParams(window.location.search).get('opener');
  return m === 'severed' ? 'severed' : 'intact';
}

export const READY_MESSAGE = 'storage-roundtrip-ready';
export const GRANT_MESSAGE = 'storage-roundtrip-grant';

// Per-run sessionStorage key on the vault-origin stand-in (localhost).
export const storageKey = (run: string) => `storage-roundtrip:${run}`;

// Correlation id for one run — NOT a secret. It mirrors production, where the
// widget learns the outcome by polling its own connection state at unify; here
// it polls the dev server's report endpoint by run id. The grant is the secret
// and never appears in any URL.
export function readRun(): string {
  return new URLSearchParams(window.location.search).get('run') ?? 'no-run';
}

export function randomId(): string {
  const c = typeof crypto !== 'undefined' ? (crypto as any) : undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

// Report endpoint served by the Vite dev middleware (storageRoundtripPlugin in
// ../vite.config.ts). Every origin hits the same server process, so relative
// fetches are same-origin from both the widget (127.0.0.1) and the callback
// (localhost), and the in-memory report store is shared.
export const REPORT_API = '/storage-roundtrip/api';

export interface RunReport {
  run: string;
  mode: OpenerMode;
  // 'launch' and 'provider' with ok: true are progress pings so a stalled
  // chain pinpoints its last completed hop; 'callback' is the final verdict.
  stage: 'launch' | 'provider' | 'callback';
  ok: boolean;
  reason?: string;
  grantSurvived?: boolean;
  grant?: string | null;
  openerAlive?: boolean;
  storageReadable?: boolean;
  userAgent?: string;
}

export const postReport = (report: RunReport) =>
  fetch(`${REPORT_API}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
  }).catch(() => undefined);
