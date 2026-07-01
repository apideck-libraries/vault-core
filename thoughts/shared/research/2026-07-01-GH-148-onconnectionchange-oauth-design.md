---
github_issue_url: https://github.com/apideck-libraries/vault-core/issues/148
status: design
package: "@apideck/react-vault"
version_at_analysis: 0.20.5
---

# GH-148 — Reliable `onConnectionChange` after OAuth + popup-blocker handling — Design

**Related Issue**: [GH-148](https://github.com/apideck-libraries/vault-core/issues/148) — "onConnectionChange never fires callable/authorized after successful OAuth (single-connection mode); autoStartAuthorization popup blocked on mount"

**Reported against**: `@apideck/react-vault` v0.20.5 (also v0.20.4). Surfaced downstream through `@apideck/vault-js` and `@apideck/vault-react`.

---

## Problem Summary

Two independent defects, both reproduced with QuickBooks Online (unified API `accounting`, service `quickbooks`) in single-connection mode with `autoStartAuthorization: true`.

1. **Bug 1 — `onConnectionChange` never fires with the post-OAuth `callable`/`authorized` state.** The connection *does* become authorized (modal flips to "Connected", backend confirms), but the consumer's callback only ever receives the earlier `added` event. Consumers gating `ApideckVault.close()` / "proceed" logic on reaching `callable` are stuck.

2. **Bug 2 — `autoStartAuthorization` opens the OAuth window from an on-mount effect with no user gesture.** Popup blockers silently block it; the button then sticks in a permanent loading state and no event ever fires. This is the "works one attempt, not the next" inconsistency.

---

## Verified Root Cause

### Bug 1: the post-OAuth emit lives on a component that unmounts exactly when it should fire

- The only post-OAuth emitters of `onConnectionChange` are in `AuthorizeButton.tsx` (lines 52, 86, 166) and `connectionActions.ts` (lines 68, 94, 153).
- `AuthorizeButton` is rendered only when `shouldShowAuthorizeButton` is true, which requires `state !== 'callable'` (`ConnectionDetails.tsx:104-109`).
- When OAuth succeeds, SWR revalidation (on popup close / window focus — `connectionDetails` uses default `revalidateOnFocus`) updates the connection to `callable`. `shouldShowAuthorizeButton` flips to `false`, React unmounts `AuthorizeButton`, and its unmount effect (`AuthorizeButton.tsx:42-46`) runs `cleanup()` → `removeEventListener('message', handler)` + `clearInterval`/`clearTimeout`. Whichever emit path (postMessage handler or grace-period fallback) was pending is cancelled.
- Net: **the "connection is now usable" notification is bound to the lifecycle of a component that unmounts at the moment that notification should fire.**

The `added` event the customer sees comes from the single-connection auto-enable effect (`useConnections.tsx:138-155`) PATCHing `{enabled:true, quiet:true}` → emit at `useConnections.tsx:398`. That works precisely because it lives in the provider, which does **not** unmount on the view switch.

### Bug 2: non-gesture `window.open` + no blocked-popup detection

- `AuthorizeButton.tsx:198-202` calls `authorizeConnection()` from a mount effect when `autoStartAuthorization` is set. That calls `window.open(...)` (line 176) with no user gesture.
- When blocked, `window.open` returns `null`. The close-poll checks `child?.closed` (line 183) on a `null` child (forever falsy), so `handleChildWindowClose`/`cleanup` never run, `isLoading` stays `true`, and the button is stuck and unclickable. The `message` listener also leaks until unmount.
- Same shape exists in `connectionActions.ts` `handleRedirect` (window.open at line 163).

## Key Discoveries That Shape the Fix

- **`ConnectionsProvider` already receives `onConnectionChange` directly** (`Vault.tsx:198` → `useConnections.tsx:59,73`), on a separate prop branch from the `ModalContent → ConnectionDetails → AuthorizeButton` drilling. No new plumbing is needed to emit from the provider.
- The provider already derives `connection` and `prevConnection` via `usePrevious` (`useConnections.tsx:121-125`) and already runs effects on `[connection]` (lines 138-155, 157-172). It is the natural, stable home for a state-transition emitter.
- `ConnectionState` union: `'available' | 'added' | 'authorized' | 'callable' | 'invalid'` (`types/Connection.ts`).
- Existing OAuth test harness to extend: `test/authorize-button.test.tsx` (postMessage → confirm → mutate, grace-period fallback, double-confirm guard) and `test/connection-actions.test.tsx`.

---

## Chosen Approach

### Bug 1 — Emit from the provider on state transition into `callable`

Add a single emitter in `ConnectionsProvider` that fires `onConnectionChange(connection)` when a connection transitions **into** the usable `callable` state, and remove the fragile post-OAuth emits from `AuthorizeButton`. This makes the emission independent of any button's lifecycle and robust to *every* update path (postMessage `mutate`, grace-period fallback, or plain `revalidateOnFocus` — confirmed: the details SWR at `useConnections.tsx:115-119` uses SWR's default `revalidateOnFocus: true`, and there is no global `<SWRConfig>` overriding it).

**Why `callable` only, not `authorized` (decided during spec review):** `authorized` means "OAuth done but configuration still required" — `StatusBadge` renders it as "Input required" / "Needs configuration", and such a connection is **not yet usable**. Emitting on `authorized` would let a consumer that gates `ApideckVault.close()` on "authorized *or* callable" (exactly what this customer describes) close the modal before a form-field connection is actually usable. `callable` is the unambiguous "now usable" signal and is precisely what the reported bug is missing. Form-field connections already get their `callable` event today via `updateConnection` on settings-save (`useConnections.tsx:398`); the provider effect adds the missing case where `callable` is reached directly from OAuth with no settings PATCH (the QBO scenario).

**Robustness note:** the report says the modal UI flips to "Connected" on success — that is itself proof `connection.state` reached `callable` inside the provider. A provider-level effect keyed on that state is therefore guaranteed to observe the transition, whereas the button-bound listener may already be torn down.

**Dedup design (a `useRef` keyed on `id:state`, updated by every emit path):**

```
lastEmittedRef = useRef<string | null>(null)   // `${id}:${state}` last emitted, by ANY path

// In updateConnection, right where it already emits (useConnections.tsx:398):
onConnectionChange?.(result.data)
lastEmittedRef.current = `${result.data.id}:${result.data.state}`

// New provider effect (runs on [connection]):
const c = connection
if (!c?.id) return
if (c.state !== 'callable') return                  // callable is the "now usable" signal
const key = `${c.id}:callable`
if (lastEmittedRef.current === key) return          // already emitted for this connection
if (prevConnection?.id !== c.id) {                  // first sighting of this connection
  lastEmittedRef.current = key                      // record, do NOT emit (avoids firing on opening an already-callable connection)
  return
}
onConnectionChange?.(c)
lastEmittedRef.current = key
```

Why this behaves correctly across scenarios:

| Scenario | Result |
|---|---|
| Fresh connect, no form fields: `added → callable` (QBO bug) | prev.id matches, `id:callable` not yet emitted → **emit callable** ✅ |
| Fresh connect, form fields: `added → authorized → callable` | `authorized` intentionally not emitted (not yet usable); `callable` emitted by `updateConnection` on settings-save, or by the effect if reached directly ✅ |
| Settings-save produces callable | `updateConnection` emits callable + sets ref → effect sees same key → **no double** ✅ |
| Settings-save while already callable (no state change) | `updateConnection` emits (settings event preserved); callable key already recorded → effect stays silent ✅ |
| Opening an already-`callable` connection | prev.id ≠ id on first sighting → recorded, **no spurious emit** ✅ |
| Switching between connections (multi-conn mode) | prev.id ≠ id → no false emit ✅ |

**Keep** the `connectionActions.ts` re-authorize emits (68, 94, 153). Re-authorizing an already-`callable` connection stays `callable` → the effect's `callable` key is already recorded → the provider effect stays silent, so those emits are still needed and do not double-fire. (Benign edge: manually re-authorizing an `authorized`-not-yet-`callable` connection that then flips to `callable` could emit once from both `connectionActions` and the provider effect; acceptable, and documented. If we want it airtight later, expose the emit+dedup helper via context so `connectionActions` shares the same `lastEmittedRef`.)

### Bug 2 — Detect a blocked popup, unstick the button, surface a toast

We cannot make a non-gesture `window.open` bypass popup blockers — that is a browser rule and out of our control. But we can convert "stuck forever" into "recoverable": after `window.open(...)`, if the returned handle is `null`, show an error toast telling the user to allow popups and click again, run `cleanup()` (resets `isLoading`, removes the leaked listener), and return. A subsequent manual click *is* a user gesture, so the retry works.

Apply the same guard in both `AuthorizeButton.authorizeConnection` (after line 176) and `connectionActions.handleRedirect` (after line 163). `autoStartAuthorization` keeps its current behavior but degrades gracefully instead of hanging.

New i18n strings (added to all 5 locales in `utils/i18n.ts`): a "Popup blocked" title + "Please allow popups and click Authorize again." description (final copy TBD during implementation).

**Out of scope (noted, not built now):** a distinguishable public callback (e.g. `onAuthorizationBlocked`) so consumers can react programmatically. That is a public-API addition and a separate decision; the toast + unstick is the core recovery.

---

## Testing Strategy (TDD)

- **Bug 1 (RED first):** a test that mounts the provider tree with an unauthorized single-connection, simulates OAuth completion (postMessage + confirm, reusing the `authorize-button.test.tsx` harness) so the connection becomes `callable` and `AuthorizeButton` unmounts, and asserts `onConnectionChange` is called with `state: 'callable'`. Add: (a) no-double-fire when settings-save yields callable; (b) no spurious emit when opening an already-`callable` connection; (c) a connection reaching `authorized` (needs-config) does **not** emit until it becomes `callable`.
- **Bug 2 (RED first):** mock `window.open` to return `null`; assert `isLoading` resets, an error toast is shown, and no listener leaks. Cover both `AuthorizeButton` and `connectionActions`.
- Full `tsdx test` + `tsdx lint` green.

## What We're NOT Doing

- Not changing the iframe/`postMessage` event bridge in `vault-js`/`vault-react` (separate repos; see Dependencies).
- Not adding a new public callback for blocked popups in this pass.
- Not emitting a separate `authorized` (needs-configuration) event — only the `callable` "now usable" transition (see rationale above).
- Not adding an "auto-open directly into Re-authorize" affordance (possible future feature; see customer Q4).
- Not altering the OAuth CSRF confirm flow.

## Dependencies / Follow-ups

- **iframe event bridge:** This fix is in vault-core, but the reporting customer is on `vault-js`/`vault-react`, which render this inside an iframe and forward events via `postMessage`. The corrected `callable` emit only reaches them if that bridge forwards whatever `onConnectionChange` emits. Since the `added` event already reaches them, it almost certainly does — to be verified on the vault-js/vault-react side.

---

## Customer-Facing Answers (for support relay)

1. **Should `onConnectionChange` emit `callable` after OAuth?** Yes. It was a bug; fixed by the provider-level emitter above. Gate your logic on `state === 'callable'` (the "now usable" state). Note: `authorized` is a "needs configuration" step for connections that require extra settings and is intentionally *not* signalled as usable — wait for `callable`.
2. **Reliable signal without polling?** (a) After this fix, the client-side `onConnectionChange` `callable` event. (b) Server-side, **Apideck Vault connection webhooks** are the canonical no-polling signal (confirm exact event name with the team). Their interim workaround — a single `GET /vault/connections/{unified_api}/{service_id}` on `onClose` — is fine.
3. **Auto-close on success?** No, by design. Recommended pattern once the event is reliable: on `onConnectionChange` reaching `callable`, call `ApideckVault.close()`. (Vault is open-source on the Vault API if they want a fully custom flow — mention as an option, likely overkill.)
4. **Reconnecting a revoked connection?** No delete needed. Vault already exposes a **"Re-authorize"** action (TopBar + button-layout menu) whenever `state` is `authorized`/`callable` + oauth + `allow_actions` permits (`TopBar.tsx:213-244`, `ButtonLayoutMenu.tsx:263-293`). Caveat: it is a manual menu action — `autoStartAuthorization` will not auto-trigger re-auth (it is gated to `state !== 'callable'`), which is why they fell back to delete+reopen. Auto-opening into re-auth would be a small feature enhancement, not a bug.
