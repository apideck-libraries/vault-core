// Three distinct origins served by the ONE Vite dev server (see vite.config.ts
// `server.host: true`). Different hostnames = different origins, so nesting
// outer → middle → widget gives genuine cross-origin iframe boundaries, and the
// widget → probe popup is cross-origin too — the conditions COOP needs to sever
// window.opener. Port is inherited from wherever the page was opened.
//
//   outer  (localhost)   OctaFlow — top-level host, carries the COOP lever
//   middle ([::1])       OctaCore — middle cross-origin iframe
//   widget (127.0.0.1)   vaultjs  — inner cross-origin iframe, real <Vault>
//   probe  (localhost)   stands in for vault's oauth/callback popup
//
// The real <Vault> lives on 127.0.0.1 (not the IPv6 literal) so its Unify API
// calls carry a friendlier Origin; the probe demonstrator needs no such luck.
//
// Open the harness via http://localhost:<port>/opener-severed-confirm/outer.html
// so `outer` is the localhost origin these URLs assume.
const PORT =
  typeof window !== 'undefined' && window.location.port
    ? window.location.port
    : '1234';

export const ORIGINS = {
  outer: `http://localhost:${PORT}`,
  middle: `http://[::1]:${PORT}`,
  widget: `http://127.0.0.1:${PORT}`,
  probe: `http://localhost:${PORT}`,
};

export type OpenerMode = 'intact' | 'severed';

export function readMode(): OpenerMode {
  const m = new URLSearchParams(window.location.search).get('opener');
  return m === 'severed' ? 'severed' : 'intact';
}

export const PROBE_MESSAGE = 'opener-severed-probe';
