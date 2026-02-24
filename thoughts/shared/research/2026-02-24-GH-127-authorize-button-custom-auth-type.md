# Research: Authorize Button Rendering for Custom Auth Type with oauthGrantType

**Date**: 2026-02-24
**Related Issue**: https://github.com/apideck-libraries/vault-core/issues/127

## Research Question

How does the Authorize button rendering gate work in `ConnectionDetails.tsx`, and how do `AuthorizeButton` and the re-authorize flow handle different `auth_type` / `oauth_grant_type` combinations?

## Summary

The Authorize button is gated behind `auth_type === 'oauth2'` in three places: `ConnectionDetails.tsx` (initial authorization), `TopBar.tsx` (re-authorize dropdown), and `ButtonLayoutMenu.tsx` (re-authorize button). Meanwhile, the downstream components (`AuthorizeButton` and `connectionActions.ts`) already branch on `oauth_grant_type` to handle `client_credentials`/`password` grants via a direct `POST /token` call. The `auth_type` field and `oauth_grant_type` field are independent in the type system — `oauth_grant_type` is not even a declared field on the `Connection` interface (accessed via `[key: string]: any` index signature).

## Detailed Findings

### 1. The Rendering Gate in ConnectionDetails

**`src/components/ConnectionDetails.tsx:103-108`**

```typescript
const shouldShowAuthorizeButton =
  enabled &&
  state !== 'callable' &&
  auth_type === 'oauth2' &&       // ← blocks custom auth type
  !requiredAuthVariables &&
  !(state === 'authorized' && hasFormFields);
```

The variables are destructured from `selectedConnection` at lines 68-76, which comes from `useConnections()` context. `selectedConnection` is the API response merged with local state (`useConnections.tsx:121-123`).

`shouldShowAuthorizeButton` is used in two render paths:
- **Standard view** (`ConnectionDetails.tsx:470-478`): Renders `<AuthorizeButton>` directly
- **Button layout view** (`ConnectionDetails.tsx:333-349`): Passed as prop to `<ButtonLayoutMenu>`

### 2. AuthorizeButton Component

**`src/components/AuthorizeButton.tsx:17-162`**

Props: `connection: Connection`, `onConnectionChange?`, `autoStartAuthorization?`

The click handler `authorizeConnection` (lines 47-104) branches on `oauth_grant_type`:

- **`client_credentials` or `password`** (lines 49-90): Direct `POST` to `${connectionsUrl}/${unified_api}/${service_id}/token` with JWT headers. No popup.
- **All other grant types** (lines 91-103): Opens a 550x750 popup to `authorizeUrl`, polls every 500ms for closure.

`auth_type` does **not appear anywhere** inside `AuthorizeButton.tsx`. The component is auth-type-agnostic — it only cares about `oauth_grant_type`.

### 3. Re-Authorize Flow in connectionActions.ts

**`src/utils/connectionActions.ts:27-93`** — `handleRedirect` function

Identical grant-type branching:
- Lines 32-34: `client_credentials` / `password` → POST to `/token`
- Lines 74-92: All others → popup window

The re-authorize option is gated identically to the initial authorize button:

**`src/components/TopBar.tsx:211-214`** and **`src/components/ButtonLayoutMenu.tsx:256-259`**:
```typescript
(state === 'authorized' || state === 'callable') &&
auth_type === 'oauth2' &&            // ← also blocks custom auth type
isActionAllowed('reauthorize')
```

### 4. Connection Type Definition

**`src/types/Connection.ts:38-76`**

| Field | Type | Declared? |
|-------|------|-----------|
| `auth_type` | `'oauth2' \| 'apiKey' \| 'basic' \| 'custom' \| 'none'` | Yes (line 47) |
| `oauth_grant_type` | Untyped | No — accessed via `[key: string]: any` (line 75) |
| `state` | `ConnectionState` (line 49) | Yes |
| `enabled` | `boolean` (line 48) | Yes |
| `authorize_url` | `string \| null` (line 52) | Yes |
| `revoke_url` | `string \| null` (line 53) | Yes |
| `settings_required_for_authorization` | `string[]` (line 62) | Yes |

`auth_type` and `oauth_grant_type` are independent — no discriminated union ties them together.

### 5. All Three `auth_type === 'oauth2'` Gates

| Location | Lines | Context |
|----------|-------|---------|
| `src/components/ConnectionDetails.tsx` | 103-108 | Initial authorize button rendering |
| `src/components/TopBar.tsx` | 211-214 | Re-authorize dropdown option |
| `src/components/ButtonLayoutMenu.tsx` | 256-259 | Re-authorize button in grid |

## Code References

- `src/components/ConnectionDetails.tsx:103-108` — `shouldShowAuthorizeButton` condition
- `src/components/ConnectionDetails.tsx:68-76` — Connection field destructuring
- `src/components/ConnectionDetails.tsx:470-478` — AuthorizeButton render (standard view)
- `src/components/ConnectionDetails.tsx:333-349` — ButtonLayoutMenu render with prop
- `src/components/AuthorizeButton.tsx:17-162` — Full component
- `src/components/AuthorizeButton.tsx:49-51` — `oauth_grant_type` branch condition
- `src/components/AuthorizeButton.tsx:53-90` — POST /token path (client_credentials/password)
- `src/components/AuthorizeButton.tsx:91-103` — Popup path (all other grant types)
- `src/utils/connectionActions.ts:27-93` — `handleRedirect` (re-authorize)
- `src/utils/connectionActions.ts:32-34` — Same `oauth_grant_type` branch
- `src/components/TopBar.tsx:211-214` — Re-authorize gate
- `src/components/ButtonLayoutMenu.tsx:256-259` — Re-authorize gate
- `src/types/Connection.ts:47` — `auth_type` field definition
- `src/types/Connection.ts:75` — `[key: string]: any` index signature (allows `oauth_grant_type`)
- `src/types/Connection.ts:26-31` — `ConnectionState` type
- `src/utils/authorizationVariablesRequired.ts:3-27` — Pre-auth field validation
- `src/constants/urls.ts:1` — `REDIRECT_URL` fallback

## Architecture Documentation

The authorization flow has a two-layer design:
1. **Visibility layer**: `auth_type` controls whether authorize/re-authorize UI elements appear
2. **Behavior layer**: `oauth_grant_type` controls what happens when the button is clicked (popup vs. POST /token)

Currently, the visibility layer only admits `auth_type === 'oauth2'`, while the behavior layer already handles the `client_credentials` and `password` grant types that can appear on `auth_type === 'custom'` connectors. The behavior layer is auth-type-agnostic — `AuthorizeButton` never checks `auth_type`.

## Historical Context (from thoughts/)

No existing research or plans were found in the `thoughts/` directory related to authorization flow, auth types, OAuth grant types, or the AuthorizeButton component.

## Follow-up: Re-authorize Gates Must Also Be Widened

All three `auth_type === 'oauth2'` gates need the same widening — not just `ConnectionDetails.tsx`.

**Reasoning**: The re-authorize gates in `TopBar.tsx:213` and `ButtonLayoutMenu.tsx:258` check `state === 'authorized' || state === 'callable'`, meaning the connection has already been authorized once. For a custom auth connector with `oauth_grant_type: 'client_credentials'`, after the initial authorization succeeds via POST `/token`, the connection transitions to `authorized` or `callable`. At that point the user needs the Re-authorize option to trigger a fresh token exchange if credentials change or the token expires.

The downstream `handleRedirect` in `connectionActions.ts:32-34` already branches on `oauth_grant_type` identically to `AuthorizeButton` — so the behavior layer is ready.

**Impact if only `ConnectionDetails` is widened**: The user could authorize initially but would have no way to re-authorize later — the Re-authorize option would never appear in the dropdown or button grid.

**All three gates requiring the same change**:

| File | Line | Gate | Purpose |
|------|------|------|---------|
| `ConnectionDetails.tsx` | 106 | `auth_type === 'oauth2'` | Initial Authorize button |
| `TopBar.tsx` | 213 | `auth_type === 'oauth2'` | Re-authorize in dropdown menu |
| `ButtonLayoutMenu.tsx` | 258 | `auth_type === 'oauth2'` | Re-authorize in button grid |

**Safety**: The widened condition `(auth_type === 'oauth2' || (auth_type === 'custom' && connection.oauth_grant_type))` is narrowly scoped:
- `apiKey`, `basic`, `none` connectors: unaffected
- `oauth2` connectors: unaffected (already pass)
- `custom` without `oauth_grant_type`: unaffected (the `&&` prevents it)
- `custom` with `oauth_grant_type`: newly admitted — these are the connectors that need a token exchange step

`oauth_grant_type` is optionally present on the `Connection` object. Currently it's not a declared field — accessed via the `[key: string]: any` index signature (`Connection.ts:75`). When absent/undefined, the `&&` check evaluates to falsy, so plain custom connectors without a grant type are never admitted.

## Follow-up: Type `oauth_grant_type` on the Connection Interface

`oauth_grant_type` should be formally declared as an optional typed field on the `Connection` interface (`src/types/Connection.ts`):

```typescript
type OAuthGrantType = 'authorization_code' | 'client_credentials' | 'password';
```

```typescript
oauth_grant_type?: OAuthGrantType;
```

This replaces reliance on the `[key: string]: any` index signature and gives type safety to the grant-type checks in `AuthorizeButton.tsx:50-51` and `connectionActions.ts:33-34`.

## Follow-up: Which `auth_type` Values Can Have `oauth_grant_type`

In practice, only `oauth2` and `custom`. The upstream Connector domain type (`src/modules/connector/domain/Connector.ts:183` in unify) declares `oauthGrantType?: OauthGrantType` without constraining by auth type, but across all connectors it's only ever set for `oauth2` connectors — Shopify is the first `custom` connector to use it.

This means the vault-core gate should check for **presence of `oauth_grant_type`** on the connection response rather than hardcoding specific `auth_type` values. The condition:

```typescript
auth_type === 'oauth2' || (auth_type === 'custom' && connection.oauth_grant_type)
```

can be simplified to:

```typescript
auth_type === 'oauth2' || !!connection.oauth_grant_type
```

This is future-proof — any connector that sets `oauth_grant_type` will get the authorize button regardless of `auth_type`, which is the correct behavior since the downstream components (`AuthorizeButton`, `handleRedirect`) already branch solely on `oauth_grant_type`.
