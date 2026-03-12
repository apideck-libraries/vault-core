# Research: Connection Never "Confirmed" After OAuth Authorization

**Date**: 2026-03-09

## Research Question

After authenticating connections in vault-core, the connection is never "confirmed" (never reaches `callable` state). Compare with ../vault which works correctly.

## Summary

The vault-core popup-based OAuth flow relies on the callback page at `vault.apideck.com/oauth/callback` sending a `postMessage` back to `window.opener`. This message triggers the critical `/confirm` API call that transitions the connection from `authorized` to `callable`. **If the postMessage is never received, the `/confirm` endpoint is never called, and the connection stays `authorized` forever.**

The fallback path (popup-closed detection via `checkChild`) only calls `mutate()` to refetch the connection state — it does NOT call `/confirm`. Since the server hasn't received the confirm call, the refetch still returns `authorized`.

In contrast, the vault Next.js app uses a full-page redirect flow where the confirm logic runs directly in the page's `useEffect` after reading URL hash params — no dependency on `postMessage` or `window.opener`.

## Detailed Findings

### vault-core: The Popup + PostMessage Flow

**Entry point**: `connectionActions.ts:145` — `handleAuthorize`

1. **Generates CSRF nonce** (`connectionActions.ts:197`), stores in `sessionStorage` under `vault_oauth_nonce_${serviceId}`
2. **POSTs to `/authorize`** (`connectionActions.ts:205-212`) with `{ nonce, redirect_uri }` where `redirect_uri` defaults to `https://vault.apideck.com/oauth/callback` (`constants/urls.ts:1`)
3. **Opens popup** (`connectionActions.ts:233`) with the returned `authorize_url`
4. **Registers two monitors**:
   - `window.addEventListener('message', messageHandler)` (`connectionActions.ts:338`)
   - `setInterval(checkChild, 500)` (`connectionActions.ts:353`)

**The critical confirm path** (`connectionActions.ts:258-319`): The `messageHandler` handles `oauth_complete` messages:
- Verifies nonce against sessionStorage
- **POSTs to `/confirm` with `confirm_token`** (`connectionActions.ts:279-291`) — **this is the ONLY place `/confirm` is called**
- Calls `mutate()` to refetch connection state (now `callable`)

**The fallback path** (`connectionActions.ts:340-350`): When popup closes without message:
- Checks `messageReceived === false`
- Calls `mutate()` to refetch — but **does NOT call `/confirm`**
- Connection stays `authorized` on server, refetch returns `authorized`

### vault.apideck.com/oauth/callback: The Bridge Page

**File**: `vault/src/pages/oauth/callback.tsx:10-46`

This Next.js page runs inside the popup and bridges OAuth completion back to vault-core:
1. Reads success params from **URL fragment** (hash): `nonce`, `confirm_token`, `service_id`
2. If all present AND `window.opener` exists: sends `postMessage` with `{ type: 'oauth_complete', nonce, confirmToken, serviceId }`, then calls `window.close()`
3. If `window.opener` is null: falls through to `window.close()` without sending the message

### vault (working): The Full-Page Redirect Flow

**File**: `vault/src/components/Connection/ConnectionForm.tsx:318-344`

1. Generates nonce, stores in `sessionStorage` under `apideck_oauth_nonce_${serviceId}`
2. POSTs to `/authorize` with `{ nonce, redirect_uri }`
3. **Navigates the full page** via `window.location.href = authorizeUrl` (no popup)
4. After OAuth, browser redirects back to the provider page

**File**: `vault/src/pages/integrations/[unified-api]/[provider].tsx:87-131`

5. `useEffect` on mount reads URL **hash** params: `nonce`, `confirm_token`, `service_id`
6. Verifies nonce against `sessionStorage`
7. **Calls `/confirm` directly** via `callConfirmEndpoint()`
8. Cleans URL fragment, calls `mutate()` to refetch
9. Connection is now `callable`

**Why vault works**: It runs the confirm logic directly in page code after reading URL hash params. No dependency on `postMessage`, `window.opener`, or cross-origin communication.

## Possible Failure Points in vault-core

### 1. `window.opener` is null in the callback page
Modern browsers (especially Safari) may nullify `window.opener` for cross-origin popups as a security measure. The popup opens on `vault.apideck.com` but the opener is the host app (e.g., `localhost:1234`). If `window.opener` is null at callback.tsx:17, the postMessage is never sent, the popup just closes, and the fallback path only refetches without confirming.

### 2. Race condition: popup closes before message is processed
The callback page calls `postMessage` then immediately `window.close()`. If the `checkChild` interval fires and detects `child.closed === true` before the `message` event is processed in the opener:
- `doCleanup()` removes the message listener (`connectionActions.ts:253`)
- The `oauth_complete` message is never handled
- `/confirm` is never called

### 3. Custom `redirect_uri` without postMessage logic
If the session provides a custom `redirect_uri` (`Session.redirect_uri`), OAuth redirects to that URL instead of `vault.apideck.com/oauth/callback`. If that URL doesn't implement the `postMessage` bridge, the message is never sent.

## Key Difference: vault vs vault-core

| Aspect | vault (works) | vault-core (broken) |
|--------|---------------|---------------------|
| Auth window | Full-page redirect | Popup (`window.open`) |
| Confirm trigger | Direct in-page `useEffect` reads hash params | Depends on `postMessage` from callback page |
| `/confirm` call | Always happens (in page code) | Only happens if `messageHandler` fires |
| Fallback | N/A (redirect always returns to page) | `checkChild` refetches but does NOT confirm |
| Cross-origin deps | None (same domain) | Requires `window.opener` across origins |

## Code References

- `vault-core/src/utils/connectionActions.ts:145-366` — full OAuth popup orchestration
- `vault-core/src/utils/connectionActions.ts:258-319` — messageHandler (only place `/confirm` is called)
- `vault-core/src/utils/connectionActions.ts:340-350` — popup-closed fallback (NO confirm)
- `vault-core/src/utils/oauthCsrf.ts` — nonce generation/verification
- `vault-core/src/constants/urls.ts:1` — `REDIRECT_URL = 'https://vault.apideck.com/oauth/callback'`
- `vault/src/pages/oauth/callback.tsx:10-46` — callback page postMessage bridge
- `vault/src/pages/integrations/[unified-api]/[provider].tsx:87-131` — working confirm flow
- `vault/src/components/Connection/ConnectionForm.tsx:318-344` — vault authorize trigger
- `vault/src/utils/oauthCsrf.ts` — vault's nonce + API call helpers

## Architecture Documentation

### Connection State Machine
States defined in `vault-core/src/types/Connection.ts:26-31`:
- `available` → `added` → `authorized` → `callable` (happy path)
- `invalid` (error state)

The `authorized` → `callable` transition requires the **`/confirm` API call** with a valid `confirm_token`. Without this call, the connection stays `authorized` indefinitely.

### The postMessage Contract
Defined in `vault-core/src/types/OAuthCsrf.ts`:
- `OAuthCompleteMessage`: `{ type: 'oauth_complete', nonce, confirmToken, serviceId, success }`
- `OAuthErrorMessage`: `{ type: 'oauth_error', error, errorDescription, serviceId }`

## Open Questions

1. Is `window.opener` reliably available in the callback page when vault-core is embedded in a third-party app? Browser security policies (COOP headers, Safari cross-origin restrictions) could block this.
2. Is the `redirect_uri` being set correctly in the session? If a custom `redirect_uri` is provided, does that URL implement the postMessage bridge?
3. Are there browser console errors in the callback popup that would indicate the postMessage is failing?
4. Could the `checkChild` interval be winning the race against the message event?
