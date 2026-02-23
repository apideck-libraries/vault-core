# Dependabot Dependency Upgrade Plan

**Date:** 2026-02-20
**Repo:** apideck-libraries/vault-core
**Package Manager:** Yarn Classic v1.22.22

## Summary

12 open Dependabot PRs, all targeting **transitive** dependencies (yarn.lock only, no direct package.json changes). 1 stale PR. 43 uncovered security alerts (mostly from storybook/tsdx toolchain — not addressable without major toolchain upgrade).

## Production Transitive Dependencies (3 PRs)

| PR | Package | Current | Target | Bump | CVE | Severity |
|----|---------|---------|--------|------|-----|----------|
| #121 | lodash | 4.17.21 | 4.17.23 | patch | CVE-2025-13465 | medium |
| #120 | lodash-es | 4.17.21 | 4.17.23 | patch | CVE-2025-13465 | medium |
| #109 | @babel/runtime | 7.16.7 | 7.27.1 | minor | CVE-2025-27789 | medium |

**Parent chains:** lodash/lodash-es via `formik`, @babel/runtime via `react-select` and others.

## Development Transitive Dependencies (8 PRs)

| PR | Package | Current | Target | Bump | CVE(s) | Severity |
|----|---------|---------|--------|------|--------|----------|
| #124 | pbkdf2 | 3.1.2 | 3.1.5 | patch | CVE-2025-6547, CVE-2025-6545 | critical |
| #119 | min-document | 2.19.0 | 2.19.2 | patch | CVE-2025-57352 | low |
| #117 | js-yaml | 3.14.1 | 3.14.2 | patch | CVE-2025-64718 | medium |
| #115 | form-data | 3.0.1 | 3.0.4 | patch | CVE-2025-7783 | critical |
| #114 | sha.js | 2.4.11 | 2.4.12 | patch | CVE-2025-9288 | critical |
| #113 | cipher-base | 1.0.4 | 1.0.6 | patch | CVE-2025-9287 | critical |
| #108 | elliptic | 6.5.4 | 6.6.1 | minor | 7 CVEs incl. 1 critical | critical |
| #107 | store2 | 2.13.1 | 2.14.4 | minor | CVE-2024-57556 | medium |

**Parent chains:** All via webpack/node-libs-browser/crypto-browserify or storybook toolchain.

## Stale PR (1)

| PR | Package | Reason |
|----|---------|--------|
| #106 | markdown-to-jsx | Direct prod dep already at 7.7.15 (safe). PR targets storybook's transitive copy (7.1.6 → 7.4.0). Close without merging. |

## Uncovered Alerts (43) — Not Addressable

Most trace to storybook (next channel) and tsdx using webpack 4. Key blockers:
- **jsonpath** (high): No fix version. Needs upstream @apideck/wayfinder fix.
- **minimatch** (high): Fix requires v10.x (major jump from 3.x). Blocked by tsdx/eslint.
- **tar** (4 high CVEs): Fix requires v7.x (major jump from 6.x).
- **webpack** (4 CVEs): Fix requires v5.x. Storybook/tsdx use v4.x.

These require a major storybook + tsdx toolchain upgrade — out of scope for this PR.

## Upgrade Strategy

Since all 11 upgradeable PRs target transitive deps, we'll use Yarn `resolutions` in `package.json` to force version upgrades in the lockfile.

### Upgrade Order

1. **Crypto/security chain** (critical): cipher-base, sha.js, pbkdf2, elliptic
2. **Production transitive**: lodash, lodash-es, @babel/runtime
3. **Remaining dev transitive**: form-data, js-yaml, min-document, store2

### Execution Steps

1. Create branch `chore/upgrade-all-dependencies-2026-02-20` from latest main
2. Add 11 `resolutions` entries to `package.json`
3. Run `yarn install` to regenerate lockfile
4. Verify each package with `yarn why {package}` to confirm target versions
5. Run validation: `tsc`, `lint`, `test`
6. Commit and create PR referencing all 12 Dependabot PRs (11 upgraded + 1 stale to close)

### Resolutions to Add

```json
{
  "lodash": ">=4.17.23",
  "lodash-es": ">=4.17.23",
  "@babel/runtime": ">=7.27.1",
  "pbkdf2": ">=3.1.5",
  "min-document": ">=2.19.2",
  "js-yaml": ">=3.14.2",
  "form-data": ">=3.0.4",
  "sha.js": ">=2.4.12",
  "cipher-base": ">=1.0.6",
  "elliptic": ">=6.6.1",
  "store2": ">=2.14.4"
}
```

### Existing Resolutions (No Conflicts)

- `jest-environment-jsdom: ^26.0.1` — unrelated, keep as-is.

## Risks

- **Transitive minor bumps** (@babel/runtime 7.16→7.27, elliptic 6.5→6.6, store2 2.13→2.14): Low risk since semver-compatible, but will validate with full test suite.
- **Resolution side effects**: Forcing versions globally may affect other consumers. Will verify with `yarn why`.
- **No code changes expected**: These are all lockfile-only upgrades via resolutions.
