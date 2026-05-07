---
date: 2026-05-05
topic: "OAuth CSRF Fix — vault-core (adapt to launched unify + vault changes)"
github_issue_url: https://github.com/apideck-io/unify/issues/9546
unify_commit: https://github.com/apideck-io/unify/commit/30812f607bd1c3ecd570d7074820b9e812d0341a
vault_commit: https://github.com/apideck-samples/vault/commit/a498117d4be4e59bd50d19a569e2c712aed6915c
repository: vault-core
branch: csrf_fix_2
status: research-only
---

# Research: vault-core — Adapt to launched OAuth CSRF fix in unify + vault

> Research is grounded in the actual launched commits (linked in frontmatter), not the planning docs. Earlier iterations of those plans referenced a `POST /authorize` endpoint and PR-description text that does not match what shipped.

## Research Question

unify (commit `30812f60`, "feat(oauth): add CSRF protection via nonce + confirm flow (Ref #9546)") and vault (commit `a498117d`, "fix: OAuth CSRF vulnerability with nonce + hash fragment flow (#302)") have just shipped the OAuth CSRF mitigation. Document what is needed in vault-core (`@apideck/react-vault`) so its OAuth popup flow is compatible with — and benefits from — that launched fix.

## Summary

The launched flow has three load-bearing properties that vault-core must accommodate:

1. **Feature flag (`oauthCsrf`) gates the new behaviour in unify.** It defaults to `false` for every `AccountPlan` and is currently allowlisted to three accounts: `22222222` (localhost+staging), `11111111` (production shared), `cm3mogvfz004ebogk8rqdbgpi` (Jonas's prod account). Accounts not in the allowlist see no behaviour change at all — the callback returns a plain redirect, no hash fragment, no `confirmed` flag. **vault-core sending nonce on every authorize is safe for both populations.**
2. **`credentials.confirmed` is now an effective state flag.** When the feature is on AND the client sent a nonce, unify sets `credentials.confirmed = false` on token exchange, then redirects to `{redirectUri}#nonce=N&confirm_token=T&service_id=S`. The new `POST /vault/connections/{api}/{service}/confirm` endpoint flips it to `true`. Until then, the connection is **not callable** (`connectionState.ts` `checkCallable` short-circuits when `credentials.confirmed === false`) and surfaces `health = 'pending_confirmation'` (a new value at the top of the priority list, just below `needs_consent`).
3. **vault's callback page postMessages the opener.** `{ type: 'oauth_complete', nonce, confirmToken, serviceId, success: true }` to `window.opener` with target `'*'`. vault-core is the opener, but currently has no `message` listener — it polls `child.closed` on a 500 ms `setInterval`. Without changes, vault-core ignores the postMessage, never calls `/confirm`, and the connection is permanently stuck `confirmed: false` for any allowlisted account.

The adaption surface in vault-core is small and entirely client-side:

A. Append `&nonce={nonce}` to the authorize URL at three sites.
B. Add a `message` listener at the two popup-opening sites that verifies nonce + origin and calls `/confirm`.
C. New `src/utils/oauthCsrf.ts` (nonce gen / verify / clear / confirm-endpoint helper, using `fetch` and the existing `connectionsUrl` + `headers` from `useConnections`).
D. New `src/types/OAuthCsrf.ts` (postMessage shapes + confirm response).
E. Optionally extend the connection-state UI to show "pending confirmation" when `connection.health === 'pending_confirmation'`, mirroring vault's `ConnectionBadge` change.

`client_credentials` and `password` grants do not use the popup and require no change.

## Cross-Repo Context

- **Execution order**: vault-core is **third** (after unify, after vault). Both prerequisites are now in production / master.
- **Depends on (launched)**:
  - **unify** at `30812f60` (29 Apr 2026) — `POST /vault/connections/{unified_api}/{service_id}/confirm` exists (gated by `oauthCsrf` feature flag), the existing `GET /vault/authorize/{service_id}/{application_id}` accepts an optional `&nonce={nonce}` query param, and the callback redirects to `{redirectUri}#nonce=N&confirm_token=T&service_id=S` when nonce was present **and** the account has `oauthCsrf` enabled.
  - **vault** at `a498117d` (4 May 2026) — `src/utils/oauthCsrf.ts`, callback page hash-reading + postMessage, provider-page confirm flow, and `ConnectionBadge` "Pending confirmation" pill are all live. Storage key prefix: `apideck_oauth_nonce_`.
- **Depended on by**: `iframe-vault` consumes `@apideck/react-vault` (vault-core) via npm. Once vault-core publishes, iframe-vault picks it up on next install — no code change in iframe-vault.
- **Release context**: standalone follow-up. Previous attempt (vault-core PR #132, `20ded96`, 2026-03-12) targeted an older API design (a NEW `POST /vault/connections/.../authorize` endpoint that the launched unify never shipped); it was reverted in `1926b29` / `2c2d341` and rolled into release `0.18.0`. Branch `csrf_fix_2` is currently identical to `main` (`b9c89ce`) — clean restart.

## What unify launched (commit `30812f60`)

### Feature flag — `oauthCsrf`

Source: `src/modules/shared/services/FeatureService.ts`.

```ts
oauthCsrf: {
  allowlistAccountIds: [
    '22222222', // localhost and staging
    '11111111', // Production shared account
    'cm3mogvfz004ebogk8rqdbgpi' // Jonas production account
  ],
  description: 'Phase 1 rollout - allowlist only, temporary flag for OAuth CSRF nonce flow'
}
```

Plan-map default is `false` for every `AccountPlan` (`free | launch | growth | scale | enterprise`). Until the allowlist expands, every other account sees the **old** unify behaviour — plain redirect, no hash fragment, no `confirmed` flag. That makes vault-core's adaption a pure additive change with no risk to non-allowlisted tenants.

### Authorize endpoint — optional `nonce` query param

`AuthorizeConnectionController.ts:62` now destructures `nonce` from `request.parameters` alongside `state`, `redirect_uri`, `scope`. It is passed through `AuthorizeConnectionRequestDTO` (`nonce?: string`) into `AuthorizeConnectionUseCase`, which writes it into `OauthShortLivedState` next to `codeVerifier`. The contract on the wire is unchanged for callers that don't send nonce.

### Callback — feature-flag-gated hash fragment

`CallbackConnectionUseCase.ts` (relevant new logic):

```ts
// only enable the CSRF branch if nonce was present AND the account has the feature
if (!nonce) return TE.right({ tokenResult, prereqs, csrfEnabled: false })
return pipe(
  this.dependencies.getFirstApplicationById(callbackDTO.applicationId),
  TE.chain((application) => this.dependencies.getAccount(application.accountId)),
  TE.map((account) => ({ ..., csrfEnabled: canHaz({ account, feature: 'oauthCsrf' }) })),
  TE.orElse(() => TE.right({ tokenResult, prereqs, csrfEnabled: false })) // fail-open if account lookup fails
)
```

When `nonce && csrfEnabled`:
- `credentials.confirmed = false` is written into the connection during token-update (`updateCredentialsAndCallable` block, `: undefined` otherwise so the field is NOT written for non-CSRF flows).
- A fresh `OauthShortLivedState` row is created keyed by `confirmToken = uuidv4()` with 30-min TTL.
- Redirect URL becomes `${redirectUri}#nonce=${enc(nonce)}&confirm_token=${enc(confirmToken)}&service_id=${enc(serviceId)}`.

When **either** `nonce` is missing **or** `oauthCsrf` is disabled for the account: plain `redirectUri`, no `confirmed` flag set, no hash fragment.

### New endpoint — `POST /vault/connections/{unified_api}/{service_id}/confirm`

OpenAPI: `src/specs/unify/vault/resources/confirm_connection.yml`. Marked `x-sdk-exclude: true` and `x-speakeasy-ignore: true` — intentionally hidden from generated SDKs.

Body: `{ confirm_token: string }`. Response: `{ status_code: 200, status: 'OK', data: { confirmed: boolean } }`.

`ConfirmConnectionUseCase.execute`:

1. Look up the `OauthShortLivedState` keyed by `confirm_token`. NotFound → 404.
2. Verify `applicationId / consumerId / serviceId / unifiedApi` on the state row match the request. Mismatch → 401.
3. **Re-check `oauthCsrf` feature flag for the account (fail closed).** Account not found / fetch failure → 401. Feature off → 401.
4. **Delete the short-lived-state row first** (single-use; narrows race window).
5. Load connection + connector. Apply `updateConnectionFactory({ connection, credentials: { confirmed: true } })`. Persist.
6. `broadcastConnectionChangeEvents(...)` so the connection's transition to `callable` is published.
7. Return `{ confirmed: true }`.

### Connection state + health changes

- `ConnectionHealth` enum (`src/types/ConnectionHealth.ts`) gains `'pending_confirmation'`. Priority order (highest first): `revoked > missing_settings > needs_consent > pending_confirmation > needs_auth > pending_refresh > ok`. OpenAPI schemas updated (`Connection.json`, `ConnectionHealth.json`) with the new value.
- `connectionHealth.ts:calculateConnectionHealth` returns `'pending_confirmation'` whenever `connection.credentials?.confirmed === false`, before the `needs_auth` check.
- `connectionState.ts:checkCallable` now also requires `connection.credentials?.confirmed !== false`. So a connection with `confirmed: false` resolves to `state: 'authorized'` (or whatever the next condition gives), **never** `'callable'`.
- Net effect for vault-core: a connection that is OAuth-authorized but not yet confirmed has `state: 'authorized'`, `health: 'pending_confirmation'`. It will not flip to `callable` until vault-core (or the user manually) calls `/confirm`.

### Lambda routing

`src/infra/lambda/vault/index.ts` adds: `connectionsConfirm: () => new ConfirmConnectionController(confirmConnectionUseCase)`. The route is wired through the same operationId mapping as everything else.

### Repo port

`OauthShortLivedStateRepoPort.ts` adds a `DeleteOauthShortLivedState` port (used by ConfirmConnection to delete the token row).

## What vault launched (commit `a498117d`)

### `src/utils/oauthCsrf.ts` (full file, 41 LOC)

```ts
import client from 'lib/axios'
import { IConfirmResponse } from 'types/OAuthCsrf'

const NONCE_KEY_PREFIX = 'apideck_oauth_nonce_'

export function generateAndStoreNonce(serviceId: string): string {
  const nonce = crypto.randomUUID()
  sessionStorage.setItem(`${NONCE_KEY_PREFIX}${serviceId}`, nonce)
  return nonce
}

export function verifyAndClearNonce(serviceId: string, nonce: string): boolean {
  const stored = sessionStorage.getItem(`${NONCE_KEY_PREFIX}${serviceId}`)
  sessionStorage.removeItem(`${NONCE_KEY_PREFIX}${serviceId}`)
  return stored === nonce
}

export async function callConfirmEndpoint(params: {
  serviceId, unifiedApi, confirmToken, jwt, applicationId, consumerId
}): Promise<IConfirmResponse> {
  // POST /vault/connections/{unifiedApi}/{serviceId}/confirm
  // body: { confirm_token: confirmToken }
  // headers: Authorization: Bearer ${jwt}, X-APIDECK-APP-ID, X-APIDECK-CONSUMER-ID
}
```

Note: `verifyAndClearNonce` clears the storage **before** comparing, so the token is one-shot regardless of validity. (vault-core can mirror this; the prior reverted vault-core attempt clears only on success.)

### `src/types/OAuthCsrf.ts`

Just `IConfirmResponse = { status_code: number; status: string; data: { confirmed: boolean } }`. vault doesn't need typed postMessage shapes because it's the **sender** of postMessage, not the receiver.

### `ConnectionForm.authorizeConnection` change (3-line diff)

```diff
   if (connection.oauth_grant_type === 'authorization_code') {
-    window.location.href = authorizeUrlWithRedirect
+    const nonce = generateAndStoreNonce(serviceId)
+    const url = new URL(authorizeUrlWithRedirect)
+    url.searchParams.append('nonce', nonce)
+    window.location.href = url.href
     return
   }
```

vault uses **redirect navigation** (`window.location.href`), not a popup. vault-core uses a popup — the same nonce-append step applies, but the wait mechanism downstream is different (postMessage vs. provider-page hash read).

### `/oauth/callback` page change

The callback page now reads `window.location.hash`, postMessages on success or `query.error_type` on failure:

```ts
if (nonce && confirm_token && service_id && window.opener) {
  window.opener.postMessage(
    { type: 'oauth_complete', nonce, confirmToken: confirm_token, serviceId: service_id, success: true },
    '*'
  )
  window.close()
} else if (query?.error_type && window.opener) {
  window.opener.postMessage(
    { type: 'oauth_error', error: query.error_type, errorDescription: query.error_message, serviceId: query.service_id },
    '*'
  )
  window.close()
} else if (hasError) {
  setOAuthError(createOAuthErrorFromQuery(query))
} else {
  window.close()
}
```

`getServerSideProps` now treats `hasError` precisely (`!!(query?.error_type || query?.error_message)`) instead of "any query param". Backwards-compat path is the final `window.close()`.

### Provider page (`/integrations/[unified-api]/[provider].tsx`)

Single mount-time `useEffect` (`[]` dep array) reads `window.location.hash`, runs `verifyAndClearNonce`, calls `callConfirmEndpoint`, then `router.replace(cleanPath, undefined, { shallow: true })` to strip the hash and `mutate()` to revalidate. **vault-core has no equivalent page** — vault-core is the popup opener, not the redirect target.

### `Connection` type + `ConnectionBadge`

`src/types/Connection.ts` adds:
```ts
export type ConnectionHealth =
  | 'ok' | 'pending_refresh' | 'needs_auth' | 'needs_consent'
  | 'revoked' | 'missing_settings' | 'pending_confirmation'

export interface IConnection {
  ...
  health?: ConnectionHealth
  ...
}
```

`ConnectionBadge` adds a new branch:
```tsx
if (health === 'pending_confirmation') {
  return (
    <div className="... bg-warning-lighter text-warning">
      <FaExclamationTriangle />
      <span>Pending confirmation</span>
    </div>
  )
}
```

### What vault deliberately did NOT do

- No `parseHashFragment` helper (uses `URLSearchParams` directly).
- No `callAuthorizeEndpoint` — the v6 design appends nonce to the existing `authorize_url`; PR #300's description (mentioning `callAuthorizeEndpoint` and a POST to `/authorize`) describes an iteration that was abandoned. The shipped commit only has `generateAndStoreNonce`, `verifyAndClearNonce`, `callConfirmEndpoint`.
- No `OAuthCompleteMessage` / `OAuthErrorMessage` types in vault. vault-core will need them because vault-core is the **receiver**.

## What exists in vault-core today (csrf_fix_2 = main)

`csrf_fix_2` and `main` point at the same commit (`b9c89ce`). Nothing CSRF-specific is on this branch.

### Authorize URL construction — three sites

| Caller | File | Lines | Current expression |
|---|---|---|---|
| First-time authorize button | `src/components/AuthorizeButton.tsx` | 34-36 | `${connection.authorize_url}&redirect_uri=${redirect_uri ?? REDIRECT_URL}` |
| Re-authorize (top bar dropdown) | `src/components/TopBar.tsx` | 71-76 | `${authorize_url}&redirect_uri=${session?.redirect_uri ?? REDIRECT_URL}` (also `revoke_url`) |
| Authorize / re-authorize (button-layout grid) | `src/components/ButtonLayoutMenu.tsx` | 97-99, 281-283, 342-344 | same pattern, plus `revoke_url` |

`REDIRECT_URL = 'https://vault.apideck.com/oauth/callback'` — `src/constants/urls.ts:1`.

### Popup open + close detection (no message listener anywhere)

`src/components/AuthorizeButton.tsx:92-103`:

```ts
const child = window.open(authorizeUrl, '_blank', 'location=no,height=750,width=550,...')
const timer = setInterval(() => {
  if (child?.closed) {
    clearInterval(timer)
    handleChildWindowClose() // -> mutate connection detail + onConnectionChange
  }
}, 500)
```

`src/utils/connectionActions.ts:75-92` (`useConnectionActions.handleRedirect`) has the same pattern.

A search for `addEventListener('message'` / `postMessage` returns zero hits in `src/`.

### Existing types

- `src/types/Connection.ts:43-82` — `Connection.authorize_url?: string | null` (line 58), `oauth_grant_type` (`authorization_code | client_credentials | password`), `state` (`available | added | authorized | callable | invalid`). **No `health` field today.**
- `src/types/Session.ts:28-37` — `Session.redirect_uri?: string` (decoded from JWT in `Vault.tsx:159-175`).
- No `OAuthCsrf.ts`, no nonce / postMessage / confirm types.

### Tests

`test/` uses Jest + `@testing-library/react`. `fetch` is mocked via `test/mock.ts:5-23`. `IntersectionObserver` is stubbed (`mock.ts:30-61`). `useConnections` is module-mocked in form tests. `window.open` is **never** mocked anywhere; `authorize-button.test.tsx` only asserts the button renders.

## API contracts now live

| Boundary | Direction | Shape |
|---|---|---|
| vault-core → unify (authorize popup target) | GET | `${connection.authorize_url}&redirect_uri={redirect_uri}&nonce={nonce}` — nonce optional |
| unify → vault `/oauth/callback` | 301 redirect | `{redirectUri}#nonce={nonce}&confirm_token={confirm_token}&service_id={serviceId}` (only if nonce sent **and** `oauthCsrf` enabled for account); else plain `redirectUri` |
| vault `/oauth/callback` → vault-core (popup opener) | postMessage (target `'*'`) | `{ type: 'oauth_complete', nonce, confirmToken, serviceId, success: true }` or `{ type: 'oauth_error', error, errorDescription, serviceId }` |
| vault-core → unify (after postMessage) | `POST {connectionsUrl}/{unified_api}/{service_id}/confirm` | body `{ confirm_token: string }`; response `{ status_code: 200, status: 'OK', data: { confirmed: boolean } }`; 401 if account does not have `oauthCsrf` enabled, 404 if token already consumed/expired |

`{connectionsUrl}` in vault-core is `${unifyBaseUrl}/vault/connections` (`useConnections.tsx:634`). `unifyBaseUrl` defaults to `https://unify.apideck.com` (`src/constants/urls.ts:2`).

## Adaption surface in vault-core

### A. New file: `src/utils/oauthCsrf.ts`

Mirror vault's shape, adapted for vault-core's `fetch`-based + per-instance `connectionsUrl`:

- `generateAndStoreNonce(serviceId)` — `crypto.randomUUID()`, sessionStorage key `apideck_oauth_nonce_{serviceId}` (match vault's prefix).
- `verifyAndClearNonce(serviceId, nonce)` — read, clear unconditionally (vault's behaviour), compare.
- `clearNonce(serviceId)` — for cleanup on errors / popup blocked.
- `callConfirmEndpoint({ serviceId, unifiedApi, confirmToken, connectionsUrl, headers }): Promise<ConfirmResponse>` — `fetch` POST to `${connectionsUrl}/${unifiedApi}/${serviceId}/confirm`, body `{ confirm_token: confirmToken }`, headers from `useConnections`. The signature differs from vault's because vault-core gets `connectionsUrl` and the JWT/X-APIDECK headers from context, not a global axios instance.

### B. New file: `src/types/OAuthCsrf.ts`

vault-core needs more types than vault because vault-core is the **receiver** of the postMessage and the (likely) consumer of `connection.health`:

```ts
export interface OAuthCompleteMessage {
  type: 'oauth_complete'
  nonce: string
  confirmToken: string
  serviceId: string
  success: boolean
}
export interface OAuthErrorMessage {
  type: 'oauth_error'
  error: string
  errorDescription: string
  serviceId: string
}
export type OAuthPostMessage = OAuthCompleteMessage | OAuthErrorMessage

export interface ConfirmResponse {
  status_code: number
  status: string
  data: { confirmed: boolean }
}
```

`ConnectionHealth` belongs in `src/types/Connection.ts` alongside `ConnectionState` (mirroring vault's placement), not in `OAuthCsrf.ts`. Add the new type and `health?: ConnectionHealth` field to `Connection`.

### C. Authorize URL — append `&nonce={nonce}` at three sites

| File | Line(s) | Change |
|---|---|---|
| `src/components/AuthorizeButton.tsx` | 34-36 | call `generateAndStoreNonce(serviceId)`, append `&nonce={nonce}` |
| `src/components/TopBar.tsx` | 71-73 | same for re-authorize |
| `src/components/ButtonLayoutMenu.tsx` | 97-99 | same for authorize |
| `src/components/ButtonLayoutMenu.tsx` | 281-283 | same for re-authorize |

Revoke URLs (`TopBar.tsx:74-76`, `ButtonLayoutMenu.tsx:342-344`) do NOT need a nonce — disconnect/revoke is unaffected by GH-9546.

vault's pattern uses `URL` + `URLSearchParams.append`:
```ts
const url = new URL(authorizeUrlWithRedirect)
url.searchParams.append('nonce', generateAndStoreNonce(serviceId))
window.open(url.href, '_blank', windowFeatures)
```
Either string concat (`&nonce=${encodeURIComponent(nonce)}`) or `URL.searchParams.append` is correct. `crypto.randomUUID()` is URL-safe so encoding is technically unnecessary, but `URL.searchParams.append` is safer.

### D. postMessage listener + confirm flow — two sites

Both popup-opening sites need a listener registered before `window.open` and torn down on completion / popup-close:

1. `src/components/AuthorizeButton.tsx:92-103` (`authorizeConnection`)
2. `src/utils/connectionActions.ts:75-92` (`useConnectionActions.handleRedirect`)

Behaviour at each site:

```
1. Before window.open:
   - generate nonce (already part of URL building)
   - compute trustedOrigin = new URL(session?.redirect_uri ?? REDIRECT_URL).origin

2. window.open(...)

3. Register message handler:
   - if event.origin !== trustedOrigin: return
   - if event.data.type === 'oauth_complete' AND event.data.serviceId === current serviceId:
       - if !verifyAndClearNonce(serviceId, event.data.nonce):
           toast error, cleanup, return
       - try { await callConfirmEndpoint({ serviceId, unifiedApi,
              confirmToken: event.data.confirmToken, connectionsUrl, headers }) }
         catch { toast error }   // 401 means account not enrolled — should not happen since the
                                  // postMessage only arrives when unify gated through
       - mutate(`${connectionsUrl}/${unifiedApi}/${serviceId}`)
         .then((result) => { onConnectionChange?.(result.data) })
       - mutate('/vault/connections')
       - cleanup (remove listener, clearInterval, clearNonce, reset loading)
   - if event.data.type === 'oauth_error' AND event.data.serviceId === current serviceId:
       - toast error, cleanup

4. Keep the existing setInterval(child.closed) polling as a FALLBACK.
   When child.closed fires, wait ~1000 ms (grace period) before running the
   non-postMessage refresh path, so a queued postMessage event can still fire.
```

The grace-period pattern was the prior reverted PR's "race condition" fix (commits `6ee497d` + `7e68155`). It's needed because `child.closed` can flip true before the message handler has run on the opener side — without grace, fallback `mutate` races the confirm call.

### E. ConnectionBadge / connection-state UI

vault added a "Pending confirmation" pill to `ConnectionBadge` for `connection.health === 'pending_confirmation'`. vault-core has equivalent badge logic to consider — but I have not yet inventoried where vault-core renders connection-state badges. **Open**: locate vault-core's badge rendering and decide whether to mirror the warning-styled pill, or whether the existing `state: 'authorized'` rendering is sufficient UX during the (typically <1s) pending window. This is a UX decision for the planning step.

### F. `client_credentials` / `password`

These two grant types do not open a popup; they POST `/token` directly. CSRF-irrelevant.
- `AuthorizeButton.tsx:73-78` (token POST in `authorizeConnection`)
- `connectionActions.ts:56-61` (token POST in `handleRedirect`)

### G. Backwards compatibility (free)

- Account NOT in `oauthCsrf` allowlist → unify's callback returns plain redirect, popup closes silently, no postMessage, `setInterval(child.closed)` fallback runs `mutate` and the connection refreshes. **Identical to today.**
- Account in allowlist but vault-core sends no nonce (e.g., older bundled version of `@apideck/react-vault` in production) → unify's callback returns plain redirect (the feature flag check requires `nonce && csrfEnabled`). Same fallback path.
- Account in allowlist + vault-core sends nonce → hash fragment arrives → postMessage → confirm → SWR mutate.

### H. Tests (following existing patterns in `test/`)

- New `test/oauthCsrf.test.ts` — nonce gen / verify / clear, `callConfirmEndpoint` URL + headers + body + response unwrap, error-path handling.
- Extend `test/authorize-button.test.tsx` (or sibling) — mock `window.open`, dispatch `MessageEvent`s; assert: happy path triggers confirm + mutate; nonce mismatch shows error toast; untrusted origin is ignored; confirm-endpoint failure (401, 404) surfaces a toast; popup-closed fallback still mutates after the grace window.
- Extend / create tests for `useConnectionActions.handleRedirect` (currently has no popup-flow tests).

## Code References

### vault-core (current — what changes)

- `src/components/AuthorizeButton.tsx:34-36` — authorize URL build (append nonce)
- `src/components/AuthorizeButton.tsx:38-45` — `handleChildWindowClose` (becomes the fallback path)
- `src/components/AuthorizeButton.tsx:92-103` — `window.open` + 500 ms `setInterval` (add listener)
- `src/components/TopBar.tsx:71-76` — re-authorize URL build (append nonce)
- `src/components/ButtonLayoutMenu.tsx:97-99, 281-283` — authorize / re-authorize URL builds
- `src/utils/connectionActions.ts:27-93` — `handleRedirect` popup path (add listener)
- `src/utils/useConnections.tsx:90-98, 608-653` — headers + `connectionsUrl` already exposed (no change)
- `src/utils/useSession.tsx` — `session.redirect_uri` source (no change)
- `src/types/Session.ts:28-37` — `Session.redirect_uri` field (no change)
- `src/types/Connection.ts:43-82` — Connection type (add `health?: ConnectionHealth`)
- `src/constants/urls.ts:1-2` — `REDIRECT_URL` and `BASE_URL` (no change)

### unify (launched at `30812f60`)

- `src/modules/shared/services/FeatureService.ts` — `oauthCsrf` flag, allowlist
- `src/modules/connection/application/useCases/authorizeConnection/AuthorizeConnectionController.ts:62, 197` — pass `nonce` through
- `src/modules/connection/application/useCases/callbackConnection/CallbackConnectionUseCase.ts` — feature-flag check, `confirmed: false`, hash-fragment redirect, fresh `OauthShortLivedState` row keyed by `confirmToken`
- `src/modules/connection/application/useCases/confirmConnection/ConfirmConnectionUseCase.ts` — full file; verify context, re-check feature flag, delete state row, set `confirmed: true`, broadcast events
- `src/modules/connection/application/useCases/confirmConnection/index.ts` — DI wiring
- `src/modules/connection/dtos/request/ConfirmConnectionRequestDTO.ts` — request shape
- `src/specs/unify/vault/resources/confirm_connection.yml` — OpenAPI (with `x-sdk-exclude` + `x-speakeasy-ignore`)
- `src/lib/connectionHealth.ts:55-60` — `'pending_confirmation'` branch on `confirmed === false`
- `src/lib/connectionState.ts:135-141` — `checkCallable` requires `confirmed !== false`
- `src/types/ConnectionHealth.ts` — `'pending_confirmation'` added
- `src/infra/lambda/vault/index.ts` — `connectionsConfirm` route

### vault (launched at `a498117d`)

- `src/utils/oauthCsrf.ts` — full reference implementation to mirror (uses axios)
- `src/types/OAuthCsrf.ts` — `IConfirmResponse`
- `src/types/Connection.ts` — `ConnectionHealth` type + `health?` field on `IConnection`
- `src/components/Connection/ConnectionForm.tsx:325-332` — nonce-append (redirect navigation, not popup)
- `src/components/Connections/ConnectionBadge.tsx:46-56` — "Pending confirmation" pill
- `src/pages/oauth/callback.tsx:10-46, 63-65` — postMessage sender + tightened `hasError`
- `src/pages/integrations/[unified-api]/[provider].tsx:85-130` — redirect-return confirm flow (does not apply to vault-core)

## Architecture Notes

- vault-core OAuth flow: **popup**, not redirect navigation. The opener is iframe-vault's parent (or any embedder of `@apideck/react-vault`); the popup loads `vault.apideck.com/oauth/callback`. vault-core has never communicated cross-window other than by polling `child.closed`.
- vault flow: **redirect**, not popup. ConnectionForm navigates `window.location.href` to the authorize URL and the user lands back on `/integrations/[unified-api]/[provider]`. vault's `/oauth/callback` page is reached only when **vault-core** is the embedder.
- vault's callback page therefore runs in two contexts:
  1. As a popup opened by vault-core → `window.opener` is vault-core, postMessage is the right channel.
  2. As a redirect target for vault's own ConnectionForm → no opener; vault's redirect-return on the provider page handles confirm.
- Confirm-token storage (unify): a fresh `OauthShortLivedState` row keyed by the token UUID, 30-min TTL, single-use (deleted at the start of confirm to narrow the race window).

## Historical Context (from thoughts/)

- vault-core PR #132 (`20ded96`, 2026-03-12) — earlier attempt; reverted. Targeted an older API design with a `POST .../authorize` endpoint that the launched unify never shipped. Most of the postMessage-handler + grace-period code in branch `feat_GH-9546_2` is portable; only the authorize call site needs simplification (no POST, just append nonce).
- vault PR #300 description (`vault/thoughts/shared/prs/300_description.md`) describes a `callAuthorizeEndpoint` and a POST authorize — that is an **earlier iteration**, not what shipped. The shipped vault commit only has `generateAndStoreNonce`, `verifyAndClearNonce`, `callConfirmEndpoint`. Read with care.
- Unify research / planning docs at `unify/thoughts/shared/research/GH-9546.md` and `…/plans/2026-04-09-GH-9546-oauth-csrf-nonce.md` — accurate v6 design notes; the **feature-flag rollout** detail is in the plan but absent from the research document, so reading only the research understates what shipped.
- Adjacent unify research worth reading before planning: `unify/thoughts/shared/research/2026-04-14-csrf-confirmed-flag-behavior.md` (semantics of `confirmed`), `…/2026-04-15-connection-health-new-value-blast-radius.md` (downstream consumers of `ConnectionHealth`), `…/2026-04-23-csrf-landing-pages-impact.md` (landing-page redirect-return scenarios).

## Related Research

- `vault/thoughts/shared/research/GH-9546.md` — vault side
- `unify/thoughts/shared/research/GH-9546.md` — unify side (v6)
- `unify/thoughts/shared/research/2026-04-14-csrf-confirmed-flag-behavior.md`
- `unify/thoughts/shared/research/2026-04-15-connection-health-new-value-blast-radius.md`
- `vault-core/thoughts/shared/research/2026-02-24-GH-127-authorize-button-custom-auth-type.md` — adjacent research on AuthorizeButton

## Open Questions

1. **Storage-key prefix**: vault uses `apideck_oauth_nonce_`; the prior vault-core attempt used `vault_oauth_nonce_`. Either works in isolation. Symmetry favours `apideck_oauth_nonce_`.
2. **Trusted-origin source**: derive from `session?.redirect_uri ?? REDIRECT_URL` per call (inside the handler closure where `session` is in scope), not as a module-level constant.
3. **Single shared listener vs. per-call listener**: `AuthorizeButton.authorizeConnection` and `useConnectionActions.handleRedirect` both open popups. The reverted PR refactored toward consolidating the popup logic into a shared `handleAuthorize` on `useConnectionActions` (commit `8e8b811`). Keep the duplication and add per-call listeners, or refactor to a single hook method? Planning decision.
4. **`pending_confirmation` UX in vault-core**: vault added a "Pending confirmation" pill to `ConnectionBadge`. vault-core's equivalent rendering is not yet inventoried — does vault-core have a connection-state badge component, and should it mirror the warning-styled pill? Or is the existing `state: 'authorized'` rendering acceptable during the (typically <1s) pending window?
5. **Confirm-endpoint failure modes**: 401 means the account is no longer in the `oauthCsrf` allowlist (race between callback and confirm if allowlist is edited mid-flow); 404 means the confirm token expired (>30 min) or was already consumed. Should vault-core treat these differently in toasts? Currently both would map to a generic "Could not confirm" message.
6. **Grace-period duration**: prior attempt used 1000 ms. No new evidence suggests a different value, but worth confirming once the listener is in place.
7. **Allowlist visibility**: only allowlisted accounts will exercise the new code path in production today. End-to-end testing must use one of the allowlisted accounts (`22222222` for staging, `11111111` or `cm3mogvfz004ebogk8rqdbgpi` for prod) — anything else exercises only the backwards-compat path.
