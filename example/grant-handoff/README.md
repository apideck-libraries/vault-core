# grant-handoff end-to-end harness — the OCTA fix, proven against REAL unify

Drives the **real** `<Vault>` through the **new** OAuth grant-handoff code path
(`src/utils/oauthGrantHandoff.ts` + `src/components/AuthorizeButton.tsx`)
against **REAL local unify** (`https://localhost:3050`) with a **REAL** OAuth
round-trip (real QuickBooks consent, real `confirm_token`). The harness serves
only its **own** vault-side `oauth/launch` + `oauth/callback` stand-ins, so it
can withhold/inject the COOP header and force the severed-opener condition
deterministically. Nothing about unify is stubbed.

## What it proves

The OCTA failure (reproduced in `../opener-severed-confirm/`): when the OAuth
popup's navigation chain crosses a `COOP: same-origin` page, the browser swaps
browsing-context groups and the popup's `window.opener` becomes **null**. The
legacy flow delivered the `confirm_token` back through that opener, so the
connection stranded at `pending_confirmation`.

This harness shows that with the grant-handoff fix, in **severed** mode:

- the callback's `window.opener` **is null** (old channel dead), **yet**
- the connection still reaches state **`callable`**, because the callback
  **self-confirms in-tab** with a grant it read from the tab's vault-origin
  `sessionStorage`, POSTing `{ confirm_token, grant }` straight to REAL unify —
  it never needs the opener.

In **intact** mode the connection also reaches `callable` (the self-confirm
never used the opener either). The contrast with `../opener-severed-confirm/`,
where severed mode strands the connection, is the whole point.

## How one severed run flows

```
outer (localhost, top host, sets gh_opener cookie)
 └─ middle ([::1], iframe)
     └─ widget (127.0.0.1, iframe) — REAL <Vault>, new grant-handoff path
         │ click Authorize
         │ POST {unify}/vault/connections/accounting/quickbooks/grant  → REAL grant
         │ window.open ─────────────► /oauth/launch  (localhost = vault, NO COOP)
         │ ◄── oauth_launch_ready (opener LIVE here)      │
         │ ──── oauth_launch_start { grant, authorizeUrl }►│ stash grant in
         │      (explicit targetOrigin = launch origin)    │ sessionStorage,
         │                                                 │ navigate tab ▼
         │                                    REAL unify authorize → REAL QuickBooks
         │                                             │  consent, unify mints
         │                                             │  confirm_token, 302 ▼
         │                                    /oauth/callback (localhost, COOP:
         │                                             │  same-origin → context
         │                                             │  group swaps, opener dies)
         │                                             │  read grant (single-use),
         │                                             │  opener === null,
         │                                             │  POST { confirm_token, grant }
         │                                             ▼    to REAL unify /confirm
         └── widget status panel polls REAL unify connection detail ◄── state → callable
```

The grant travels only via postMessage → sessionStorage → the confirm POST
body. It **never** appears in any URL (that rule is security-load-bearing).

## Prerequisites

- **unify** running locally on `https://localhost:3050` with the grant-handoff
  PR (`POST .../grant`; `.../confirm` accepting `{ confirm_token, grant }`).
  Visit **https://localhost:3050 once in the browser** to accept its self-signed
  cert, or the in-browser `fetch`es fail.
- The connector under test configured in unify for app **2222**:
  `unified_api=accounting`, `service_id=quickbooks` (already in `example/.env`).
- **QuickBooks sandbox** reachable for the real consent screen.
- vault on `http://localhost:3003` is **optional** — this harness serves its own
  launch/callback stand-ins and does not use vault's pages.
- A **real unify-issued session token** in `example/.env` (`VITE_VAULT_TOKEN`),
  minted below. Its top-level `redirect_uri` claim must be
  `http://localhost:1234/oauth/callback`.

## Run

```bash
# 1. Mint a real session token into example/.env (leaves other vars intact):
cd example
UNIFY_ADMIN_API_KEY=sk_... ./grant-handoff/mint-session.sh
#   (or: ./grant-handoff/mint-session.sh --key sk_...)
#   Prints the token exp. Tokens are ~1h TTL — re-run when it expires.

# 2. From the repo root, build vault-core so example/ imports the compiled dist:
cd ..
yarn build

# 3. Start the example dev server:
cd example
yarn install   # first time only
yarn start     # http://localhost:1234
```

Open on **localhost** (the origins assume it) and allow popups:

- **Control (intact):**
  http://localhost:1234/grant-handoff/outer.html?opener=intact
- **OCTA repro (severed — the real test):**
  http://localhost:1234/grant-handoff/outer.html?opener=severed

Click **Authorize** in the widget, complete the real QuickBooks consent, and let
the popup walk the chain back to `/oauth/callback`.

## Expected result

| Mode | Widget status panel (live unify state) | Callback popup verdict |
|---|---|---|
| `intact` | flips to **callable ✅ (PASS)** | self-confirm fired; `window.opener` LIVE (unused) |
| `severed` | flips to **callable ✅ (PASS)** | **GO ✅ — `window.opener: null` but self-confirm fired** |

In **severed** mode the callback shows `window.opener` **null** — the OLD flow
would strand the connection right here — yet the connection still reaches
`callable` via the in-tab self-confirm. That is the fix.

Contrast: in `../opener-severed-confirm/`, severed mode leaves the connection
stuck (the dropped `confirm_token` is never confirmed).

## Files

| File | Origin | Stands in for |
|---|---|---|
| `outer.tsx` / `.html` | `localhost` | customer top-level host + mode toggle (sets `gh_opener` cookie) |
| `middle.tsx` / `.html` | `[::1]` | middle cross-origin iframe |
| `widget.tsx` / `.html` | `127.0.0.1` | embedded vault-core widget — REAL `<Vault>` |
| `launch.tsx` / `.html` | `localhost` | REAL vault `oauth/launch` (NO COOP) |
| `callback.tsx` / `.html` | `localhost` | REAL vault `oauth/callback` self-confirm (COOP lever in severed) |
| `origins.ts` | — | origins, mode, service ids, unify base, storage key |
| `mint-session.sh` | — | mints a real unify session token into `example/.env` |

The `/oauth/*` rewrites and the callback COOP lever live in `../vite.config.ts`
(`grantHandoffPlugin`). There is **no** unify stub and **no** CORS shim — unify
serves its own endpoints and CORS.

### Safari note

Safari cannot load literal-IPv6 origins (`http://[::1]:…`). On Safari-like
browsers the middle-iframe hop falls back to `127.0.0.1` (see `isSafariLike` in
`origins.ts`). The widget is still cross-origin to the localhost outer/vault, and
the opener severance comes from COOP on the callback, so the repro still holds.

### confirm_token delivery

unify delivers the `confirm_token` in the redirect back to
`http://localhost:1234/oauth/callback`. Per the sequence diagrams
(`../../thoughts/shared/research/2026-07-16-oauth-confirm-handoff-sequence-diagrams.md`)
it arrives in the URL **fragment** (`…/oauth/callback#…confirm_token…`). The
callback stand-in is tolerant — it scans both the query string and the hash for
`confirm_token` (and a few variants) and logs the raw URL to the console so you
can see exactly how unify delivered it.

## Related

- Today's failure repro: `../opener-severed-confirm/`
- The sessionStorage assumption this relies on: `../storage-roundtrip/`
- Problem & requirements:
  `../../thoughts/shared/research/2026-07-14-oauth-confirm-iframe-context.md`
- Sequence diagrams:
  `../../thoughts/shared/research/2026-07-16-oauth-confirm-handoff-sequence-diagrams.md`
