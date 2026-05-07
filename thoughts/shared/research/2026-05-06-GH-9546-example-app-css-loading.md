# Research: Example/Playground App Renders Without CSS

**Date**: 2026-05-06
**Related Issue**: https://github.com/apideck-libraries/vault-core/issues/9546 (CSRF fix branch `csrf_fix_2`)

## Research Question

> "for some reason, when trying the playground it has no css... everything is just rendered all over the place."

The user observes that the example app at `example/` renders the `<Vault>` component without any styling. This document maps out — as it exists today — every file involved in CSS production, packaging, and consumption, and traces the path between the example app and the CSS files in `dist/`.

## Summary

The Vault component itself contains **no CSS imports**. The package's CSS is produced as standalone files in `dist/` (`tailwind.css`, `styles.css`, `custom.css`) by separate npm scripts (`build-tailwind`, `copy-css`) that run after `tsdx build`. These CSS files are **never imported** by the JS bundle (`dist/react-vault.esm.js` / `dist/index.js`). They are intended for the package consumer to import manually — the `README.md` documents this at line 70: `import '@apideck/react-vault/dist/styles.css';`.

The example app at `example/index.tsx` does **not** perform that import. It also has no `<link>` tag in `example/index.html`, no CSS configuration in `example/vite.config.ts`, and no Tailwind/PostCSS dependencies in `example/package.json`. The only styles that reach the browser are the runtime-injected emotion `<style>` tags from `@apideck/components` (bundled inside the ESM build).

The example app was recently rewritten in commits `7390b70` (CSRF testing harness) → `7712318` (parcel → vite) → `576f87e` (simplified to render `<Vault>` from `.env`). None of those commits added a CSS import to the example.

For comparison, the Storybook setup *does* import the styles explicitly:
- `.storybook/preview.js:1` — `import '../src/styles/tailwind.css';`
- `stories/Vault.stories.tsx:1` — `import '../src/styles/index.css';`
- `stories/ConnectionForm.stories.tsx:1` — `import '../src/styles/index.css';`

## Detailed Findings

### CSS source files (`src/styles/`)

- `src/styles/tailwind.css` — three lines: `@tailwind base/components/utilities`
- `src/styles/base.css` — `@import './tailwind.css'; @import './custom.css';`
- `src/styles/custom.css` — pre-compiled Tailwind dump (~12 KB), all selectors prefixed under `.apideck`
- `src/styles/index.css` — aggregator: imports `./base.css`, `./tailwind.css`, and `../../node_modules/@apideck/wayfinder/dist/styles.css`

### Tailwind / PostCSS configuration (project root)

- `tailwind.config.js` — `content` scans `./src/**/*.{html,js,jsx,ts,tsx}`, `./node_modules/@apideck/wayfinder/**/*.js`, `./node_modules/@apideck/components/**/*.js`, `./stories/*`. Sets `important: '#react-vault'` so all utilities are scoped to that ID.
- `postcss.config.js` — `plugins: [tailwindcss, autoprefixer]`

### Build pipeline (project root)

`package.json` scripts (lines 12–27):
- `"build": "tsdx build && yarn build-tailwind"`
- `"build-tailwind": "NODE_ENV=production npx tailwindcss -o ./dist/tailwind.css --minify && yarn copy-css"`
- `"copy-css": "cp ./src/styles/base.css ./dist/styles.css && cp ./src/styles/custom.css ./dist/custom.css"`

`tsdx.config.js` configures `rollup-plugin-postcss` with `inject: { insertAt: 'top' }` (`tsdx.config.js:24-33`), but because no `*.tsx` source file imports a `.css` file, this plugin has nothing to process and emits nothing into the JS bundles.

### Component-side CSS imports (`src/`)

- `src/index.tsx:1` — exports only `Vault`, no side-effect CSS import
- `src/components/Vault.tsx` — no CSS import. Renders root `<div id="react-vault" className="apideck">` (line 180). `apideck` is the namespace expected by the scoped Tailwind output.
- `src/components/Modal.tsx:72` — uses `className="apideck react-vault"` on the dialog
- A grep for `import.*\.css` across `src/components/` returns zero matches.

### `dist/` build output

JS bundles:
- `dist/index.js` (CJS dev/prod switch)
- `dist/react-vault.cjs.development.js` + map
- `dist/react-vault.cjs.production.min.js` + map
- `dist/react-vault.esm.js` + map

CSS files (produced by `build-tailwind` + `copy-css`, NOT by tsdx):
- `dist/tailwind.css`
- `dist/styles.css` (copy of `src/styles/base.css`)
- `dist/custom.css` (copy of `src/styles/custom.css`)

Type defs: `dist/index.d.ts` plus per-file `.d.ts`.

### `package.json` package-resolution fields

- `"main": "dist/index.js"` (line 4)
- `"module": "dist/react-vault.esm.js"` (line 70)
- `"typings": "dist/index.d.ts"` (line 5)
- `"files": ["dist"]` (lines 6–8)
- No `"style"`, `"sass"`, `"css"`, or `"exports"` field.

### What `dist/react-vault.esm.js` actually contains

- No `import` or `require` of any `.css` file.
- Inline emotion `StyleSheet` machinery (lines ~4315–4407) sourced from `@apideck/components` — this dynamically calls `document.createElement('style')` at runtime to inject that library's own styles. Tailwind classes are NOT delivered this way.
- The three CSS files in `dist/` are never referenced.

### Example app (`example/`)

- `example/index.html` — single `<script type="module" src="/index.tsx">`. **No `<link>` tag, no inline `<style>`.**
- `example/index.tsx` (3 imports total):
  ```ts
  import * as React from 'react';
  import * as ReactDOM from 'react-dom';
  import { Vault } from '../.';
  ```
  No CSS import. Renders `<Vault>` from `.env` config to `#root`.
- `example/vite.config.ts` — only configures `@vitejs/plugin-react` and React deduplication aliases (`react` / `react-dom` → `../node_modules/...`). No CSS, PostCSS, or Tailwind configuration.
- `example/package.json` — deps `react`, `react-dom`; devDeps `vite`, `@vitejs/plugin-react`, TS types. **No `tailwindcss`, `postcss`, `autoprefixer`, or any CSS tooling.**
- `example/tsconfig.json` — does not extend a base config; `include: ["index.tsx", "vite.config.ts"]`.

### Resolution of `'../.'` from `example/index.tsx`

Vite (ESM-first) prefers the `"module"` field, so `import { Vault } from '../.'` resolves to `dist/react-vault.esm.js`. As documented above, that file imports no CSS.

### Storybook contrasted

- `.storybook/preview.js:1` — `import '../src/styles/tailwind.css';`
- `stories/Vault.stories.tsx:1` — `import '../src/styles/index.css';`
- `stories/ConnectionForm.stories.tsx:1` — `import '../src/styles/index.css';`

These imports cause Storybook's PostCSS pipeline (Tailwind + autoprefixer) to process and inject the styles. There is no equivalent in the example app.

### README documentation for consumers

`README.md:70` documents the consumer-side import:
```
import '@apideck/react-vault/dist/styles.css';
```

## Code References

- `example/index.tsx:1-3` — three imports, none CSS
- `example/index.html:10-13` — body with `<div id="root">` and one `<script>`, no `<link>`
- `example/vite.config.ts:8-24` — Vite config, no CSS section
- `example/package.json:10-19` — deps and devDeps, no CSS tooling
- `src/index.tsx:1` — single export, no side-effect import
- `src/components/Vault.tsx:180` — root element `<div id="react-vault" className="apideck">`
- `src/styles/index.css:1-4` — CSS aggregator
- `src/styles/tailwind.css:1-3` — `@tailwind` directives
- `tailwind.config.js` — `content` paths and `important: '#react-vault'`
- `postcss.config.js:2` — `plugins: [tailwindcss, autoprefixer]`
- `tsdx.config.js:24-33` — `rollup-plugin-postcss` with `inject: { insertAt: 'top' }`
- `package.json:12-27` — `build`, `build-tailwind`, `copy-css` scripts
- `package.json:4` — `main`
- `package.json:70` — `module`
- `.storybook/preview.js:1` — Storybook CSS import
- `stories/Vault.stories.tsx:1` — Storybook CSS import
- `stories/ConnectionForm.stories.tsx:1` — Storybook CSS import
- `README.md:70` — documented consumer import path

## Architecture Documentation

The current shape of CSS delivery in `@apideck/react-vault`:

1. **Authoring**: Tailwind directives in `src/styles/tailwind.css`; custom rules and a pre-compiled snapshot in `src/styles/custom.css`; `index.css` aggregates them and additionally pulls in `@apideck/wayfinder/dist/styles.css`.

2. **Tailwind scoping**: The `important: '#react-vault'` config in `tailwind.config.js` makes every Tailwind utility apply only inside the `#react-vault` element. The Vault root element at `src/components/Vault.tsx:180` carries that ID along with `className="apideck"`.

3. **Build**: `tsdx build` produces JS bundles in `dist/`. A separate `build-tailwind` script then runs the Tailwind CLI to write `dist/tailwind.css` and copies `src/styles/base.css` → `dist/styles.css` and `src/styles/custom.css` → `dist/custom.css`.

4. **Distribution**: The package ships JS in `dist/` (referenced by `main` / `module` fields) and CSS in `dist/` (not referenced by any package.json field). Consumers are expected to import a CSS file alongside the JS, as documented in `README.md:70`.

5. **Storybook**: Storybook gets styles by explicit imports in `.storybook/preview.js` and `stories/*.stories.tsx`, which its PostCSS pipeline processes at dev time.

6. **Example app**: Renders `<Vault>` from `dist/react-vault.esm.js` only. No CSS file is imported, no `<link>` tag is present, no PostCSS/Tailwind tooling is configured. The only styles that load are the runtime-injected emotion sheets from `@apideck/components` bundled inside the ESM build.

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-05-05-GH-9546-csrf-fix-vault-core.md` and `thoughts/shared/plans/2026-05-05-GH-9546-csrf-fix-vault-core.md` — the 11-phase CSRF fix plan that produced the current `csrf_fix_2` branch. Both reference the example app as a manual smoke-test target ("start example app, inspect popup URL for `&nonce=`") but do not specify how the example app should style itself.
- `thoughts/shared/prs/csrf_fix_2_description.md` — PR description for the branch; confirms `tsdx build` passes; does not mention example-app styling.
- `thoughts/shared/progress/2026-05-05-GH-9546-csrf-fix-vault-core-status.json` — Phase 11 (refactor) was abandoned per plan bail criteria (commit `2e0eea9`).
- No thoughts/ document covers the example-app rewrite (commits `7390b70`, `7712318`, `576f87e`) or describes how CSS should be consumed by the example app.
- `thoughts/shared/research/2026-02-20-dependabot-upgrade.json` and the matching plan note that the tsdx + webpack 4 toolchain blocks several upgrades; not directly related but explains why tsdx is still the build tool.

## Related Research

- `thoughts/shared/research/2026-05-05-GH-9546-csrf-fix-vault-core.md` — the CSRF research powering this branch
- `thoughts/shared/plans/2026-05-05-GH-9546-csrf-fix-vault-core.md` — the corresponding plan
- `thoughts/shared/prs/csrf_fix_2_description.md` — PR description

## Open Questions

- None within scope — the documentary picture is complete: the example app has no mechanism that loads any of the three CSS files in `dist/`, and the package's JS bundle does not auto-inject Tailwind styles. The user did not request a fix; if/when they do, the smallest change the codebase would support is adding an explicit CSS import in `example/index.tsx` (matching the pattern shown in `README.md:70` and in `stories/*.stories.tsx:1`).
