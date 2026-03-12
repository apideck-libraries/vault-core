---
date: 2026-03-04
topic: "Switch OAuth to Secure Authorize Endpoint — vault-core"
repository: vault-core
source: platform-orchestrator
orchestrator_work_item: thoughts/2026-03-04-quickbooks-authorized-not-callable/
status: complete
---

# Research: vault-core — Switch to Secure Authorize Endpoint

## Research Question

vault-core currently calls unify's legacy `/authorize` endpoint which silently drops the `nonce` parameter. Switch to `/secure-authorize` so the nonce-based CSRF protection and confirm flow work correctly, allowing connections to transition from `authorized` to `callable` after OAuth.

## Summary

vault-core generates a nonce and sends it with the authorize request, but calls the legacy `/authorize` endpoint which ignores the nonce. This means unify's callback takes the legacy path (no confirm needed), and CSRF protection is a no-op. The fix is to change the endpoint URL from `/authorize` to `/secure-authorize` in `connectionActions.ts`. The confirm flow is already fully implemented — it just never triggers because the legacy endpoint drops the nonce.

## Cross-Repo Context

- **Execution order**: vault-core and vault can be done in parallel — both make independent changes to call the same unify endpoint
- **Depends on**: Nothing — unify already has `/secure-authorize` endpoint working
- **Depended on by**: iframe-vault consumes vault-core as `@apideck/react-vault` npm package — iframe-vault gets the fix when vault-core publishes a new version
- **API contracts**:
  - Current: `POST /vault/connections/{api}/{serviceId}/authorize` with `{ nonce, redirect_uri? }` → `{ data: { authorize_url } }`
  - Target: `POST /vault/connections/{api}/{serviceId}/secure-authorize` with `{ nonce, redirect_uri? }` → `{ data: { authorize_url } }`
  - Same request/response shape, different URL path segment

## Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/utils/connectionActions.ts` | Core OAuth logic — `handleAuthorize` calls `/authorize`, needs to call `/secure-authorize` | L196-212 (authorize), L257-334 (postMessage handler), L278-310 (confirm call) |
| `src/utils/oauthCsrf.ts` | Nonce generation (`generateAndStoreNonce`), verification (`verifyAndClearNonce`), cleanup (`clearNonce`) via sessionStorage | L1-25 |
| `src/constants/urls.ts` | `REDIRECT_URL = 'https://vault.apideck.com/oauth/callback'` — fallback redirect URL (used only for revoke, not authorize) | L1 |
| `src/utils/useConnections.tsx` | `ConnectionsProvider` — constructs `connectionsUrl` base URL, provides headers | L1+ |
| `src/types/Session.ts` | `Session` interface — includes optional `redirect_uri` field (L31) decoded from JWT | L1-35 |
| `src/components/AuthorizeButton.tsx` | Triggers `handleAuthorize` on click | - |

## Implementation Details

### Current authorize call (`connectionActions.ts:196-212`)

```ts
const nonce = generateAndStoreNonce(serviceId);
const authorizeBody: Record<string, string> = { nonce };
if (session?.redirect_uri) {
  authorizeBody.redirect_uri = session.redirect_uri;
}

const authorizeResponse = await fetch(
  `${connectionsUrl}/${unifiedApi}/${serviceId}/authorize`,  // ← change to /secure-authorize
  {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(authorizeBody),
  }
);
```

The only change needed is `/authorize` → `/secure-authorize` at line 205.

### Confirm flow already implemented (`connectionActions.ts:257-310`)

The postMessage handler at line 257 already:
1. Listens for `oauth_complete` message with `nonce` and `confirmToken`
2. Verifies nonce via `verifyAndClearNonce(serviceId, data.nonce)` (line 269)
3. Calls `POST /confirm` with `{ confirm_token: data.confirmToken }` (lines 278-290)
4. Mutates SWR cache on success

This code path currently never executes because the legacy endpoint drops the nonce, so unify's callback doesn't include `confirm_token` in the redirect params. After switching to `/secure-authorize`, this flow will activate.

### Nonce CSRF mechanism (`oauthCsrf.ts`)

- `generateAndStoreNonce(serviceId)`: Generates UUID via `crypto.randomUUID()`, stores in `sessionStorage` under key `vault_oauth_nonce_{serviceId}`
- `verifyAndClearNonce(serviceId, receivedNonce)`: Reads stored nonce, compares, removes if matching, returns boolean
- `clearNonce(serviceId)`: Removes nonce from storage without verification (used on popup close without message)

### Flow after the change

1. vault-core generates nonce → `POST /secure-authorize { nonce, redirect_uri? }`
2. unify stores nonce in `OauthShortLivedState`, redirects to OAuth provider
3. Provider redirects to unify callback → unify detects nonce → secure flow
4. unify sets `confirmed: false`, generates `confirm_token`, redirects to callback page with `?nonce=...&confirm_token=...&service_id=...`
5. Callback page (`vault.apideck.com/oauth/callback`) postMessages `{ type: 'oauth_complete', nonce, confirmToken, serviceId }` to `window.opener`
6. vault-core's `messageHandler` receives message → verifies nonce → calls `POST /confirm { confirm_token }`
7. unify sets `confirmed: true`, runs hooks, validates → connection becomes `callable`

## Boundary Points

| From | To | Contract |
|------|----|----------|
| vault-core | unify | `POST /vault/connections/{api}/{serviceId}/secure-authorize` with `{ nonce: string, redirect_uri?: string }` → `{ data: { authorize_url: string } }` |
| unify callback | vault callback page | HTTP 301 redirect with `?nonce=...&confirm_token=...&service_id=...` query params |
| vault callback page | vault-core | `window.opener.postMessage({ type: 'oauth_complete', nonce, confirmToken, serviceId, success: true })` |
| vault-core | unify | `POST /vault/connections/{api}/{serviceId}/confirm` with `{ confirm_token: string }` → `{ confirmed: true }` |

## Implementation Patterns

- **Naming**: camelCase for utils, PascalCase for components
- **HTTP calls**: `fetch()` with headers from `ConnectionsProvider`
- **State management**: SWR with `mutate()` for cache invalidation
- **Error handling**: try/catch with toast notifications via `addToast`
- **Tests**: Jest with fetch mocks in `test/mock.ts`

## Scope & Constraints

- **In scope**: Change `/authorize` to `/secure-authorize` in `connectionActions.ts`
- **Out of scope**: No changes to confirm flow, nonce logic, callback handling, or any other files
- **Constraint**: The request/response shape is identical between `/authorize` and `/secure-authorize` — only the URL path differs
