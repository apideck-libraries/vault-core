---
github_issue_url: https://github.com/apideck-libraries/vault-core/issues/127
status: draft
related_research: thoughts/shared/research/2026-02-24-GH-127-authorize-button-custom-auth-type.md
---

# Show Authorize Button for Custom Auth Type with oauthGrantType

**Related Issue**: [GH-127](https://github.com/apideck-libraries/vault-core/issues/127)

---

## Pattern Decisions

- **Type addition:** Inline string literal union with named type alias (based on: `ConnectionState` at `src/types/Connection.ts:26-31`)
- **Gate condition pattern:** `auth_type === 'oauth2' || !!oauth_grant_type` — presence-based, future-proof
- **Types to update:** `Connection` interface (`src/types/Connection.ts:38-76`) — add `OAuthGrantType` type and `oauth_grant_type` field
- **Components to update:** `ConnectionDetails.tsx:106`, `TopBar.tsx:213`, `ButtonLayoutMenu.tsx:258`

---

## Overview

Widen the authorize/re-authorize button visibility gates to show for any connector that has `oauth_grant_type` set, not just `auth_type === 'oauth2'`. This unblocks connectors like Shopify that use `auth_type: 'custom'` with `oauth_grant_type: 'client_credentials'`. The downstream behavior layer (`AuthorizeButton`, `connectionActions.ts`) already handles these grant types correctly — only the visibility layer needs updating.

## Current State Analysis

The authorization flow has a two-layer design:
1. **Visibility layer**: `auth_type === 'oauth2'` controls whether authorize/re-authorize UI elements appear
2. **Behavior layer**: `oauth_grant_type` controls what happens when clicked (popup vs. POST `/token`)

The visibility layer blocks custom auth connectors even though the behavior layer already supports them. Additionally, `oauth_grant_type` is not a declared field on the `Connection` interface — it's accessed via the `[key: string]: any` index signature.

### Key Discoveries:

- Three identical gates at `ConnectionDetails.tsx:106`, `TopBar.tsx:213`, `ButtonLayoutMenu.tsx:258`
- `AuthorizeButton.tsx` never references `auth_type` — fully auth-type-agnostic (`AuthorizeButton.tsx:49-51`)
- `connectionActions.ts:32-34` has identical grant-type branching to `AuthorizeButton`
- `oauth_grant_type` is untyped on `Connection` interface (`Connection.ts:75` index signature)

## Desired End State

- Connectors with `oauth_grant_type` set (regardless of `auth_type`) show the Authorize button when in `added`/`authorized`/`invalid` states
- Connectors with `oauth_grant_type` set show the Re-authorize option when in `authorized`/`callable` states
- `oauth_grant_type` is a properly typed optional field on the `Connection` interface
- All existing `oauth2` connector behavior is unchanged
- `apiKey`, `basic`, `none`, and `custom`-without-grant-type connectors are unaffected

### Verification:

- Automated: existing tests still pass, new tests cover `custom` + `oauth_grant_type` scenarios
- Manual: Storybook with a mock `custom`/`client_credentials` connection shows Authorize button

## What We're NOT Doing

- Modifying `AuthorizeButton` or `connectionActions.ts` behavior — they already work correctly
- Adding new API calls or changing the token exchange flow
- Handling any new `oauth_grant_type` values beyond the existing three
- Removing the `[key: string]: any` index signature from `Connection` (other untyped fields may depend on it)

## Implementation Approach

This is a small, focused change: one type addition and three condition widenings. We'll follow TDD by writing tests for the new visibility behavior first, then making the type and condition changes to turn them green.

## Phase 1: Type Update — Add `OAuthGrantType` to Connection Interface

### Overview

Declare `oauth_grant_type` as a properly typed optional field on the `Connection` interface.

### Session Startup Protocol
1. Verify working directory: `pwd`
2. Read progress JSON: `thoughts/shared/progress/2026-02-24-GH-127-authorize-button-custom-auth-type-status.json`
3. Confirm current phase matches JSON `current_phase`

### Changes Required:

#### 1. Connection Type

**File**: `src/types/Connection.ts` (after line 36, before the `Connection` interface)
**Change**: Add `OAuthGrantType` type alias and export it

**Key Implementation Notes**:
- Follow the same pattern as `ConnectionState` (line 26-31) — named type alias with string literal union
- Values: `'authorization_code' | 'client_credentials' | 'password'`

#### 2. Connection Interface

**File**: `src/types/Connection.ts` (inside `Connection` interface, after `auth_type` on line 47)
**Change**: Add `oauth_grant_type?: OAuthGrantType` field

**Key Implementation Notes**:
- Must be optional (`?`) — not all connections have a grant type
- Place it adjacent to `auth_type` for logical grouping

### Success Criteria:

#### Automated Verification:
- Build succeeds: `tsdx build`
- Existing tests still pass: `tsdx test --no-watch`

### Session Completion
1. All changes committed
2. Update progress JSON: set phase 1 to "complete", increment current_phase
3. Verify clean state: `git status` shows clean working tree

---

## Phase 2: Write Tests for Widened Authorize Gate (TDD - RED)

### Overview

Write tests that assert the Authorize button renders for `custom` auth type connections with `oauth_grant_type` set, and does NOT render for `custom` without it.

### Session Startup Protocol
1. Verify working directory: `pwd`
2. Check previous phase committed: `git log -1 --oneline`
3. Read progress JSON: `thoughts/shared/progress/2026-02-24-GH-127-authorize-button-custom-auth-type-status.json`
4. Confirm current phase matches JSON `current_phase`

### Changes Required:

#### 1. Test Cases

**File**: Existing test file(s) in `test/` — find the file that tests `ConnectionDetails` rendering
**Change**: Add test cases for custom auth type + oauth_grant_type scenarios

**Test cases to write**:

1. **Shows Authorize button for `auth_type: 'custom'` with `oauth_grant_type: 'client_credentials'`**
   - Connection: `{ auth_type: 'custom', oauth_grant_type: 'client_credentials', enabled: true, state: 'added' }`
   - Assert: Authorize button is rendered

2. **Does NOT show Authorize button for `auth_type: 'custom'` without `oauth_grant_type`**
   - Connection: `{ auth_type: 'custom', enabled: true, state: 'added' }`
   - Assert: Authorize button is NOT rendered

3. **Still shows Authorize button for `auth_type: 'oauth2'` (regression guard)**
   - Connection: `{ auth_type: 'oauth2', enabled: true, state: 'added' }`
   - Assert: Authorize button is rendered

**Key Implementation Notes**:
- Follow existing test patterns in the test file (mock setup, rendering approach, query methods)
- Use `@testing-library/react` queries
- These tests should FAIL at this point — the gate still requires `auth_type === 'oauth2'`

### Success Criteria:

#### Automated Verification:
- New tests FAIL as expected (gate hasn't been widened yet)
- Existing tests still pass

### Session Completion
1. All changes committed
2. Update progress JSON: set phase 2 to "complete", increment current_phase
3. Verify clean state: `git status` shows clean working tree

---

## Phase 3: Widen Authorize Gates (TDD - GREEN)

### Overview

Update the three `auth_type === 'oauth2'` conditions to also admit connections with `oauth_grant_type` set.

### Session Startup Protocol
1. Verify working directory: `pwd`
2. Check previous phase committed: `git log -1 --oneline`
3. Read progress JSON: `thoughts/shared/progress/2026-02-24-GH-127-authorize-button-custom-auth-type-status.json`
4. Confirm current phase matches JSON `current_phase`

### Changes Required:

#### 1. ConnectionDetails — Initial Authorize Button

**File**: `src/components/ConnectionDetails.tsx` (line 106)
**Change**: Replace `auth_type === 'oauth2'` with `(auth_type === 'oauth2' || !!oauth_grant_type)`

**Key Implementation Notes**:
- `oauth_grant_type` must be destructured from `selectedConnection` at lines 68-76 alongside the existing fields
- The `!!` coercion converts the optional string to boolean for the condition

#### 2. TopBar — Re-authorize Dropdown

**File**: `src/components/TopBar.tsx` (line 213)
**Change**: Replace `auth_type === 'oauth2'` with `(auth_type === 'oauth2' || !!oauth_grant_type)`

**Key Implementation Notes**:
- `oauth_grant_type` must be destructured from `selectedConnection` — check existing destructure location (around line 64)

#### 3. ButtonLayoutMenu — Re-authorize Button

**File**: `src/components/ButtonLayoutMenu.tsx` (line 258)
**Change**: Replace `auth_type === 'oauth2'` with `(auth_type === 'oauth2' || !!oauth_grant_type)`

**Key Implementation Notes**:
- `oauth_grant_type` must be destructured from `connection` prop — check existing destructure location (around line 62)

### Success Criteria:

#### Automated Verification:
- All tests pass (including new tests from Phase 2): `tsdx test --no-watch`
- Build succeeds: `tsdx build`
- Linting passes: `tsdx lint`

#### Manual Verification:
- In Storybook, a mock connection with `auth_type: 'custom'` and `oauth_grant_type: 'client_credentials'` shows the Authorize button
- Existing `oauth2` connections still show Authorize/Re-authorize as before
- `apiKey`/`basic`/`none` connections remain unaffected

### Session Completion
1. All changes committed
2. Update progress JSON: set phase 3 to "complete", increment current_phase
3. Verify clean state: `git status` shows clean working tree

---

## Testing Strategy

**IMPORTANT: Follow Test-Driven Development (TDD) for all code**

### TDD Approach:

1. Phase 1 (types) needs no tests — type additions don't change runtime behavior
2. Phase 2 writes failing tests for the new gate behavior
3. Phase 3 makes those tests pass by widening the conditions

### Unit Tests:

- Custom auth + `oauth_grant_type` present → Authorize button visible
- Custom auth without `oauth_grant_type` → Authorize button NOT visible
- OAuth2 auth → Authorize button still visible (regression)

### Manual Testing Steps:

1. In Storybook, render a connection with `auth_type: 'custom'`, `oauth_grant_type: 'client_credentials'`, `enabled: true`, `state: 'added'` — verify Authorize button appears
2. Click the Authorize button — verify it calls POST `/token` (not a popup)
3. After authorization, verify Re-authorize option appears in the dropdown/button grid
4. Verify an `oauth2` connection still works identically to before

## References

- Related research: `thoughts/shared/research/2026-02-24-GH-127-authorize-button-custom-auth-type.md`
- AuthorizeButton grant-type branching: `src/components/AuthorizeButton.tsx:49-51`
- connectionActions grant-type branching: `src/utils/connectionActions.ts:32-34`
- ConnectionState type pattern to follow: `src/types/Connection.ts:26-31`
