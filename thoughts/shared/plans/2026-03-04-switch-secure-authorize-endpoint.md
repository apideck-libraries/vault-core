---
status: draft
related_research: thoughts/shared/research/quickbooks-authorized-not-callable.md
---

# Switch to Secure Authorize Endpoint — Implementation Plan

---

## Pattern Decisions

- **URL change only:** Single string replacement in fetch call (based on: `src/utils/connectionActions.ts:205`)
- **Test update:** Update `AUTHORIZE_URL` constant in test file (based on: `test/connectionActions.test.ts:66`)
- **No new code:** All CSRF/confirm machinery already implemented in phases 1-6 of GH-9546

---

## Overview

vault-core currently calls unify's legacy `/authorize` endpoint which silently drops the `nonce` parameter. This means the confirm flow (already fully implemented) never activates, and connections stay `authorized` instead of becoming `callable`. The fix is a one-line URL change from `/authorize` to `/secure-authorize`, plus updating the test constant to match.

## Current State Analysis

- `handleAuthorize` in `connectionActions.ts` generates a nonce, sends it to `/authorize`, opens a popup, listens for `oauth_complete` postMessage, verifies the nonce, and calls `/confirm`
- The legacy `/authorize` endpoint ignores the nonce, so unify's callback takes the legacy path — no `confirm_token` is returned, and the confirm flow never triggers
- All CSRF machinery (`oauthCsrf.ts`, nonce generation/verification, confirm endpoint call) is implemented and tested
- Tests in `connectionActions.test.ts` assert against an `AUTHORIZE_URL` constant pointing to `/authorize`

### Key Discoveries:

- `connectionActions.ts:205` — the fetch URL uses `/authorize` path segment
- `test/connectionActions.test.ts:66` — `AUTHORIZE_URL` constant uses `/authorize`
- Same request/response shape between `/authorize` and `/secure-authorize` — only URL differs

## Desired End State

After this change:
1. `handleAuthorize` calls `/secure-authorize` instead of `/authorize`
2. unify receives the nonce, activates the secure flow, returns `confirm_token` via callback
3. The existing confirm flow in `connectionActions.ts:257-310` activates
4. Connections transition from `authorized` → `callable` after OAuth
5. All existing tests pass with the updated URL

### Verification:
- `tsdx test connectionActions` — all tests pass with `/secure-authorize` URL
- `tsdx build` — build succeeds

## What We're NOT Doing

- No changes to the confirm flow, nonce logic, or `oauthCsrf.ts`
- No changes to `AuthorizeButton.tsx`, `useConnections.tsx`, or `useSession.tsx`
- No new tests — existing test suite already covers the full CSRF flow
- No changes to request/response shape

## Implementation Approach

Single-phase change: update the URL in source and the URL constant in tests.

## Phase 1: Switch `/authorize` to `/secure-authorize`

### Overview

Change the authorize endpoint URL from `/authorize` to `/secure-authorize` in the source code and update the corresponding test constant.

### Session Startup Protocol
1. Verify working directory: `pwd`
2. Check previous phase committed: `git log -1 --oneline`
3. Read progress JSON: `thoughts/shared/progress/2026-03-04-switch-secure-authorize-endpoint-status.json`
4. Confirm current phase matches JSON `current_phase`

### Changes Required:

#### 1. Update authorize endpoint URL

**File**: `src/utils/connectionActions.ts` (line 205)
**Change**: Replace `/authorize` with `/secure-authorize` in the fetch URL template literal

**Key Implementation Notes**:
- Only change the path segment in the template literal string
- The rest of the fetch call (method, headers, body) stays identical

#### 2. Update test URL constant

**File**: `test/connectionActions.test.ts` (line 66)
**Change**: Update `AUTHORIZE_URL` constant from `/authorize` to `/secure-authorize`

**Key Implementation Notes**:
- This constant is used in all test assertions that match the authorize fetch call
- Changing this single constant updates all test expectations automatically

### Success Criteria:

#### Automated Verification:
- Tests pass: `tsdx test connectionActions --no-watch`
- Build succeeds: `tsdx build`

#### Manual Verification:
- Confirm the fetch URL in source reads `.../secure-authorize`
- Confirm the test constant reads `.../secure-authorize`
- All existing test cases (happy path, nonce mismatch, error handling, redirect_uri, grant types) still pass

### Session Completion
1. All changes committed: `git add src/utils/connectionActions.ts test/connectionActions.test.ts && git commit -m "Phase 7: Switch /authorize to /secure-authorize endpoint"`
2. Update progress JSON: set phase 1 to "complete"
3. Verify clean state: `git status` shows clean working tree

---

## Testing Strategy

**No new tests needed.** The existing test suite in `test/connectionActions.test.ts` already covers:
- Happy path CSRF flow (authorize → popup → postMessage → confirm)
- Nonce mismatch rejection
- Authorize endpoint error handling
- Confirm endpoint error handling
- `redirect_uri` inclusion
- Client credentials / password grant type fallback

All tests will continue to work because the `AUTHORIZE_URL` constant is updated alongside the source change.

## Performance Considerations

None — this is a URL string change with no behavioral impact.

## Migration Notes

Not applicable — this is a library change. Consumers get the fix when they upgrade `@apideck/react-vault`.

## References

- Related research: `thoughts/shared/research/quickbooks-authorized-not-callable.md`
- Prior implementation: `thoughts/shared/plans/2026-03-03-GH-9546-oauth-csrf-protection.md` (phases 1-6)
- Source: `src/utils/connectionActions.ts:205`
- Tests: `test/connectionActions.test.ts:66`
