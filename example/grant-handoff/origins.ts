// Grant-handoff end-to-end harness — drives the REAL <Vault> through the NEW
// grant-handoff code path (src/utils/oauthGrantHandoff.ts +
// src/components/AuthorizeButton.tsx) against REAL local unify (https://localhost:3050)
// with a REAL OAuth round-trip. The ONLY things this harness serves itself are
// the vault-side oauth/launch + oauth/callback stand-ins, so it can withhold /
// inject COOP headers and force the severed-opener condition deterministically.
// Everything unify does (grant, authorize, provider redirect, confirm_token
// minting, /confirm) is REAL.
//
// Same three-loopback-origin trick as ../opener-severed-confirm/ and
// ../storage-roundtrip/: ONE Vite dev server (`server.host: true`), several
// distinct origins that all hit it. Different hostnames = different origins, so
// nesting outer -> middle -> widget gives genuine cross-origin iframe
// boundaries.
//
//   outer / host (localhost)   top-level customer host — carries intact/severed
//                              toggle. ALSO the VAULT origin (launch + callback
//                              live here, equal to the session redirect_uri origin).
//   middle       ([::1])       middle cross-origin iframe
//   widget       (127.0.0.1)   inner cross-origin iframe — runs the REAL <Vault>
//   vault        (localhost)   oauth/launch + oauth/callback (served here via
//                              the /oauth/* rewrite in ../vite.config.ts)
//
// The real OAuth provider is unify + QuickBooks; there is NO local provider hop.
//
// Open the harness on localhost so `outer`/`vault` are the localhost origin
// these URLs assume — and the session redirect_uri origin:
//   http://localhost:1234/grant-handoff/outer.html?opener=severed

const PORT =
  typeof window !== 'undefined' && window.location.port
    ? window.location.port
    : '1234';

// Safari cannot load literal-IPv6 URLs (http://[::1]:…) — a long-standing
// WebKit/Safari networking limitation Chrome, Firefox and DuckDuckGo don't
// share. On Safari-like browsers the middle-iframe hop falls back to 127.0.0.1
// (cosmetically it then shares the widget's origin, but the widget is still
// cross-origin to the localhost outer/vault, which is all this harness needs —
// the severance is produced by COOP on the callback, not by the iframe nesting).
export const isSafariLike =
  typeof navigator !== 'undefined' &&
  /safari/i.test(navigator.userAgent) &&
  !/chrome|chromium|crios|firefox|fxios|edg/i.test(navigator.userAgent);

export const ORIGINS = {
  outer: `http://localhost:${PORT}`,
  middle: isSafariLike ? `http://127.0.0.1:${PORT}` : `http://[::1]:${PORT}`,
  widget: `http://127.0.0.1:${PORT}`,
  vault: `http://localhost:${PORT}`,
};

// The connector under test (see example/.env). These are used by the launch +
// callback stand-ins for the sessionStorage key and the real /confirm URL; the
// widget reads them from VITE_* env so the REAL <Vault> and this harness agree.
const env = (import.meta as any).env ?? {};
export const UNIFIED_API: string = env.VITE_VAULT_UNIFIED_API ?? 'accounting';
export const SERVICE_ID: string = env.VITE_VAULT_SERVICE_ID ?? 'quickbooks';

// REAL local unify. The widget's <Vault> talks to it for grant + authorize, and
// the callback stand-in POSTs the self-confirm here (unauthenticated).
export const UNIFY_BASE_URL: string =
  env.VITE_VAULT_UNIFY_BASE_URL || 'https://localhost:3050';

export type OpenerMode = 'intact' | 'severed';

export function readMode(): OpenerMode {
  const m =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('opener')
      : null;
  return m === 'severed' ? 'severed' : 'intact';
}

// Correlation id for one run — NOT a secret, purely for display. The grant is
// the secret and never appears in any URL (it travels only via postMessage,
// sessionStorage and the confirm POST body).
export function readRun(): string {
  return typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('run') ?? 'no-run'
    : 'no-run';
}

export function randomId(): string {
  const c = typeof crypto !== 'undefined' ? (crypto as any) : undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

// Stable, per-service sessionStorage key on the vault origin (localhost). The
// launch page stashes the grant here; the callback page reads it back and
// single-use-deletes it. Both pages are localhost, so they share the tab's
// vault-origin sessionStorage bucket (which survives COOP context-group swaps).
export const grantStorageKey = (serviceId: string) =>
  `oauth_grant:${serviceId}`;

// Cookie the outer host sets so the dev server can apply the callback COOP lever
// in severed mode. Real unify redirects back to our /oauth/callback WITHOUT our
// ?opener param, so the query string is not a reliable signal on the callback
// request; a localhost cookie (outer and callback are both localhost) is sent on
// the top-level navigation and survives the real-unify round-trip. See
// grantHandoffPlugin in ../vite.config.ts.
export const OPENER_COOKIE = 'gh_opener';
