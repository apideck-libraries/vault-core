---
github_issue_url: https://github.com/apideck-libraries/vault-core/issues/9546
status: draft
related_research: thoughts/shared/research/2026-05-06-GH-9546-example-app-css-loading.md
---

# Example App CSS Import Implementation Plan

**Related Issue**: [GH-9546](https://github.com/apideck-libraries/vault-core/issues/9546)

---

## Pattern Decisions

- **Consumer-style CSS import** (Option A in design discussion): one-line `import` of the pre-built `dist/styles.css` from `example/index.tsx`. Mirrors `README.md:70` (`import '@apideck/react-vault/dist/styles.css';`) and is the same pattern a real package consumer uses.
- **No new tooling in `example/`**: no `tailwindcss`, `postcss`, or `autoprefixer` added to `example/package.json`; no `postcss.config.js` introduced; no changes to `example/vite.config.ts`. The example continues to consume the package's built artifacts.
- **No tests written**: the change is a single side-effect import; there is no unit-test surface. Verification is a single manual browser check on `yarn start`.
- **Files touched**: `example/index.tsx` only.

---

## Overview

The example/playground app at `example/` mounts `<Vault>` but renders without styling. The package ships pre-built CSS files in `dist/` that are not referenced by the JS bundle — by design, consumers import them explicitly (per `README.md:70`). The example app currently does not. This plan adds that one consumer-style import so the playground renders as a styled, real-consumer-equivalent harness.

## Current State Analysis

From `thoughts/shared/research/2026-05-06-GH-9546-example-app-css-loading.md`:

- `example/index.tsx:1-3` — three imports, none CSS.
- `example/index.html` — no `<link>` tag, no inline `<style>`.
- `example/vite.config.ts` — no CSS / PostCSS / Tailwind configuration.
- `example/package.json` — no Tailwind/PostCSS dependencies.
- `dist/react-vault.esm.js` (which `import { Vault } from '../.'` resolves to) contains no `*.css` import.
- `dist/styles.css` exists in the working tree (built locally; produced by the `copy-css` script — `package.json:24`).
- `dist/` is gitignored (`.gitignore:6`), so a fresh checkout requires `yarn build` (or at least `yarn build-tailwind`) before `yarn start` in `example/`. This is already a pre-condition for the example today: `'../.'` resolves to `dist/react-vault.esm.js`, which only exists after a build.
- Storybook follows the same explicit-import pattern: `.storybook/preview.js:1`, `stories/Vault.stories.tsx:1`, `stories/ConnectionForm.stories.tsx:1`.

## Desired End State

After this plan:

- `example/index.tsx` imports `'../dist/styles.css'` as a side-effect import.
- Running `yarn start` from `example/` (after the package has been built once) serves the playground with the Vault modal fully styled — Tailwind utilities applied under the `#react-vault` / `.apideck` scope, identical to how a real package consumer would see it.
- No source code in `src/` changed; no test changes; no build-pipeline changes.
- `tsdx test --no-watch`, `tsdx lint`, and `tsdx build` continue to pass at their current state (this change does not touch the published package surface).

### Key Discoveries:

- `README.md:70` documents the consumer import path as `'@apideck/react-vault/dist/styles.css'`. Within the monorepo's example app, the relative equivalent is `'../dist/styles.css'`.
- `dist/styles.css` is itself just `@import './tailwind.css'; @import './custom.css';` (copy of `src/styles/base.css`). Importing it pulls the full styled output transitively. Vite's CSS handling resolves the `@import` chain at dev time without any extra configuration.
- The Vault root element at `src/components/Vault.tsx:180` carries `id="react-vault"` and `className="apideck"`, matching the `important: '#react-vault'` scope in `tailwind.config.js` and the `.apideck`-prefixed selectors in `dist/custom.css`.

## What We're NOT Doing

- **Not** adding `tailwindcss` / `postcss` / `autoprefixer` to `example/package.json`.
- **Not** modifying `example/vite.config.ts` to handle CSS preprocessing.
- **Not** adding HMR for CSS edits in the playground (Option B from the design discussion).
- **Not** adding a `<link>` tag to `example/index.html` (Option C).
- **Not** adding a `prestart` build script to `example/package.json` (the build pre-condition already exists implicitly because of `import { Vault } from '../.'`).
- **Not** changing any CSS source files (`src/styles/*.css`), `tailwind.config.js`, `postcss.config.js`, or `tsdx.config.js`.
- **Not** changing the published package's CSS distribution or `package.json` `main`/`module`/`files`/`exports` fields.
- **Not** updating `README.md` — the documented consumer pattern is already correct and is exactly what we're now mirroring.

## Implementation Approach

Single-line side-effect import added to `example/index.tsx`. Verification is one manual browser check; there is no unit-test or build-pipeline surface to exercise.

---

## Phase 1: Add `dist/styles.css` import to example app

### Overview

Add a single side-effect CSS import to `example/index.tsx` so the playground renders the Vault modal with full styling, matching the consumer pattern documented in `README.md:70`.

### Session Startup Protocol
1. Verify working directory: `pwd` → must be `/Users/lagoni/Documents/apideck/vault-core`
2. Read progress JSON: `thoughts/shared/progress/2026-05-06-GH-9546-example-app-css-import-status.json`
3. Confirm `current_phase` is `1`
4. Confirm `dist/styles.css` exists locally (`ls dist/styles.css`); if missing, run `yarn build` once before manual verification (this build is environmental, not a plan deliverable).

### Changes Required:

#### 1. example/index.tsx — add CSS side-effect import

**File**: `example/index.tsx` (top of file, alongside the existing imports at lines 1–3)
**Change**: Add `import '../dist/styles.css';` as a side-effect import.

**Key Implementation Notes**:

- Place the CSS import **after** the React imports and **after** the `import { Vault } from '../.';` line. Side-effect imports conventionally come last so module imports remain visually grouped at the top.
- Use a relative path `'../dist/styles.css'`. Do **not** use the package-name path `'@apideck/react-vault/dist/styles.css'` — the example is in-tree and not installed as a node_module, so the package-name path won't resolve cleanly through Vite's alias setup (`example/vite.config.ts:13-14` aliases `react`/`react-dom` only).
- Build pre-condition: `dist/styles.css` must exist on disk for Vite to resolve the import at dev time. This is already true for the existing import `'../.'` (which resolves to `dist/react-vault.esm.js`), so no new pre-condition is being introduced. Document is not needed in `example/README.md` (the file does not exist and the package `README.md` already covers this for consumers).
- Do **not** also import `'../dist/tailwind.css'` or `'../dist/custom.css'` separately — `dist/styles.css` is `@import './tailwind.css'; @import './custom.css';` and Vite resolves the chain transitively.

**Code Sketch**:

```tsx
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Vault } from '../.';
import '../dist/styles.css';

// ... rest of file unchanged
```

### Success Criteria:

#### Automated Verification:
- `tsdx lint` passes (no source-code changes; should remain at current pre-existing state — note the pre-existing `eslint-plugin-prettier` warning called out in `thoughts/shared/prs/csrf_fix_2_description.md` is not in scope and is unrelated)
- `tsdx test --no-watch` passes (no `src/` or `test/` changes; existing pass/fail count must be unchanged)
- `tsdx build` succeeds (no `src/` changes; build output remains equivalent)

#### Manual Verification:
- From `/Users/lagoni/Documents/apideck/vault-core`, run `yarn build` once if `dist/styles.css` is missing (gitignored — fresh checkouts will need this).
- From `/Users/lagoni/Documents/apideck/vault-core/example`, run `yarn start`; Vite serves on `http://localhost:1234` (per `vite.config.ts:21`).
- Open `http://localhost:1234` in a browser with `example/.env` configured (a valid `VITE_VAULT_TOKEN`).
- Confirm the Vault modal renders **with styles applied**:
  - Modal has the dark backdrop and centered white panel (Tailwind `bg-gray-400 bg-opacity-75` → `Modal.tsx:78`).
  - Header, connection list, and form inputs have proper spacing, fonts, borders, and colors — not unstyled HTML.
  - Buttons render as styled buttons (rounded, colored), not browser defaults.
- Confirm in DevTools that a stylesheet (or inline `<style>` blocks from Vite's dev pipeline) is loaded; the `#react-vault` element has computed Tailwind utility styles applied.
- Sanity check: the no-token branch (`example/index.tsx:15-26`) still renders its plain `system-ui` message — that branch uses inline `style={{ ... }}` and is intentionally unaffected.

### Session Completion
1. All changes committed: `git add example/index.tsx && git commit -m "Restore example app styling by importing dist/styles.css (Ref #9546)"`
2. Update progress JSON: set phase 1 to `complete`, increment `current_phase` to `2` (or mark plan complete if no further phases).
3. Verify clean state: `git status` shows clean working tree.

---

## Testing Strategy

This plan does not introduce automated tests because there is no unit-test surface: the change is a single side-effect import in a non-published example/playground app. The package's existing test suite (`test/`) is unaffected.

### Manual Testing Steps:

1. With `dist/` built (`yarn build`), `cd example && yarn start`.
2. Verify the styled Vault modal renders at `http://localhost:1234` with a valid `VITE_VAULT_TOKEN`.
3. Verify the no-token fallback branch still renders unaffected (confirms we didn't break the early-return path).
4. Stop the dev server. Run `tsdx lint`, `tsdx test --no-watch`, and `tsdx build` from the project root to confirm package-level checks remain at their pre-existing pass/fail state.

## Performance Considerations

None. The added import is a single CSS file (~13 KB minified Tailwind output) loaded once on app boot in dev mode. No runtime, build-time, or bundle-size impact on the published package.

## Migration Notes

None. The package's published surface (`main`, `module`, `dist/`) is unchanged. Existing consumers continue to import `'@apideck/react-vault/dist/styles.css'` exactly as documented in `README.md:70`. This change only updates the in-tree example app to follow that same documented pattern.

## References

- Related research: `thoughts/shared/research/2026-05-06-GH-9546-example-app-css-loading.md`
- Documented consumer import: `README.md:70`
- Storybook precedent for the same pattern: `.storybook/preview.js:1`, `stories/Vault.stories.tsx:1`, `stories/ConnectionForm.stories.tsx:1`
- Vault root element scope: `src/components/Vault.tsx:180`
- Build script that produces `dist/styles.css`: `package.json:24` (`copy-css`)
- Branch context: `thoughts/shared/prs/csrf_fix_2_description.md`
