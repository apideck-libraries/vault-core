---
status: implemented
related_research: /Users/geisermenoia/orca/workspaces/unify/gh-9546-plan/thoughts/shared/research/2026-10-26-GH-9546-oauth-csrf-current-state-and-handoff.md
---

# GH-9546 G3 vault-core: registered-origins client (react-vault 0.24.0)

**Related Issue**: [GH-9546](https://github.com/apideck-io/unify/issues/9546) (OAuth CSRF / connection hijack, gate G3, vault-core part)

**Pattern Decisions**:

- Pure helper module: a new `src/utils/authorizeUrl.ts` with plain exported functions and no React imports, shaped like `src/utils/oauthCsrf.ts:22-56` (`generateNonce`, `callConfirmEndpoint`), so it is unit-tested without rendering, as `test/oauth-csrf.test.ts` does. The new callback constant sits next to `REDIRECT_URL` in `src/constants/urls.ts:1-2`.
- Reaching the sites: `embedOrigin` travels the way `unifyBaseUrl` already does: `Vault` prop (`src/components/Vault.tsx:55-59,117`) → `ConnectionsProvider` prop (`Vault.tsx:203`, `src/utils/useConnections.tsx:61,71`) → context value (`useConnections.tsx:673-674`). The session `redirect_uri` is read from `useSession()` (`src/utils/useSession.tsx:15-25`) as every site does today. A small hook `src/utils/useAuthorizeUrlBuilder.ts` reads both contexts once and returns a builder, so the four sites do not each repeat the plumbing (the hook-in-utils pattern of `useConnectionActions`, `src/utils/connectionActions.ts:13`).
- Listener: the per-flow listener lifecycle stays exactly as it is (`src/components/AuthorizeButton.tsx:101-186`, `connectionActions.ts:99-195`: register before `window.open`, cleanup, blocked-popup reset, 500 ms poll + 1000 ms grace). The only change is one guard at the top of each handler calling a shared predicate in a new `src/utils/oauthMessage.ts`.
- `handleRedirect` keeps its signature `(url, onConnectionChange?)` (`connectionActions.ts:37-40`): it derives the accepted message origin from the `redirect_uri` inside the URL it opens (Implementation Approach).
- Tests: component tests render the real `<Vault>` with a fetch mock and a `window.open` spy (`test/authorize-button.test.tsx:152-236`); `handleRedirect` is tested through the `Host` component (`test/connection-actions.test.tsx:50-123`); session claims come from `tokenWithClaims` (`test/attribution.test.tsx:16-29`), moved into `test/mock.ts` so several files can use it. Messages are dispatched with an explicit `source`: jsdom 16.7.0 (the version `jest-environment-jsdom` ^26 resolves, `package.json:101`) keeps a plain object passed as `source` and returns that same object from `event.source` (checked against the installed jsdom of the main vault-core checkout), so the `fakeChild` returned by the `window.open` spy works as the popup.
- Utilities identified: `generateNonce` (`src/utils/oauthCsrf.ts:22-24`), `getPopupFeatures`, `callConfirmEndpoint`, `useSession`, `useConnections`, `useConnectionActions`.
- Interfaces/Dependencies to update: `Props` of `Vault` (`Vault.tsx:16-97`), `Props` and `ContextProps` of `ConnectionsProvider` (`useConnections.tsx:16-46,50-62`), the README props table (`README.md:151-169`). `package.json` `version` is not changed (`np` bumps it at publish). No new dependency. `src/index.tsx:1` keeps exporting only `Vault`.
- Mandatory Companions: every authorize/re-authorize URL is built by the shared builder (never by string concatenation); every `message` listener calls the shared predicate before reading `event.data`; every new prop has JSDoc and a README row. Phase 2 and Phase 4 each have a grep criterion for these.

## Overview

Make react-vault send the two values unify's registered-origins protection checks, and stop trusting OAuth popup messages from anyone but the popup it opened. Every authorize and re-authorize URL gains `opener_origin` (always `window.location.origin`) and `embed_origin` (a new optional `embedOrigin` prop, defaulting to `window.location.origin`), with a properly encoded `redirect_uri` whose fallback follows the environment of `unifyBaseUrl` instead of always pointing at production. The two popup listeners accept `oauth_complete`/`oauth_error` only when `event.source` is the opened popup and `event.origin` is the origin of the `redirect_uri` that flow sent. This is the vault-core part of gate G3 (unify plan `2026-10-26-GH-9546-registered-origins.md:98-101`); no application may be set to `enforced` until G3 is in production. It ships as react-vault 0.24.0, published by a human with `np`.

## Current State Analysis

- **URL building is copied, not shared.** Four sites concatenate ``${authorize_url}&redirect_uri=${session.redirect_uri ?? REDIRECT_URL}`` (no encoding), parse it with `new URL`, then `searchParams.append('nonce', generateNonce())`:
  - A: `AuthorizeButton.tsx:32-34` (computed at render; `redirect_uri` from `useSession` at `:23-25`), nonce `:96-99`, own `window.open(url.href, '_blank', getPopupFeatures())` at `:164`.
  - B: `ButtonLayoutMenu.tsx:97-106`, the Authorize option's `onClick` → `handleRedirect` (`:105`). Unreachable: the same option sets `customComponent: <AuthorizeButton connection={connection} />` (`:108`) and every render branch prefers `customComponent` (`:483-486`, `:505-511`, `:538-545`).
  - C: `ButtonLayoutMenu.tsx:280-289`, Re-authorize → `handleRedirect` (`:288`).
  - D: `TopBar.tsx:71-73` (computed at render), Re-authorize `onClick` `:239-244` → `handleRedirect` (`:243`).
  - Revoke: `TopBar.tsx:74-76` (used at `:327`) and `ButtonLayoutMenu.tsx:346-349`, same concatenation, no nonce, both through `handleRedirect`.
- **Two consequences of the concatenation.** An `authorize_url` without `?` (the test fixture, `test/authorize-button.test.tsx:27`) turns `&redirect_uri=…` into part of the path. A `redirect_uri` with its own query (`?a=1&b=2`) is split into several top-level parameters. The `searchParams.append('nonce')` call already re-serialises the whole query on every authorize URL today, so switching to `searchParams` for every parameter changes nothing about how the server's own `state` is encoded (`state` is a JWT: base64url segments and dots, which serialise unchanged).
- **Fallback callback is production only.** `REDIRECT_URL = 'https://vault.apideck.com/oauth/callback'` (`src/constants/urls.ts:1`); there is no environment notion besides the `unifyBaseUrl` prop (default `BASE_URL`, `urls.ts:2`, `Vault.tsx:117`). `example/.env.example:8` suggests `https://staging-unify.apideck.com` as a staging base URL; no other repo in the workspace references that host, and the staging unify that platform-api uses is `https://deploy-preview-staging--unify.stagingapideck.com`.
- **Listeners trust any sender.** `AuthorizeButton.tsx:114-159` (registered `:161`) and `connectionActions.ts:121-170` (registered `:172`) read only `event.data`, filter on `type` and `serviceId` (`:122` / `:129`), toast on `oauth_error`, call `callConfirmEndpoint` on `oauth_complete`, and never look at `event.origin` or `event.source`. Earlier plans recorded "no origin check" because white-label callback pages have no fixed origin (`thoughts/shared/plans/2026-06-19-GH-9546-drop-client-nonce-storage.md:66`); deriving the origin from the `redirect_uri` the flow actually sent resolves that.
- **Popup handle.** `window.open` is called after the listener is registered and its result is a local `const child` (`AuthorizeButton.tsx:164`, `connectionActions.ts:175`); `null` (blocked) triggers `cleanup()` (`:170-173` / `:179-182`).
- **Context.** `ConnectionsProvider`'s `contextValue` exposes `unifyBaseUrl` and `connectionsUrl` (`useConnections.tsx:673-674`) and its `useMemo` dependency list (`:679-693`) omits `unifyBaseUrl`. In practice `contextValue` is still recomputed on every render, because the list also contains plain functions rebuilt each render, so a changed prop does reach consumers today; listing the values explicitly is hygiene, not a bug fix.
- **Session.** `Vault` decodes the token with `jwt-decode` (`Vault.tsx:159-175`; invalid → `{}`), `Session.redirect_uri?: string` (`src/types/Session.ts:31`). Clients enforce nothing from token claims.
- **Server contract** (unify branch `feat/GH-9546-oauth-consent-screen`, not merged): authorize reads `state, redirect_uri, scope, nonce, opener_origin, embed_origin` (`AuthorizeConnectionController.ts:72`); under `enforced` the first failing check wins: unregistered `redirect_uri`, then Apideck callback page without `opener_origin`, then unregistered `opener_origin`, then unregistered `embed_origin` (`:418-446`); empty values are skipped (`if (openerOrigin && …)`, `if (embedOrigin && …)`). Apideck origins (`vault.apideck.com` / `vault.stagingapideck.com`, the unify base URL, `vaultjs.apideck.com`) always pass. On `origin/main` the controller reads only `state, redirect_uri, scope, nonce` (`:61`), so the new parameters are ignored, and main never emits a confirm fragment in practice.
- **Tests.** Jest via `tsdx test` (ts-jest with type diagnostics, `testURL: 'http://localhost'`), flat `test/*.test.ts(x)`. `authorize-button.test.tsx` renders `<Vault token="token123">` (invalid JWT → empty session → fallback callback), spies `window.open` to return `fakeChild` (`:196-203`) and dispatches messages with `origin: 'https://vault.apideck.com'` and no `source` (`:256-268`, `:286-297`, `:314-326`, `:342-354`, `:445-457`). `connection-actions.test.tsx` uses `AUTHORIZE_URL_BASE` with `?redirect_uri=http://localhost:3000` (`:23`) and dispatches the same way (`:193-205`, `:223-234`, `:251-263`, `:278-290`, `:424-436`). No test covers re-authorize (C, D) or revoke.
- **Commands.** `yarn lint`, `yarn test`, `yarn build` (`package.json` scripts), `npx tsc --noEmit` (no script; `tsconfig.json` includes only `src`). CI runs lint, `test --ci --coverage`, build (`.github/workflows/main.yml`). Yarn classic lockfile (`yarn.lock` header "yarn lockfile v1"). `node_modules` is not installed in this worktree.
- **Release.** Version commits touch only `package.json`; `np` makes them with the bare version as subject (`bd3c1f4 0.23.2`, tag `v0.23.2`); `0.23.0` was a manual commit `v0.23.0` with tag `v0.23.0`. `postdeploy` dispatches iframe-vault's update workflow (`scripts/triggerSyncWorkflow.js`). Commits: `Ref #…`, never `Closes`, Co-Authored-By trailer, never on `main` (`.claude/CLAUDE.md:38-42`).

## Desired End State

- Every authorize and re-authorize popup URL (sites A, B, C, D) is built by `buildAuthorizeUrl` and carries exactly one each of `redirect_uri`, `nonce`, `opener_origin`, `embed_origin`, plus the server's own parameters unchanged; the path of an `authorize_url` without `?` is preserved.
- `redirect_uri` is the session `redirect_uri` when it is not `null`/`undefined` (sent verbatim, even if it is not a URL), otherwise `https://vault.stagingapideck.com/oauth/callback` when the `unifyBaseUrl` hostname ends with `.stagingapideck.com`, otherwise `https://vault.apideck.com/oauth/callback` (including a missing or malformed `unifyBaseUrl`).
- `opener_origin` is always `window.location.origin`. `embed_origin` is the `embedOrigin` prop verbatim whenever it is a non-empty string (including `'null'`), `'null'` when it is the empty string, else (undefined) `window.location.origin`.
- Both listeners act on a message only when `event.source` is the popup this flow opened and `event.origin` equals the origin of the `redirect_uri` in the URL that popup was opened with. A `redirect_uri` that is missing, ambiguous, not a URL, or not `http(s)` accepts no message. An ignored message changes nothing: the flow still ends through the popup-close refresh. The `type` and `serviceId` filters still apply to accepted messages.
- Revoke URLs are byte-identical to today; their messages are filtered by the same rule.
- `Vault` has an `embedOrigin?: string` prop with JSDoc saying that hosts such as iframe-vault must pass the real embedding origin; README documents `embedOrigin` and `unifyBaseUrl`.
- `package.json` `version` is unchanged (`0.23.2`); `np` makes the 0.24.0 bump when a human publishes. Nothing is tagged, published or pushed.
- Verified by: `yarn lint`, `yarn test`, `npx tsc --noEmit`, `yarn build` (no new failures against the Phase 1 baseline), `grep -rn "&redirect_uri=" src` printing only the two revoke lines, `grep -rn "addEventListener('message'" src` printing two lines whose handlers start with `isMessageFromPopup`, and `grep -n embedOrigin dist/components/Vault.d.ts` printing the prop.

## What We're NOT Doing

- Grant handoff (the server-side flow that would let a non-opener complete a connection); recorded as a separate follow-up in the related research.
- Client-side enforcement from token claims (`oauth_protection_mode` or anything else in the session JWT); unify enforces, the client only sends values.
- The raw-JSON 422 popup gap: under `enforced`, an unregistered value makes unify answer JSON 422 in the popup, the callback page never runs, and the opener gets no message (the popup-close refresh still runs). That is a unify follow-up, not G3.
- Changing revoke/disconnect URLs (`TopBar.tsx:74-76`, `ButtonLayoutMenu.tsx:346-349`): still concatenated, still `REDIRECT_URL` as fallback, no new parameters.
- Publishing: no `np`, no `npm publish`, no tag, no push. A human publishes 0.24.0 with `np` (2FA).
- iframe-vault and Hosted Vault (vault) changes: their own G3 plans. iframe-vault passes the parent's `event.origin` as `embedOrigin`; Hosted Vault posts only to `target_origin`.
- Copying unify's shared matching fixture: there is no client-side validation or matching of registered entries here.
- Validating `embedOrigin` or the session `redirect_uri` on the client: both are sent verbatim and unify decides.
- Removing the unreachable `onClick` of site B: it is updated to the builder so no stale copy remains, but its removal is a separate cleanup.
- Following a session `redirect_uri` that itself redirects to a different origin's callback page: messages from that other origin are ignored (the popup-close refresh still completes the flow; under `enforced` such a connection stays unconfirmed, as the unify plan already warns for app pages).
- `frame-ancestors`, COOP, the consent screen, the `pending_confirmation` UI, and the `client_credentials`/`password` paths.

## Implementation Approach

Build the pure helper first and prove it in isolation, wire it into the four sites, then add the message filter and the public prop, then verify. Each GREEN phase makes exactly its RED phase's tests pass while the rest of the suite stays green.

Key decisions:

- **Accepted origin comes from the URL actually opened.** `messageOriginForPopupUrl(url)` reads `redirect_uri` from the popup URL and returns its origin. Both listeners call it on the exact string they pass to `window.open`, so the accepted origin can never drift from what unify will redirect to, and `handleRedirect` needs no new parameter: the revoke callers, which build their URL themselves, get the same rule for free. Rules: exactly one `redirect_uri` parameter (zero or several → `null`, since unify's parse of duplicates is not ours to guess), parseable as an absolute URL, protocol `http:` or `https:` (a `data:` URL or a custom scheme has the opaque origin `'null'`, which must never be accepted), else `null`. A `null` accepted origin means no message is ever acted on.
- **Both checks, popup first.** `isMessageFromPopup(event, popup, acceptedOrigin)` is true only when `popup` is not `null`, `event.source === popup`, `acceptedOrigin` is not `null`/`'null'`, and `event.origin === acceptedOrigin`. The source check stops other windows on the callback origin (another tab, a frame) from completing this flow; the origin check stops a page the popup has navigated to (provider, attacker-controlled redirect) from speaking for the callback page. The `popup !== null` clause matters: a message with no `source` would otherwise match a blocked popup (`null === null`). The guard runs before any `event.data` read and returns without `cleanup()`, so the listener and the poller keep running and an ignored message leaves the flow to the existing popup-close refresh.
- **URL building with `URL.searchParams.set`.** `buildAuthorizeUrl` parses `authorize_url` with `new URL` and `set`s the four parameters: this preserves the path when there is no `?`, encodes a `redirect_uri` that has its own query or fragment, and replaces a `redirect_uri` already present in `authorize_url` (the `connection-actions` fixture has one) instead of duplicating it. It returns `null` when `authorize_url` is missing or not an absolute URL; callers then open nothing (A also resets its loading state). Today the same input throws from `new URL` after `setIsLoading(true)` and leaves the button spinning.
- **Fallback callback by environment.** `fallbackRedirectUri(unifyBaseUrl)` parses the base URL and returns the staging callback only when the hostname ends with `.stagingapideck.com` (a suffix check on the parsed hostname, so `stagingapideck.com.evil.example` is production); everything else, including `http://localhost:3050` and a malformed value, is production. This mirrors unify's `VAULT_URL` (production → `vault.apideck.com`, elsewhere → `vault.stagingapideck.com`). Local unify development therefore uses the production callback page unless the session sets its own `redirect_uri`.
- **`embedOrigin` verbatim when defined.** Inside iframe-vault `window.location.origin` is `https://vaultjs.apideck.com`, an Apideck origin unify always accepts; defaulting there would turn the embed check off. So any defined non-empty value is sent as is (`'null'` from an opaque parent makes unify reject under `enforced`: fail closed); only `undefined` falls back to `window.location.origin`. An empty string is sent as `'null'`: unify treats an empty `embed_origin` as absent (`if (embedOrigin && …)`, `:441`), so sending `''` would skip the embed check while `opener_origin` (the host's own Apideck origin) passes; `'null'` fails closed instead. A real `MessageEvent.origin` is never empty, so iframe-vault never produces it (it also refuses to render without a non-empty origin), but a host bug must not turn the check off. `opener_origin` is always `window.location.origin`: it names the window that receives the callback message, and the confirm fragment's `target_origin` is built from it.
- **Built at click time.** The builder runs inside the click handlers (and inside A's `authorizeConnection`), not at render, so every popup gets a fresh nonce and the current `embedOrigin`, `unifyBaseUrl` and session. `ConnectionsProvider` lists `embedOrigin` and `unifyBaseUrl` in its `contextValue` dependencies (hygiene: the memo already recomputes every render because of function dependencies, so this is not what makes a prop change visible).
- **Safe against unify main.** unify `origin/main` ignores `opener_origin`/`embed_origin` (`AuthorizeConnectionController.ts:61` on main) and does not forward them to providers, and still redirects to the same callback page, whose messages come from the popup and the `redirect_uri` origin. So 0.24.0 can ship before the unify branch merges; with Hosted Vault's G3 change (errors no longer posted) the success-path behaviour is unchanged too.
- **Rollout.** vault-core merges and a human publishes 0.24.0 → iframe-vault upgrades and passes `embedOrigin` → no application is `enforced` before that is in production (until iframe-vault passes it, react-vault inside iframe-vault reports `https://vaultjs.apideck.com`). `np` computes the next version from `package.json` and makes the bump commit itself, so this plan does not bump the version: the publisher runs `np minor` (0.23.2 → 0.24.0) after the branch merges, and `postdeploy` triggers the iframe-vault update workflow as usual.

## Phases

### Phase 1: Write Tests for Authorize URL Helper (TDD - RED)

**Overview:** Record the baseline on the clean tree, then write unit tests for the three pure functions of `src/utils/authorizeUrl.ts`: URL building, fallback callback selection, and accepted-origin derivation.

**Changes Required:**

- Baseline (before creating any file, on the clean branch head `bd3c1f4`): `yarn install --frozen-lockfile`, then run and record (pass/fail and failing test names) `yarn lint`, `npx tsc --noEmit`, `yarn test`, `yarn build`. Keep the record in the session notes; later phases compare against it. Known baseline (measured 2026-10-28): 13 suites / 77 tests pass, `yarn lint` passes, `npx tsc --noEmit` reports one pre-existing error inside `node_modules/i18next/typescript/t.v4.d.ts` (TS1005); "passes" for tsc below means no error beyond that one.
- `test/authorize-url.test.ts` (new). Imports `buildAuthorizeUrl`, `fallbackRedirectUri`, `messageOriginForPopupUrl` from `../src/utils/authorizeUrl` and `STAGING_REDIRECT_URL`, `REDIRECT_URL` from `../src/constants/urls`. Assertions parse the result with `new URL` and read `searchParams`, never compare whole strings (parameter order is not part of the contract), except where noted.
  - `describe('buildAuthorizeUrl')`:
    - 'keeps the path of an authorize_url without a query and adds the four parameters' (`https://unify.apideck.com/vault/authorize/shopify/abc`: `pathname` stays `/vault/authorize/shopify/abc`)
    - 'keeps the existing state parameter unchanged' (`…?state=eyJhbGciOi.eyJzdWIi.sig-_x`: `searchParams.get('state')` equal to the input value and the serialised URL contains `state=eyJhbGciOi.eyJzdWIi.sig-_x`)
    - 'replaces a redirect_uri already present in authorize_url' (`…?redirect_uri=http://localhost:3000`: `getAll('redirect_uri')` has one value, the resolved one)
    - 'uses the session redirect_uri when present'
    - 'encodes a session redirect_uri that has its own query and fragment' (`https://app.example.com/cb?x=1&y=2#f`: `get('redirect_uri')` returns it verbatim and `has('y')` is false)
    - 'sends a session redirect_uri that is not a URL verbatim' (`not a url`)
    - 'sends an empty session redirect_uri verbatim' (`''`, mirroring unify's `redirect_uri ??`)
    - 'uses the fallback callback page when the session redirect_uri is undefined' (with `unifyBaseUrl` `https://unify.apideck.com` → `REDIRECT_URL`)
    - 'uses the staging callback page when the session redirect_uri is undefined and unifyBaseUrl is staging'
    - 'sets opener_origin to window.location.origin'
    - 'sets opener_origin to window.location.origin even when embedOrigin is given'
    - 'sets embed_origin to embedOrigin when given'
    - "sends embedOrigin 'null' verbatim"
    - "sends an empty embedOrigin as 'null'"
    - 'defaults embed_origin to window.location.origin when embedOrigin is undefined'
    - 'adds a non-empty nonce that differs between calls'
    - 'returns null when authorize_url is null or undefined'
    - 'returns null when authorize_url is not an absolute URL' (`/vault/authorize/x`)
  - `describe('fallbackRedirectUri')`:
    - 'returns the production callback page when unifyBaseUrl is undefined'
    - 'returns the production callback page for https://unify.apideck.com'
    - 'returns the staging callback page for https://deploy-preview-staging--unify.stagingapideck.com'
    - 'returns the production callback page for a host that only contains stagingapideck.com' (`https://stagingapideck.com.evil.example`)
    - 'returns the production callback page for http://localhost:3050'
    - 'returns the production callback page for a malformed unifyBaseUrl' (`not a url`)
  - `describe('messageOriginForPopupUrl')`:
    - 'returns the origin of the Apideck callback page' (`https://vault.apideck.com`)
    - 'returns the origin of the staging callback page'
    - 'returns the origin of a custom callback page, port included' (`https://connect.customer.example:8443/oauth/callback` → `https://connect.customer.example:8443`)
    - 'returns the redirect_uri origin of a URL built by buildAuthorizeUrl' (round trip with a session `redirect_uri`)
    - 'reads the redirect_uri of a revoke URL built by concatenation' (`https://unify.apideck.com/vault/revoke/x/y?state=s&redirect_uri=https://vault.apideck.com/oauth/callback` → `https://vault.apideck.com`)
    - 'returns null when the popup URL has no redirect_uri'
    - 'returns null when the popup URL has more than one redirect_uri'
    - 'returns null when redirect_uri is not a URL'
    - 'returns null for a redirect_uri that is not http or https' (`data:text/plain,x` and `myapp://callback`)
    - 'returns null when the popup URL itself is not a URL'

- `test/authorize-button.test.tsx` (site A, through `<Vault>`; moved here so Phase 2's site wiring has failing tests):
  - 'opens the authorize popup with redirect_uri, nonce, opener_origin and embed_origin' (parse the `window.open` URL: one each of the four parameters, `opener_origin` and `embed_origin` equal `window.location.origin`, `redirect_uri` the production callback page)
  - 'does not open a popup when the connection has no authorize_url' (`authorize_url: null`; `window.open` not called, Authorize clickable again)
- Sites C and D get the same `if (!url) return` guard on the builder's `null`; their null branch is covered by the builder's unit tests (`returns null …`) and recorded here as not separately component-tested. Their parameter wiring is component-tested in Phase 3 (site C through the button layout, site D in `registered-origins.test.tsx`).

**Key Implementation Notes:**

- `window.location.origin` in these tests is jsdom's `http://localhost` (tsdx `testURL`); assert against `window.location.origin` rather than a literal so a location mock cannot break the tests.
- One test per branch of the Phase 2 functions: each `null` return, each fallback outcome, each verbatim rule, the replace-not-append rule.
- Expected outcome: `test/authorize-url.test.ts` FAILS with TS2307 "Cannot find module '../src/utils/authorizeUrl'" (and TS2305 for the missing `STAGING_REDIRECT_URL` export); in `test/authorize-button.test.tsx` exactly the two new tests FAIL on their assertions and all existing tests pass.
- Commit: `test: cover the authorize URL helper (RED)`, body `Ref #9546` and the Co-Authored-By trailer from `.claude/CLAUDE.md:40`.

**Success Criteria:**

Automated:
- [ ] `yarn test authorize-url` fails with "Cannot find module" for `test/authorize-url.test.ts`
- [ ] `yarn test authorize-button` reports exactly the two new tests failing
- [ ] `yarn lint` passes (or matches the baseline)

Manual:
- [ ] The baseline record exists and names any failure already present before this phase.

### Phase 2: Authorize URL Helper at All Authorize Sites (TDD - GREEN)

**Overview:** Implement the helper, carry `embedOrigin` through `ConnectionsProvider`, and build the URL with it at sites A, B, C and D, until every Phase 1 test passes and the existing suite still does.

**Changes Required:**

- `src/constants/urls.ts` - add `STAGING_REDIRECT_URL = 'https://vault.stagingapideck.com/oauth/callback'` and `STAGING_HOST_SUFFIX = '.stagingapideck.com'` next to `REDIRECT_URL` (`:1`).
- `src/utils/authorizeUrl.ts` (new) -
  - `fallbackRedirectUri(unifyBaseUrl?: string): string`.
  - `buildAuthorizeUrl(params: { authorizeUrl?: string | null; sessionRedirectUri?: string; unifyBaseUrl?: string; embedOrigin?: string }): string | null`: `new URL(authorizeUrl)` in a `try`, then `searchParams.set` for `redirect_uri` (`sessionRedirectUri ?? fallbackRedirectUri(unifyBaseUrl)`), `nonce` (`generateNonce()`), `opener_origin` (`window.location.origin`), `embed_origin` (`embedOrigin === undefined ? window.location.origin : embedOrigin || 'null'`); returns `href`.
  - `messageOriginForPopupUrl(popupUrl: string): string | null` (rules in Implementation Approach).
  - A header comment naming the unify contract (authorize parameters, Apideck callback page per environment) and why `embedOrigin` is verbatim.
- `src/utils/useConnections.tsx` - `embedOrigin?: string` in `Props` (`:50-62`), the destructuring (`:64-76`) and `ContextProps` (`:16-46`); add `embedOrigin` to `contextValue` (`:648-678`) and `embedOrigin`, `unifyBaseUrl` to its dependency list (`:679-693`).
- `src/utils/useAuthorizeUrlBuilder.ts` (new) - `useAuthorizeUrlBuilder(): (authorizeUrl?: string | null) => string | null`, reading `useSession().session?.redirect_uri` and `useConnections()`'s `unifyBaseUrl` and `embedOrigin`, calling `buildAuthorizeUrl`.
- `src/components/AuthorizeButton.tsx` - drop the `REDIRECT_URL` import (`:6`), the render-time `authorizeUrl` (`:32-34`) and `redirect_uri` from the session destructuring (`:24`); in the popup branch replace `:96-99` with the builder; when it returns `null`, `setIsLoading(false)` and return before registering the listener; open the built string.
- `src/components/ButtonLayoutMenu.tsx` - sites B (`:97-106`) and C (`:280-289`): build with the hook's builder, return when `null`, else `await handleRedirect(url, onConnectionChange)`. Remove the `generateNonce` import (`:10`); keep `REDIRECT_URL` (`:5`) for the revoke URL (`:346-349`, unchanged).
- `src/components/TopBar.tsx` - delete the render-time `authorizeUrl` (`:71-73`); site D (`:239-244`) builds at click, returns when `null`, else `handleRedirect(url, onConnectionChange)`. Remove the `generateNonce` import (`:11`); keep `REDIRECT_URL` (`:6`) and `revokeUrl` (`:74-76`).

**Key Implementation Notes:**

- Hooks are called at component top level (`const buildAuthorizeUrl = useAuthorizeUrlBuilder()`), the returned function inside handlers; `getOptions`/`getButtonOptions` are plain functions, so they only call the builder inside `onClick`.
- `searchParams.set`, not `append`, so a `redirect_uri` in `authorize_url` is replaced; every other server parameter is untouched.
- Site B is unreachable but is converted anyway so no `redirect_uri` concatenation for authorize remains.
- The listeners and `handleRedirect` are not touched in this phase; existing message tests still dispatch without `source` and still pass.
- A's `autoStartAuthorization` effect runs on mount with the first render's builder; `Vault` passes `embedOrigin` and the token in the same render, so the first URL already has the right values.
- Commit: `feat: send opener_origin and embed_origin on every authorize URL`, body `Ref #9546` + trailer.

**Success Criteria:**

Automated:
- [ ] All Phase 1 tests pass: `yarn test authorize-url`
- [ ] `yarn test` passes (no failure beyond the baseline)
- [ ] `yarn lint` and `npx tsc --noEmit` pass (or match the baseline)
- [ ] `grep -rn "&redirect_uri=" src` prints only `TopBar.tsx` (revoke) and `ButtonLayoutMenu.tsx` (revoke)
- [ ] `grep -rln "generateNonce" src` prints only `src/utils/oauthCsrf.ts` and `src/utils/authorizeUrl.ts`
- [ ] `grep -rn "useAuthorizeUrlBuilder()" src/components` prints one line each for `AuthorizeButton.tsx`, `ButtonLayoutMenu.tsx`, `TopBar.tsx`

Manual:
- [ ] None: the URLs are first inspected in a browser in Phase 5.

### Phase 3: Write Tests for Popup Message Filter and embedOrigin (TDD - RED)

**Overview:** Write the predicate's unit tests and the component tests for the message filter on both listeners, the custom and staging callback origins, the re-authorize paths and the `embedOrigin` prop.

**Changes Required:**

- `test/mock.ts` - move `tokenWithClaims` here from `test/attribution.test.tsx:16-29` and export it; add `dispatchMessage(data, { origin, source }: { origin: string; source?: unknown })` (cast `source` to `MessageEventSource` inside, so a plain `fakeChild` object type-checks) that dispatches `new MessageEvent('message', { data, origin, source })` on `window` inside `act`. `test/attribution.test.tsx` imports `tokenWithClaims` (no behaviour change).
- `test/oauth-message.test.ts` (new), `isMessageFromPopup` from `../src/utils/oauthMessage`:
  - 'accepts a message from the popup with the accepted origin'
  - 'rejects a message from the accepted origin sent by another window'
  - 'rejects a message from the popup with another origin'
  - 'rejects every message when no origin is accepted'
  - "rejects every message when the accepted origin is the opaque 'null'"
  - 'rejects a message without source when the popup is null' (blocked popup)
- `test/authorize-button.test.tsx` (site A, fallback callback `https://vault.apideck.com` because `token123` is not a JWT):
  - 'ignores oauth_complete from the callback origin sent by another window' (no `/confirm`)
  - 'ignores oauth_complete from the popup with another origin' (`https://evil.example`; no `/confirm`)
  - 'ignores oauth_error from an untrusted sender' (no "User denied consent" toast)
  - 'ignores a message without source' (the pre-0.24 dispatch shape; no `/confirm`)
  - 'refreshes the connection on popup close after ignoring a message' (fake timers: ignored message, then `fakeChild.closed = true`, 500 ms + 1100 ms; the detail GET count grows and no `/confirm`)
- `test/connection-actions.test.tsx` (`handleRedirect`; accepted origin `http://localhost:3000` from `AUTHORIZE_URL_BASE`):
  - 'ignores a message from the redirect_uri origin sent by another window'
  - 'ignores a message from the popup with the Apideck callback origin when redirect_uri is elsewhere' (origin `https://vault.apideck.com`)
  - 'acts on no message when the popup URL has no redirect_uri' (Host `url` without `redirect_uri`; trusted source; no `/confirm`)
  - 'refreshes on popup close after ignoring a message'
- `test/registered-origins.test.tsx` (new), `<Vault>` with `tokenWithClaims`, a fetch mock parametrised on the unify base URL (detail URL `${base}/vault/connections/ecommerce/shopify`), `window.open` spy returning `fakeChild`:
  - 'accepts messages from a custom callback page set as session redirect_uri and ignores the Apideck callback origin' (`redirect_uri: 'https://connect.customer.example/oauth/callback'`: a message from `https://vault.apideck.com` does not confirm, one from `https://connect.customer.example` does)
  - 'sends an invalid session redirect_uri verbatim and acts on no message' (`redirect_uri: 'not a url'`)
  - 'uses the staging callback page for a staging unifyBaseUrl and ignores the production callback origin' (`unifyBaseUrl="https://deploy-preview-staging--unify.stagingapideck.com"`, no session `redirect_uri`: popup URL has the staging `redirect_uri`; a message from `https://vault.apideck.com` does not confirm, one from `https://vault.stagingapideck.com` does)
  - 'Re-authorize in the button layout sends both origins and acts only on its popup's messages' (site C: `showButtonLayout`, connection `state: 'callable'`, `auth_type: 'oauth2'`; popup URL has `opener_origin`, `embed_origin`, `redirect_uri`, `nonce`; another-window message ignored, popup message confirms)
  - 'Re-authorize in the TopBar menu sends both origins and acts only on its popup's messages' (site D: open the menu via the `Menu.Button` inside `getByTestId('dropdown')`, click "Re-authorize")
  - 'Disconnect still opens the revoke URL unchanged' (guard: `revoke_url` `https://unify.apideck.com/vault/revoke/shopify/abc?state=s`; opened URL equals `${revoke_url}&redirect_uri=${REDIRECT_URL}`)
- `test/embed-origin.test.tsx` (new), `<Vault>` with `token123`:
  - 'sends the embedOrigin prop as embed_origin'
  - "sends embedOrigin 'null' verbatim"
  - 'defaults embed_origin to window.location.origin without the prop'
  - 'sends window.location.origin as opener_origin when embedOrigin differs'
  - 'uses the latest embedOrigin after the prop changes' (`rerender` with a new `embedOrigin`, same token, then click: new value)
  - 'Re-authorize carries the embedOrigin prop' (site C, through `handleRedirect`)

**Key Implementation Notes:**

- Every "ignores" test pairs the rejected message with an assertion that would fail today (a `/confirm` POST or a toast), so the RED is caused by the missing filter, not by the test setup.
- `embed-origin.test.tsx` is its own file because passing `embedOrigin` to `<Vault>` is a ts-jest type error until Phase 4 adds the prop; that error fails the whole file, which must not hide the assertion-level REDs of the other files.
- The TopBar test opens `@apideck/components`' `Dropdown` (headless UI `Menu`, root `data-testid="dropdown"`) by clicking its `Menu.Button`; the option label is the "Re-authorize" text.
- Existing dispatches in `authorize-button.test.tsx` and `connection-actions.test.tsx` are not changed in this phase (they move to the trusted shape in Phase 4).
- Expected outcome: `oauth-message.test.ts` FAILS with "Cannot find module"; `embed-origin.test.tsx` FAILS with TS2322 (`embedOrigin` not on `Props`); in `authorize-button.test.tsx`, `connection-actions.test.tsx` and `registered-origins.test.tsx` every new test except the 'Disconnect' guard FAILS on its ignore assertion; all pre-existing tests still pass.
- Commit: `test: cover the popup message filter and embedOrigin (RED)`, body `Ref #9546` + trailer.

**Success Criteria:**

Automated:
- [ ] `yarn test oauth-message embed-origin` fails ("Cannot find module", TS2322)
- [ ] `yarn test authorize-button connection-actions registered-origins` shows exactly the failures listed above
- [ ] `yarn test attribution` passes (tokenWithClaims move)

Manual:
- [ ] Every branch listed in Phase 4's Changes Required has a named test above.

### Phase 4: Popup Message Filter and embedOrigin Prop (TDD - GREEN)

**Overview:** Add the shared predicate, guard both listeners with it, expose `embedOrigin` on `Vault`, document both props, and move the existing tests' messages to the trusted shape, until every test passes.

**Changes Required:**

- `src/utils/oauthMessage.ts` (new) - `isMessageFromPopup(event: MessageEvent, popup: Window | null, acceptedOrigin: string | null): boolean` (rules in Implementation Approach), with a comment on why both checks are needed and why the origin comes from the flow's `redirect_uri`.
- `src/components/AuthorizeButton.tsx` - in the popup branch: `const acceptedOrigin = messageOriginForPopupUrl(popupUrl)`; declare `let popup: Window | null = null` before the handler; first statement of `handler` (`:114`): `if (!isMessageFromPopup(event, popup, acceptedOrigin)) return;`; assign `popup = window.open(…)` (`:164`) and use `popup` in the blocked check (`:170`) and the poller (`:175-186`).
- `src/utils/connectionActions.ts` - same in `handleRedirect`'s popup branch (`:95-196`): accepted origin from the `url` argument, `let popup`, guard first in `handler` (`:121`), `popup = window.open(url, …)` (`:175`). Signature unchanged; a doc comment says the accepted origin is derived from the `redirect_uri` in `url` and that a URL without one accepts no message.
- `src/components/Vault.tsx` - `embedOrigin?: string` in `Props` after `unifyBaseUrl` (`:55-59`), JSDoc: the origin of the page embedding Vault, sent as `embed_origin` on every authorize URL so applications with OAuth protection can restrict which sites embed Vault; defaults to `window.location.origin`; hosts that render Vault on behalf of another site (for example Apideck's iframe-vault) must pass that site's origin, because the default would report the host's own origin; passed verbatim, including `'null'` for an opaque origin; an empty string is sent as `'null'` because unify skips an empty `embed_origin`. Destructure without a default (`:106-124`) and pass to `ConnectionsProvider` (`:193-204`).
- `README.md` - two rows in the props table after `serviceId` (`:163`): `unifyBaseUrl` (string, default `https://unify.apideck.com`, "Base URL of the Unify API; only for local development or staging. A `*.stagingapideck.com` host also selects the staging Vault callback page") and `embedOrigin` (string, default `window.location.origin`, the JSDoc text in one sentence). Adding `unifyBaseUrl` is one row, so it is included.
- `example/.env.example:8` - replace the `https://staging-unify.apideck.com` example with `https://deploy-preview-staging--unify.stagingapideck.com` and note that a `*.stagingapideck.com` base URL selects the staging callback page.
- `test/authorize-button.test.tsx` - the five existing dispatches (`:256-268`, `:286-297`, `:314-326`, `:342-354`, `:445-457`) use `dispatchMessage` with `source: fakeChild` and `origin: 'https://vault.apideck.com'`.
- `test/connection-actions.test.tsx` - the five existing dispatches (`:193-205`, `:223-234`, `:251-263`, `:278-290`, `:424-436`) use `source: fakeChild` and `origin: 'http://localhost:3000'`.

**Key Implementation Notes:**

- The guard is the first statement of each handler and returns without `cleanup()`: an ignored message must not stop the poller, or the popup-close refresh (the only completion path for ignored or absent messages) would never run.
- `popup` is assigned after `addEventListener`, as today; `window.open` is synchronous and no message from the new popup can arrive before it returns.
- The existing 'ignores postMessage with foreign serviceId' tests must use the trusted origin and source: otherwise they would pass because of the new filter and stop testing the `serviceId` filter.
- No default for `embedOrigin` in `Vault`: `undefined` must reach `buildAuthorizeUrl` so the default is applied in one tested place.
- Commit: `feat: accept OAuth popup messages only from the popup and its callback origin`, body `Ref #9546` + trailer.

**Success Criteria:**

Automated:
- [ ] All Phase 3 tests pass: `yarn test oauth-message embed-origin authorize-button connection-actions registered-origins attribution`
- [ ] `yarn test authorize-url` still passes
- [ ] `yarn lint` and `npx tsc --noEmit` pass (or match the baseline)
- [ ] `grep -rn "addEventListener('message'" src` prints two lines (`AuthorizeButton.tsx`, `connectionActions.ts`) and `grep -rn "isMessageFromPopup(" src` prints the definition plus one call in each of those files
- [ ] `grep -n "embedOrigin" README.md src/components/Vault.tsx` shows the README row, the JSDoc'd prop and the `ConnectionsProvider` pass-through

Manual:
- [ ] Read the `embedOrigin` JSDoc as an iframe-vault maintainer would: it says to pass the parent's origin and why.

### Phase 5: Verify All Checks

**Overview:** Run every check against the baseline, inspect the built typings, and check the behaviour in a browser. No version bump: `np` makes it at publish time.

**Changes Required:**

- No source changes. Run `yarn install --frozen-lockfile`, `yarn lint`, `yarn test`, `npx tsc --noEmit`, `yarn build`.
- No version bump and no commit in this phase unless a check needs a fix. No tag, no `np`, no `npm publish`, no push.

**Key Implementation Notes:**

- `yarn build` writes `dist/` (gitignored); it is the input of the example app below and of the typings check.
- The release is a minor (`np minor`): a new prop and a behaviour change (messages from other senders are ignored) with no API removal.
- Hand-off note for the publisher: `np minor` after merge (Implementation Approach, "Rollout"), then the iframe-vault upgrade (its own plan), before any application is set to `enforced`.

**Success Criteria:**

Automated:
- [ ] `yarn install --frozen-lockfile` passes and `git status --short yarn.lock` prints nothing
- [ ] `yarn lint`, `yarn test`, `npx tsc --noEmit`, `yarn build` pass, with no failure that is not in the Phase 1 baseline
- [ ] `grep -n "embedOrigin" dist/components/Vault.d.ts` prints the prop
- [ ] `git diff origin/main --stat -- package.json` shows no `version` change, and `git tag --points-at HEAD` prints nothing

Manual:
- [ ] Example app (`cd example && yarn install && yarn start`, `http://localhost:1234`) with a staging session JWT and `VITE_VAULT_UNIFY_BASE_URL=https://deploy-preview-staging--unify.stagingapideck.com`: click Authorize; the popup URL has `redirect_uri=https://vault.stagingapideck.com/oauth/callback` (encoded), `opener_origin=http://localhost:1234`, `embed_origin=http://localhost:1234`, a `nonce` and the original `state`; the OAuth flow completes and the connection shows as connected (popup-close refresh on unify main).
- [ ] Same page, devtools console in the opener while a popup is open: `window.postMessage({ type: 'oauth_complete', serviceId: '<service id>', confirmToken: 'x' }, '*')` makes no `/confirm` request (source is not the popup).
- [ ] With a session whose `redirect_uri` is a page on another origin, the popup URL carries it encoded and messages from `vault.stagingapideck.com` are ignored.
- [ ] Re-authorize from the TopBar menu and (with `showButtonLayout`) from the button layout: both popup URLs carry the four parameters.
- [ ] iframe-test harness (`http://localhost:1234/iframe-test/iframe.html`, see `example/iframe-test/README.md`): Vault in a same-origin iframe still completes Authorize, which shows `event.source` matches when the popup is opened from inside a frame. The harness is same-origin, so `opener_origin` and `embed_origin` are both `http://localhost:1234`; a cross-origin `embedOrigin` is exercised by iframe-vault's plan.
- [ ] Optional, if the unify branch runs locally or on a preview: with an application in `monitoring`, the dashboard's "Seen but not registered" panel lists `http://localhost:1234` as an opener and embedding origin.

## Testing Strategy

- **TDD order:** two RED/GREEN pairs. Phase 1 fails on a missing module; Phase 3 fails on a missing module, a missing prop (its own file) and, for every listener test, on an assertion that the current code violates. GREEN phases change only what their RED phase needs, and the rest of the suite stays green after each.
- **One named test per branch:** builder (path preserved, state preserved, replace not append, session/fallback/staging redirect, verbatim invalid and empty redirect, opener origin, embed origin defined/'null'/empty/undefined, nonce, two `null` returns); fallback (undefined, production, staging, suffix spoof, localhost, malformed); origin derivation (Apideck, staging, custom with port, round trip, revoke concatenation, missing, duplicate, non-URL, non-http(s), unparseable popup URL); predicate (accept, wrong source, wrong origin, no accepted origin, opaque accepted origin, null popup); each listener (wrong source, wrong origin, error message, no source, refresh after ignore); each site (A via `authorize-button`, C and D via `registered-origins`, B by construction, revoke guard); prop (value, 'null', default, opener independence, prop change, re-authorize path).
- **Edge cases covered:** `authorize_url` without `?` and with an existing query or `redirect_uri`; session `redirect_uri` absent, not a URL, empty, with its own query; white-label callback page origin accepted; right origin from the wrong window ignored; message with no `source`; popup blocked (`null` popup never matches); re-authorize paths C and D; staging fallback; behaviour against unify main (manual Phase 5, and by construction: main ignores the new parameters).
- **Unchanged behaviour:** existing tests keep their intent and only gain a trusted `source`/`origin`; the `serviceId` filter is still tested with otherwise-trusted messages; the blocked-popup, grace-period and double-confirm tests run unchanged; the revoke URL is pinned by a guard test.
- **Not covered locally:** real cross-origin popups and browsers' `MessageEvent.source` identity (manual Phase 5 in a real browser), unify `enforced` rejections (unify branch, not merged), iframe-vault's cross-origin `embedOrigin` (iframe-vault plan).
- **Quality gates per phase:** the scoped `yarn test <pattern>`, `yarn lint`, `npx tsc --noEmit`; the full `yarn test` and `yarn build` in Phases 2 and 5.

## References

- unify plan (contract, gates): `/Users/geisermenoia/orca/workspaces/unify/gh-9546-plan/thoughts/shared/plans/2026-10-26-GH-9546-registered-origins.md` (`:92-104` rollout and external gates, `:98-101` G3)
- unify sources (branch `feat/GH-9546-oauth-consent-screen`): `src/modules/connection/application/useCases/authorizeConnection/AuthorizeConnectionController.ts` (`:72` parameters, `:418-446` `findUnregisteredValue`; `origin/main` `:61`), `CallbackConnectionUseCase.ts` (confirm fragment and `target_origin`, per the G3 research brief)
- Related research: `/Users/geisermenoia/orca/workspaces/unify/gh-9546-plan/thoughts/shared/research/2026-10-26-GH-9546-oauth-csrf-current-state-and-handoff.md`
- vault-core: `src/components/AuthorizeButton.tsx`, `src/components/ButtonLayoutMenu.tsx`, `src/components/TopBar.tsx`, `src/components/Vault.tsx`, `src/utils/connectionActions.ts`, `src/utils/oauthCsrf.ts`, `src/utils/useConnections.tsx`, `src/utils/useSession.tsx`, `src/constants/urls.ts`, `src/types/OAuthCsrf.ts`, `src/types/Session.ts`, `README.md:151-173`, `package.json`, `example/index.tsx`, `example/.env.example`, `example/iframe-test/README.md`, `test/authorize-button.test.tsx`, `test/connection-actions.test.tsx`, `test/oauth-csrf.test.ts`, `test/attribution.test.tsx`, `test/mock.ts`, `.claude/CLAUDE.md:38-42`
- Earlier vault-core plans: `thoughts/shared/plans/2026-06-19-GH-9546-drop-client-nonce-storage.md` (`:66` the "no origin check" rationale this plan supersedes), `thoughts/shared/plans/2026-05-05-GH-9546-csrf-fix-vault-core.md`
- Sibling G3 plans: iframe-vault (`/Users/geisermenoia/Workspace/apideck/iframe-vault-gh9546`), Hosted Vault (`/Users/geisermenoia/Workspace/apideck/vault-gh9546`)
