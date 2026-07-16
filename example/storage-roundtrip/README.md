# sessionStorage round-trip experiment — step 0 of the confirm-handoff fix

Empirically tests the **single unverified assumption** of the proposed fix for
the OAuth confirm handoff (the failure reproduced in
`../opener-severed-confirm/`): connections stuck at `pending_confirmation`
because COOP on the popup's navigation chain severs `window.opener`, the only
channel that delivers the `confirm_token` today.

## The proposed fix, in one paragraph

Instead of carrying the secret **backwards** (popup → widget) **after** OAuth
completes — through an opener link that third-party COOP may have destroyed —
carry a single-use **grant forwards** (widget → popup) **at open time**, when
the opener link is guaranteed alive because the popup's first page is a
vault-origin launcher whose headers we control. The launcher stores the grant
in the tab's vault-origin `sessionStorage`; after the provider redirect chain,
the vault-origin callback reads it back and **self-confirms in-tab** (grant +
`confirm_token`). Nothing ever needs to travel back into the nested iframe.
Security is preserved because the grant only enters a popup through a live
opener handshake (a handed-out URL can never carry it) and is useless without
the `confirm_token` minted post-completion inside the completer's tab.

## The question this harness answers

> Does a tab's vault-origin `sessionStorage` survive the browsing-context-group
> swaps that `COOP: same-origin` pages cause mid-navigation-chain?

If **yes** (expected per spec — session storage is keyed to the tab's session,
not the browsing-context group): the design is viable. If **no** on any major
browser: the design is falsified before anything is built. That's the go/no-go.

## What one run does

```
widget (127.0.0.1, cross-origin iframe under localhost host)
  │ window.open ──────────────► launch.html   (localhost = "vault", NO COOP)
  │ ◄── ready ping (opener LIVE)     │
  │ ──── grant via postMessage ────► │  stores grant in sessionStorage,
  │      (explicit targetOrigin)     │  navigates the tab:
  │                                  ▼
  │                              provider.html ([::1], COOP: same-origin when
  │                                  │           severed → context-group swap,
  │                                  │           opener dies here)
  │                                  ▼
  │                              callback.html (localhost = "vault" again,
  │                                  │           also COOP-served when severed)
  │                                  │  reads grant from sessionStorage,
  │                                  │  checks window.opener,
  │                                  │  POSTs verdict to the dev server
  │                                  ▼
  └── polls /storage-roundtrip/api/result ◄──── (the production analog:
      and shows GO / NO-GO                       widget polls unify)
```

The run id in URLs is a non-secret correlation id. The grant **never** appears
in a URL — that rule is security-load-bearing in the real design, so the
harness observes it too.

## Run

```bash
cd example
yarn install
yarn start        # http://localhost:1234 (or next free port)
```

Open the host on **localhost** (the origins assume it), allow popups:

- **Control:** http://localhost:1234/storage-roundtrip/host.html?opener=intact
- **The experiment:** http://localhost:1234/storage-roundtrip/host.html?opener=severed

Click **Run experiment**, watch the popup walk the chain, then read the widget
banner:

| Mode | Expected result |
|---|---|
| `intact` | opener LIVE at callback, grant survived — both channels work |
| `severed` | opener **null** at callback (today's flow would drop the token) but grant **survived** → **GO ✅** |
| any | grant missing at callback → **NO-GO ❌** — design falsified on that browser; record the reported user agent |

Repeat the severed run in **Chrome, Safari, and Firefox** (and once in private
mode per browser) before calling it a GO.

### Safari note

Safari cannot load literal-IPv6 URLs (`http://[::1]:…`) — a WebKit/Safari
networking limitation Chrome, Firefox and DuckDuckGo don't share. On
Safari-like browsers the harness auto-falls back to `127.0.0.1` for the
provider hop (see `shared.ts`). The provider then shares the widget's origin,
which is cosmetically less realistic but mechanically irrelevant: the tested
storage bucket is the popup tab's `localhost` (vault) one, and `127.0.0.1` is
still cross-origin to it, so the COOP context-group swap still happens. The
widget banner shows which provider origin is active. The popup chain also
posts per-hop progress reports, so a stall names its last completed hop
instead of hanging silently.

### Results so far (severed mode)

| Browser | Engine | Result |
|---|---|---|
| Chromium (headless, Playwright) | Blink | **GO ✅** — opener dead, grant survived |
| Firefox | Gecko | **GO ✅** — opener dead, grant survived |
| DuckDuckGo (macOS) | WebKit | **GO ✅** — opener dead, grant survived |
| Safari | WebKit | **GO ✅** — opener dead, grant survived (via the `127.0.0.1` provider fallback; the first run stalled only on Safari's inability to load the `[::1]` origin) |

**Verdict: GO on all three engines (Blink, Gecko, WebKit).** The design's core
assumption — vault-origin sessionStorage surviving COOP browsing-context-group
swaps within the popup tab — holds everywhere. Remaining nice-to-have: repeat
once per browser in private mode.

## What else the harness demonstrates

- **Launcher guardrails:** open `launch.html` directly (no opener) — it refuses
  to start the flow. That's the anti-phishing property: a handed-out launcher
  link goes nowhere. It also write-read probes sessionStorage before relying
  on it.
- **Grant invisibility:** the provider page shows it cannot read the grant
  (different origin → different sessionStorage bucket).
- **The full proposed flow shape end-to-end:** open-time handshake in, storage
  across, server-side confirm out, widget polls — each stand-in maps 1:1 to a
  production piece (launcher → vault `oauth/launch`, report POST → in-tab
  `POST /confirm`, result polling → connection-state polling at unify).

## Files

| File | Origin | Stands in for |
|---|---|---|
| `host.html` / `host.tsx` | `localhost` | customer top-level page |
| `widget.html` / `widget.tsx` | `127.0.0.1` | embedded vault-core widget |
| `launch.html` / `launch.tsx` | `localhost` | proposed vault `oauth/launch` |
| `provider.html` / `provider.tsx` | `[::1]` | OAuth provider (COOP lever) |
| `callback.html` / `callback.tsx` | `localhost` | vault `oauth/callback` self-confirm |
| `shared.ts` | — | origins, message types, report client |

COOP headers and the report API live in `../vite.config.ts`
(`storageRoundtripPlugin`).

## Related

- Today's failure repro: `../opener-severed-confirm/`
- Problem & requirements: `../../thoughts/shared/research/2026-07-14-oauth-confirm-iframe-context.md`
- Prior plan this supersedes in part: `../../../unify/thoughts/shared/plans/2026-07-13-vault-oauth-csrf-confirm-handoff-fix.md`
