# `window.opener` severed confirm handoff — real cross-origin iframe repro (OCTA)

Reproduces the production failure the storage harness (`../iframe-test/`)
explicitly does **not** cover: an OAuth connection stuck at `state: authorized`
/ `health: pending_confirmation` with no `vault.connection.callable` webhook,
because the client-driven `POST /confirm` never fires.

## Why it breaks

After OAuth, vault's callback page forwards the `confirm_token` to the widget
**only** via:

```js
if (nonce && confirm_token && service_id && window.opener) { window.opener.postMessage(...) }
// vault/src/pages/oauth/callback.tsx:17 — else the token is silently dropped
```

When the widget is nested in cross-origin iframes (OCTA: OctaFlow → iframe →
OctaCore → iframe → vaultjs), the OAuth popup can end up with `window.opener ===
null` — so the guard is skipped, `POST /confirm` never runs, and the connection
stays `pending_confirmation`.

## What makes this repro "proper"

The previous version monkey-patched `window.open` to force `noopener`. That
faked the symptom but also nulled the `window.open` return handle, so the
Authorize button spun forever instead of resetting — not what production does.

This version induces the **real** browser condition instead:

- **Genuine cross-origin nesting.** One Vite dev server, three loopback origins
  (`localhost` → `[::1]` → `127.0.0.1`) so `outer.html` embeds `middle.html`
  embeds `widget.html` across real origin boundaries, mirroring OCTA's chain.
- **Real COOP severance, no JS override.** The OAuth popup's landing page is
  served with `Cross-Origin-Opener-Policy: same-origin` in severed mode (a Vite
  dev-server middleware — see `vite.config.ts`). Because that page is
  cross-origin to the widget that opened it, the browser puts the popup in its
  own browsing-context group and `window.opener` becomes `null`. COOP is ignored
  on iframe documents and we don't control the real vault callback's headers, so
  the popup's own landing page is the lever that genuinely applies — and it's the
  same header a provider or vault page can set in production, which is exactly
  why the failure is "spotty" across accounts.

### Two things run on the widget page

1. **The real `<Vault>`** (`@apideck/react-vault`) against **real Unify** — set a
   JWT to drive the full OAuth → confirm flow. Whether the *real* vault callback
   keeps its opener is environment-dependent (the production "spotty").
2. **An opener probe** — the deterministic demonstrator. It replays the shape
   of vault's `oauth/callback` handoff (`window.open` →
   `window.opener.postMessage(token)`) against our own `probe.html`, whose COOP
   header we control. **No OAuth login required.** In severed mode the popup's
   `window.opener` is null, the message is dropped, and the widget shows exactly
   what strands the connection. Note the probe uses its own message type and
   listener — it demonstrates the browser mechanism, not vault-core's code path
   (only the real `<Vault>` above exercises that). The severance also doesn't
   depend on the iframe nesting: COOP on the popup's landing page severs the
   opener even for a top-level widget. The nesting mirrors OCTA's embedding and
   matters for the real `<Vault>` path (CORS, storage partitioning), not for
   the probe.

## Run

The example imports the built `../../dist`, so build the library first.

```bash
# repo root
yarn build

cd example
cp .env.example .env      # optional — only needed to drive the real <Vault>
yarn install
yarn start                # serves on http://localhost:1234 (or next free port)
```

Open the **top-level host on `localhost`** (the origins assume it):

- **Working:** http://localhost:1234/opener-severed-confirm/outer.html?opener=intact
- **OCTA bug:** http://localhost:1234/opener-severed-confirm/outer.html?opener=severed

Click **Test opener handoff** and watch the widget banner:

- `?opener=intact` → popup keeps its opener → **DELIVERED ✅** → `/confirm` would fire → `callable`.
- `?opener=severed` → popup's `window.opener` is null → **DROPPED ❌** → `/confirm` never fires → stuck `pending_confirmation`.

Allow popups for the host. To also exercise the real `<Vault>` OAuth flow, set
`VITE_VAULT_TOKEN` in `example/.env` (an account in unify's `oauthCsrf` allowlist,
an OAuth connector such as `accounting/xero` or `accounting/quickbooks`).

## Files

| File | Origin | Role |
|---|---|---|
| `outer.html` / `outer.tsx` | `localhost` | OctaFlow — top-level host, mode toggle |
| `middle.html` / `middle.tsx` | `[::1]` | OctaCore — middle cross-origin iframe |
| `widget.html` / `widget.tsx` | `127.0.0.1` | vaultjs — real `<Vault>` + opener probe |
| `probe.html` / `probe.tsx` | `localhost` | stands in for vault's `oauth/callback`; COOP toggled here |
| `origins.ts` | — | shared origin/mode helpers |

## Notes

- If `[::1]` (IPv6 loopback) isn't served in your environment, adjust the
  hostnames in `origins.ts` — any three distinct origins work.
- The real `<Vault>` on `127.0.0.1` needs Unify to allow that Origin (CORS); the
  probe demonstrator does not depend on Unify at all.

## The fix (see the plan)

`../../../unify/thoughts/shared/plans/2026-07-13-vault-oauth-csrf-confirm-handoff-fix.md`
and the problem/requirements writeup at
`../../thoughts/shared/research/2026-07-14-oauth-confirm-iframe-context.md`.
The security-critical constraint: the confirm secret must be minted
post-completion and delivered only to the initiating context — which is exactly
the `window.opener` channel this harness severs.
