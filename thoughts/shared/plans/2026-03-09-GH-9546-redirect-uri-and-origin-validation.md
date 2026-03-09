---
github_issue_url: https://github.com/apideck-io/unify/issues/9546
status: draft
related_research: thoughts/shared/research/GH-9546.md
---

# GH-9546 Follow-up: redirect_uri Fallback & Origin Validation

**Related Issue**: [GH-9546](https://github.com/apideck-io/unify/issues/9546)

---

## Pattern Decisions

- **Hook pattern:** All changes inside existing `useConnectionActions` hook (based on: `src/utils/connectionActions.ts`)
- **Import style:** Add `REDIRECT_URL` to existing import from `'../constants/urls'` — currently no import from that module exists in this file, but `BASE_URL` is used via `connectionsUrl` from `useConnections`
- **Test pattern:** Extend existing `test/connectionActions.test.ts` with new `describe` blocks; use existing `dispatchOAuthComplete` helper with origin support (based on: `test/connectionActions.test.ts`)
- **No new files:** Both gaps are fixed in `connectionActions.ts`; tests in `connectionActions.test.ts`

---

## Overview

Two remaining gaps from GH-9546 security work need fixing in `src/utils/connectionActions.ts`:

1. **`redirect_uri` fallback (Breaking):** The authorize POST body omits `redirect_uri` when `session.redirect_uri` is unset, causing HTTP 400 from unify which requires `redirect_uri` with `minLength: 1`.
2. **`event.origin` validation (Security):** The `messageHandler` accepts postMessages from any origin, bypassing CSRF protections.

## Current State Analysis

- `connectionActions.ts:198-201`: `redirect_uri` is conditionally added only when `session?.redirect_uri` is truthy
- `connectionActions.ts:257`: `messageHandler` has no `event.origin` check
- `REDIRECT_URL = 'https://vault.apideck.com/oauth/callback'` exists in `src/constants/urls.ts` but is not imported in `connectionActions.ts`
- Existing test at `connectionActions.test.ts:494-519` asserts `redirect_uri` is NOT sent when session has none — this test must be updated

## Desired End State

- `redirect_uri` is **always** present in the authorize POST body, using `session?.redirect_uri ?? REDIRECT_URL` as fallback
- `messageHandler` rejects messages where `event.origin` does not match the trusted origin derived from the redirect URI
- All existing tests still pass; new tests cover both fixes
- Verify: `tsdx test connectionActions` passes with new and updated tests

### Key Discoveries:

- `REDIRECT_URL` constant already exists at `src/constants/urls.ts:1`
- `connectionActions.ts` does NOT currently import from `../constants/urls` — need a new import line
- jsdom `MessageEvent` origin defaults to `''` — existing tests dispatching messages without origin will fail after the origin check is added, requiring the helper and existing tests to be updated
- The `dispatchOAuthComplete` helper at `test/connectionActions.test.ts:109-125` needs an `origin` parameter

## What We're NOT Doing

- No changes to unify, vault, iframe-vault, or any other repo
- No changes to the `/confirm` flow
- No changes to `oauthCsrf.ts` or `OAuthCsrf.ts` types
- No npm publish / version bump

## Implementation Approach

Follow TDD red-green-refactor. Write failing tests first for both gaps, then implement fixes, then verify.

## Phase 1: Write Failing Tests (TDD - RED)

### Overview

Add tests that assert the correct behavior for both gaps. These tests will fail against the current implementation, proving the gaps exist.

### Session Startup Protocol
1. Verify working directory: `pwd`
2. Read progress JSON: `thoughts/shared/progress/2026-03-09-GH-9546-redirect-uri-and-origin-validation-status.json`
3. Confirm current phase matches JSON `current_phase`

### Changes Required:

#### 1. Update `dispatchOAuthComplete` helper to support origin

**File**: `test/connectionActions.test.ts` (lines 109-125)
**Change**: Add optional `origin` parameter to `dispatchOAuthComplete` helper

**Key Implementation Notes**:
- Default origin should be `'https://vault.apideck.com'` (the origin of `REDIRECT_URL`)
- The `MessageEvent` constructor accepts `origin` in its init object
- All existing calls to `dispatchOAuthComplete` should continue working without changes (default origin covers them)

**Code Sketch**:
```ts
const dispatchOAuthComplete = (
  nonce: string,
  confirmToken = 'confirm-token-123',
  serviceId = 'test-service',
  origin = 'https://vault.apideck.com'
) => {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin,
      data: {
        type: 'oauth_complete',
        nonce,
        confirmToken,
        serviceId,
        success: true,
      },
    })
  );
};
```

#### 2. Update existing test: "does not include redirect_uri when session has none"

**File**: `test/connectionActions.test.ts` (lines 494-519)
**Change**: Rename to "sends default REDIRECT_URL as redirect_uri when session has none" and update the assertion to expect `redirect_uri: 'https://vault.apideck.com/oauth/callback'`

**Key Implementation Notes**:
- This test currently asserts `redirect_uri` is absent — after the fix it must always be present
- The expected body becomes `{ nonce: 'test-nonce-uuid', redirect_uri: 'https://vault.apideck.com/oauth/callback' }`

#### 3. Add new test: messages from untrusted origins are ignored

**File**: `test/connectionActions.test.ts` (new `describe` block after existing `redirect_uri handling`)
**Change**: Add `describe('security - event.origin validation', ...)` with test cases

**Test cases to add**:

- `'ignores postMessage from untrusted origin'`: Dispatch `oauth_complete` with `origin: 'https://evil.example.com'`, assert `/confirm` is NOT called
- `'processes postMessage from default vault origin'`: Dispatch with `origin: 'https://vault.apideck.com'` (default redirect URL origin), assert `/confirm` IS called
- `'processes postMessage from custom session redirect_uri origin'`: Set `mockSession = { redirect_uri: 'https://custom.example.com/callback' }`, dispatch with `origin: 'https://custom.example.com'`, assert `/confirm` IS called

**Key Implementation Notes**:
- Follow existing test patterns: `fetchSpy.mockImplementation`, `act(async () => { ... })`, assertions on `fetchSpy` calls
- The "processes from default vault origin" test validates the happy path still works with the origin check
- The "custom origin" test validates the origin is derived from `session.redirect_uri`

#### 4. Update existing happy path test assertion

**File**: `test/connectionActions.test.ts` (line 183)
**Change**: The happy path test at line 162 asserts `body: JSON.stringify({ nonce: 'test-nonce-uuid' })` — after the fix, `redirect_uri` will always be present. Update to `body: JSON.stringify({ nonce: 'test-nonce-uuid', redirect_uri: 'https://vault.apideck.com/oauth/callback' })`

### Success Criteria:

#### Automated Verification:
- New tests FAIL: `tsdx test connectionActions --no-watch` — expected failures prove the gaps exist
- Specifically: tests asserting `redirect_uri` is always present will fail; tests asserting origin rejection will fail

### Session Completion
1. All changes committed: `git commit -m "Phase 1: Add failing tests for redirect_uri fallback and origin validation (TDD RED)"`
2. Update progress JSON: set phase 1 to "complete", increment current_phase
3. Verify clean state: `git status` shows clean working tree

---

## Phase 2: Implement Both Fixes (TDD - GREEN)

### Overview

Make all failing tests pass by implementing the `redirect_uri` fallback and `event.origin` validation.

### Session Startup Protocol
1. Verify working directory: `pwd`
2. Check previous phase committed: `git log -1 --oneline`
3. Read progress JSON: `thoughts/shared/progress/2026-03-09-GH-9546-redirect-uri-and-origin-validation-status.json`
4. Confirm current phase matches JSON `current_phase`

### Changes Required:

#### 1. Add `REDIRECT_URL` import

**File**: `src/utils/connectionActions.ts` (top of file, after existing imports)
**Change**: Add import for `REDIRECT_URL` from `'../constants/urls'`

**Code Sketch**:
```ts
import { REDIRECT_URL } from '../constants/urls';
```

#### 2. Fix `redirect_uri` fallback

**File**: `src/utils/connectionActions.ts` (lines 198-201)
**Change**: Replace conditional `redirect_uri` with always-present fallback

**Code Sketch**:
```ts
const authorizeBody: Record<string, string> = {
  nonce,
  redirect_uri: session?.redirect_uri ?? REDIRECT_URL,
};
```

#### 3. Add `event.origin` validation

**File**: `src/utils/connectionActions.ts` (around line 257, before `messageHandler` definition)
**Change**: Derive `trustedOrigin` and add origin check as first line of handler

**Key Implementation Notes**:
- Derive `trustedOrigin` as a `const` immediately before the `messageHandler` function definition
- Use `new URL(session?.redirect_uri ?? REDIRECT_URL).origin` — same source of truth as `redirect_uri`
- Early return when `event.origin !== trustedOrigin`

**Code Sketch**:
```ts
const trustedOrigin = new URL(session?.redirect_uri ?? REDIRECT_URL).origin;

const messageHandler = async (event: MessageEvent) => {
  if (event.origin !== trustedOrigin) return;
  const { data } = event;
  // ... rest unchanged
```

### Success Criteria:

#### Automated Verification:
- All tests pass: `tsdx test connectionActions --no-watch`
- Build succeeds: `tsdx build`

### Session Completion
1. All changes committed: `git commit -m "Phase 2: Implement redirect_uri fallback and event.origin validation (TDD GREEN)"`
2. Update progress JSON: set phase 2 to "complete", increment current_phase
3. Verify clean state: `git status` shows clean working tree

---

## Phase 3: Verify Full Suite & Refactor (TDD - REFACTOR)

### Overview

Run the full test suite and lint to confirm no regressions. Refactor if needed while keeping tests green.

### Session Startup Protocol
1. Verify working directory: `pwd`
2. Check previous phase committed: `git log -1 --oneline`
3. Read progress JSON: `thoughts/shared/progress/2026-03-09-GH-9546-redirect-uri-and-origin-validation-status.json`
4. Confirm current phase matches JSON `current_phase`

### Changes Required:

No code changes expected. This phase is verification only.

### Success Criteria:

#### Automated Verification:
- Full test suite passes: `tsdx test --no-watch`
- Build succeeds: `tsdx build`
- Lint passes: `tsdx lint`

#### Manual Verification:
- Authorize flow works in example app (if applicable)
- No regressions in existing OAuth flow

### Session Completion
1. Update progress JSON: set phase 3 to "complete"
2. All phases complete

---

## Testing Strategy

**IMPORTANT: Follow Test-Driven Development (TDD) for all code**

### TDD Approach:

1. Phase 1: Write failing tests → run → confirm they fail (RED)
2. Phase 2: Implement fixes → run → confirm all pass (GREEN)
3. Phase 3: Full suite verification and optional refactor (REFACTOR)

### Unit Tests:

Tests to write/update in `test/connectionActions.test.ts`:

| Test | Type | Phase |
|------|------|-------|
| Update `dispatchOAuthComplete` helper with `origin` param | Helper update | 1 |
| Update happy path assertion to include `redirect_uri` | Update existing | 1 |
| "sends default REDIRECT_URL when session has none" | Update existing | 1 |
| "ignores postMessage from untrusted origin" | New | 1 |
| "processes postMessage from default vault origin" | New | 1 |
| "processes postMessage from custom session redirect_uri origin" | New | 1 |

### Existing tests to verify still pass:
- Happy path authorize → popup → postMessage → confirm
- Nonce mismatch rejection
- Popup blocked
- Authorize API failure
- Confirm API failure
- Client credentials / password grant types

## References

- Research: `thoughts/shared/research/GH-9546.md`
- Source: `src/utils/connectionActions.ts`
- Tests: `test/connectionActions.test.ts`
- Constants: `src/constants/urls.ts`
