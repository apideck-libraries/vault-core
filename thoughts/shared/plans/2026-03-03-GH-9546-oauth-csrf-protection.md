---
github_issue_url: https://github.com/apideck-io/unify/issues/9546
status: draft
related_research: thoughts/shared/research/GH-9546.md
---

# OAuth CSRF Vulnerability Fix — Implementation Plan

**Related Issue**: [GH-9546](https://github.com/apideck-io/unify/issues/9546)

---

## Pattern Decisions

- **Utility pattern:** Pure functions for nonce management (based on: existing utilities in `src/utils/`)
- **Hook pattern:** Extend `useConnectionActions` with new `handleAuthorize` function (based on: `src/utils/connectionActions.ts`)
- **Component refactoring:** AuthorizeButton delegates to `handleAuthorize` from `useConnectionActions` (eliminates duplicated popup code)
- **Types:** New `OAuthCsrf.ts` type file (based on: existing type files in `src/types/`)
- **Test pattern:** `@testing-library/react` + `jest.spyOn(window, 'fetch')` + component-wrapping pattern for hook tests (based on: `test/authorize-button.test.tsx`). `@testing-library/react-hooks` is NOT installed — do not use `renderHook`.
- **Security:** Nonce verification is the sole trust anchor for postMessage — NO origin validation
- **Utilities identified:** `connectionActions.ts` (primary change), `useSession.tsx` (consume for redirect_uri), `useConnections.tsx` (consume for headers/connectionsUrl)
- **Types to update:** New `OAuthCsrf` types; no changes to existing `Connection` or `Session` types

---

## Overview

Add CSRF protection to the OAuth popup flow in `connectionActions.ts` and consolidate duplicated popup logic from `AuthorizeButton.tsx`. Currently the popup flow has zero CSRF protection — no nonce, no postMessage listener, no confirm step. The fix introduces nonce generation, calls a new authorize endpoint, listens for postMessage from the vault callback page, verifies the nonce, and calls a confirm endpoint. AuthorizeButton is refactored to delegate to the new `handleAuthorize` function, eliminating code duplication.

## Current State Analysis

**`src/utils/connectionActions.ts:74-92`** — The OAuth popup flow in `handleRedirect`:
1. Opens `window.open(url)` with a pre-baked `authorize_url` from the connection object
2. Polls `child.closed` via `setInterval` every 500ms
3. On close: re-fetches connection via SWR `mutate`, calls `onConnectionChange`

**`src/components/AuthorizeButton.tsx:91-103`** — Identical popup flow duplicated in the component:
1. Opens `window.open(authorizeUrl)` with same window features
2. Polls `child.closed` via `setInterval` every 500ms
3. On close: re-fetches via SWR `mutate`, calls `onConnectionChange`

**No CSRF protection exists.** No nonce, no sessionStorage usage, no postMessage listener, no confirm token anywhere in the codebase.

**Callers** construct the authorize URL from `connection.authorize_url` + `redirect_uri`:
- `TopBar.tsx:71-73,239` — Re-authorize action
- `ButtonLayoutMenu.tsx:97-100,281-284` — Authorize / re-authorize actions
- `AuthorizeButton.tsx:34-36` — Authorize button click

**Revoke flow** also uses `handleRedirect` with `revoke_url` — this is unaffected by the CSRF changes.

### Key Discoveries:

- `connectionActions.ts` already imports `useConnections` which provides `headers` and `connectionsUrl` — same auth headers needed for new endpoints
- `useSession` provides `session.redirect_uri` — needed for optional authorize body parameter
- `connectionsUrl` = `${unifyBaseUrl}/vault/connections` — existing URL pattern is `${connectionsUrl}/${unified_api}/${service_id}/token`
- Client credentials / password grant types (lines 32-73) are a separate code path, unaffected
- `REDIRECT_URL` constant already exists in `src/constants/urls.ts` as `https://vault.apideck.com/oauth/callback`
- `REDIRECT_URL` is used in `TopBar.tsx:72,75` and `ButtonLayoutMenu.tsx:98,282,343` for BOTH authorize and revoke URLs — after refactoring, authorize callers won't construct URLs, but revoke callers still need `REDIRECT_URL`
- jsdom 16 does not implement `crypto.randomUUID()` — tests must mock it
- `@testing-library/react-hooks` is NOT installed — hook tests must use component-wrapping pattern

## Desired End State

After implementation:
1. OAuth authorization flow uses nonce-based CSRF protection
2. `handleAuthorize` function calls `POST /authorize` with nonce, opens popup with returned URL, listens for postMessage, verifies nonce, calls `POST /confirm`
3. Fallback: if popup closes without postMessage, re-fetches connections (existing behavior preserved)
4. All authorize callers (TopBar, ButtonLayoutMenu, AuthorizeButton) use the new `handleAuthorize` instead of constructing URLs manually
5. AuthorizeButton is a thin UI wrapper that delegates to `handleAuthorize` — no duplicated popup logic
6. Revoke flow via `handleRedirect` is completely unchanged
7. All existing tests continue to pass; new tests cover CSRF flow

**Verification**: Unit tests for nonce utility + handleAuthorize flow. Build succeeds. Existing tests pass.

## What We're NOT Doing

- Changes to `@apideck/vault-js` (parent SDK)
- Changes to client_credentials or password grant flows
- Origin validation on postMessage — nonce is the sole trust anchor (per research requirement)
- Changes to the `Vault` component's public API
- Origin validation for iframe-vault's existing postMessage protocol
- Changes to the revoke/disconnect flow

## Implementation Approach

1. Add types for the API contracts (authorize/confirm/postMessage)
2. Create a small utility for nonce management (pure, testable)
3. Add `handleAuthorize` to `connectionActions.ts` that orchestrates the full CSRF flow
4. Update callers (TopBar, ButtonLayoutMenu) to use `handleAuthorize` for authorize actions; revoke actions keep using `handleRedirect`
5. Refactor AuthorizeButton to delegate to `handleAuthorize` from `useConnectionActions`, eliminating duplicated popup code
6. Keep `handleRedirect` unchanged for backward compatibility (revoke flow)

---

## Phase 1: Type Updates

### Overview

Add TypeScript types for the new API contracts and postMessage payloads. No constants needed — nonce verification replaces origin validation.

### Session Startup Protocol
1. Verify working directory: `pwd`
2. Check branch: `git branch --show-current`
3. Read progress JSON: `thoughts/shared/progress/2026-03-03-GH-9546-oauth-csrf-protection-status.json`
4. Confirm current phase matches JSON `current_phase`

### Changes Required:

#### 1. New OAuth CSRF Types

**File**: `src/types/OAuthCsrf.ts` (new file)
**Change**: Add types for authorize response, confirm response, and postMessage payloads

**Key Implementation Notes**:
- Follow existing type file patterns (PascalCase interfaces, exported)
- Types mirror the API contracts from the research document

```typescript
// postMessage payload from vault callback page
export interface OAuthCompleteMessage {
  type: 'oauth_complete';
  nonce: string;
  confirmToken: string;
  serviceId: string;
  success: boolean;
}

export interface OAuthErrorMessage {
  type: 'oauth_error';
  error: string;
  errorDescription: string;
  serviceId: string;
}

export type OAuthPostMessage = OAuthCompleteMessage | OAuthErrorMessage;

// POST /authorize response
export interface AuthorizeResponse {
  status_code: number;
  status: string;
  data: {
    authorize_url: string;
  };
}

// POST /confirm response
export interface ConfirmResponse {
  status_code: number;
  status: string;
  data: {
    confirmed: boolean;
  };
}
```

### Success Criteria:

#### Automated Verification:
- Build succeeds: `tsdx build`
- Linting passes: `tsdx lint`

#### Manual Verification:
- Types are importable from other files without errors

### Session Completion
1. All changes committed: `git add src/types/OAuthCsrf.ts && git commit -m "Phase 1: Add OAuth CSRF types"`
2. Update progress JSON: set phase 1 to "complete", increment current_phase
3. Verify clean state: `git status` shows clean working tree

---

## Phase 2: Write Tests for OAuth CSRF Utility (TDD - RED)

### Overview

Write failing tests for the nonce management utility functions.

### Session Startup Protocol
1. Verify working directory: `pwd`
2. Check previous phase committed: `git log -1 --oneline`
3. Read progress JSON: `thoughts/shared/progress/2026-03-03-GH-9546-oauth-csrf-protection-status.json`
4. Confirm current phase matches JSON `current_phase`

### Changes Required:

#### 1. OAuth CSRF Utility Tests

**File**: `test/oauthCsrf.test.ts` (new file)
**Change**: Write tests for nonce utility functions

**Key Implementation Notes**:
- Add `import 'whatwg-fetch'` at top (following existing test convention from `test/authorize-button.test.tsx:3`)
- Mock `crypto.randomUUID` since jsdom 16 does not implement it: `Object.defineProperty(globalThis, 'crypto', { value: { randomUUID: jest.fn(() => 'test-uuid-1234') } })` or similar approach
- Rely on jsdom's built-in `sessionStorage` for storage tests
- Expected outcome: **All tests FAIL** (module doesn't exist yet)

**Test Cases**:

1. **`generateAndStoreNonce(serviceId)`**:
   - Returns a string (UUID format)
   - Stores the nonce in `sessionStorage` with key `vault_oauth_nonce_{serviceId}`
   - Calling twice with same serviceId overwrites previous nonce

2. **`verifyAndClearNonce(serviceId, receivedNonce)`**:
   - Returns `true` when receivedNonce matches stored nonce
   - Returns `false` when receivedNonce doesn't match
   - Returns `false` when no nonce is stored for that serviceId
   - Clears the nonce from sessionStorage after successful verification
   - Does NOT clear the nonce after failed verification

3. **`clearNonce(serviceId)`**:
   - Removes the nonce from sessionStorage
   - No-ops if no nonce stored

### Success Criteria:

#### Automated Verification:
- Tests exist and fail with import/module-not-found errors: `tsdx test oauthCsrf --no-watch`

### Session Completion
1. All changes committed: `git add test/oauthCsrf.test.ts && git commit -m "Phase 2: Add failing tests for OAuth CSRF utility (TDD RED)"`
2. Update progress JSON: set phase 2 to "complete", increment current_phase
3. Verify clean state: `git status` shows clean working tree

---

## Phase 3: Implement OAuth CSRF Utility (TDD - GREEN)

### Overview

Implement the nonce management utility to make Phase 2 tests pass.

### Session Startup Protocol
1. Verify working directory: `pwd`
2. Check previous phase committed: `git log -1 --oneline`
3. Read progress JSON: `thoughts/shared/progress/2026-03-03-GH-9546-oauth-csrf-protection-status.json`
4. Confirm current phase matches JSON `current_phase`

### Changes Required:

#### 1. OAuth CSRF Utility

**File**: `src/utils/oauthCsrf.ts` (new file)
**Change**: Implement nonce management functions

**Key Implementation Notes**:
- `generateAndStoreNonce(serviceId)`: Use `crypto.randomUUID()`, store in `sessionStorage` with key `vault_oauth_nonce_{serviceId}`, return the nonce
- `verifyAndClearNonce(serviceId, receivedNonce)`: Compare received nonce against stored value, clear on success only, return boolean
- `clearNonce(serviceId)`: Remove from sessionStorage
- All functions are pure/stateless (aside from sessionStorage side effects) — no React dependencies
- sessionStorage key pattern: `vault_oauth_nonce_{serviceId}` — scoped per service to support multiple concurrent auth flows
- No origin validation functions — nonce is the sole trust anchor

### Success Criteria:

#### Automated Verification:
- All Phase 2 tests pass: `tsdx test oauthCsrf --no-watch`
- Build succeeds: `tsdx build`
- Linting passes: `tsdx lint`

### Session Completion
1. All changes committed: `git add src/utils/oauthCsrf.ts && git commit -m "Phase 3: Implement OAuth CSRF utility (TDD GREEN)"`
2. Update progress JSON: set phase 3 to "complete", increment current_phase
3. Verify clean state: `git status` shows clean working tree

---

## Phase 4: Write Tests for handleAuthorize (TDD - RED)

### Overview

Write failing tests for the new `handleAuthorize` function in `connectionActions.ts`.

### Session Startup Protocol
1. Verify working directory: `pwd`
2. Check previous phase committed: `git log -1 --oneline`
3. Read progress JSON: `thoughts/shared/progress/2026-03-03-GH-9546-oauth-csrf-protection-status.json`
4. Confirm current phase matches JSON `current_phase`

### Changes Required:

#### 1. connectionActions Tests

**File**: `test/connectionActions.test.ts` (new file)
**Change**: Write tests for `handleAuthorize` CSRF flow

**Key Implementation Notes**:
- Add `import 'whatwg-fetch'` at top (following existing convention)
- Mock `crypto.randomUUID` to return a known nonce value
- `useConnectionActions` is a hook — DO NOT use `renderHook` from `@testing-library/react-hooks` (not installed). Instead, use the **component-wrapping test approach**: create a test component that calls the hook and exposes its return values (existing pattern in the repo)
- Must provide `ConnectionsProvider` and `SessionProvider` context wrappers (study existing test patterns in `test/authorize-button.test.tsx` for wrapper setup — uses the full `Vault` component)
- Mock `window.fetch` with `jest.spyOn` for authorize/confirm endpoint calls
- Mock `window.open` for popup creation
- Mock `window.addEventListener` to capture postMessage handler
- Use `act()` from `react-dom/test-utils` for state updates

**Test Cases**:

1. **Happy path — full CSRF flow**:
   - Calls POST `/{unifiedApi}/{serviceId}/authorize` with nonce in body and correct auth headers
   - Opens popup with the authorize_url from the response
   - When postMessage `oauth_complete` received with matching nonce: calls POST `/{unifiedApi}/{serviceId}/confirm` with confirm_token
   - After confirm: calls SWR `mutate` to re-fetch connection data

2. **Fallback — popup closed without postMessage**:
   - Opens popup, no postMessage received
   - When `child.closed` detected: re-fetches via SWR mutate (existing behavior)
   - Cleans up postMessage listener and interval

3. **Security — wrong nonce in postMessage**:
   - postMessage received with non-matching nonce
   - Does NOT call confirm endpoint
   - Shows error toast

4. **Error — authorize endpoint fails**:
   - Fetch returns error response
   - Shows error toast
   - Does not open popup

5. **Error — confirm endpoint fails**:
   - Authorize succeeds, postMessage received, but confirm fetch fails
   - Shows error toast
   - Still re-fetches connection data

6. **Client credentials / password unchanged**:
   - When `oauth_grant_type` is `client_credentials` or `password`, `handleAuthorize` uses the existing token flow (same as current `handleRedirect`)

7. **Include redirect_uri when session has custom one**:
   - When `session.redirect_uri` is set, include it in the authorize POST body
   - When not set, only send nonce in body

- Expected outcome: **All tests FAIL** (handleAuthorize doesn't exist yet)

### Success Criteria:

#### Automated Verification:
- Tests exist and fail: `tsdx test connectionActions --no-watch`

### Session Completion
1. All changes committed: `git add test/connectionActions.test.ts && git commit -m "Phase 4: Add failing tests for handleAuthorize (TDD RED)"`
2. Update progress JSON: set phase 4 to "complete", increment current_phase
3. Verify clean state: `git status` shows clean working tree

---

## Phase 5: Implement handleAuthorize + Update Callers (TDD - GREEN)

### Overview

Add `handleAuthorize` to `connectionActions.ts` and update TopBar/ButtonLayoutMenu callers to use it for authorize actions.

### Session Startup Protocol
1. Verify working directory: `pwd`
2. Check previous phase committed: `git log -1 --oneline`
3. Read progress JSON: `thoughts/shared/progress/2026-03-03-GH-9546-oauth-csrf-protection-status.json`
4. Confirm current phase matches JSON `current_phase`

### Changes Required:

#### 1. Add handleAuthorize to connectionActions

**File**: `src/utils/connectionActions.ts`
**Change**: Add new `handleAuthorize` function, add `useSession` import, export `handleAuthorize` from return object

**Key Implementation Notes**:

- Import `useSession` to access `session.redirect_uri`
- Import `generateAndStoreNonce`, `verifyAndClearNonce`, `clearNonce` from `./oauthCsrf`
- Import `OAuthCompleteMessage`, `OAuthErrorMessage`, `AuthorizeResponse` from types

- **Function signature**: `handleAuthorize(onConnectionChange?: (connection: Connection) => any)`
  - No URL parameter — URL comes from authorize endpoint response

- **Flow**:
  1. Set `isReAuthorizing(true)`
  2. If `client_credentials` or `password` grant type → delegate to existing token POST flow (same as current `handleRedirect` lines 32-73). This preserves existing behavior for non-OAuth-code flows.
  3. Generate nonce via `generateAndStoreNonce(selectedConnection.service_id)`
  4. POST to `${connectionsUrl}/${selectedConnection.unified_api}/${selectedConnection.service_id}/authorize` with body `{ nonce }` (add `redirect_uri: session.redirect_uri` if set). Use existing `headers` from `useConnections`. Add `'Content-Type': 'application/json'` header.
  5. On error response → `addToast` error, `clearNonce`, `setIsReAuthorizing(false)`, return
  6. Extract `authorize_url` from response
  7. `window.open(authorize_url, '_blank', windowFeatures)` — if popup blocked (`child` is null), toast error and return
  8. Set up `window.addEventListener('message', handler)` and `setInterval(checkChild, 500)` for fallback
  9. **postMessage handler**: NO origin validation — nonce is the sole trust anchor. Check `event.data.type === 'oauth_complete'` and `event.data.serviceId === selectedConnection.service_id`. Verify nonce via `verifyAndClearNonce`. If nonce mismatch → toast error, return. Call confirm endpoint. Re-fetch via SWR mutate. Cleanup.
  10. **Error message handler**: Check `event.data.type === 'oauth_error'`. Toast error with `event.data.errorDescription`. Cleanup.
  11. **Fallback (child.closed)**: If no postMessage was received, re-fetch via SWR mutate (existing behavior). Cleanup.
  12. **Cleanup function**: `clearInterval(timer)`, `window.removeEventListener('message', handler)`, `clearNonce(serviceId)`, `setIsReAuthorizing(false)`

- **Confirm endpoint**: POST to `${connectionsUrl}/${selectedConnection.unified_api}/${selectedConnection.service_id}/confirm` with body `{ confirm_token: confirmToken }`, same `headers` plus `'Content-Type': 'application/json'`

- Add `handleAuthorize` to the returned object alongside existing `handleRedirect`

- **Keep `handleRedirect` unchanged** — it's still used for revoke flows

#### 2. Update TopBar Callers

**File**: `src/components/TopBar.tsx`
**Change**: Use `handleAuthorize` for re-authorize action; keep `handleRedirect` for revoke

- Line 51 area: Also destructure `handleAuthorize` from `useConnectionActions()`
- Line 239: Change `handleRedirect(authorizeUrl, onConnectionChange)` → `handleAuthorize(onConnectionChange)`
- Lines 71-73: Remove `authorizeUrl` construction (dead code after this change). Keep `authorize_url` in destructuring only if used elsewhere; otherwise remove it too.
- Line 74-75: Keep `revokeUrl` construction — revoke flow unchanged
- Line 322: `handleRedirect(revokeUrl, onConnectionChange)` — **unchanged** (revoke flow)
- **PRESERVE `REDIRECT_URL` import** — still used for `revokeUrl` on line 74-75

#### 3. Update ButtonLayoutMenu Callers

**File**: `src/components/ButtonLayoutMenu.tsx`
**Change**: Use `handleAuthorize` for authorize/re-authorize actions; keep `handleRedirect` for revoke

- Line 49 area: Also destructure `handleAuthorize` from `useConnectionActions()`
- Lines 96-100: Change authorize onClick — remove `authorizeUrl` construction (lines 97-99), replace `handleRedirect(authorizeUrl, onConnectionChange)` → `handleAuthorize(onConnectionChange)` on line 100
- Lines 280-284: Change re-authorize onClick — remove `authorizeUrl` construction (lines 281-283), replace `handleRedirect(authorizeUrl, onConnectionChange)` → `handleAuthorize(onConnectionChange)` on line 284
- Lines 341-345: `handleRedirect(revokeUrl, onConnectionChange)` — **unchanged** (revoke flow)
- **PRESERVE `REDIRECT_URL` import** — still used for `revokeUrl` on line 342-343

### Success Criteria:

#### Automated Verification:
- All Phase 4 tests pass: `tsdx test connectionActions --no-watch`
- All existing tests still pass: `tsdx test --no-watch`
- Build succeeds: `tsdx build`
- Linting passes: `tsdx lint`

#### Manual Verification:
- Re-authorize action in TopBar dropdown triggers new CSRF flow (network tab shows POST /authorize then POST /confirm)
- Revoke/disconnect still works via old popup flow
- Client credentials / password flows unaffected

### Session Completion
1. All changes committed: `git add src/utils/connectionActions.ts src/components/TopBar.tsx src/components/ButtonLayoutMenu.tsx && git commit -m "Phase 5: Implement handleAuthorize with CSRF protection and update callers (TDD GREEN)"`
2. Update progress JSON: set phase 5 to "complete", increment current_phase
3. Verify clean state: `git status` shows clean working tree

---

## Phase 6: Refactor AuthorizeButton to use handleAuthorize

### Overview

Refactor `AuthorizeButton.tsx` to delegate all authorization logic to `handleAuthorize` from `useConnectionActions`, eliminating duplicated popup code. AuthorizeButton becomes a thin UI wrapper — it renders the button variants (standard, Google Drive, QuickBooks) and delegates click handling to the hook.

### Session Startup Protocol
1. Verify working directory: `pwd`
2. Check previous phase committed: `git log -1 --oneline`
3. Read progress JSON: `thoughts/shared/progress/2026-03-03-GH-9546-oauth-csrf-protection-status.json`
4. Confirm current phase matches JSON `current_phase`

### Changes Required:

#### 1. Refactor AuthorizeButton Component

**File**: `src/components/AuthorizeButton.tsx`
**Change**: Replace internal popup logic and client_credentials/password logic with delegation to `handleAuthorize` from `useConnectionActions`

**Key Implementation Notes**:

**What to REMOVE from AuthorizeButton**:
- The `authorizeUrl` construction (line 34-36)
- The `handleChildWindowClose` function (lines 38-45)
- The entire `authorizeConnection` body that handles client_credentials/password (lines 49-90) and popup open/poll (lines 91-103)
- The `REDIRECT_URL` import (line 6) — no longer constructs authorize URLs
- The `useSWRConfig` import and `mutate` usage (line 5, 28) — delegated to hook
- The `connectionsUrl` and `headers` from `useConnections` (line 23) — delegated to hook

**What to ADD**:
- Import `useConnectionActions` from `../utils/connectionActions`
- Destructure `handleAuthorize`, `isReAuthorizing` from `useConnectionActions()`

**What to KEEP**:
- `connection` prop — still needed for `integration_state` check, `service_id` (branded buttons)
- `onConnectionChange` prop — passed to `handleAuthorize`
- `autoStartAuthorization` prop — triggers `handleAuthorize` on mount
- `useSession` — needed for `session.theme` (button styling)
- `useTranslation` — for button text
- `useToast` — only if error handling stays in component (e.g., for popup-blocked)
- Google Drive and QuickBooks branded button rendering (lines 113-145)
- Standard button rendering (lines 147-159)

**Revised `authorizeConnection`**:
```typescript
const authorizeConnection = () => {
  handleAuthorize(onConnectionChange);
};
```

**`isLoading` replacement**:
- Replace local `const [isLoading, setIsLoading] = useState(false)` with `isReAuthorizing` from `useConnectionActions()`
- Update `isAuthorizationEnabled` to use `!isReAuthorizing` instead of `!isLoading`
- Update button `isLoading={isReAuthorizing}` and `className` conditionals

**`autoStartAuthorization` effect**:
- Keep the `useEffect` but call `handleAuthorize(onConnectionChange)` instead of `authorizeConnection()`
- Or keep calling `authorizeConnection()` which now delegates to `handleAuthorize`

#### 2. Verify Existing Tests Pass

The existing tests in `test/authorize-button.test.tsx` test button **visibility** (based on auth_type/oauth_grant_type), not authorization flow. These should pass without changes after the refactoring since the button rendering logic is preserved.

**If existing tests need fetch mock updates**: The refactored AuthorizeButton no longer calls fetch directly (delegated to hook), so mock setup may need adjustment if tests trigger click events. However, the existing tests only test visibility, not clicks, so they should be unaffected.

### Success Criteria:

#### Automated Verification:
- All existing tests pass: `tsdx test --no-watch` (especially `authorize-button.test.tsx`)
- Build succeeds: `tsdx build`
- Linting passes: `tsdx lint`

#### Manual Verification:
- AuthorizeButton click triggers CSRF flow (POST /authorize → postMessage → POST /confirm)
- `autoStartAuthorization` triggers CSRF flow on mount
- Google Drive / QuickBooks branded buttons still render correctly
- Client credentials / password flows still work (delegated to hook)

### Session Completion
1. All changes committed: `git add src/components/AuthorizeButton.tsx && git commit -m "Phase 6: Refactor AuthorizeButton to use handleAuthorize from useConnectionActions"`
2. Update progress JSON: set phase 6 to "complete", increment current_phase
3. Verify clean state: `git status` shows clean working tree

---

## Phase 7: Verify All Tests Pass (TDD - GREEN verification)

### Overview

Run the full test suite and build to verify everything works together after all changes.

### Session Startup Protocol
1. Verify working directory: `pwd`
2. Check previous phase committed: `git log -1 --oneline`
3. Read progress JSON: `thoughts/shared/progress/2026-03-03-GH-9546-oauth-csrf-protection-status.json`
4. Confirm current phase matches JSON `current_phase`

### Changes Required:

No code changes expected. Run verification commands:

1. `tsdx test --no-watch` — all tests pass
2. `tsdx build` — build succeeds
3. `tsdx lint` — no lint errors

If any failures: fix them in this phase and re-run.

### Success Criteria:

#### Automated Verification:
- All tests pass: `tsdx test --no-watch`
- Build succeeds: `tsdx build`
- Linting passes: `tsdx lint`

### Session Completion
1. If fixes were needed, commit them: `git commit -m "Phase 7: Fix issues found during verification"`
2. Update progress JSON: set phase 7 to "complete", increment current_phase
3. Verify clean state: `git status` shows clean working tree

---

## Phase 8: Refactor (TDD - REFACTOR)

### Overview

Review all changes for cleanup opportunities while keeping tests green.

### Session Startup Protocol
1. Verify working directory: `pwd`
2. Check previous phase committed: `git log -1 --oneline`
3. Read progress JSON: `thoughts/shared/progress/2026-03-03-GH-9546-oauth-csrf-protection-status.json`
4. Confirm current phase matches JSON `current_phase`

### Changes Required:

Review and address:

1. **Dead code in TopBar/ButtonLayoutMenu**: If `authorizeUrl` construction is no longer used by any code path, remove it. **CRITICAL: PRESERVE `REDIRECT_URL` import in both files** — it is still used for revoke URL construction (`TopBar.tsx:74-75`, `ButtonLayoutMenu.tsx:342-343`).
2. **Dead `authorize_url` destructuring**: In TopBar, `authorize_url` was destructured from `selectedConnection` (line 67). If no longer used after removing `authorizeUrl` construction, remove it from the destructuring.
3. **Consistent error handling**: Ensure all error toasts follow existing patterns (using `t()` for translations)
4. **Cleanup ordering**: Verify cleanup runs in all code paths (success, error, popup blocked, popup closed)
5. **Type safety**: Ensure no `any` types leaked into new code

### Success Criteria:

#### Automated Verification:
- All tests still pass: `tsdx test --no-watch`
- Build succeeds: `tsdx build`
- Linting passes: `tsdx lint`

### Session Completion
1. If changes were made, commit: `git commit -m "Phase 8: Refactor and cleanup"`
2. Update progress JSON: set phase 8 to "complete", increment current_phase
3. Verify clean state: `git status` shows clean working tree

---

## Testing Strategy

**IMPORTANT: Follow Test-Driven Development (TDD) for all code**

### TDD Approach:

1. **Phase 1**: Types only — no tests needed
2. **Phase 2 → 3**: Write tests for oauthCsrf utility → implement utility
3. **Phase 4 → 5**: Write tests for handleAuthorize → implement handleAuthorize + callers
4. **Phase 6**: Refactor AuthorizeButton — existing tests validate (no new RED phase needed, this is a refactoring)
5. **Phase 7**: Full verification
6. **Phase 8**: Refactor while tests stay green

### Test Infrastructure Notes:

- **`@testing-library/react-hooks` is NOT installed** — do not use `renderHook`. Use component-wrapping test approach instead.
- **`crypto.randomUUID` mock required** — jsdom 16 does not implement it. Mock in test setup.
- **`import 'whatwg-fetch'`** — add to all new test files (following existing convention).

### Unit Tests:

- `test/oauthCsrf.test.ts`: Nonce generation/verification/clearing
- `test/connectionActions.test.ts`: Full CSRF flow (happy path, fallback, security, errors)

### Component Tests:

- Existing tests in `test/` must continue passing (especially `authorize-button.test.tsx`)
- AuthorizeButton refactoring validated by existing visibility tests

### Manual Testing Steps:

1. In Storybook or example app: trigger authorize for an OAuth connection
2. Verify network tab shows POST /authorize followed by POST /confirm
3. Verify popup opens with the URL from the authorize response
4. Trigger re-authorize from TopBar dropdown — same CSRF flow
5. Verify disconnect/revoke still works unchanged via old popup flow
6. Verify client_credentials connections still work unchanged
7. Verify `autoStartAuthorization` triggers CSRF flow on mount

## Performance Considerations

- `crypto.randomUUID()` is synchronous and fast — no performance concern
- `sessionStorage` operations are synchronous and fast
- postMessage listener is lightweight, cleaned up after each flow
- No additional polling introduced — existing 500ms interval is reused for fallback

## Migration Notes

- No breaking changes to the public API
- `handleRedirect` is preserved and still works for revoke flows
- Callers that currently construct `authorizeUrl` from `connection.authorize_url` will no longer do so — the URL comes from the new endpoint
- AuthorizeButton's internal refactoring is invisible to consumers — same props, same behavior

## References

- Related research: `thoughts/shared/research/GH-9546.md`
- Existing popup pattern (connectionActions): `src/utils/connectionActions.ts:74-92`
- Existing popup pattern (AuthorizeButton): `src/components/AuthorizeButton.tsx:91-103`
- Auth headers: `src/utils/useConnections.tsx:90-98`
- Session context: `src/utils/useSession.tsx`
- AuthorizeButton callers: `src/components/ConnectionDetails.tsx:471-478`, `src/components/ButtonLayoutMenu.tsx:104-108`
- REDIRECT_URL usage (revoke): `src/components/TopBar.tsx:74-75`, `src/components/ButtonLayoutMenu.tsx:342-343`
- API contracts: See research document "Cross-Repo Context" section
