---
github_issue_url: https://github.com/apideck-io/unify/issues/9546
status: draft
related_research: thoughts/shared/research/2026-05-05-GH-9546-csrf-fix-vault-core.md
---

# OAuth CSRF Fix — vault-core (`@apideck/react-vault`) Implementation Plan

**Related Issue**: [GH-9546](https://github.com/apideck-io/unify/issues/9546)
**Cross-repo prerequisites (already launched)**:
- unify @ [`30812f60`](https://github.com/apideck-io/unify/commit/30812f607bd1c3ecd570d7074820b9e812d0341a) — feature flag `oauthCsrf` (allowlist only), `nonce` query param on `GET /vault/authorize`, hash-fragment redirect from callback when nonce sent + flag on, new `POST /vault/connections/{api}/{service}/confirm` endpoint, `connection.health = 'pending_confirmation'` when `credentials.confirmed === false`.
- vault @ [`a498117d`](https://github.com/apideck-samples/vault/commit/a498117d4be4e59bd50d19a569e2c712aed6915c) — `/oauth/callback` postMessages `{ type: 'oauth_complete', nonce, confirmToken, serviceId, success: true }` to `window.opener` on successful return; `{ type: 'oauth_error', ... }` on failure.

---

## Pattern Decisions

- **Utilities pattern:** Stateless module with named exports, mirroring `vault/src/utils/oauthCsrf.ts` (based on: `vault` commit `a498117d` `src/utils/oauthCsrf.ts`). vault-core's version uses `fetch` + injected `connectionsUrl`/`headers` rather than vault's global `axios` instance.
- **Type pattern:** Single `src/types/OAuthCsrf.ts` for postMessage shapes + `ConfirmResponse`. New `ConnectionHealth` type lives in `src/types/Connection.ts` next to the existing `ConnectionState` union (matches vault's placement at `vault/src/types/Connection.ts`).
- **Component change pattern:** Add a new branch to `StatusBadge.tsx` for `health === 'pending_confirmation'` using the existing `bg-yellow-100 text-yellow-800` palette (matches existing `needsUserAttention` rendering at `src/components/StatusBadge.tsx:70`). No new badge component.
- **Popup-flow listener pattern:** Per-site handlers — one in `AuthorizeButton.authorizeConnection` and one in `useConnectionActions.handleRedirect`. No refactor to a shared hook.
- **Test pattern:** Jest + `@testing-library/react`, `setupFetchMock` style from `test/authorize-button.test.tsx`; `window.open` is mocked via `jest.spyOn(window, 'open')`; postMessage events dispatched via `window.dispatchEvent(new MessageEvent('message', { data: ..., origin: ... }))`.
- **Utilities identified:** `oauthCsrf` (new — `src/utils/oauthCsrf.ts`); reuses `connectionsUrl` + `headers` from `useConnections.tsx:90-98, 608-653` and `session.redirect_uri` from `useSession.tsx`.
- **Types to update:** `Connection` (add `health?: ConnectionHealth`); new `ConnectionHealth` union; new `OAuthCompleteMessage`, `OAuthErrorMessage`, `OAuthPostMessage`, `ConfirmResponse`.

---

## Overview

unify's GH-9546 fix splits OAuth completion into two steps when the `oauthCsrf` flag is on for the account: `GET /authorize` accepts an optional `nonce`, and the callback redirects with a hash fragment `#nonce=…&confirm_token=…&service_id=…` so the opener can prove possession of the nonce by `POST /…/confirm`. Until `/confirm` is called, the connection has `credentials.confirmed = false` and is not callable. This plan adds vault-core's client side of that handshake — generate-nonce-on-authorize, listen-for-postMessage, call-confirm — while preserving the existing `setInterval(child.closed)` polling as the backwards-compat / non-allowlisted-account path.

## Current State Analysis

vault-core branch `csrf_fix_2` is identical to `main` (`b9c89ce`). Nothing CSRF-specific is on this branch.

- **Authorize URL is built at four sites** (research §C):
  - `src/components/AuthorizeButton.tsx:34-36` — `${connection.authorize_url}&redirect_uri=${redirect_uri ?? REDIRECT_URL}`
  - `src/components/TopBar.tsx:71-73` — re-authorize via `useConnectionActions.handleRedirect`
  - `src/components/ButtonLayoutMenu.tsx:97-99` — authorize via `handleRedirect`
  - `src/components/ButtonLayoutMenu.tsx:281-283` — re-authorize via `handleRedirect`
- **Two popup-opening sites** open `_blank` windows and poll `child.closed` on a 500 ms `setInterval` (research §C):
  - `src/components/AuthorizeButton.tsx:92-103` (inline `authorizeConnection`)
  - `src/utils/connectionActions.ts:75-92` (`useConnectionActions.handleRedirect`)
- **No `message` listener exists anywhere in `src/`** (research §C). Both popup-opening sites only refresh state when the popup window closes.
- **`Connection` type has no `health` field** (`src/types/Connection.ts:43-82`). `ConnectionState = 'available' | 'added' | 'authorized' | 'callable' | 'invalid'`.
- **`StatusBadge` already encodes connection-health-like states** (`src/components/StatusBadge.tsx:24-49`): `consent_state` checks, `integration_state === 'needs_configuration'`, then a `state` switch. The yellow palette (`bg-yellow-100 text-yellow-800`) is already used for `needsUserAttention` cases. The component is rendered by `ConnectionDetails.tsx:406`, `ConnectionListItem.tsx:97`, and `ButtonLayoutMenu.tsx:464`.
- **`useConnections` exposes `connectionsUrl` and `headers`** suitable for direct `fetch` calls (research §A).
- **Tests use Jest + `@testing-library/react`** with `setupFetchMock` (`test/authorize-button.test.tsx`), `IntersectionObserver` stub (`test/mock.ts:30-61`), and `whatwg-fetch` polyfill. `window.open` is **never** mocked today — `authorize-button.test.tsx` only asserts the button renders.

## Desired End State

- A user on an allowlisted account who clicks Authorize: nonce is generated and stored, the popup loads unify's authorize page with `&nonce=…`, unify→callback returns hash fragment, vault's callback page postMessages the opener, vault-core's listener verifies nonce + serviceId, calls `/confirm`, mutates SWR, and the connection transitions from `state: 'authorized', health: 'pending_confirmation'` to `state: 'callable', health: 'ok'`. UI shows a yellow "Pending confirmation" badge during the brief window between callback and `/confirm` success.
- A user on a non-allowlisted account: identical UX to today. unify's callback returns plain redirect (research §A — feature-flag check requires `nonce && csrfEnabled`); no postMessage; popup closes; existing `child.closed` polling triggers `mutate`; connection is `state: 'callable'` directly.
- A consumer of `@apideck/react-vault` running an older bundled version against an allowlisted account: identical to today (no nonce sent → unify's callback returns plain redirect → existing path).
- An OAuth error in the popup: `oauth_error` postMessage triggers a generic toast and refresh; the existing `child.closed` fallback also runs after a 1000 ms grace window.

### Verification:

- `tsdx build` passes.
- `tsdx lint` passes.
- `tsdx test --no-watch` passes; new tests cover nonce gen/verify/clear, confirm-endpoint URL+headers+body, postMessage happy path, postMessage error path, nonce mismatch, foreign serviceId message ignored, `child.closed` 1000 ms-grace fallback after a successful postMessage, `child.closed` fallback when no postMessage arrives.
- Manual smoke (allowlisted account `22222222` on staging): Authorize a fresh OAuth connection → popup → consent → returns and closes → connection shows "Connected" within ~1s. Network tab shows `POST /vault/connections/{api}/{service}/confirm` with `confirm_token` body and `data.confirmed: true` response.
- Manual smoke (non-allowlisted account): Authorize as before → popup closes → connection shows "Connected". No `/confirm` call in network tab. No regression.

### Key Discoveries:

- vault is the **sender** of the postMessage; vault-core is the **receiver**. vault therefore did not need typed postMessage shapes; vault-core does. (Research §B.)
- `vault.utils.oauthCsrf.verifyAndClearNonce` clears storage **before** comparing — the token is one-shot regardless of validity (research §"vault launched"). Mirror this in vault-core. The prior reverted vault-core attempt cleared only on success — that is incorrect.
- Confirm-endpoint signature differs from vault's because vault-core gets `connectionsUrl` and the JWT/X-APIDECK headers from context, not a global axios instance (research §A). Pass them as named-parameter inputs.
- The 1000 ms grace period after `child.closed` is required because `child.closed` can flip true before the message handler has run on the opener side — without grace, fallback `mutate` races the `/confirm` call (research §D, prior reverted PR commits `6ee497d` / `7e68155`).
- The `oauthCsrf` allowlist is **3 accounts** (`22222222`, `11111111`, `cm3mogvfz004ebogk8rqdbgpi`) — every other account exercises the backwards-compat path. End-to-end testing must use one of these.
- `connection.confirmed` (the underlying state) is exposed via `connection.health === 'pending_confirmation'`. unify's `connectionState.checkCallable` short-circuits when `confirmed === false`, so a not-yet-confirmed connection has `state: 'authorized'`, `health: 'pending_confirmation'` (research §A).

## What We're NOT Doing

- **No origin verification** in the postMessage handler. `react-vault` is a library that consumers can deploy anywhere, and `redirect_uri` is per-session — there is no fixed trusted origin. The nonce (sessionStorage-bound, per-service-id) is the actual CSRF defense; an attacker with no nonce cannot induce a confirm. We still filter on `event.data.serviceId === current serviceId` and on `event.data.type ∈ {'oauth_complete', 'oauth_error'}` for correctness (ignore stale / foreign messages), but not on `event.origin`.
- **No POST `/authorize` endpoint** call. unify shipped the v6 design where authorize accepts `?nonce=` as a query param on the existing GET. The earlier reverted vault-core attempt and vault PR #300's description mention `callAuthorizeEndpoint` / a POST — that iteration was abandoned (research §"vault launched" and §"Historical Context").
- **No nonce on revoke URLs.** `TopBar.tsx:74-76` and `ButtonLayoutMenu.tsx:342-344` are unaffected; revoke is unrelated to GH-9546 (research §C).
- **No refactor of the two popup-opening sites into a shared `useConnectionActions.handleAuthorize` hook.** The reverted PR did this (commit `8e8b811`); we keep the duplication and add per-site listeners. Refactoring is out of scope for this branch.
- **No changes for `client_credentials` / `password` grants.** They POST `/token` directly without a popup; CSRF-irrelevant (research §F).
- **No distinct toast copy for 401 vs 404 from `/confirm`.** Both surface a generic "Could not confirm authorization" message; the underlying error is `console.warn`'d for debugging.
- **No iframe-vault changes.** iframe-vault consumes `@apideck/react-vault` via npm — once vault-core publishes, it picks up on next install (research §"Cross-Repo Context").

## Implementation Approach

Work bottom-up: types first (no tests needed), then the new utility module (TDD), then the StatusBadge branch (TDD), then the two popup-flow sites (TDD each). Finish with a verification phase and a refactor pass.

The phasing pairs each user-visible change with its tests so that any single phase can be reviewed and reverted independently. The two popup-flow sites are split into separate phase pairs because they live in different files with different state sources (`AuthorizeButton` uses props + `useSession`; `handleRedirect` uses `useConnections().selectedConnection`).

---

## Phase 1: Type / Interface Updates

### Overview

Add the new types vault-core needs as the postMessage receiver. No tests required for type-only additions; downstream phases will exercise them.

### Session Startup Protocol
1. Verify working directory: `pwd`
2. Read progress JSON: `thoughts/shared/progress/2026-05-05-GH-9546-csrf-fix-vault-core-status.json`
3. Confirm current phase matches JSON `current_phase`

### Changes Required:

#### 1. `src/types/Connection.ts`

**File**: `src/types/Connection.ts` (after line 31, the `ConnectionState` export)
**Change**: Add `ConnectionHealth` union and an optional `health` field on `Connection`.

**Key Implementation Notes**:
- Mirror unify's enum order from `connectionHealth.ts` (research §"unify launched"): `'ok' | 'pending_refresh' | 'needs_auth' | 'needs_consent' | 'revoked' | 'missing_settings' | 'pending_confirmation'`.
- `health` is optional — older unify deployments do not return the field, so consumers must tolerate `undefined`.
- Add `health?: ConnectionHealth` to the `Connection` interface (after `state` on line 55 to keep state-related fields adjacent).

#### 2. `src/types/OAuthCsrf.ts` (new file)

**File**: `src/types/OAuthCsrf.ts`
**Change**: New file exporting postMessage shapes and confirm response.

**Key Implementation Notes**:
- Shapes must match vault's sender exactly (research §"vault launched", `vault/src/pages/oauth/callback.tsx`):
  - `OAuthCompleteMessage` = `{ type: 'oauth_complete'; nonce: string; confirmToken: string; serviceId: string; success: boolean }`
  - `OAuthErrorMessage` = `{ type: 'oauth_error'; error: string; errorDescription: string; serviceId: string }`
  - `OAuthPostMessage` = union of the two.
- `ConfirmResponse` matches unify's wire shape: `{ status_code: number; status: string; data: { confirmed: boolean } }`.

### Success Criteria:

#### Automated Verification:
- `tsdx build` succeeds.
- `tsdx lint` passes.
- `tsdx test --no-watch` passes (no new tests yet; existing tests untouched).

#### Manual Verification:
- TypeScript compiler reports no errors when importing `Connection.health` or `OAuthCsrf` types from a downstream file (smoke check via the next phase's test file).

### Session Completion
1. Commit: `git add -A && git commit -m "Phase 1: add ConnectionHealth and OAuthCsrf types (Ref #9546)"`
2. Update progress JSON: phase 1 status `complete`, `current_phase` = 2.
3. `git status` clean.

---

## Phase 2: Write Tests for `oauthCsrf` Utilities (TDD — RED)

### Overview

Write failing tests for `src/utils/oauthCsrf.ts` before implementing it. Mirrors vault's utility surface (research §B) but with `fetch` + injected URL/headers.

### Session Startup Protocol
1. `pwd`; `git log -1 --oneline`; read progress JSON; confirm `current_phase: 2`.

### Changes Required:

#### 1. `test/oauth-csrf.test.ts` (new file)

**File**: `test/oauth-csrf.test.ts`
**Change**: Unit tests for `generateAndStoreNonce`, `verifyAndClearNonce`, `clearNonce`, `callConfirmEndpoint`.

**Key Implementation Notes**:
- Import from `../src/utils/oauthCsrf` (the file does not yet exist — tests will fail with "Cannot find module" until Phase 3).
- Use `whatwg-fetch` (already in `test/authorize-button.test.tsx:3`); spy on `window.fetch`.
- `sessionStorage` is available in jsdom; reset between tests with `sessionStorage.clear()`.
- `crypto.randomUUID` is available in Node 19+ / jsdom 22+; if the test environment lacks it, mock via `Object.defineProperty(global, 'crypto', { value: { randomUUID: () => 'fixed-uuid' } })`.

**Test cases to cover**:
- `generateAndStoreNonce(serviceId)` returns a non-empty string and writes `apideck_oauth_nonce_{serviceId}` to `sessionStorage`.
- Two successive calls for the same `serviceId` produce different nonces (the second overwrites the first).
- `verifyAndClearNonce(serviceId, nonce)` returns `true` when stored matches and removes the key. Returns `false` when stored differs and **still** removes the key (one-shot semantics, matching vault's behaviour).
- `verifyAndClearNonce(serviceId, nonce)` returns `false` when no nonce is stored for that `serviceId`.
- `clearNonce(serviceId)` removes the key without comparing.
- `callConfirmEndpoint({ unifiedApi, serviceId, confirmToken, connectionsUrl, headers })`:
  - POSTs to `${connectionsUrl}/${unifiedApi}/${serviceId}/confirm` with body `{ confirm_token: confirmToken }`.
  - Forwards `headers` (e.g., `Authorization`, `X-APIDECK-APP-ID`, `X-APIDECK-CONSUMER-ID`).
  - Returns the parsed JSON when response is OK (`{ status_code: 200, status: 'OK', data: { confirmed: true } }`).
  - Throws on non-2xx (or returns a known error shape — match the function contract decided in Phase 3; test should specify expected throw and Phase 3 implements that).

**Expected outcome**: All tests **FAIL** with "Cannot find module '../src/utils/oauthCsrf'" or equivalent — confirming RED.

### Success Criteria:

#### Automated Verification:
- `tsdx test --no-watch test/oauth-csrf.test.ts` runs and reports failures (not infrastructure errors).

#### Manual Verification:
- Failures are because the module / functions don't exist, not because the test setup is broken.

### Session Completion
1. Commit: `git add -A && git commit -m "Phase 2: failing tests for oauthCsrf utilities (Ref #9546)"`
2. Update progress JSON.

---

## Phase 3: Implement `oauthCsrf` Utilities (TDD — GREEN)

### Overview

Implement `src/utils/oauthCsrf.ts` to make Phase 2's tests pass.

### Session Startup Protocol
1. `pwd`; `git log -1 --oneline` (should be Phase 2's RED commit); read progress JSON; confirm `current_phase: 3`.

### Changes Required:

#### 1. `src/utils/oauthCsrf.ts` (new file)

**File**: `src/utils/oauthCsrf.ts`
**Change**: Implement four named exports.

**Key Implementation Notes**:
- Storage key prefix: `apideck_oauth_nonce_` (match vault for cross-repo symmetry).
- `generateAndStoreNonce(serviceId: string): string` — `const nonce = crypto.randomUUID(); sessionStorage.setItem(\`apideck_oauth_nonce_${serviceId}\`, nonce); return nonce;`
- `verifyAndClearNonce(serviceId: string, nonce: string): boolean` — read, **remove unconditionally**, then compare. Mirror vault's one-shot semantics.
- `clearNonce(serviceId: string): void` — `sessionStorage.removeItem(\`apideck_oauth_nonce_${serviceId}\`)`. Used on popup-blocked / pre-confirm errors so a stale nonce doesn't poison the next attempt.
- `callConfirmEndpoint(params: { unifiedApi: string; serviceId: string; confirmToken: string; connectionsUrl: string; headers: Record<string, string> }): Promise<ConfirmResponse>`:
  - URL: `${params.connectionsUrl}/${params.unifiedApi}/${params.serviceId}/confirm`
  - `fetch(url, { method: 'POST', headers: { ...params.headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm_token: params.confirmToken }) })`
  - On non-OK response: throw an `Error` with the JSON-parsed message if available, otherwise the status text. Caller (popup site) catches and toasts.
- Import the `ConfirmResponse` type from `../types/OAuthCsrf`.

**Code Sketch** (only for `callConfirmEndpoint` shape):

```ts
export async function callConfirmEndpoint(params: {
  unifiedApi: string;
  serviceId: string;
  confirmToken: string;
  connectionsUrl: string;
  headers: Record<string, string>;
}): Promise<ConfirmResponse> {
  // Build URL, fetch POST, parse JSON
  // Throw on !response.ok with best-available error message
  // Return parsed JSON on success
}
```

### Success Criteria:

#### Automated Verification:
- `tsdx test --no-watch test/oauth-csrf.test.ts` passes (all tests GREEN).
- `tsdx lint` passes.
- `tsdx build` succeeds.

#### Manual Verification:
- Spot-check that storage prefix matches vault's `apideck_oauth_nonce_`.

### Session Completion
1. Commit: `git add -A && git commit -m "Phase 3: implement oauthCsrf utilities (Ref #9546)"`
2. Update progress JSON.

---

## Phase 4: Write Tests for `StatusBadge` "Pending confirmation" Branch (TDD — RED)

### Overview

Add failing tests asserting `StatusBadge` renders "Pending confirmation" with the yellow `needsUserAttention` palette when `connection.health === 'pending_confirmation'`.

### Session Startup Protocol
1. `pwd`; `git log -1 --oneline`; read progress JSON; confirm `current_phase: 4`.

### Changes Required:

#### 1. `test/status-badge.test.tsx` (new file)

**File**: `test/status-badge.test.tsx`
**Change**: New test file targeting `StatusBadge` directly (no existing tests today).

**Key Implementation Notes**:
- Render `<StatusBadge connection={...} />` with a minimal `Connection` fixture (require `id`, `service_id`, `unified_api`, `name`, `icon`, `state`).
- Wrap in the i18n provider used by other tests if needed (check whether `useTranslation` requires it — `test/connection-form.test.tsx` may show the pattern). If a bare render works with `react-i18next` initReactI18next defaulting to keys, no provider is needed.

**Test cases**:
- Renders text "Pending confirmation" when `health === 'pending_confirmation'`.
- Applies yellow palette classes (`bg-yellow-100`, `text-yellow-800`).
- Takes precedence over the `state` switch — i.e., a connection with `state: 'authorized', health: 'pending_confirmation'` renders "Pending confirmation", not "Input required" / "Needs configuration".
- Existing behaviour preserved: `state: 'callable'` with no `health` → "Connected"; `state: 'authorized'` with no `health` → "Input required" or "Needs configuration".

**Expected outcome**: New "Pending confirmation" tests FAIL (the branch doesn't exist yet); existing-behaviour tests PASS.

### Success Criteria:

#### Automated Verification:
- `tsdx test --no-watch test/status-badge.test.tsx` shows the new branch tests as failing, existing-behaviour tests as passing.

### Session Completion
1. Commit: `git add -A && git commit -m "Phase 4: failing tests for StatusBadge pending_confirmation branch (Ref #9546)"`
2. Update progress JSON.

---

## Phase 5: Implement `StatusBadge` "Pending confirmation" Branch (TDD — GREEN)

### Overview

Add the `health === 'pending_confirmation'` branch to `StatusBadge.tsx`.

### Session Startup Protocol
1. `pwd`; `git log -1 --oneline`; read progress JSON; confirm `current_phase: 5`.

### Changes Required:

#### 1. `src/components/StatusBadge.tsx`

**File**: `src/components/StatusBadge.tsx` (modify `statusText` at line 24-49 and `getStatusClass` at line 67-74)
**Change**: Branch on `connection.health === 'pending_confirmation'` before the existing `state`-based logic.

**Key Implementation Notes**:
- Destructure `health` alongside the existing `state, integration_state, enabled, consent_state` (line 20).
- In `statusText`: add `if (health === 'pending_confirmation') return t('Pending confirmation');` near the top — after `consent_state` checks (which take priority — match unify's priority list: `revoked > missing_settings > needs_consent > pending_confirmation > needs_auth > pending_refresh > ok`) but before the `integration_state === 'needs_configuration'` check.
- In `getStatusClass`: extend `needsUserAttention` to include `health === 'pending_confirmation'` so the existing yellow palette applies. Equivalent local boolean `isPendingConfirmation` is also acceptable; either way the resolved class is `bg-yellow-100 text-yellow-800`.
- Translation key: add `'Pending confirmation'` to whichever i18n source `useTranslation` resolves against. Inspect `src/utils/i18n.*` to find the locale dictionary; add the English entry. (If translations are key-as-value by default, the code change alone suffices.)

### Success Criteria:

#### Automated Verification:
- `tsdx test --no-watch test/status-badge.test.tsx` passes (all tests GREEN).
- `tsdx test --no-watch` (full suite) passes — no regression in `connection-form`, `with-connections`, `single-connections`, etc.
- `tsdx lint` passes.

#### Manual Verification:
- Storybook (if a `StatusBadge` story exists; otherwise via Vault example app): a connection with `health: 'pending_confirmation'` renders the yellow "Pending confirmation" pill.
- A `state: 'callable'` connection with no `health` still renders "Connected" (no regression).

### Session Completion
1. Commit: `git add -A && git commit -m "Phase 5: StatusBadge pending_confirmation branch (Ref #9546)"`
2. Update progress JSON.

---

## Phase 6: Write Tests for `AuthorizeButton` Popup Flow (TDD — RED)

### Overview

Add failing tests for: nonce generated and stored before popup opens, `&nonce=` appended to authorize URL, postMessage `oauth_complete` triggers `/confirm` + SWR mutate, postMessage `oauth_error` shows toast, foreign-serviceId message ignored, nonce-mismatch shows error toast, `child.closed` 1000 ms-grace fallback when no postMessage arrives.

### Session Startup Protocol
1. `pwd`; `git log -1 --oneline`; read progress JSON; confirm `current_phase: 6`.

### Changes Required:

#### 1. Extend `test/authorize-button.test.tsx`

**File**: `test/authorize-button.test.tsx` (extend the existing `describe`, or add a new `describe('Authorize button OAuth CSRF flow')`)
**Change**: Add tests covering the full popup → postMessage → confirm flow.

**Key Implementation Notes**:
- Mock `window.open` with `jest.spyOn(window, 'open').mockImplementation(() => fakeChild)` where `fakeChild = { closed: false, close: jest.fn() }`. To exercise `child.closed` paths, flip `fakeChild.closed = true` and advance timers via `jest.useFakeTimers()` / `jest.advanceTimersByTime(500)`.
- Dispatch `MessageEvent`s: `window.dispatchEvent(new MessageEvent('message', { data: { type: 'oauth_complete', nonce, confirmToken: 'tok', serviceId, success: true }, origin: 'https://vault.apideck.com' }))`.
- Use the existing `setupFetchMock` pattern; extend it to handle the new `POST /…/confirm` URL by inspecting `init.method === 'POST'` and the URL ending in `/confirm`. Return `{ status_code: 200, status: 'OK', data: { confirmed: true } }`.
- Pre-populate `sessionStorage` for the nonce-mismatch test: write a known-different nonce under `apideck_oauth_nonce_{serviceId}` before dispatching the message.

**Test cases**:
- Click "Authorize" → `window.open` is called; the URL passed contains `&nonce={uuid}` and `apideck_oauth_nonce_{serviceId}` is in `sessionStorage`.
- After `oauth_complete` postMessage with the correct nonce: `fetch` is called with `POST {connectionsUrl}/{unifiedApi}/{serviceId}/confirm`, body contains `confirm_token`. SWR mutate refreshes the detail endpoint. `onConnectionChange` fires.
- `oauth_error` postMessage: `addToast` is invoked with an error-type toast; `/confirm` is NOT called.
- Foreign serviceId in `event.data.serviceId`: handler ignores the message; `/confirm` is NOT called.
- Nonce mismatch: handler ignores / errors out, `/confirm` is NOT called, error toast surfaces.
- `child.closed` flips true with no preceding postMessage: after the 1000 ms grace window elapses, fallback `mutate` runs (existing behaviour) and listener is torn down. `/confirm` is NOT called.
- `child.closed` flips true AFTER an `oauth_complete` was already handled: fallback does not re-mutate (or mutates harmlessly — test for no double `/confirm` call).

**Expected outcome**: All new tests FAIL because:
- The URL has no `&nonce=` (Phase 7 adds it).
- No `message` listener is registered (Phase 7 adds it).
- No `/confirm` POST is made.

Existing visibility tests still pass.

### Success Criteria:

#### Automated Verification:
- `tsdx test --no-watch test/authorize-button.test.tsx` shows the new tests failing, existing visibility tests passing.

### Session Completion
1. Commit: `git add -A && git commit -m "Phase 6: failing tests for AuthorizeButton OAuth CSRF flow (Ref #9546)"`
2. Update progress JSON.

---

## Phase 7: Implement `AuthorizeButton` Popup Flow (TDD — GREEN)

### Overview

Append nonce to the authorize URL, register a `message` listener before `window.open`, handle `oauth_complete` / `oauth_error`, and add a 1000 ms grace window after `child.closed` before running the fallback.

### Session Startup Protocol
1. `pwd`; `git log -1 --oneline`; read progress JSON; confirm `current_phase: 7`.

### Changes Required:

#### 1. `src/components/AuthorizeButton.tsx`

**File**: `src/components/AuthorizeButton.tsx` (modify lines 34-36 and 92-103)
**Change**: Inline nonce-generation into the authorize-URL build for the popup branch only; add postMessage listener and 1000 ms-grace fallback.

**Key Implementation Notes**:
- Move the URL build inside `authorizeConnection`'s `else` branch (the popup path). The `client_credentials` / `password` branch must NOT generate a nonce.
- Build URL via `URL` + `searchParams.append('nonce', nonce)` (matches vault's pattern, research §C). Equivalent string concat with `encodeURIComponent` is acceptable but `searchParams` is safer.
- Register the listener **before** `window.open` so messages are not lost if the popup posts immediately.
- Listener body:
  - Bail if `event.data?.type` is neither `'oauth_complete'` nor `'oauth_error'` (do not check `event.origin` — see "What We're NOT Doing").
  - Bail if `event.data?.serviceId !== connection.service_id` (filter stale messages from a prior popup).
  - On `oauth_complete`:
    - `if (!verifyAndClearNonce(serviceId, event.data.nonce))` → `addToast({ type: 'error', title: t('Could not confirm authorization'), … })`, run `cleanup()`, return.
    - `try { await callConfirmEndpoint({ unifiedApi, serviceId, confirmToken: event.data.confirmToken, connectionsUrl, headers }) } catch (e) { addToast({ type: 'error', title: t('Could not confirm authorization'), description: e?.message, … }); console.warn('[oauthCsrf] confirm failed', e); }`
    - `mutate(\`${connectionsUrl}/${unifiedApi}/${serviceId}\`).then((r) => onConnectionChange?.(r.data))`; `mutate('/vault/connections')`.
    - `cleanup()`.
  - On `oauth_error`: `addToast({ type: 'error', title: t('Authorization failed'), description: event.data.errorDescription || event.data.error })`; `clearNonce(serviceId)`; `cleanup()`.
- `cleanup()`: `window.removeEventListener('message', handler)`; `clearInterval(timer)`; clear the grace-period timeout if any; `setIsLoading(false)`.
- `child.closed` poll: keep the 500 ms `setInterval`. When `child.closed` is true:
  - Clear the interval immediately so we don't fire repeatedly.
  - Start a `setTimeout` with 1000 ms grace; the timeout's callback checks a "completed via postMessage" flag (set inside `oauth_complete` / `oauth_error` handlers); if still uncompleted, run `handleChildWindowClose()` (existing fallback path) and `cleanup()`.
- `useEffect` cleanup on unmount: ensure listener and timers are torn down if the component unmounts mid-flow (avoid leaking listeners across re-renders).

**Code Sketch** (structural — focus on order, not exact wording):

```ts
} else {
  const nonce = generateAndStoreNonce(connection.service_id);
  const url = new URL(authorizeUrl);
  url.searchParams.append('nonce', nonce);

  let completed = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let graceTimeout: ReturnType<typeof setTimeout> | undefined;

  const cleanup = () => {
    completed = true;
    window.removeEventListener('message', handler);
    if (timer) clearInterval(timer);
    if (graceTimeout) clearTimeout(graceTimeout);
    setIsLoading(false);
  };

  const handler = (event: MessageEvent<OAuthPostMessage>) => {
    // type / serviceId guards, then oauth_complete / oauth_error branches
  };
  window.addEventListener('message', handler);

  const child = window.open(url.href, '_blank', 'location=no,height=750,width=550,scrollbars=yes,status=yes,left=0,top=0');

  timer = setInterval(() => {
    if (child?.closed) {
      clearInterval(timer);
      graceTimeout = setTimeout(() => {
        if (!completed) {
          handleChildWindowClose();
          cleanup();
        }
      }, 1000);
    }
  }, 500);
}
```

### Success Criteria:

#### Automated Verification:
- `tsdx test --no-watch test/authorize-button.test.tsx` passes (all tests GREEN).
- `tsdx test --no-watch` (full suite) passes.
- `tsdx lint` passes.
- `tsdx build` succeeds.

#### Manual Verification:
- Console clean (no React warnings about state updates after unmount, no listener leaks).

### Session Completion
1. Commit: `git add -A && git commit -m "Phase 7: AuthorizeButton OAuth CSRF flow (Ref #9546)"`
2. Update progress JSON.

---

## Phase 8: Write Tests for `useConnectionActions.handleRedirect` + TopBar/ButtonLayoutMenu Nonce Append (TDD — RED)

### Overview

Cover the second popup site (`handleRedirect`) and assert that its callers in `TopBar.tsx` and `ButtonLayoutMenu.tsx` pass an authorize URL containing `&nonce=`.

### Session Startup Protocol
1. `pwd`; `git log -1 --oneline`; read progress JSON; confirm `current_phase: 8`.

### Changes Required:

#### 1. `test/connection-actions.test.tsx` (new file)

**File**: `test/connection-actions.test.tsx`
**Change**: Tests for `useConnectionActions.handleRedirect` covering the popup branch.

**Key Implementation Notes**:
- Render a host component that consumes `useConnectionActions()` inside a `<Vault>` (so `useConnections` context is populated by the existing `setupFetchMock`).
- Trigger `handleRedirect` by simulating a user action that goes through TopBar or ButtonLayoutMenu (both call `handleRedirect` with an authorize URL — see research §"Authorize URL construction"). Alternative: render `<TopBar>` directly with a mock `useConnections` context.
- Mock `window.open`, dispatch `MessageEvent`s, intercept `fetch` for `/confirm` (same pattern as Phase 6).

**Test cases** (mirror the Phase 6 set, scoped to handleRedirect):
- handleRedirect popup branch: `window.open` URL contains `&nonce=`.
- `oauth_complete` postMessage triggers `/confirm` and SWR mutate.
- `oauth_error` shows toast.
- Foreign serviceId message ignored.
- Nonce mismatch shows toast and skips `/confirm`.
- `child.closed` with no postMessage triggers the existing fallback after 1000 ms grace.
- `client_credentials` / `password` branch in `handleRedirect` is untouched (no nonce, no popup, no listener) — regression check.

#### 2. Verify TopBar / ButtonLayoutMenu nonce-append

The Phase 6 / Phase 8 tests above exercise the popup flow end-to-end through the actual call sites. If render paths are simulated through TopBar/ButtonLayoutMenu, the URL-with-nonce assertion implicitly validates lines 71-73 / 97-99 / 281-283. If the tests render a synthetic host instead, add explicit URL-build assertions for TopBar and ButtonLayoutMenu — render those components, click the relevant button, assert `window.open` (or the URL passed to handleRedirect) contains `&nonce=`.

**Expected outcome**: All new tests FAIL until Phase 9 lands.

### Success Criteria:

#### Automated Verification:
- `tsdx test --no-watch test/connection-actions.test.tsx` shows the new tests failing.
- Other suites still pass.

### Session Completion
1. Commit: `git add -A && git commit -m "Phase 8: failing tests for handleRedirect OAuth CSRF flow (Ref #9546)"`
2. Update progress JSON.

---

## Phase 9: Implement `handleRedirect` Popup Flow + TopBar/ButtonLayoutMenu Nonce Append (TDD — GREEN)

### Overview

Make Phase 8's tests pass: append nonce in the four URL-build sites that feed `handleRedirect`, and add the postMessage listener + grace fallback inside `handleRedirect`'s popup branch.

### Session Startup Protocol
1. `pwd`; `git log -1 --oneline`; read progress JSON; confirm `current_phase: 9`.

### Changes Required:

#### 1. `src/components/TopBar.tsx`

**File**: `src/components/TopBar.tsx` (lines 71-73)
**Change**: Append `&nonce=` to the re-authorize URL before passing to `handleRedirect`.

**Key Implementation Notes**:
- Generate the nonce inline at the call site (right where the URL is built), using `connection.service_id` (or whichever variable is in scope at line 71-73).
- Use `URL` + `searchParams.append('nonce', nonce)` to keep the construction style consistent with Phase 7.
- Revoke URL (lines 74-76) is unchanged.

#### 2. `src/components/ButtonLayoutMenu.tsx`

**File**: `src/components/ButtonLayoutMenu.tsx` (lines 97-99 and 281-283)
**Change**: Append `&nonce=` to both authorize URL builds.

**Key Implementation Notes**: Same as TopBar — inline nonce gen, `URL.searchParams.append`. Revoke URL at lines 342-344 unchanged.

#### 3. `src/utils/connectionActions.ts`

**File**: `src/utils/connectionActions.ts` (lines 75-92, the `else` branch in `handleRedirect`)
**Change**: Add the postMessage listener + 1000 ms-grace fallback. Mirror Phase 7's structure exactly so cleanup, ordering, and edge cases are uniform.

**Key Implementation Notes**:
- `selectedConnection?.service_id` and `?.unified_api` — both already in scope.
- `connectionsUrl`, `headers`, `mutate`, `addToast`, `t` — already destructured / imported.
- `setIsReAuthorizing(false)` is the equivalent of Phase 7's `setIsLoading(false)`; include it in `cleanup()`.
- `onConnectionChange?.(result.data)` is called both in the `oauth_complete` success path and in the existing `child.closed` fallback path — preserve existing behaviour for the fallback.
- DO NOT touch the `client_credentials` / `password` branch (lines 32-73).

### Success Criteria:

#### Automated Verification:
- `tsdx test --no-watch` (full suite) passes — Phase 6 and Phase 8 suites both green.
- `tsdx lint` passes.
- `tsdx build` succeeds.

#### Manual Verification:
- TopBar re-authorize and ButtonLayoutMenu authorize/re-authorize buttons in the example app open popups with `&nonce=` in the URL (inspect via popup window's address bar or example-app console log).

### Session Completion
1. Commit: `git add -A && git commit -m "Phase 9: handleRedirect OAuth CSRF flow + nonce on TopBar/ButtonLayoutMenu (Ref #9546)"`
2. Update progress JSON.

---

## Phase 10: Verify All Tests Pass + Lint + Build (TDD — GREEN Verification)

### Overview

Full-suite verification that everything still passes together and the bundle builds.

### Session Startup Protocol
1. `pwd`; `git log -1 --oneline`; read progress JSON; confirm `current_phase: 10`.

### Changes Required:

No code changes. This phase is verification only.

### Success Criteria:

#### Automated Verification:
- `tsdx test --no-watch` — all tests pass.
- `tsdx lint` — clean.
- `tsdx build` — produces `dist/` without errors.
- `git status` — clean working tree.

#### Manual Verification:

**Allowlisted-account smoke test (staging, account `22222222`)**:
1. Start the example app: `yarn` then `cd example && yarn && yarn start` (or whatever the example-app run command is).
2. Configure example app to point at staging unify with the allowlisted account's JWT.
3. Open Vault, pick an OAuth connector with `oauth_grant_type: 'authorization_code'`.
4. Click Authorize → popup loads unify authorize page with `&nonce=…` in URL.
5. Complete OAuth in popup → popup closes.
6. Within ~1 s: connection shows "Connected" badge. (Briefly may show yellow "Pending confirmation" pill before the confirm completes — acceptable.)
7. Network tab: confirms a `POST /vault/connections/{api}/{service}/confirm` call with `data: { confirmed: true }` response.
8. SessionStorage inspector: `apideck_oauth_nonce_{serviceId}` is gone.

**Non-allowlisted-account smoke test**:
1. Same flow with any account NOT in the allowlist.
2. Authorize popup loads with `&nonce=…` (we still send it).
3. unify's callback returns plain redirect; popup closes.
4. After ~1.5 s grace, connection refreshes to "Connected".
5. Network tab: NO `/confirm` call (unify did not signal CSRF mode).
6. No regression vs current production behaviour.

**Error-path smoke test (allowlisted account)**:
1. Cancel the OAuth consent in the popup.
2. vault's callback page postMessages `oauth_error`.
3. Toast appears with error description.
4. Connection remains in its previous state.

### Session Completion
1. No commit (verification only). If any fix-ups are needed, treat as a follow-up sub-phase or amend Phase 7/9 (do not amend already-pushed commits).
2. Update progress JSON: phase 10 `complete`.

---

## Phase 11: Refactor (TDD — REFACTOR)

### Overview

Clean up the duplication between `AuthorizeButton.authorizeConnection` and `useConnectionActions.handleRedirect` if practical, while keeping all tests green. This phase is **scoped** — if the refactor introduces non-trivial complexity or behavioural drift, abandon it and document why.

### Session Startup Protocol
1. `pwd`; `git log -1 --oneline`; read progress JSON; confirm `current_phase: 11`.

### Changes Required:

#### 1. (Optional) Extract a shared `useOAuthPopupFlow` hook

**File**: `src/utils/useOAuthPopupFlow.ts` (new — only if extracting cleanly)
**Change**: Hook that takes `({ connection, connectionsUrl, headers, mutate, addToast, onConnectionChange })` and returns `{ openAuthorizePopup(authorizeUrl) }`. Internally encapsulates: nonce gen + URL append, `window.open`, listener registration, `child.closed` polling + 1000 ms grace, cleanup.

**Key Implementation Notes**:
- Both `AuthorizeButton` and `useConnectionActions.handleRedirect` would call `openAuthorizePopup(authorizeUrl)`. The differing state sources (`connection` vs. `selectedConnection`, `setIsLoading` vs. `setIsReAuthorizing`) become consumer responsibilities — the hook only handles the popup mechanics.
- The four URL-build call sites stay as-is (they still pass URL-with-nonce in; the hook does NOT re-append).
- Bail criterion: if the resulting hook has more than 5 input params or has special-case branches for one of the two callers, the abstraction is wrong — abandon and leave the duplication.

#### 2. Documentation

If the hook is extracted, update `src/utils/README.md` (if one exists; otherwise skip) with a one-line entry. No new docs files.

### Success Criteria:

#### Automated Verification:
- `tsdx test --no-watch` — all tests still pass without modification (refactor must not change behaviour).
- `tsdx lint` clean; `tsdx build` succeeds.

#### Manual Verification:
- Code review: the duplication is genuinely smaller. If not, the refactor is dropped.

### Session Completion
1. If the refactor lands: `git add -A && git commit -m "Phase 11: extract useOAuthPopupFlow hook (Ref #9546)"`
2. If abandoned: leave a short note in this plan's "Notes" or commit message log. No empty commit.
3. Update progress JSON: phase 11 `complete` (regardless of whether refactor landed).

---

## Testing Strategy

**TDD followed throughout** — phases pair RED (test) with GREEN (implementation) for each unit (utility, badge, AuthorizeButton, handleRedirect).

### Unit Tests:

- **`oauthCsrf` utilities** (`test/oauth-csrf.test.ts`): nonce gen + storage, one-shot verify, clear, confirm-endpoint URL/headers/body/response.
- **`StatusBadge` health branch** (`test/status-badge.test.tsx`): rendering, palette, priority over `state`-based logic, no regression on existing branches.
- **`AuthorizeButton`** (`test/authorize-button.test.tsx`): URL with nonce, postMessage happy / error, foreign serviceId, nonce mismatch, child.closed grace, no double-mutate after success.
- **`useConnectionActions.handleRedirect`** (`test/connection-actions.test.tsx`): same surface as `AuthorizeButton`, plus regression check that `client_credentials` / `password` paths are untouched.

### Component Tests:

- Use `@testing-library/react` (existing pattern).
- Mock `window.open` via `jest.spyOn(window, 'open')`.
- Dispatch postMessage via `window.dispatchEvent(new MessageEvent('message', { data, origin }))`.
- Reuse `setupFetchMock` style from `test/authorize-button.test.tsx` and extend it to handle `POST /…/confirm`.
- `jest.useFakeTimers()` + `jest.advanceTimersByTime(...)` for the 500 ms `child.closed` poll and 1000 ms grace.

### Manual Testing Steps:

1. (Allowlisted) End-to-end OAuth flow against staging unify with account `22222222`. See Phase 10 manual checklist.
2. (Non-allowlisted) Same flow against any other account. Confirm no `/confirm` call and no UX regression.
3. (Error) Cancel consent in popup; confirm `oauth_error` toast.

## Performance Considerations

- The 1000 ms grace adds a worst-case 1 s delay to the existing UX **only** when the popup closes without sending a postMessage (i.e., non-allowlisted accounts). Today's UX has zero grace; this is an acceptable trade-off for correctness on allowlisted accounts.
- A single `addEventListener('message', handler)` per popup. Cleanup is paired in every code path (success, error, popup-closed-no-message, component unmount). No listener leaks across multiple authorize attempts.
- `crypto.randomUUID()` is fast and synchronous; no measurable impact.
- Bundle size: `src/utils/oauthCsrf.ts` is ≈40 LOC; type files are erased at build. Negligible.

## Migration Notes

- **No data migration**. All state lives in unify.
- **No semver bump implications**. The component public API (`<Vault>` props, `onConnectionChange` callback shape) is unchanged. Consumers of `@apideck/react-vault` pick up the fix on next `npm install` without code changes.
- **iframe-vault**: no code change in iframe-vault — it consumes vault-core via npm and will auto-pick up on rebuild.
- **Backwards compatibility is automatic** (research §G):
  - Account NOT in `oauthCsrf` allowlist: unify ignores the nonce; callback returns plain redirect; existing `child.closed` fallback runs `mutate`. Identical UX to today.
  - Account in allowlist running an older `@apideck/react-vault` that does not send nonce: unify's `nonce && csrfEnabled` gate fails closed; plain redirect; same fallback path.
  - Account in allowlist + new vault-core: postMessage path, `/confirm`, mutate.

## References

- Related research: `thoughts/shared/research/2026-05-05-GH-9546-csrf-fix-vault-core.md`
- Reference utility implementation: `vault/src/utils/oauthCsrf.ts` (commit `a498117d`)
- Reference postMessage sender: `vault/src/pages/oauth/callback.tsx:10-46` (commit `a498117d`)
- Reference badge change: `vault/src/components/Connections/ConnectionBadge.tsx:46-56` (commit `a498117d`)
- unify `confirm` endpoint: `unify/src/modules/connection/application/useCases/confirmConnection/ConfirmConnectionUseCase.ts` (commit `30812f60`)
- unify health priority: `unify/src/lib/connectionHealth.ts:55-60` (commit `30812f60`)
- Existing popup-open sites: `src/components/AuthorizeButton.tsx:92-103`, `src/utils/connectionActions.ts:75-92`
- Existing badge component: `src/components/StatusBadge.tsx:24-74`
- Tests pattern: `test/authorize-button.test.tsx:32-66` (`setupFetchMock`)
- Allowlist (manual-test reference): `unify/src/modules/shared/services/FeatureService.ts` — accounts `22222222`, `11111111`, `cm3mogvfz004ebogk8rqdbgpi`
