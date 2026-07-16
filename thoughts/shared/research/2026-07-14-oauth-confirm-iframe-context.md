# OAuth confirm handoff — problem, requirements, rejected options

**Date:** 2026-07-14

## Problem

Embedded Vault (`@apideck/react-vault`) requires a client-driven `POST /confirm` to move an OAuth connection from `authorized` → `callable`. After OAuth, vault's popup callback delivers the `confirm_token` to the widget only via `window.opener.postMessage`. When the widget is nested in cross-origin iframes (OCTA), `window.opener` is `null` (COOP / popup isolation), the token is dropped, `/confirm` never fires, and the connection is stuck at `pending_confirmation` with no `vault.connection.callable` webhook.

Not random — deterministic per configuration (provider COOP behavior × embedded-or-not × browser storage partitioning). "Spotty" only across the population of accounts. For a given setup (e.g. OCTA) it fails 100%.

## Requirements any fix must satisfy

The confirm step is the CSRF gate. Removing or weakening it enables account-harvesting: a Vault user crafts an authorize URL bound to their own consumer, phishes a provider-account owner (who need not be a Vault user), and on the victim's consent the attacker's consumer gets connected to the victim's provider account.

To prevent that, the confirming secret must be:

1. **Minted post-completion** (after the victim authenticates) — so whoever crafted the initiation link can't know it up front.
2. **Delivered only into the browsing context that initiated the flow**, and redeemable only with the matching session JWT — so a phisher who merely handed out a link never receives it.

The current design meets both via the opener channel. That channel is exactly what nested cross-origin iframes destroy — so the security mechanism and the failure are the same object. No client-side rearrangement keeps both requirements and survives the iframe.

### Additional constraints

- No `event.origin` allowlists / no redirect-origin manipulation (vault + vault-core are customer-self-deployable).
- Consent phishing itself (victim consents on the real provider) is the provider's consent-screen responsibility — out of scope; but the fix must not make the attack a one-click, no-token affair.

## Options already declined

| Option | Why declined |
|---|---|
| **Surface an error / retry on popup-close** (frontend hardening) | Workaround, not a fix — just tells the user it failed. Doesn't make nested-iframe work. |
| **`window.opener` / relay-iframe / BroadcastChannel / localStorage** | All die on COOP (severed window handle) or storage partitioning (a vault-origin iframe under a customer top-level site is in a different storage partition than the top-level vault popup). No in-browser channel carries data from a top-level cross-site popup into a deeply-nested third-party iframe. |
| **Session-scoped `POST /confirm-pending`** (confirm any pending state for the consumer, no token echo) | Reopens CSRF: degrades to "confirm whatever is pending," reintroducing connection injection. |
| **Widget-minted nonce sent outbound, redeemed with JWT** | Violates requirement 1: a secret present at initiation is known to the link-crafter (the attacker), who can then confirm. |
| **Server-side auto-confirm at unify callback** | Callback is unauthenticated, and the flow binds to the attacker's consumer in the phishing case — auto-confirm hands the attacker the victim's account with zero further steps. Strictly worse. |
