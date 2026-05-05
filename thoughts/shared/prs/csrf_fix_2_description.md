**Related Issue**: [GH-9546](https://github.com/apideck-io/unify/issues/9546)

> _Note: this description was drafted before the PR was opened. No `thoughts/shared/pr_description.md` template exists in the repo, so the structure below is a sensible default — replace section ordering as the team prefers._

## Summary

- Adds the **client (receiver) side** of the OAuth CSRF handshake that already shipped in [unify `30812f60`](https://github.com/apideck-io/unify/commit/30812f607bd1c3ecd570d7074820b9e812d0341a) and [vault `a498117d`](https://github.com/apideck-samples/vault/commit/a498117d4be4e59bd50d19a569e2c712aed6915c). Without this PR, allowlisted accounts in unify never complete the new two-step authorize → confirm flow when authorizing through `@apideck/react-vault`.
- Generates a per-service-id nonce on every authorize click, listens for `oauth_complete` / `oauth_error` postMessages from the vault callback page, and `POST`s to the new `/{api}/{service}/confirm` endpoint to mark the credential trustworthy.
- **Fully backwards-compatible**: non-allowlisted accounts and older unify deployments fall through to the existing `child.closed` poll path. No public API changes; no consumer-side migration needed.

## Why this change

unify GH-9546 splits OAuth completion into two steps for accounts on the `oauthCsrf` allowlist:

1. `GET /vault/authorize?...&nonce=…` — opener generates a one-shot nonce (sessionStorage-bound, per service id).
2. unify's callback returns to vault as `…#nonce=…&confirm_token=…&service_id=…`. The vault callback page postMessages the opener.
3. Opener verifies the nonce (one-shot — cleared regardless of match), then `POST`s `/vault/connections/{api}/{service}/confirm` with the `confirm_token`. unify only marks `credentials.confirmed = true` after this call lands.

Until `/confirm` is called, `connection.health` is `'pending_confirmation'` and `state` stays at `'authorized'` (not `'callable'`). vault and unify are already deployed; vault-core was the missing client piece.

## What changed

### New files
- `src/utils/oauthCsrf.ts` — `generateAndStoreNonce`, `verifyAndClearNonce` (one-shot; clears regardless of match, mirroring `vault/src/utils/oauthCsrf.ts`), `clearNonce`, `callConfirmEndpoint`.
- `src/types/OAuthCsrf.ts` — `OAuthCompleteMessage`, `OAuthErrorMessage`, `OAuthPostMessage`, `ConfirmResponse`.

### Modified
- `src/types/Connection.ts` — adds `ConnectionHealth` union (`'ok' | 'pending_refresh' | 'needs_auth' | 'needs_consent' | 'revoked' | 'missing_settings' | 'pending_confirmation'`) and optional `Connection.health` field.
- `src/components/StatusBadge.tsx` — yellow "Pending confirmation" badge when `health === 'pending_confirmation'`. Takes precedence over the `state`-based switch but yields to `consent_state` checks (matches unify's priority order).
- `src/components/AuthorizeButton.tsx` — popup branch now generates a nonce, appends `&nonce=` to the authorize URL, registers a `message` listener (with type + serviceId guards), `POST`s `/confirm` on success, and adds a 1000 ms grace window after `child.closed` so postMessage handling can finish before the existing fallback `mutate` runs. Cleanup is paired in every code path (success, error, popup-closed-no-message, component unmount).
- `src/utils/connectionActions.ts` — same listener + grace logic added to `useConnectionActions.handleRedirect`'s popup branch (re-authorize flow). The `client_credentials` / `password` token-grant branch is untouched.
- `src/components/TopBar.tsx`, `src/components/ButtonLayoutMenu.tsx` (×2 sites) — append `&nonce=` to authorize URLs at click time. Revoke URLs are unchanged.
- `src/utils/i18n.ts` — translations for `Pending confirmation`, `Could not confirm authorization`, `Authorization failed` in en / nl / fr / de / es.

### Tests (27 new cases across 4 files)
- `test/oauth-csrf.test.ts` (new, 9 cases) — nonce gen / one-shot verify / clear / `callConfirmEndpoint` URL + headers + body + error.
- `test/status-badge.test.tsx` (new, 5 cases) — pending_confirmation rendering, palette, precedence, no regression.
- `test/authorize-button.test.tsx` (extended, +7 cases) — nonce-on-URL, oauth_complete → /confirm, oauth_error toast, foreign serviceId ignored, nonce mismatch, child.closed grace, no double-confirm.
- `test/connection-actions.test.tsx` (new, 6 cases) — same surface for `handleRedirect`.

## Out of scope (intentional)

- **No `event.origin` verification** in the postMessage handler. `react-vault` is a library deployed to consumer-controlled origins, and `redirect_uri` is per-session — no fixed trusted origin exists. The nonce (sessionStorage-bound, per-service-id) is the actual CSRF defense; `type` and `serviceId` are still filtered for correctness. Documented in the plan's "What We're NOT Doing".
- **No POST `/authorize`**. unify shipped the GET-with-`?nonce=` design; the earlier abandoned vault-core attempt referenced a `callAuthorizeEndpoint` POST that no longer exists in unify.
- **No nonce on revoke URLs**. Revoke is unrelated to GH-9546.
- **No refactor of the two popup-flow sites into a shared hook.** Bail criteria from the plan's Phase 11 met (different state setters and connection-source ownership). Documented in `thoughts/shared/progress/...status.json`.
- **No `client_credentials` / `password` grant changes** — those POST `/token` directly without a popup; CSRF-irrelevant.

## Backwards compatibility

| Scenario | Behaviour |
|---|---|
| Account NOT in `oauthCsrf` allowlist | unify ignores the nonce. Callback returns plain redirect. Existing `child.closed` poll runs `mutate`. **Identical UX to today.** |
| Account in allowlist running an older `@apideck/react-vault` (no nonce sent) | unify's `nonce && csrfEnabled` gate fails closed → plain redirect → same fallback. Same as today. |
| Account in allowlist + this PR | Full nonce → postMessage → /confirm path. New behaviour. |
| OAuth error in popup | `oauth_error` postMessage triggers a toast and refresh; `child.closed` fallback also runs after 1000 ms grace. |

Component public API (`<Vault>` props, `onConnectionChange` callback shape) is unchanged. No consumer code changes required. iframe-vault picks up the fix on next `npm install`.

## How to verify it

### Automated (run from repo root)

- [x] `yarn tsdx test --no-watch` — **10 suites, 59 tests, all passing** (was 32 on `main`).
- [x] `yarn tsdx build` — succeeds, types clean.
- [ ] `yarn tsdx lint` — **broken at project level**, unrelated to this PR. `eslint-plugin-prettier` is missing from `node_modules` (referenced by tsdx's eslint config). Pre-existing. Recommend a follow-up to either reinstall the dependency or remove the prettier plugin from the lint config.

### Manual (requires staging credentials — left for reviewer)

Allowlisted account on staging (e.g., `22222222`):
- [ ] Authorize a fresh OAuth connector → popup loads `/vault/authorize/...` with `&nonce=…`.
- [ ] Complete consent → popup closes → connection shows "Connected" within ~1 s. (Briefly may show yellow "Pending confirmation" pill.)
- [ ] Network tab: `POST /vault/connections/{api}/{service}/confirm` with `{"confirm_token":...}` body, response `data.confirmed: true`.
- [ ] SessionStorage inspector: `apideck_oauth_nonce_{serviceId}` is gone after success.

Non-allowlisted account:
- [ ] Same flow → popup closes → "Connected" after ~1.5 s grace. **No** `/confirm` call. No regression vs current production.

Error path (allowlisted):
- [ ] Cancel consent → vault postMessages `oauth_error` → toast appears with the error description → connection stays in previous state.

## Changelog entry

> Add OAuth CSRF nonce/confirm handshake on the authorize popup flow for accounts on unify's `oauthCsrf` allowlist. Backwards-compatible — non-allowlisted accounts continue to use the existing `child.closed` fallback. Adds `Connection.health` field and a "Pending confirmation" status badge.

## Suggested commit-message / PR title

`feat(oauth): add OAuth CSRF nonce + /confirm handshake (Ref #9546)`

## References

- Plan: `thoughts/shared/plans/2026-05-05-GH-9546-csrf-fix-vault-core.md`
- Research: `thoughts/shared/research/2026-05-05-GH-9546-csrf-fix-vault-core.md`
- Cross-repo: unify [`30812f60`](https://github.com/apideck-io/unify/commit/30812f607bd1c3ecd570d7074820b9e812d0341a), vault [`a498117d`](https://github.com/apideck-samples/vault/commit/a498117d4be4e59bd50d19a569e2c712aed6915c)
