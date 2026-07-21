import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Multi-page: the plain direct render (index.html) plus the iframe-embedding
// repro for GH-9546 — a host page (iframe.html) and the framed Vault document
// (vault.html). In dev, Vite serves each by path (/iframe.html, /vault.html);
// these inputs only matter for `vite build`.
const pages = {
  index: path.resolve(__dirname, 'index.html'),
  iframe: path.resolve(__dirname, 'iframe-test/iframe.html'),
  vault: path.resolve(__dirname, 'iframe-test/vault.html'),
  // opener-severed confirm repro (OCTA): real <Vault> widget nested in genuine
  // cross-origin iframes (localhost → 127.0.0.1 → [::1]) against real Unify,
  // plus a probe popup (probe.html) that models vault's oauth/callback.
  openerOuter: path.resolve(__dirname, 'opener-severed-confirm/outer.html'),
  openerMiddle: path.resolve(__dirname, 'opener-severed-confirm/middle.html'),
  openerWidget: path.resolve(__dirname, 'opener-severed-confirm/widget.html'),
  openerProbe: path.resolve(__dirname, 'opener-severed-confirm/probe.html'),
  // sessionStorage round-trip experiment (storage-roundtrip/): step 0 of the
  // proposed confirm-handoff fix — does a tab's vault-origin sessionStorage
  // survive COOP browsing-context-group swaps mid-navigation-chain?
  storageHost: path.resolve(__dirname, 'storage-roundtrip/host.html'),
  storageWidget: path.resolve(__dirname, 'storage-roundtrip/widget.html'),
  storageLaunch: path.resolve(__dirname, 'storage-roundtrip/launch.html'),
  storageProvider: path.resolve(__dirname, 'storage-roundtrip/provider.html'),
  storageCallback: path.resolve(__dirname, 'storage-roundtrip/callback.html'),
  // grant-handoff end-to-end harness (grant-handoff/): the REAL <Vault> on the
  // NEW grant-handoff code path against REAL local unify (https://localhost:3050)
  // with a REAL OAuth round-trip. The harness only serves its OWN vault-side
  // oauth/launch + oauth/callback stand-ins (so it can inject COOP on the
  // callback); everything unify does is real. Proves severed mode still reaches
  // state `callable`.
  grantHandoffOuter: path.resolve(__dirname, 'grant-handoff/outer.html'),
  grantHandoffMiddle: path.resolve(__dirname, 'grant-handoff/middle.html'),
  grantHandoffWidget: path.resolve(__dirname, 'grant-handoff/widget.html'),
  grantHandoffLaunch: path.resolve(__dirname, 'grant-handoff/launch.html'),
  grantHandoffCallback: path.resolve(__dirname, 'grant-handoff/callback.html'),
};

// Deterministically reproduce the OCTA opener severance with a REAL header
// instead of monkey-patching window.open. COOP is ignored on iframe documents
// and we don't control the real vault callback's headers, so the lever that
// genuinely applies is `Cross-Origin-Opener-Policy: same-origin` on the popup's
// OWN landing page (probe.html — our stand-in for vault's oauth/callback, which
// IS top-level so COOP takes effect). When that page is cross-origin to the
// widget that opened it, the browser swaps browsing-context groups and the
// popup's `window.opener` becomes null — exactly the production condition.
//
// COOP on the top-level host (outer.html) would NOT help: a popup's initial
// document inherits the top-level COOP only when the creator document is
// same-origin with its top level, and the widget iframe is cross-origin to
// outer — so the host's header never reaches popups the widget opens. Only
// pages inside the popup's own navigation chain (provider, vault callback)
// can sever it.
function openerCoopPlugin(): Plugin {
  const severed = (url: string) =>
    /[?&]opener=severed/.test(url) &&
    /\/opener-severed-confirm\/probe\.html/.test(url);
  return {
    name: 'opener-severed-coop',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && severed(req.url)) {
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        }
        next();
      });
    },
  };
}

// storage-roundtrip experiment support:
//  - COOP: same-origin on the popup chain's provider AND callback pages in
//    severed mode (the launcher stays COOP-free by design — it's the page
//    "we" control), forcing browsing-context-group swaps mid-chain.
//  - a tiny in-memory report API: the popup's final page POSTs its verdict,
//    the widget polls for it — the dev-server analog of the widget polling
//    unify for the connection state, since no browser channel reaches a
//    cross-origin nested iframe from a popup (that impossibility is the whole
//    point of the experiment).
function storageRoundtripPlugin(): Plugin {
  const coop = (url: string) =>
    /[?&]opener=severed/.test(url) &&
    /\/storage-roundtrip\/(provider|callback)\.html/.test(url);
  const reports = new Map<string, unknown>();
  return {
    name: 'storage-roundtrip',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (
          url.startsWith('/storage-roundtrip/api/report') &&
          req.method === 'POST'
        ) {
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              if (data?.run) reports.set(String(data.run), data);
            } catch {
              // ignore malformed reports
            }
            res.statusCode = 204;
            res.end();
          });
          return;
        }
        if (url.startsWith('/storage-roundtrip/api/result')) {
          const run = new URLSearchParams(url.split('?')[1] ?? '').get('run');
          const report = run ? reports.get(run) : undefined;
          res.setHeader('Content-Type', 'application/json');
          if (report) {
            res.end(JSON.stringify(report));
          } else {
            res.statusCode = 404;
            res.end('{}');
          }
          return;
        }
        if (coop(url)) {
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        }
        next();
      });
    },
  };
}

// grant-handoff end-to-end harness support (grant-handoff/). This harness drives
// the REAL <Vault> against REAL local unify (https://localhost:3050) with a REAL
// OAuth round-trip — there is NO unify stub and NO CORS shim here (unify serves
// its own endpoints and its own CORS). The dev server's ONLY jobs are:
//   1. Internal rewrites (keep the query string) so deriveLaunchUrl's hard-coded
//      /oauth/launch and unify's redirect to /oauth/callback resolve to our own
//      COOP-controllable stand-in pages.
//   2. COOP lever: Cross-Origin-Opener-Policy: same-origin on the CALLBACK ONLY
//      in severed mode (NEVER the launch page) — this is what severs the popup's
//      window.opener, reproducing the OCTA condition. Real unify redirects back
//      to /oauth/callback without our ?opener param, so severed mode is read from
//      the `gh_opener` cookie the outer host set on the localhost origin (with a
//      query-param fallback for direct hits).
function grantHandoffPlugin(): Plugin {
  const isSevered = (query: URLSearchParams, cookie: string): boolean => {
    if (query.get('opener') === 'severed') return true;
    return /(?:^|;\s*)gh_opener=severed(?:;|$)/.test(cookie);
  };

  return {
    name: 'grant-handoff',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const rawUrl = req.url ?? '';
        const [pathOnly, search = ''] = rawUrl.split('?');
        const query = new URLSearchParams(search);

        // 1. Internal rewrites (keep the query string) so /oauth/launch and
        //    /oauth/callback resolve to our real stand-in pages.
        if (pathOnly === '/oauth/launch') {
          req.url = `/grant-handoff/launch.html${search ? `?${search}` : ''}`;
        } else if (pathOnly === '/oauth/callback') {
          req.url = `/grant-handoff/callback.html${search ? `?${search}` : ''}`;
        }

        // 2. COOP lever in severed mode — the CALLBACK ONLY, never the launch
        //    page. The launch page must keep window.opener intact by
        //    construction; severance happens here, on the final callback.
        const coopTarget = /\/grant-handoff\/callback\.html/.test(
          req.url ?? ''
        );
        if (coopTarget && isSevered(query, req.headers.cookie ?? '')) {
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        }

        next();
      });
    },
  };
}

// Force a single React copy across the example AND the in-tree vault-core source.
// Without this, Vite finds nested React copies in the parent's node_modules and
// the React tree fails with "Invalid hook call".
export default defineConfig({
  plugins: [
    react(),
    openerCoopPlugin(),
    storageRoundtripPlugin(),
    grantHandoffPlugin(),
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      react: path.resolve(__dirname, '../node_modules/react'),
      'react-dom': path.resolve(__dirname, '../node_modules/react-dom'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
  css: { postcss: { plugins: [] } },
  build: {
    rollupOptions: {
      input: pages,
    },
  },
  server: {
    port: 1234,
    open: false,
    // Bind all loopback addresses so the opener-severed harness can nest the
    // widget across genuinely different origins on one server: localhost,
    // 127.0.0.1 and [::1] are three distinct origins that all hit this server.
    host: true,
  },
});
