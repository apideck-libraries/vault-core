---
status: implemented
related_research:
  - thoughts/shared/research/2026-07-14-oauth-confirm-iframe-context.md
  - thoughts/shared/research/2026-07-16-oauth-confirm-handoff-sequence-diagrams.md
---

# OAuth Confirm Grant Handoff (vault-core side) Implementation Plan

**Problem**: connections stuck at `pending_confirmation` when COOP severs `window.opener` (deterministic for nested-iframe embedders like OCTA).
**Design**: forward grant handoff — validated GO on Blink, Gecko, and WebKit via `example/storage-roundtrip/` (results table in its README).

---

## Pattern Decisions

- **New util module** `src/utils/oauthGrantHandoff.ts` — pure, parameter-object functions next to the existing `src/utils/oauthCsrf.ts` (same style as `callConfirmEndpoint`: explicit `connectionsUrl`/`headers` params, no context access inside utils).
- **Per-call listener lifecycle** — message listeners armed before `window.open`, torn down in `cleanup()`, guarded by a `completed` flag; unchanged pattern (based on: `src/components/AuthorizeButton.tsx:122-173`, `src/utils/connectionActions.ts:109-160`).
- **Synchronous `window.open` in the click handler** — non-negotiable; the grant is minted in parallel and delivered via the handshake, never awaited before opening (popup blockers otherwise regress the happy path).
- **Origin pinning for the handshake only.** The launch origin is derived from `session.redirect_uri ?? REDIRECT_URL` (the same source the authorize `redirect_uri` uses today, `AuthorizeButton.tsx:36-38`, `src/constants/urls.ts:1`), so it is known per session — incoming `oauth_launch_ready` is validated with `event.source === child && event.origin === launchOrigin`, and the outgoing grant is posted with that explicit `targetOrigin`. The legacy `oauth_complete` path keeps its documented no-origin-check decision (white-label domains; see `thoughts/shared/plans/2026-06-19-GH-9546-drop-client-nonce-storage.md` § What We're NOT Doing).
- **Grant never in any URL** — security-load-bearing; it travels only over the live opener `postMessage` handshake. Only non-secret correlation data (e.g. `service_id`) may appear in the launch URL.
- **Test pattern**: `@testing-library/react` + `act()` + spied `window.open`/`window.fetch` + dispatched `MessageEvent` + jest fake timers for the poll/timeout branches; mock setup from `test/mock.ts` (based on: `test/authorize-button.test.tsx`, `test/connection-actions.test.tsx`).
- **Types**: new `src/types/OAuthGrantHandoff.ts`; `src/types/OAuthCsrf.ts` untouched (legacy wire format stays).
- **SWR refresh**: revalidating `mutate(detailUrl)` + `mutate('/vault/connections')` on success — unchanged from today (`AuthorizeButton.tsx:164-170`, `connectionActions.ts:151-157`).

---

## Overview

Invert the confirm-token handoff direction for OAuth popups. Instead of the popup posting the `confirm_token` **backwards** to the widget after completion (dies when COOP severs `window.opener`), the widget hands a single-use, session-bound **grant forwards at open time** — over the opener link that is alive by construction because the popup's first page is vault's COOP-free `oauth/launch` — and the popup **self-confirms in-tab** at the callback (grant + `confirm_token`). Nothing travels popup → widget anymore, so iframe nesting, COOP, and storage partitioning become irrelevant. The widget detects completion by polling the connection state after the popup closes, and surfaces an actionable error instead of today's silent fake success. The legacy opener `postMessage` → JWT `/confirm` path stays fully armed as a fallback, making the rollout purely additive.

## Current State Analysis

Two structurally-duplicated popup flows exist:

- **First-time authorize** — `src/components/AuthorizeButton.tsx:57-195` (`authorizeConnection`, rendered from `ConnectionDetails.tsx:473`).
- **Re-authorize / disconnect** — `src/utils/connectionActions.ts:36-182` (`useConnectionActions().handleRedirect`, called from `TopBar.tsx:239-244`, `ButtonLayoutMenu.tsx:98-105`, `:286-293` for authorize and `TopBar.tsx:327`, `ButtonLayoutMenu.tsx:351-354` for revoke).

Shared mechanics today:

1. Authorize URL = `${connection.authorize_url}&redirect_uri=${session?.redirect_uri ?? REDIRECT_URL}` plus a stateless `&nonce=` param (`generateNonce`, `src/utils/oauthCsrf.ts:22-24`) — the nonce is unify's opt-in trigger for the confirm flow, never verified anywhere.
2. `window.open(url, '_blank', 'location=no,height=750,width=550,...')` (`AuthorizeButton.tsx:176-180`, `connectionActions.ts:163-167`).
3. A `message` listener filters on `data.type` and `data.serviceId` (no origin check, no nonce check) and POSTs `{ confirm_token }` to unify via `callConfirmEndpoint` (`src/utils/oauthCsrf.ts:26-56`) with JWT-derived headers from `useConnections` (`src/utils/useConnections.tsx:90-99`).
4. A 500 ms `child.closed` poller with a 1000 ms grace period refetches the connection on close (`AuthorizeButton.tsx:182-193`, `connectionActions.ts:169-180`) — **it never calls `/confirm` and treats popup-close as success**, which is exactly the silent strand when COOP has severed the opener and the `confirm_token` was dropped in vault's callback.

**The failure** (see `thoughts/shared/research/2026-07-16-oauth-confirm-handoff-sequence-diagrams.md` § 2): any COOP `same-origin` page in the popup's navigation chain moves it to a new browsing-context group, `window.opener` becomes `null` in vault's callback, the token is dropped, `/confirm` never fires, the connection sticks at `pending_confirmation`, and no `vault.connection.callable` webhook is emitted. Deterministic per configuration; no backwards in-browser channel survives (opener, BroadcastChannel, localStorage, relay iframes all die on COOP or storage partitioning — see `thoughts/shared/research/2026-07-14-oauth-confirm-iframe-context.md` § Options already declined).

Baseline note: the `fix_csrf_3` branch already contains the landed 2026-06-19 drop-client-nonce-storage refactor (stateless `generateNonce`, zero `sessionStorage` usage in `src/`). This plan builds on that state.

## Cross-Repo Contract (assumed — coordination required)

vault-core is one of three legs. This plan implements only the vault-core leg and **assumes** the following contracts; if the other repos land different names/shapes, update the constants/types in Phase 1 before wiring:

**unify** (must deploy first):
- `POST {connectionsUrl}/{unified_api}/{service_id}/grant` with the standard JWT headers → `{ status_code, status, data: { grant: string, expires_in: number } }`. The grant is single-use, short-TTL, bound to app+consumer+service+api and to the minting session (liveness checked at redemption). A 404/4xx/5xx from this endpoint means "grant flow unavailable" and must trigger the legacy fallback, not an error.
- `POST .../confirm` additionally accepts an **unauthenticated** body `{ confirm_token, grant }` (in-tab self-confirm from vault's callback). The existing JWT + `{ confirm_token }` form stays (legacy fallback). No server-side grant parking keyed to OAuth state — that degrades to auto-confirm.

**vault** (must deploy before vault-core release; see memory: vault-core depends on vault for callback handling):
- New `GET /oauth/launch` page, served **without COOP**, that: posts `{ type: 'oauth_launch_ready' }` to `window.opener` (repeating every ~250 ms until answered), refuses loudly if `window.opener` is null or a sessionStorage write-read probe fails (anti-phishing: a handed-out launch link goes nowhere, and it fails before any consent), then on receiving `oauth_launch_start` stores the grant in tab sessionStorage and navigates the tab to the provided authorize URL.
- `oauth/callback` self-confirms in-tab (reads + removes the grant from sessionStorage, POSTs `{ confirm_token, grant }`), falling back to the legacy opener `postMessage` when no grant is present or the self-confirm fails, then closes. Fallback ladder: sessionStorage self-confirm → legacy opener postMessage → loud error.

The `postMessage` protocol types (Phase 1) are the single source of truth vault-core exports for its side of the wire.

## Desired End State

- Clicking authorize/re-authorize opens `{launchOrigin}/oauth/launch?service_id=...` synchronously and mints a grant in parallel; after the `ready` handshake the grant + legacy authorize URL are posted into the popup with an explicit `targetOrigin`.
- If the grant mint fails **or** no `ready` arrives within the handshake timeout (old/self-hosted vault without the launch page), the widget navigates the already-open popup to the legacy authorize URL and the flow proceeds exactly as today.
- The legacy `oauth_complete`/`oauth_error` listener stays armed in both modes (it is also the popup-side fallback when the in-tab self-confirm fails).
- On popup close without a completed legacy confirm, the widget polls the connection detail endpoint until `state === 'callable'` (success: mutate + `onConnectionChange`, no toast) or a poll budget elapses (actionable error toast — never a silent fake success).
- Revoke/disconnect popups are untouched (no mint, no handshake, no poll).
- `yarn test --no-watch`, `tsdx build`, `tsdx lint` all green; grep confirms the grant never appears in any URL construction.

**Verify:** `yarn test --no-watch`; `tsdx build`; `tsdx lint`; manual run of the example app happy path + a forced-timeout fallback (point `redirect_uri` at an origin with no launch page).

## What We're NOT Doing

- **Not** implementing the unify leg (grant mint/redeem endpoints) or the vault leg (`oauth/launch` page, callback self-confirm) — separate repos, separate plans; contracts pinned above.
- **Not** removing the legacy `oauth_complete` postMessage → JWT `/confirm` path — it is the fallback ladder's second rung and stays indefinitely for older vault deployments.
- **Not** removing the `&nonce=` param — it remains unify's opt-in trigger for minting the `confirm_token`, which the new flow still needs (the callback self-confirms with it).
- **Not** adding an `event.origin` check to the **legacy** `oauth_complete` listener (unchanged decision: no fixed origin under white-label domains). The pinned-origin check applies only to the new launch handshake, whose origin is known by construction.
- **Not** handling popup-blocked or custom `redirect_uri` hardening — separate, pre-existing scope (unify plan Phases 1–2 per the sequence-diagrams doc).
- **Not** touching `client_credentials`/`password` grant paths, consent screens, or `pending_confirmation` UI states.
- **Not** deduplicating `AuthorizeButton` and `connectionActions` into one flow implementation beyond what the shared utils naturally absorb — a full merge is a separate refactor.

## Implementation Approach

All genuinely new logic lands as pure, independently-testable functions in `src/utils/oauthGrantHandoff.ts` (Component A), so the two duplicated flow sites only gain thin wiring (Component B). TDD red-green per component:

1. Types + constants (domain, no tests).
2. RED: unit tests for the three utils (`mintGrant`, `runLaunchHandshake`, `pollForCallable`).
3. GREEN: implement the utils.
4. RED: integration tests for both flow sites (handshake happy path, both fallback triggers, poll success/timeout, revoke untouched, legacy behaviors preserved).
5. GREEN: wire `AuthorizeButton` + `connectionActions` (+ call-site signature updates in `TopBar`/`ButtonLayoutMenu`).
6. Verify full suite.
7. Refactor/cleanup.

Key runtime shape (intent, not code): on click — arm listeners, `window.open(launchUrl)` **synchronously**, fire `mintGrant` in parallel; `runLaunchHandshake` resolves `'handoff'` (ready received + grant delivered) or `'legacy'` (mint failed or ready timeout → it navigates `child.location.href` to the legacy authorize URL); on `child.closed` and not `completed`, keep today's 1000 ms grace, then `pollForCallable`; poll outcome drives mutate/`onConnectionChange` vs. an actionable error toast.

**Edge cases handled by design** (worth keeping in review view):
- *Grant delivered but user abandons at the provider*: grant expires server-side (TTL); popup close → poll → timeout → accurate "not completed" toast.
- *In-tab self-confirm fails in the callback (expired/used grant)*: vault falls back to legacy opener postMessage; the widget's still-armed legacy listener confirms via JWT. The `completed` flag prevents the poller from double-reporting.
- *Unify grant endpoint disabled/rolled back after release*: mint returns non-2xx → automatic legacy fallback per click; no stuck state.
- *Re-authorize of an already-`callable` connection*: the poll sees `callable` immediately and reports success — degrades to today's silent-refetch behavior, no regression.
- *User closes popup deliberately mid-consent*: poll timeout → informative toast; today this is a silent refetch, so the only change is honesty.

---

## Phase 1: Protocol Types + Constants (domain)

### Overview

Pin the wire contract and tunables. No behavior change, no tests required (types + constants only).

### Session Startup Protocol
1. Verify working directory: `pwd`
2. Read progress JSON: `thoughts/shared/progress/2026-07-17-oauth-confirm-grant-handoff-status.json`
3. Confirm current phase matches JSON `current_phase`

### Changes Required:

#### 1. `src/types/OAuthGrantHandoff.ts` (new)
- `LaunchReadyMessage` — `{ type: 'oauth_launch_ready' }` (popup → widget).
- `LaunchStartMessage` — `{ type: 'oauth_launch_start'; grant: string; authorizeUrl: string }` (widget → popup; posted with explicit `targetOrigin`).
- `GrantResponse` — `{ status_code: number; status: string; data: { grant: string; expires_in: number } }` (mirrors `ConfirmResponse` shape, `src/types/OAuthCsrf.ts:20-26`).
- `HandshakeOutcome` — `'handoff' | 'legacy'`; `PollOutcome` — `'callable' | 'timeout'`.
- Doc comment: grant is single-use, session-bound, never URL-carried; this file is the vault-core side of the vault `oauth/launch` contract.

#### 2. `src/constants/urls.ts`
- Add `OAUTH_LAUNCH_PATH = '/oauth/launch'`.

#### 3. `src/constants/oauthGrantHandoff.ts` (new)
- `LAUNCH_READY_TIMEOUT_MS = 3000` (fallback trigger for launch-page-less vaults), `CALLABLE_POLL_INTERVAL_MS = 1000`, `CALLABLE_POLL_BUDGET_MS = 15000`. Short comments on why each exists.

### Success Criteria:

#### Automated Verification:
- `tsdx build` and `tsdx lint` pass; `yarn test --no-watch` still green (nothing imports the new files yet).

#### Manual Verification:
- Type/constant names match the Cross-Repo Contract section verbatim.

### Session Completion
1. Commit: `git add -A && git commit -m "Phase 1: grant-handoff protocol types and constants"` (+ `Co-Authored-By: Claude <noreply@anthropic.com>`)
2. Update progress JSON: phase 1 → "complete", `current_phase` → 2.
3. `git status` clean.

---

## Phase 2: Unit Tests for Grant-Handoff Utils (TDD - RED)

### Overview

Author `test/oauth-grant-handoff.test.ts` against the not-yet-existing `src/utils/oauthGrantHandoff.ts`. All tests fail (missing module) until Phase 3. One named test per branch/error path of the paired GREEN phase:

### Changes Required:

#### 1. `test/oauth-grant-handoff.test.ts` (new)

**`describe('mintGrant')`** (spied `window.fetch`; params `{ unifiedApi, serviceId, connectionsUrl, headers }` like `callConfirmEndpoint`):
- `POSTs to {connectionsUrl}/{unifiedApi}/{serviceId}/grant with the provided headers and returns the grant string on 2xx`
- `returns null on non-2xx response (grant flow unavailable → caller falls back to legacy)`
- `returns null when fetch rejects (network error) instead of throwing`

**`describe('deriveLaunchUrl')`**:
- `builds {origin(redirect_uri)}{OAUTH_LAUNCH_PATH}?service_id=... from a session redirect_uri`
- `falls back to the REDIRECT_URL origin when session has no redirect_uri`
- `never includes a grant parameter regardless of inputs` (guards the invariant at the only URL-construction point)

**`describe('runLaunchHandshake')`** (stub `child` window object with `postMessage` spy + settable `location.href`; jest fake timers; params include `child`, `launchOrigin`, `legacyAuthorizeUrl`, and a `grantPromise`):
- `posts oauth_launch_start with the grant and legacy authorize URL to the child with explicit targetOrigin after a valid ready message, and resolves 'handoff'`
- `ignores a ready message whose event.source is not the opened child`
- `ignores a ready message whose event.origin differs from the launch origin`
- `navigates the child to the legacy authorize URL and resolves 'legacy' when no ready arrives within LAUNCH_READY_TIMEOUT_MS`
- `navigates the child to the legacy authorize URL and resolves 'legacy' when the grant promise resolves null (mint failed)`
- `removes its message listener after resolving (both outcomes)`

**`describe('pollForCallable')`** (spied `window.fetch` returning connection detail payloads; fake timers; params `{ detailUrl, headers }`):
- `resolves 'callable' as soon as a poll returns a connection with state 'callable'`
- `resolves 'timeout' when the poll budget elapses while state stays 'pending_confirmation'`
- `keeps polling through a failed fetch (transient error) rather than rejecting`
- `stops polling immediately when the returned cancel function is invoked`

### Success Criteria:

#### Automated Verification:
- `yarn test --no-watch test/oauth-grant-handoff` fails only with "cannot find module" / missing exports; all other suites unaffected.

#### Manual Verification:
- Every branch listed in Phase 3's implementation notes has exactly one named test above.

### Session Completion
1. Commit: `git add -A && git commit -m "Phase 2: unit tests for grant-handoff utils (TDD - RED)"` (+ `Co-Authored-By`).
2. Progress JSON: phase 2 → "complete", `current_phase` → 3.
3. `git status` clean.

---

## Phase 3: Implement Grant-Handoff Utils (TDD - GREEN)

### Overview

Create `src/utils/oauthGrantHandoff.ts` making Phase 2 green. Pure functions, no React context access (mirrors `oauthCsrf.ts`).

### Changes Required:

#### 1. `src/utils/oauthGrantHandoff.ts` (new)
- `mintGrant(params)` — `fetch` POST like `callConfirmEndpoint` (`src/utils/oauthCsrf.ts:26-56`) but returns `string | null`; any non-2xx or thrown error → `null` (fallback signal, never a throw — a failed mint must degrade, not break, the click).
- `deriveLaunchUrl(session, serviceId)` — `new URL(session?.redirect_uri ?? REDIRECT_URL).origin + OAUTH_LAUNCH_PATH` + `?service_id=` (non-secret correlation only). Also export `deriveLaunchOrigin` (or return both) for the handshake's origin pin.
- `runLaunchHandshake(params): Promise<HandshakeOutcome>` — arms its own `message` listener; on `oauth_launch_ready` with `event.source === child && event.origin === launchOrigin`, awaits `grantPromise`; grant present → `child.postMessage({ type: 'oauth_launch_start', grant, authorizeUrl }, launchOrigin)` → `'handoff'`; grant `null` or `LAUNCH_READY_TIMEOUT_MS` elapsed → `child.location.href = legacyAuthorizeUrl` → `'legacy'`. Always removes its listener and clears its timer on resolve.
- `pollForCallable(params): { promise: Promise<PollOutcome>; cancel: () => void }` — `setInterval` at `CALLABLE_POLL_INTERVAL_MS` fetching `detailUrl` with `headers`; `data.state === 'callable'` → `'callable'`; budget `CALLABLE_POLL_BUDGET_MS` exhausted → `'timeout'`; fetch errors swallowed (keep polling); `cancel()` clears everything.
- Module doc comment linking the two research docs and stating the invariants: grant never in a URL; handshake is the only delivery channel; legacy path remains as fallback.

### Success Criteria:

#### Automated Verification:
- `yarn test --no-watch` — full suite green (Phase 2 tests pass; nothing else touched).
- `tsdx build`, `tsdx lint` pass.
- `grep -rn "grant" src/ | grep -i "searchParams\|\?grant\|&grant"` returns nothing (no URL carries a grant).

#### Manual Verification:
- Confirm `runLaunchHandshake` performs no `window.open` itself — opening stays synchronous at the call sites.

### Session Completion
1. Commit: `git add -A && git commit -m "Phase 3: grant-handoff utils (TDD - GREEN)"` (+ `Co-Authored-By`).
2. Progress JSON: phase 3 → "complete", `current_phase` → 4.
3. `git status` clean.

---

## Phase 4: Integration Tests for Both Flow Sites (TDD - RED)

### Overview

Extend `test/authorize-button.test.tsx` and `test/connection-actions.test.tsx` to the new flow. The `window.open` spy must return a stub child (`postMessage` spy, settable `location.href`, mutable `closed`) — extend the existing spy setup. These fail until Phase 5 wires the components. One named test per new branch, mirrored across both files unless noted:

### Changes Required:

#### 1. `test/authorize-button.test.tsx`
- `opens the popup to the launch URL synchronously on click, before the grant mint resolves` (assert `window.open` called with `{launchOrigin}/oauth/launch?service_id=...` and standard window features while the mint fetch is still pending)
- `still mints the grant with a POST to .../grant carrying the JWT headers`
- `on oauth_launch_ready from the child at the launch origin: posts oauth_launch_start with grant + legacy authorize URL (containing &nonce=) and explicit targetOrigin`
- `when the grant mint returns non-2xx: navigates the popup to the legacy authorize URL and the legacy oauth_complete → /confirm path still works end-to-end`
- `when no oauth_launch_ready arrives within LAUNCH_READY_TIMEOUT_MS: navigates the popup to the legacy authorize URL` (fake timers)
- `legacy oauth_complete received after a completed handoff handshake: still POSTs /confirm exactly once (popup-side fallback; no double confirm with the poller)`
- `on popup close after handoff without oauth_complete: polls the connection detail URL and, on state=callable, mutates and fires onConnectionChange without an error toast`
- `on popup close with the connection stuck pending_confirmation: shows an actionable error toast after the poll budget, never a silent success`
- `on oauth_error: toasts, does not confirm, and does not start the callable poll`
- Preserved-behavior updates: the existing `oauth_complete → /confirm`, foreign-`serviceId`, grace-period, and no-double-confirm tests are updated only where the opened URL changed (launch URL instead of authorize URL) — their assertions about `/confirm` semantics stay identical.

#### 2. `test/connection-actions.test.tsx`
- Mirror all of the above for `handleRedirect` (re-authorize path), plus:
- `revoke/disconnect: opens the revoke URL directly — no grant mint, no handshake listener, no callable poll` (the new options are absent at revoke call sites)

### Success Criteria:

#### Automated Verification:
- `yarn test --no-watch` — the new specs fail for the expected reason (components still open the authorize URL directly); Phase 2/3 suites stay green.

#### Manual Verification:
- Each edge case in Implementation Approach § Edge cases maps to at least one named test.

### Session Completion
1. Commit: `git add -A && git commit -m "Phase 4: integration tests for grant handoff flows (TDD - RED)"` (+ `Co-Authored-By`).
2. Progress JSON: phase 4 → "complete", `current_phase` → 5.
3. `git status` clean.

---

## Phase 5: Wire Components (TDD - GREEN)

### Overview

Wire the utils into both flow sites and update the two re-authorize call sites. Revoke paths untouched.

### Changes Required:

#### 1. `src/components/AuthorizeButton.tsx`
- Import the three utils + constants; keep everything about the legacy listener (`:122-173`) intact.
- In `authorizeConnection`: build the legacy authorize URL exactly as today (nonce included, `:104-107`); `window.open(deriveLaunchUrl(...))` synchronously (`:176-180` window-features string unchanged); start `mintGrant` in parallel (do not await before opening); run `runLaunchHandshake` with the child, pinned launch origin, legacy URL, and grant promise.
- Replace the body of the close-poller's post-grace branch (`:182-193`): instead of blind `handleChildWindowClose()`, if not `completed`, run `pollForCallable` against the existing detail URL/headers (both already in scope for `callConfirmEndpoint`, `:144-150`); `'callable'` → existing mutate + `onConnectionChange` path; `'timeout'` → error toast ("Authorization was not completed — please retry"); either way `cleanup()`.
- `cleanup()` additionally cancels an in-flight poll and the handshake listener/timer.
- `completed` flag set by the legacy `oauth_complete` confirm as today — the poller checks it before starting (prevents double reporting).

#### 2. `src/utils/connectionActions.ts`
- `handleRedirect(url, onConnectionChange)` gains an optional third param, e.g. `grantHandoff?: { unifiedApi: string; serviceId: string }`. Absent (revoke call sites) → today's behavior byte-for-byte. Present → same open/mint/handshake/poll sequence as `AuthorizeButton` (`connectionActions.ts:163-180` region).

#### 3. `src/components/TopBar.tsx` (`:240-244`) and `src/components/ButtonLayoutMenu.tsx` (`:98-105`, `:286-293`)
- Pass the new `grantHandoff` context at the re-authorize call sites (both have the connection in scope). Revoke call sites (`TopBar.tsx:327`, `ButtonLayoutMenu.tsx:351-354`) unchanged.

### Success Criteria:

#### Automated Verification:
- `yarn test --no-watch` — full suite green.
- `tsdx build`, `tsdx lint` pass.

#### Manual Verification:
- Example app: authorize an OAuth connector — popup opens on the launch URL; with no launch page deployed the popup lands on the legacy authorize URL within ~3 s and the flow completes as before.

### Session Completion
1. Commit: `git add -A && git commit -m "Phase 5: wire grant handoff into authorize flows (TDD - GREEN) Ref #9546"` (+ `Co-Authored-By`).
2. Progress JSON: phase 5 → "complete", `current_phase` → 6.
3. `git status` clean.

---

## Phase 6: Verify Full Suite (TDD - GREEN verification)

### Overview
Whole-suite verification; fix any fallout.

### Changes Required:
- No planned changes. Run: `yarn test --no-watch`, `tsdx build`, `tsdx lint`.
- Invariant greps: grant never URL-carried (Phase 3 grep); `grep -rn "sessionStorage" src/` still returns nothing (the widget side never touches storage — only vault's launch/callback pages do, in their repo).

### Success Criteria:

#### Automated Verification:
- All three commands green; both greps clean.

#### Manual Verification:
- Manual matrix in the example app: (a) happy path with a stubbed launch page, (b) mint-failure fallback, (c) ready-timeout fallback, (d) popup closed mid-flow → actionable toast after poll budget.

### Session Completion
1. If fixes were needed: commit `git add -A && git commit -m "Phase 6: verification fixes"`; else no commit.
2. Progress JSON: phase 6 → "complete", `current_phase` → 7.
3. `git status` clean.

---

## Phase 7: Cleanup (TDD - REFACTOR)

### Overview
Tidy while green; reduce the duplication the wiring added.

### Changes Required:
- Extract any now-identical open/mint/handshake/poll sequence shared by `AuthorizeButton.tsx` and `connectionActions.ts` into a helper in `oauthGrantHandoff.ts` **if** it falls out naturally — do not force a full flow merge (out of scope).
- Ensure module doc comments state the fallback ladder and the deployment-order dependency (unify → vault → vault-core release).
- Confirm no dead imports/constants; toast copy reviewed for actionability.

### Success Criteria:

#### Automated Verification:
- `yarn test --no-watch`, `tsdx build`, `tsdx lint` all green.

#### Manual Verification:
- Diff review: no behavioral change vs. Phase 5.

### Session Completion
1. Commit: `git add -A && git commit -m "Phase 7: cleanup after grant handoff wiring (TDD - REFACTOR)"` (+ `Co-Authored-By`).
2. Progress JSON: phase 7 → "complete".
3. `git status` clean.

---

## Testing Strategy

**Follow TDD (red-green-refactor).** Component A (utils) and Component B (flow wiring) each get a paired RED/GREEN cycle; every new `if`/timeout/error branch has a named test (enumerated in Phases 2 and 4).

### Unit (`test/oauth-grant-handoff.test.ts`)
`mintGrant` (2xx / non-2xx / rejection), `deriveLaunchUrl` (session-derived / fallback origin / grant-free invariant), `runLaunchHandshake` (handoff, wrong-source, wrong-origin, ready-timeout, null-grant, listener teardown), `pollForCallable` (callable, timeout, transient fetch error, cancel).

### Integration (`test/authorize-button.test.tsx`, `test/connection-actions.test.tsx`)
Synchronous launch-URL open; parallel mint; grant delivery with pinned targetOrigin; both legacy fallback triggers keep the full legacy confirm working; popup-side fallback confirm after handoff without double-confirm; poll success (no toast) and poll timeout (actionable toast); `oauth_error` skips confirm and poll; revoke path completely untouched; preserved legacy suite (foreign serviceId, grace period, no double confirm) updated only for the changed opened-URL assertion.

### Manual
1. `example/storage-roundtrip/` remains the design's mechanism harness (GO recorded); the example app is the wiring harness.
2. Full matrix per Phase 6: happy path, mint-fail fallback, timeout fallback, abandoned-flow toast.
3. Cross-browser spot check once vault's launch page exists: Chrome, Firefox, Safari (note Safari cannot load literal-IPv6 URLs — use `127.0.0.1` in local harnesses).

## Migration & Rollout Notes

- **Deployment order is load-bearing**: unify (grant endpoints) → vault (launch page + callback self-confirm) → vault-core release. Shipping vault-core first is safe only because of the ready-timeout fallback — every click would pay the ~3 s timeout, so don't.
- **Purely additive**: older vault deployments (no launch page) and unify rollback (grant endpoint gone) both degrade automatically to today's flow per click; no stored client state, no migration.
- **Security invariants (non-negotiable in review)**: grant never in any URL; launcher never proceeds without a completed opener handshake; no server-side grant parking keyed to OAuth state; `window.open` stays synchronous in the click handler; fallback ladder is sessionStorage self-confirm → legacy opener postMessage → loud error.

## References

- Problem & requirements: `thoughts/shared/research/2026-07-14-oauth-confirm-iframe-context.md`
- Design + sequence diagrams: `thoughts/shared/research/2026-07-16-oauth-confirm-handoff-sequence-diagrams.md`
- Go/no-go evidence: `example/storage-roundtrip/README.md` (GO on Blink, Gecko, WebKit)
- Failure repro: `example/opener-severed-confirm/`
- Baseline plan (landed on this branch): `thoughts/shared/plans/2026-06-19-GH-9546-drop-client-nonce-storage.md`
- Current flow: `src/components/AuthorizeButton.tsx:57-195`, `src/utils/connectionActions.ts:36-182`, `src/utils/oauthCsrf.ts:22-56`, `src/utils/useConnections.tsx:90-119`, `src/constants/urls.ts:1-2`
