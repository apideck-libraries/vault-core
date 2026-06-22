# Iframe embedding test (GH-9546)

Reproduces the production failure: Vault embedded in a storage-partitioned
third-party iframe where `sessionStorage` is unavailable and the client-side
OAuth nonce check breaks (connection stays `pending_confirmation`).

## Approach (why same-origin)

A sandboxed iframe *without* `allow-same-origin` gives the frame an opaque
origin — which doesn't just block storage, it also sends `Origin: null` to
Unify (CORS-rejected) and breaks React init, so **Vault never renders and you
can't reach the Authorize button to observe the nonce failure at all**.

So the frame is kept **same-origin** (Vault loads, API calls succeed, Authorize
renders) and we sever **only `sessionStorage`** inside it — exactly what a
partitioned/blocked third-party iframe does in practice.

- **`iframe.html` / `iframe.tsx`** — host page. Renders the iframe and a
  `sessionStorage:` selector that sets `?storage=` on the frame.
- **`vault.html` / `vault.tsx`** — framed document. Replaces
  `window.sessionStorage` with a shim per `?storage=`, then renders `<Vault>`
  with a banner showing the resulting storage behaviour.

### Modes

| Mode | `?storage=` | sessionStorage behaviour | Reproduces |
|---|---|---|---|
| **Severed** (default) | `noop` | writes dropped, reads return `null` | nonce never matches → "Could not confirm" → stuck `pending_confirmation` |
| **Denied** | `throw` | every op throws `SecurityError` | pre-fix `generateAndStoreNonce` crash on Authorize click |
| **Normal** | `normal` | untouched | control — both builds work |

## Run

```bash
# from repo root — build the library so example/dist is current
yarn build

cd example
cp .env.example .env   # set VITE_VAULT_TOKEN to a live session JWT (CSRF allowlist)
yarn install
yarn start             # http://localhost:1234
```

Open **http://localhost:1234/iframe-test/iframe.html**.

> Vault imports the built `../../dist` (same as the plain example), so re-run
> `yarn build` at the repo root after changing `src/` to test a fix.

## What to expect

With **Severed** or **Denied** selected:

- **Pre-fix build** (`generateAndStoreNonce` → `sessionStorage`): clicking an
  OAuth Authorize button either crashes (`throw`) or completes the popup but
  fails verification (`noop`) — the connection stays unconfirmed.
- **Fixed build** (`generateNonce`, no storage): Authorize works regardless; the
  red banner shows storage is broken yet the flow still confirms.

Switch to **Normal** to confirm the harness itself is sound (both builds pass).

## Caveat

This reproduces the storage behaviour, not opaque-origin isolation. The genuine
cross-site, partitioned-origin case additionally depends on Unify's CORS and on
the OAuth popup `postMessage`-ing back to the opener — both Unify-side concerns
separate from the client storage failure this harness targets.
