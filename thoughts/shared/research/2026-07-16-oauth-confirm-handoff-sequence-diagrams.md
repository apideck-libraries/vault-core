# OAuth confirm handoff — current vs. proposed flow (sequence diagrams)

**Date:** 2026-07-16
**Related:**
- Problem & security requirements: [`2026-07-14-oauth-confirm-iframe-context.md`](./2026-07-14-oauth-confirm-iframe-context.md)
- Failure repro: [`example/opener-severed-confirm/`](../../../example/opener-severed-confirm/)
- Design go/no-go experiment (GO on Blink, Gecko, WebKit): [`example/storage-roundtrip/`](../../../example/storage-roundtrip/)

An embedded (vault-core) OAuth connection only becomes `callable` after a
client-driven `POST /confirm` carrying the single-use `confirm_token`. The
diagrams below show how that token travels today, exactly where it dies, and
how the proposed design reroutes it.

---

## 1. Current behavior — happy path (opener intact)

The `confirm_token` travels **backwards** out of the popup via
`window.opener.postMessage`, and the widget (which holds the session JWT)
redeems it.

```mermaid
sequenceDiagram
    autonumber
    participant W as Widget<br/>(vault-core, iframe in customer page,<br/>holds session JWT)
    participant P as Popup tab
    participant PR as Provider<br/>(e.g. Xero)
    participant U as Unify API
    participant CB as Vault oauth/callback<br/>(page in popup, no JWT)

    W->>P: window.open(authorize URL)
    P->>U: GET /vault/authorize
    U-->>P: 302 → provider consent
    P->>PR: user authenticates & consents
    PR-->>P: 302 → unify callback (code)
    P->>U: OAuth code exchange (CallbackConnectionUseCase)
    U-->>P: 302 → vault /oauth/callback#nonce&confirm_token&service_id
    Note over CB: confirm_token minted post-completion,<br/>delivered only into this tab
    CB->>W: window.opener.postMessage(confirm_token) ✅ opener is alive
    CB->>CB: window.close()
    W->>U: POST /confirm (JWT + confirm_token)
    U-->>W: connection → callable ✅ (+ vault.connection.callable webhook)
```

---

## 2. Current behavior — the failure (opener severed by COOP)

When any page in the popup's navigation chain (provider or callback) is served
with `Cross-Origin-Opener-Policy: same-origin`, the browser moves the popup
into a new browsing-context group and **`window.opener` becomes `null`**.
Deterministic per configuration — for a nested-iframe embedder like OCTA it
fails 100% of the time.

```mermaid
sequenceDiagram
    autonumber
    participant W as Widget<br/>(vault-core, iframe in customer page,<br/>holds session JWT)
    participant P as Popup tab
    participant PR as Provider<br/>(e.g. Xero)
    participant U as Unify API
    participant CB as Vault oauth/callback<br/>(page in popup, no JWT)

    W->>P: window.open(authorize URL)
    P->>U: GET /vault/authorize
    U-->>P: 302 → provider consent
    rect rgb(254, 226, 226)
        P->>PR: user authenticates & consents
        Note over P,PR: a page in this chain carries<br/>COOP: same-origin →<br/>browsing-context group swap →<br/>window.opener = null 💥
    end
    PR-->>P: 302 → unify callback (code)
    P->>U: OAuth code exchange
    U-->>P: 302 → vault /oauth/callback#nonce&confirm_token&service_id
    rect rgb(254, 226, 226)
        Note over CB: if (window.opener) → FALSE<br/>confirm_token silently DROPPED
        CB->>CB: window.close()  ← token lost forever
    end
    W->>W: child.closed poller fires → re-fetch
    Note over W: connection still authorized /<br/>pending_confirmation — but the UI<br/>treats popup-close as success 💥
    Note over U: no /confirm ever arrives →<br/>stuck pending_confirmation,<br/>no callable webhook,<br/>confirm_token expires in 30 min
```

**Why no client-side patch fixes this as-is:** the callback page has no JWT
(it cannot self-confirm), and every backwards channel from a top-level popup
into a nested cross-origin iframe — opener, BroadcastChannel, localStorage,
relay iframes — is destroyed by the same COOP severance or by storage
partitioning. The opener channel is simultaneously the CSRF gate and the
failure.

---

## 3. Proposed behavior — grant handed forward at open time

Invert the direction: don't carry the secret backwards after completion —
carry a delegation **forwards at open time**, when the opener link is
guaranteed alive because the popup's first page (`oauth/launch`) is
vault-origin and served **without COOP**. The popup then confirms itself
in-tab; nothing ever travels popup → widget.

```mermaid
sequenceDiagram
    autonumber
    participant W as Widget<br/>(vault-core, iframe in customer page,<br/>holds session JWT)
    participant L as Vault oauth/launch<br/>(popup page 1, vault origin, NO COOP)
    participant PR as Provider<br/>(e.g. Xero)
    participant U as Unify API
    participant CB as Vault oauth/callback<br/>(popup page 3, vault origin)

    W->>L: window.open(launch URL) — synchronous, in the click handler
    W->>U: POST authorize-init (JWT) — in parallel
    U-->>W: single-use grant<br/>(session-bound, short TTL,<br/>scoped to app+consumer+service+api)
    rect rgb(220, 252, 231)
        L->>W: postMessage("ready") — opener alive BY CONSTRUCTION
        W->>L: postMessage(grant, vaultOrigin) — never via URL
        L->>L: store grant in tab's vault-origin sessionStorage
        Note over L: no opener or no storage?<br/>→ refuse loudly, BEFORE any consent
    end
    L->>U: navigate tab → GET /vault/authorize
    U-->>L: 302 → provider consent
    rect rgb(254, 249, 195)
        L->>PR: user authenticates & consents
        Note over L,PR: COOP may sever window.opener here —<br/>IRRELEVANT: nothing uses it anymore.<br/>sessionStorage survives the context-group<br/>swap (verified: Blink, Gecko, WebKit)
    end
    PR-->>CB: 302 → unify callback → vault /oauth/callback#confirm_token
    rect rgb(220, 252, 231)
        CB->>CB: read grant from sessionStorage (single-use)
        CB->>U: POST /confirm (grant + confirm_token) — in-tab self-confirm
        U-->>CB: validates single-use, context binding,<br/>session liveness → callable ✅ (+ webhook)
        CB->>CB: window.close()
    end
    W->>U: poll connection state (JWT) after popup close
    U-->>W: callable ✅ — or an actionable error if not,<br/>never a silent fake success
```

### Why the CSRF gate still holds

Confirmation requires two halves that only ever coexist in the legitimate tab:

| Half | Minted | Reachable by a phisher who hands out a link? |
|---|---|---|
| `confirm_token` | post-completion, at the callback | No — it never leaves the completer's tab (today it crosses a `postMessage('*')` hop; the proposal removes even that) |
| grant | at initiation, from the widget's JWT | No — it enters a popup **only** through a live opener handshake at open time; no URL ever carries it |

A victim who clicks a phished authorize URL produces a token with no grant
beside it; the attacker holds a grant but never sees a token. The legacy
opener path stays as a fallback (older vault-core versions, storage-blocked
browsers), so the rollout is purely additive.

### Failure modes, before vs. after

| Failure mode | Current | Proposed |
|---|---|---|
| COOP on provider/callback chain (the OCTA bug) | silent strand | **fixed** — no opener dependency after open time |
| Nested cross-origin iframes / storage partitioning | silent strand | **fixed** — nothing travels back into the iframe |
| Customer's own top-level page sets COOP | silent strand | loud, pre-consent, customer-fixable error |
| Popup blocked / custom `redirect_uri` | broken | unchanged — separate hardening (existing plan Phases 1–2) |
