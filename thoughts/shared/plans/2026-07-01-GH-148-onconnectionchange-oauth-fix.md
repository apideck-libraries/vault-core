---
github_issue_url: https://github.com/apideck-libraries/vault-core/issues/148
status: ready
related_research: thoughts/shared/research/2026-07-01-GH-148-onconnectionchange-oauth-design.md
---

# GH-148 — Reliable `onConnectionChange` after OAuth + popup-blocker handling — Implementation Plan

> **For agentic workers:** Implement task-by-task with TDD (RED → GREEN → commit). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make `onConnectionChange` fire reliably with `state: 'callable'` after a successful OAuth (single-connection and list modes), and stop `autoStartAuthorization` from hanging the button when a popup is blocked.

**Architecture:** Move the post-OAuth "connection is now usable" emission out of `AuthorizeButton` (which unmounts the instant a connection becomes `callable`) and into `ConnectionsProvider` (which never unmounts on the view switch). The provider emits once per transition into `callable`, deduped via a ref. Separately, detect a blocked `window.open` (returns `null`), surface a toast, and reset the loading state so a manual click can retry.

**Tech Stack:** React 17, TypeScript, SWR, react-i18next, `@apideck/components` (`Button`, `useToast`, `usePrevious`), tsdx (jest + `@testing-library/react`).

## Global Constraints

- Package: `@apideck/react-vault` (repo `apideck-libraries/vault-core`). React 17.
- Test runner: `tsdx test`. Lint: `tsdx lint`. Build: `tsdx build`.
- Commits: include `Co-Authored-By: Claude <noreply@anthropic.com>`; use `Ref #148`, never `Closes #148`; never commit to `main` (work on branch `gh-148-onconnectionchange-oauth-fix`).
- Emit `onConnectionChange` on transition into `callable` only — NOT `authorized` (a "needs configuration" state that is not yet usable). Rationale in the design doc.
- i18n strings must be added to all 5 locales (en, nl, fr, de, es) in `src/utils/i18n.ts`.

---

## Current State (verified)

- Only post-OAuth emitters: `AuthorizeButton.tsx` (52, 86, 166) and `connectionActions.ts` (68, 94, 153).
- `AuthorizeButton` renders only while `shouldShowAuthorizeButton` is true, which requires `state !== 'callable'` (`ConnectionDetails.tsx:104-109`). On transition to `callable` it unmounts and its cleanup (`AuthorizeButton.tsx:42-46`) tears down the message listener + poll, cancelling the pending emit.
- `ConnectionsProvider` already receives `onConnectionChange` (`useConnections.tsx:59,73`) and derives `connection` + `prevConnection` (`useConnections.tsx:121-125`); it already runs effects on `[connection]`.
- Details SWR (`useConnections.tsx:115-119`) uses default `revalidateOnFocus: true`; no global `<SWRConfig>`. So state reaches `callable` on popup-close/focus regardless of the postMessage.
- `window.open` blocked → returns `null`; poll checks `child?.closed` on `null` (forever falsy) → `isLoading` stuck.

## What We're NOT Doing

- Not changing the `vault-js`/`vault-react` iframe `postMessage` bridge (separate repos).
- Not adding a new public `onAuthorizationBlocked` callback.
- Not emitting a separate `authorized` event.
- Not altering the OAuth CSRF confirm flow.

---

## Phase 1 — Emit `callable` from the provider; retire `AuthorizeButton` emits

### Overview

Add a deduped `callable`-transition emitter to `ConnectionsProvider`, then remove the three now-redundant emits (and the now-unused `onConnectionChange` prop) from `AuthorizeButton`, and stop passing that prop from `ConnectionDetails` and `ButtonLayoutMenu`. The `connectionActions.ts` re-authorize emits stay.

### Files

- Create test: `test/on-connection-change.test.tsx`
- Modify: `src/utils/useConnections.tsx` (import `useRef`; add ref; add effect; set ref in `updateConnection`)
- Modify: `src/components/AuthorizeButton.tsx` (remove prop + 3 emit calls, keep the `mutate` calls)
- Modify: `src/components/ConnectionDetails.tsx:471-479` (drop `onConnectionChange` from `<AuthorizeButton>`)
- Modify: `src/components/ButtonLayoutMenu.tsx` (drop `onConnectionChange` from the nested `<AuthorizeButton>`)

### Interfaces

- Provider effect produces: `onConnectionChange(connection)` exactly once when `connection.state` first becomes `'callable'` for a given connection id (unless the same `id:callable` was already emitted, e.g. by `updateConnection`).
- `AuthorizeButton` Props after change: `{ connection: Connection; autoStartAuthorization?: boolean }` (no `onConnectionChange`).

- [ ] **Step 1: Write the failing test** — `test/on-connection-change.test.tsx`

```tsx
import '@testing-library/jest-dom/extend-expect';
import 'jest-location-mock';
import 'whatwg-fetch';

import * as React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { mutate as globalMutate } from 'swr';

import { setupIntersectionObserverMock } from './mock';
import { Vault } from '../src/components/Vault';

const UNIFIED_API = 'ecommerce';
const SERVICE_ID = 'shopify';
const CONNECTIONS_URL = 'https://unify.apideck.com/vault/connections';
const DETAIL_URL = `${CONNECTIONS_URL}/${UNIFIED_API}/${SERVICE_ID}`;

const baseConnection = (overrides: Record<string, any> = {}) => ({
  id: `${UNIFIED_API}+${SERVICE_ID}`,
  name: 'Shopify',
  unified_api: UNIFIED_API,
  service_id: SERVICE_ID,
  auth_type: 'oauth2',
  enabled: true,
  state: 'added',
  form_fields: [],
  configurable_resources: [],
  resource_schema_support: [],
  resource_settings_support: [],
  settings_required_for_authorization: [],
  authorize_url: `https://unify.apideck.com/vault/authorize/${SERVICE_ID}/abc`,
  revoke_url: null,
  ...overrides,
});

// `setState` flips what the detail endpoint returns, so a test can drive the
// connection into `callable` WITHOUT going through the AuthorizeButton handler
// (mirroring SWR revalidate-on-focus after the popup closes). That is what makes
// the first test a valid RED: before the fix, nothing emits `callable` here.
const setupMock = (initialState = 'added') => {
  let state = initialState;
  (window.fetch as any).mockImplementation((url: string) => {
    if (url === DETAIL_URL) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ status_code: 200, data: baseConnection({ state }) }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ status_code: 200, data: [baseConnection({ state })] }),
    };
  });
  return { setState: (s: string) => { state = s; } };
};

describe('onConnectionChange callable transition (GH-148)', () => {
  beforeEach(() => {
    jest.spyOn(window, 'fetch');
    setupIntersectionObserverMock();
  });
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  const renderVault = async (onConnectionChange: jest.Mock) => {
    let screen: any;
    await act(async () => {
      screen = render(
        <Vault
          token="token123"
          open
          unifiedApi={UNIFIED_API}
          serviceId={SERVICE_ID}
          onConnectionChange={onConnectionChange}
        />
      );
    });
    return screen;
  };

  it('emits onConnectionChange(callable) on transition to callable, even as the button unmounts', async () => {
    const { setState } = setupMock('added');
    const onConnectionChange = jest.fn();
    const screen = await renderVault(onConnectionChange);

    await waitFor(() =>
      expect(screen.getByText('Authorize')).toBeInTheDocument()
    );

    // Backend confirms the connection; revalidation picks up `callable`.
    setState('callable');
    await act(async () => {
      await globalMutate(DETAIL_URL);
    });

    await waitFor(() =>
      expect(onConnectionChange).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'callable' })
      )
    );
    const callableCalls = onConnectionChange.mock.calls.filter(
      ([c]) => c?.state === 'callable'
    );
    expect(callableCalls).toHaveLength(1);
    expect(screen.queryByText('Authorize')).not.toBeInTheDocument();
  });

  it('does NOT emit callable when opening an already-callable connection', async () => {
    setupMock('callable');
    const onConnectionChange = jest.fn();
    await renderVault(onConnectionChange);

    await act(async () => {
      await Promise.resolve();
    });

    const callableCalls = onConnectionChange.mock.calls.filter(
      ([c]) => c?.state === 'callable'
    );
    expect(callableCalls).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test, verify it FAILS**

Run: `yarn tsdx test on-connection-change`
Expected: the first test FAILS (`onConnectionChange` never called with `callable`) — reproduces the bug.

- [ ] **Step 3: Add the provider emitter** — `src/utils/useConnections.tsx`

Import `useRef` (add to the existing React import at line 2-9):

```tsx
import React, {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
```

Add the ref just after `const prevConnection: any = usePrevious(connection);` (line 125):

```tsx
  // Last `${id}:${state}` we emitted via onConnectionChange, from ANY path.
  // Used to dedup the callable transition below against updateConnection.
  const lastEmittedRef = useRef<string | null>(null);
```

Add this effect immediately after the existing `[connection]` effect that ends at line 172:

```tsx
  // GH-148: emit onConnectionChange once when a connection transitions into the
  // usable `callable` state. Lives in the provider (which does not unmount on the
  // view switch), so it fires reliably regardless of the AuthorizeButton lifecycle.
  useEffect(() => {
    if (!connection?.id || connection.state !== 'callable') return;

    const key = `${connection.id}:callable`;
    if (lastEmittedRef.current === key) return;

    // First render we see this connection (e.g. opening one that is already
    // callable): record it but do not emit — there was no transition.
    if (prevConnection?.id !== connection.id) {
      lastEmittedRef.current = key;
      return;
    }

    lastEmittedRef.current = key;
    onConnectionChange?.(connection);
  }, [connection]);
```

In `updateConnection`, record the key right after the existing emit at line 398 (`onConnectionChange?.(result.data);`):

```tsx
        onConnectionChange?.(result.data);
        if (result.data?.id) {
          lastEmittedRef.current = `${result.data.id}:${result.data.state}`;
        }
```

- [ ] **Step 4: Remove the fragile emits from `AuthorizeButton`** — `src/components/AuthorizeButton.tsx`

Props interface (lines 13-17) → drop `onConnectionChange`:

```tsx
interface Props {
  connection: Connection;
  autoStartAuthorization?: boolean;
}
```

Destructure (lines 19-23):

```tsx
const AuthorizeButton = ({ connection, autoStartAuthorization }: Props) => {
```

`handleChildWindowClose` (lines 48-55) → keep `mutate`, drop the `.then` emit:

```tsx
  const handleChildWindowClose = () => {
    mutate(
      `${connectionsUrl}/${connection?.unified_api}/${connection?.service_id}`
    );
    setIsLoading(false);
  };
```

client_credentials/password branch (lines 83-88) → drop the `.then` emit:

```tsx
        mutate(
          `${connectionsUrl}/${connection?.unified_api}/${connection?.service_id}`
        );
        mutate('/vault/connections');
```

postMessage handler (lines 164-169) → drop the `.then` emit:

```tsx
        mutate(`${connectionsUrl}/${unifiedApi}/${serviceId}`);
        mutate('/vault/connections');
```

- [ ] **Step 5: Stop passing the removed prop** — `ConnectionDetails.tsx` and `ButtonLayoutMenu.tsx`

`ConnectionDetails.tsx:471-479`:

```tsx
          {shouldShowAuthorizeButton ? (
            <div className="mt-3">
              <AuthorizeButton
                connection={selectedConnection}
                autoStartAuthorization={autoStartAuthorization}
              />
            </div>
          ) : null}
```

`ButtonLayoutMenu.tsx` (the nested `<AuthorizeButton>` around line 109-111):

```tsx
        customComponent: (
          <AuthorizeButton connection={connection} />
        ),
```

- [ ] **Step 6: Run the tests, verify GREEN**

Run: `yarn tsdx test on-connection-change`
Expected: both tests PASS.
Run: `yarn tsdx test authorize-button connection-actions`
Expected: all existing OAuth tests still PASS (they assert the confirm/mutate flow, not `onConnectionChange`).

- [ ] **Step 7: Commit**

```bash
git add src/utils/useConnections.tsx src/components/AuthorizeButton.tsx \
  src/components/ConnectionDetails.tsx src/components/ButtonLayoutMenu.tsx \
  test/on-connection-change.test.tsx
git commit -m "$(cat <<'EOF'
fix: emit onConnectionChange(callable) from provider after OAuth

Move the post-OAuth "now usable" emission out of AuthorizeButton (which
unmounts the moment a connection becomes callable, cancelling the emit)
into ConnectionsProvider, which never unmounts on the view switch. Emit
once per transition into `callable`, deduped via a ref against
updateConnection. Remove the now-redundant AuthorizeButton emits + prop.

Ref #148

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### Success Criteria

**Automated:** `yarn tsdx test on-connection-change` passes; `yarn tsdx test` fully green; `yarn tsdx lint` clean.
**Manual:** In `example/`, open Vault single-connection for an oauth2 connector, complete OAuth → host receives `onConnectionChange` with `state: 'callable'` exactly once; reopening an already-connected connection emits nothing.

---

## Phase 2 — Detect a blocked popup: toast + unstick the button

### Overview

After `window.open(...)`, if the handle is `null` (popup blocker), show a toast, run `cleanup()` (resets loading + removes the leaked listener), and return. Apply in both `AuthorizeButton` and `connectionActions`. Add the two i18n strings to all 5 locales.

### Files

- Modify: `src/utils/i18n.ts` (2 keys × 5 locales)
- Modify: `src/components/AuthorizeButton.tsx` (guard after `window.open`, ~line 180)
- Modify: `src/utils/connectionActions.ts` (guard after `window.open`, ~line 167)
- Modify test: `test/authorize-button.test.tsx` (blocked-popup case)
- Modify test: `test/connection-actions.test.tsx` (blocked-popup case)

- [ ] **Step 1: Write the failing tests**

Append to `test/authorize-button.test.tsx` inside `describe('Authorize button OAuth CSRF flow', ...)`:

```tsx
  it('shows a toast and unsticks the button when the popup is blocked', async () => {
    openSpy.mockImplementation(() => null as unknown as Window);
    const { screen } = await renderAndClickAuthorize();

    await waitFor(() => {
      expect(screen.getByText('Popup blocked')).toBeInTheDocument();
    });
    // button is not stuck: still present and clickable, retry re-opens
    await act(async () => {
      fireEvent.click(screen.getByText('Authorize'));
    });
    expect(openSpy).toHaveBeenCalledTimes(2);
  });
```

Append to `test/connection-actions.test.tsx` inside its `describe`:

```tsx
  it('shows a toast when the popup is blocked', async () => {
    openSpy.mockImplementation(() => null as unknown as Window);
    const { getByText } = await triggerAndOpen();

    await waitFor(() => {
      expect(getByText('Popup blocked')).toBeInTheDocument();
    });
    expect(openSpy).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run, verify they FAIL**

Run: `yarn tsdx test authorize-button connection-actions`
Expected: the two new tests FAIL (no "Popup blocked" toast; AuthorizeButton stays in loading and does not re-open on retry).

- [ ] **Step 3: Add i18n strings** — `src/utils/i18n.ts`

Add these two keys immediately after each locale's `'Re-authorize'` line (77 en, 191 nl, 306 fr, 421 de, 537 es):

en (after `'Re-authorize': 'Re-authorize',`):
```tsx
      'Popup blocked': 'Popup blocked',
      'Please allow pop-ups and try authorizing again.':
        'Please allow pop-ups and try authorizing again.',
```
nl (after `'Re-authorize': 'Herverbinden',`):
```tsx
      'Popup blocked': 'Pop-up geblokkeerd',
      'Please allow pop-ups and try authorizing again.':
        'Sta pop-ups toe en probeer opnieuw te autoriseren.',
```
fr (after `'Re-authorize': 'Réautoriser',`):
```tsx
      'Popup blocked': 'Fenêtre pop-up bloquée',
      'Please allow pop-ups and try authorizing again.':
        'Veuillez autoriser les pop-ups et réessayer l’autorisation.',
```
de (after `'Re-authorize': 'Erneut autorisieren',`):
```tsx
      'Popup blocked': 'Pop-up blockiert',
      'Please allow pop-ups and try authorizing again.':
        'Bitte erlaube Pop-ups und versuche die Autorisierung erneut.',
```
es (after `'Re-authorize': 'Reautorizar',`):
```tsx
      'Popup blocked': 'Ventana emergente bloqueada',
      'Please allow pop-ups and try authorizing again.':
        'Permite las ventanas emergentes e inténtalo de nuevo.',
```

- [ ] **Step 4: Guard in `AuthorizeButton`** — insert immediately after the `const child = window.open(...)` block (before `timer = setInterval(...)`, ~line 181):

```tsx
      if (!child) {
        addToast({
          title: t('Popup blocked'),
          description: t('Please allow pop-ups and try authorizing again.'),
          type: 'error',
          autoClose: true,
        });
        cleanup();
        return;
      }
```

- [ ] **Step 5: Guard in `connectionActions.handleRedirect`** — insert immediately after its `const child = window.open(...)` block (before `timer = setInterval(...)`, ~line 168):

```tsx
      if (!child) {
        addToast({
          title: t('Popup blocked'),
          description: t('Please allow pop-ups and try authorizing again.'),
          type: 'error',
          autoClose: true,
        });
        cleanup();
        return;
      }
```

- [ ] **Step 6: Run, verify GREEN**

Run: `yarn tsdx test authorize-button connection-actions`
Expected: all tests PASS, including the two new blocked-popup tests.

- [ ] **Step 7: Commit**

```bash
git add src/utils/i18n.ts src/components/AuthorizeButton.tsx \
  src/utils/connectionActions.ts test/authorize-button.test.tsx \
  test/connection-actions.test.tsx
git commit -m "$(cat <<'EOF'
fix: detect blocked popup on authorize instead of hanging the button

autoStartAuthorization (and any authorize/re-authorize) calls window.open;
a popup blocker returns null and left the button stuck loading forever.
Detect the null handle, toast, and reset state so a manual click (a real
user gesture) can retry. Adds "Popup blocked" copy to all 5 locales.

Ref #148

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### Success Criteria

**Automated:** `yarn tsdx test` fully green; `yarn tsdx lint` clean; `yarn tsdx build` succeeds.
**Manual:** With popups blocked, clicking Authorize shows the "Popup blocked" toast and the button returns to its normal (clickable) state; a second click (a user gesture) opens the OAuth window.

---

## Final Verification

- [ ] `yarn tsdx test` — all suites pass.
- [ ] `yarn tsdx lint` — clean.
- [ ] `yarn tsdx build` — succeeds.
- [ ] `git push` the branch; open PR against `main` referencing #148.
