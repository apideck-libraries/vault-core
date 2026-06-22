---
github_issue_url: https://github.com/apideck-io/unify/issues/9546
status: draft
related_research: thoughts/shared/research/2026-05-05-GH-9546-csrf-fix-vault-core.md
---

# Drop Client-Side Nonce Storage & Verification Implementation Plan

**Related Issue**: [GH-9546](https://github.com/apideck-io/unify/issues/9546) (OAuth CSRF — vault-core follow-up)

---

## Pattern Decisions

- **Utility refactor:** Replace stateful `generateAndStoreNonce` with stateless `generateNonce` — keep the existing `generateUuid` helper and `callConfirmEndpoint` untouched (based on: `src/utils/oauthCsrf.ts`).
- **postMessage handler pattern:** Existing per-call listener registered before `window.open`, torn down in `cleanup()` — unchanged. Only the nonce gate is removed (based on: `src/components/AuthorizeButton.tsx:127-187`, `src/utils/connectionActions.ts:113-173`).
- **Test pattern:** `@testing-library/react` + `act()` + spied `window.open`/`window.fetch` + dispatched `MessageEvent`, mock setup from `test/mock.ts` (based on: `test/authorize-button.test.tsx`, `test/connection-actions.test.tsx`).
- **Utilities identified:** `oauthCsrf` (`src/utils/oauthCsrf.ts`), `connectionActions` (`src/utils/connectionActions.ts`).
- **Types to update:** None. `OAuthCompleteMessage.nonce` (`src/types/OAuthCsrf.ts:3`) stays — unify still puts `nonce` on the wire; the client simply stops reading it.

---

## Overview

Remove the client-side OAuth nonce **storage** and **verification** from vault-core. Keep generating and appending a `nonce` query param to the authorize URL (it is unify's opt-in trigger for the confirm flow), but stop persisting it in `sessionStorage` and stop gating `/confirm` on a nonce match. The connection's security is enforced entirely server-side by the single-use, context-bound `confirm_token`; the client nonce check adds no security and is fragile in partitioned third-party iframes.

## Current State Analysis

The current flow stores a nonce in `sessionStorage` at authorize time and re-reads it to gate `/confirm`:

- `generateAndStoreNonce` writes to `sessionStorage` (`src/utils/oauthCsrf.ts:20-24`).
- `verifyAndClearNonce` reads + clears + compares (`:26-32`); `clearNonce` removes it (`:34-36`).
- Both popup handlers block `/confirm` when `verifyAndClearNonce` returns false (`AuthorizeButton.tsx:149-157`, `connectionActions.ts:135-143`) and call `clearNonce` on `oauth_error` (`AuthorizeButton.tsx:144`, `connectionActions.ts:130`).

**Two problems, one root cause — `sessionStorage` is unguarded:**

- **3a (blocked storage throws):** In a storage-partitioned iframe, `sessionStorage.setItem` throws `SecurityError`; `generateAndStoreNonce` throws at `oauthCsrf.ts:22` before returning. Reproduced by 3 currently-failing tests in `test/oauth-csrf.test.ts:79-128` (`yarn test oauth-csrf` → 3 failed, 9 passed).
- **3b (severed storage returns null):** `verifyAndClearNonce` returns `false` for a *legitimate* completion → "Could not confirm" toast → `/confirm` never fires → connection stuck `pending_confirmation`.

This is exactly vault-core's deployment environment (embedded via iframe-vault), so a storage-dependent security check is both fragile and misplaced.

### Key Discoveries (verified against unify source)

- **The nonce is only a trigger server-side, never verified.** `unify/.../CallbackConnectionUseCase.ts:394` (`if (!nonce) return csrfEnabled: false`) and `:475` (`if (!nonce || !csrfEnabled) return redirectUri`). When present, the nonce is **echoed back verbatim** into the redirect hash (`:494-498`) — no comparison anywhere.
- **The `confirm_token` is the real capability.** Fresh `uuidv4()` (`CallbackConnectionUseCase.ts:479`), stored single-use with 30-min TTL in a row keyed to `consumerId/applicationId/serviceId/unifiedApi` (`:482-491`).
- **`/confirm` enforces a context match against the authenticated session.** `unify/.../ConfirmConnectionUseCase.ts:62-69` returns 401 unless the stored context matches the request — and `consumerId`/`applicationId` come from `authorizer(request)` (the JWT), not the body, which carries only `confirm_token` (`ConfirmConnectionController.ts` `isValid`). The nonce is never referenced in the confirm path.
- **Conclusion:** A forged/replayed `oauth_complete` postMessage cannot confirm anything — the attacker has no `confirm_token` that passes the server-side context match. The client nonce verification is strictly redundant with stronger server controls.
- vault-core reference surface (full list, build artifact `example/dist` excluded): `src/utils/oauthCsrf.ts`, `src/utils/connectionActions.ts`, `src/components/AuthorizeButton.tsx`, `src/components/TopBar.tsx`, `src/components/ButtonLayoutMenu.tsx`, `test/oauth-csrf.test.ts`, `test/authorize-button.test.tsx`, `test/connection-actions.test.tsx`.

## Desired End State

- `oauthCsrf.ts` exports `generateNonce` (stateless), `callConfirmEndpoint` — and no `verifyAndClearNonce`/`clearNonce`.
- No code path in `src/` touches `sessionStorage`. `grep -rn "sessionStorage" src/` returns nothing.
- The authorize URL still carries `&nonce=<uuid>` at all three call sites.
- On `oauth_complete` for the matching `serviceId`, the handler calls `/confirm` directly — regardless of the message's `nonce` value.
- `oauth_error` still toasts and skips `/confirm`; foreign-`serviceId` messages are still ignored; the 1000 ms grace-period fallback and double-confirm guard are unchanged.
- `yarn test --no-watch` green; `tsdx build` and `tsdx lint` pass.

**Verify:** `yarn test --no-watch` (full suite green, including no orphaned references), `grep -rn "verifyAndClearNonce\|clearNonce\|generateAndStoreNonce\|sessionStorage" src/ test/` returns nothing.

## What We're NOT Doing

- **Not** removing the `nonce` query param from the authorize URL — it remains the server's opt-in trigger; dropping it disables CSRF protection entirely (plain redirect, no `confirm_token`).
- **Not** changing `callConfirmEndpoint`, the postMessage listener lifecycle, the 1000 ms grace fallback, or the `child.closed` polling.
- **Not** removing the `nonce` field from `OAuthCompleteMessage` — it stays on the wire from unify; we just ignore it client-side.
- **Not** adding an `event.origin` check — white-label / custom redirect domains mean there is no fixed origin to pin.
- **Not** touching unify or vault. (Out-of-scope note recorded in Migration Notes.)
- **Not** changing `pending_confirmation` UI or `client_credentials`/`password` grant paths.

## Implementation Approach

The utility export and its consumers are a single atomic unit: removing `verifyAndClearNonce`/`clearNonce` from `oauthCsrf.ts` requires removing every importer in the same change, or TypeScript compilation breaks across the whole test suite. So the TDD cycle is structured as: **(RED)** rewrite all three test files to the target behavior, then **(GREEN)** land the util refactor and all consumers together, then verify, then refactor cleanup. No type-change phase is needed (the wire types are unchanged).

---

## Phase 1: Rewrite Tests to Target Behavior (TDD - RED)

### Overview

Rewrite the three test files so they assert the post-removal behavior. These fail until Phase 2 lands (the util `generateNonce` doesn't exist yet, and the handlers still gate on `verifyAndClearNonce`).

### Session Startup Protocol
1. Verify working directory: `pwd`
2. Read progress JSON: `thoughts/shared/progress/2026-06-19-GH-9546-drop-client-nonce-storage-status.json`
3. Confirm current phase matches JSON `current_phase`

### Changes Required:

#### 1. `test/oauth-csrf.test.ts`
**Change**: Replace the storage-based describe blocks with `generateNonce` tests; keep `callConfirmEndpoint`.

**Key Implementation Notes**:
- Update import to `{ callConfirmEndpoint, generateNonce }`.
- Delete the `generateAndStoreNonce`, `verifyAndClearNonce`, `clearNonce`, and `sessionStorage unavailable (in-memory fallback)` describe blocks (`:21-129`) — including the 3 currently-failing tests, whose premise (in-memory fallback) no longer exists.
- Delete the `STORAGE_PREFIX` constant and `beforeEach(sessionStorage.clear())`.
- New `describe('generateNonce')`:
  - returns a non-empty string.
  - returns a different value on each call (uniqueness).
  - does **not** touch `sessionStorage`: spy `Storage.prototype.setItem` and assert it is **not** called; assert `generateNonce` does **not** throw even when `setItem` is mocked to throw.
- Leave the `callConfirmEndpoint` describe block (`:131-186`) unchanged.

#### 2. `test/authorize-button.test.tsx`
**Change**: Drop storage assertions; assert `/confirm` proceeds regardless of nonce value.

**Key Implementation Notes**:
- Remove the `STORAGE_PREFIX` constant (`:148`).
- "appends &nonce= ... and stores nonce in sessionStorage" (`:240-253`) → keep the URL `nonce=` assertions, **delete** the `sessionStorage.getItem(...)` assertion.
- "on oauth_complete with valid nonce: POSTs to /confirm and clears the nonce" (`:255-288`) → rename to drop "and clears the nonce"; **delete** the trailing `sessionStorage.getItem(...).toBeNull()` assertion.
- Replace "on nonce mismatch: skips /confirm and surfaces an error toast" (`:345-372`) with **"on oauth_complete with an arbitrary nonce: still POSTs to /confirm"** — dispatch `oauth_complete` with `nonce: 'arbitrary-value'` and assert a `/confirm` POST **is** made (the new behavior).
- Keep unchanged: oauth_error skips confirm (`:290-313`), foreign serviceId ignored (`:315-343`), grace fallback (`:374-421`), no double-confirm (`:423-483`).

#### 3. `test/connection-actions.test.tsx`
**Change**: Mirror the authorize-button updates for `handleRedirect`.

**Key Implementation Notes**:
- Update import `generateAndStoreNonce` → `generateNonce` (`:12`); the `buildUrlAtClick` helpers (`:139`, `:293`) call `generateNonce(serviceId? )` — `generateNonce` takes no serviceId arg, so call `generateNonce()`.
- Remove `STORAGE_PREFIX` (`:15`).
- "appends &nonce= ... and stores nonce in sessionStorage" (`:158-169`) → delete the `sessionStorage.getItem(...)` assertion.
- "on oauth_complete with valid nonce ... clears the nonce" (`:171-204`) → delete the trailing `sessionStorage.getItem(...).toBeNull()` assertion.
- Replace "on nonce mismatch: skips /confirm" (`:260-286`) with "arbitrary nonce: still POSTs to /confirm".
- Keep oauth_error, foreign serviceId, grace fallback unchanged.

### Success Criteria:

#### Automated Verification:
- `yarn test --no-watch` runs and the **rewritten** specs fail for the expected reasons (missing `generateNonce` export; handler still gating → "arbitrary nonce still confirms" fails). Other suites unaffected (src still compiles — `oauthCsrf.ts` unchanged this phase).

#### Manual Verification:
- Confirm the 3 ex-failing storage-fallback tests are gone, not merely skipped.

### Session Completion
1. Commit: `git add -A && git commit -m "Phase 1: rewrite OAuth CSRF tests for stateless nonce (TDD - RED)"` (+ `Co-Authored-By: Claude <noreply@anthropic.com>`)
2. Update progress JSON: phase 1 → "complete", `current_phase` → 2.
3. `git status` clean.

---

## Phase 2: Remove Nonce Storage Across Util + Consumers (TDD - GREEN)

### Overview

Land the atomic refactor: stateless `generateNonce`, delete `verifyAndClearNonce`/`clearNonce`, and update all four `src/` consumers so the handlers confirm without a nonce gate. All Phase-1 tests go green.

### Session Startup Protocol
1. Verify working directory: `pwd`
2. Check previous phase committed: `git log -1 --oneline`
3. Read progress JSON; confirm `current_phase` is 2.

### Changes Required:

#### 1. `src/utils/oauthCsrf.ts`
**Change**: Stateless nonce; remove verify/clear.
**Key Implementation Notes**:
- Replace `generateAndStoreNonce` (`:20-24`) with `export function generateNonce(): string { return generateUuid(); }`.
- Delete `verifyAndClearNonce` (`:26-32`) and `clearNonce` (`:34-36`).
- Keep `generateUuid` (`:7-18`) and `callConfirmEndpoint` (`:38-68`) unchanged. `STORAGE_PREFIX`/`storageKey` (`:3-5`) become dead — delete them.
- Add a brief comment documenting the contract: *the nonce is opaque, echoed by unify, and never verified server-side (see unify `CallbackConnectionUseCase.ts:394/475/494`, `ConfirmConnectionUseCase.ts:62-69`); security is the single-use, context-bound `confirm_token`.*

#### 2. `src/components/AuthorizeButton.tsx`
**Key Implementation Notes**:
- Import (`:9-14`): drop `clearNonce`, `verifyAndClearNonce`; rename `generateAndStoreNonce` → `generateNonce`.
- `:109`: `const nonce = generateNonce();`
- oauth_error branch (`:144`): remove `clearNonce(serviceId);`.
- Remove the verify gate (`:149-157`) entirely — proceed straight from the `serviceId` check to the `callConfirmEndpoint` try-block. `data.nonce` is no longer read.

#### 3. `src/utils/connectionActions.ts`
**Key Implementation Notes**:
- Import (`:9-13`): drop `clearNonce`, `verifyAndClearNonce` (keep `callConfirmEndpoint`).
- oauth_error branch (`:130`): remove `clearNonce(serviceId);`.
- Remove the verify gate (`:135-143`).

#### 4. `src/components/TopBar.tsx`
**Key Implementation Notes**:
- Import (`:11`) and call site (`:240`): `generateAndStoreNonce(selectedConnection.service_id)` → `generateNonce()`.

#### 5. `src/components/ButtonLayoutMenu.tsx`
**Key Implementation Notes**:
- Import (`:10`) and both call sites (`:98`, `:286`): `generateAndStoreNonce(connection.service_id)` → `generateNonce()`.

### Success Criteria:

#### Automated Verification:
- `yarn test --no-watch` — full suite green.
- `tsdx build` succeeds (no unused-import / missing-export errors).
- `tsdx lint` passes.
- `grep -rn "sessionStorage" src/` returns nothing.

#### Manual Verification:
- In the example app / Storybook, an OAuth authorize popup still appends `&nonce=` and the connection confirms on `oauth_complete`.

### Session Completion
1. Commit: `git add -A && git commit -m "Phase 2: remove client-side nonce storage and verification (TDD - GREEN) Ref #9546"` (+ `Co-Authored-By`).
2. Progress JSON: phase 2 → "complete", `current_phase` → 3.
3. `git status` clean.

---

## Phase 3: Verify Full Suite (TDD - GREEN verification)

### Overview
Confirm the whole suite, build, and lint are green and no orphaned references remain.

### Session Startup Protocol
1. `pwd`; `git log -1 --oneline`; read progress JSON; confirm `current_phase` is 3.

### Changes Required:
- No code changes. Run verification commands and fix any fallout discovered (e.g., an unmigrated reference).

### Success Criteria:

#### Automated Verification:
- `yarn test --no-watch` — all suites pass.
- `tsdx build` and `tsdx lint` pass.
- `grep -rn "verifyAndClearNonce\|clearNonce\|generateAndStoreNonce\|apideck_oauth_nonce_\|sessionStorage" src/ test/` returns nothing.

#### Manual Verification:
- Re-run `yarn test oauth-csrf` — 0 failing (the original 3 reds are gone).

### Session Completion
1. If fixes were needed: commit `git add -A && git commit -m "Phase 3: verification fixes"`; else no commit.
2. Progress JSON: phase 3 → "complete", `current_phase` → 4.
3. `git status` clean.

---

## Phase 4: Cleanup (TDD - REFACTOR)

### Overview
Tidy comments and remove any now-dead test scaffolding while the suite stays green.

### Session Startup Protocol
1. `pwd`; `git log -1 --oneline`; read progress JSON; confirm `current_phase` is 4.

### Changes Required:
- Remove leftover unused constants/imports in the three test files (e.g., `STORAGE_PREFIX`, any unused `sessionStorage` setup) if not already removed.
- Ensure the `oauthCsrf.ts` contract comment is accurate and concise.
- Confirm the `OAuthCompleteMessage.nonce` field retains a short comment noting it is received-but-unused (wire compatibility).

### Success Criteria:

#### Automated Verification:
- `yarn test --no-watch`, `tsdx build`, `tsdx lint` all green.

#### Manual Verification:
- Diff review: no behavioral change vs. Phase 2; comments accurate.

### Session Completion
1. Commit: `git add -A && git commit -m "Phase 4: cleanup after nonce-storage removal (TDD - REFACTOR)"` (+ `Co-Authored-By`).
2. Progress JSON: phase 4 → "complete".
3. `git status` clean.

---

## Testing Strategy

**Follow TDD (red-green-refactor).** This is a removal/refactor, so the RED phase rewrites existing tests to the target behavior rather than authoring brand-new components.

### Unit Tests (`test/oauth-csrf.test.ts`):
- `generateNonce`: non-empty, unique per call, never touches `sessionStorage`, never throws even if `Storage.prototype.setItem` is mocked to throw.
- `callConfirmEndpoint`: unchanged (URL/headers/body/response, non-2xx throws).

### Component / Integration Tests (`authorize-button.test.tsx`, `connection-actions.test.tsx`):
- Authorize URL still carries `&nonce=`.
- `oauth_complete` (matching `serviceId`) → `/confirm` POST with `{ confirm_token }`, **regardless of nonce value** (new behavior; replaces the nonce-mismatch test).
- `oauth_error` → toast, no `/confirm`.
- Foreign `serviceId` → ignored.
- 1000 ms grace fallback and no-double-confirm guard preserved.
- No `sessionStorage` assertions anywhere.

### Manual Testing Steps:
1. Example app: authorize an OAuth2 connector; verify popup URL has `&nonce=` and the connection confirms on completion.
2. Simulate a partitioned iframe (block storage in devtools) and confirm authorize no longer throws.

## Performance Considerations

Negligible — removes two `sessionStorage` round-trips per OAuth flow.

## Migration Notes

- **Contract dependency:** This hard-codes "nonce is opaque, echoed, never verified server-side." That matches unify today (`CallbackConnectionUseCase`/`ConfirmConnectionUseCase`). If unify ever adds server-side nonce verification, a non-storing client would break — record this on the unify side as a do-not-do, and keep the contract comment in `oauthCsrf.ts`.
- **Backwards compatible:** Non-allowlisted accounts already receive a plain redirect; sending an unverified nonce is harmless. No data migration.
- **Cross-repo:** vault (`src/utils/oauthCsrf.ts`) still stores+verifies its own nonce on the redirect-return path; that is a separate codebase and out of scope here.

## References

- Related research: `thoughts/shared/research/2026-05-05-GH-9546-csrf-fix-vault-core.md`
- Server-side controls (verified): `unify/src/modules/connection/application/useCases/confirmConnection/ConfirmConnectionUseCase.ts:62-69`; `.../ConfirmConnectionController.ts` (`isValid`); `.../callbackConnection/CallbackConnectionUseCase.ts:394,475,479-498`
- Client handlers: `src/components/AuthorizeButton.tsx:127-187`, `src/utils/connectionActions.ts:113-173`
