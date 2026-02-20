---
description: Consolidate all Dependabot PRs and security alerts into a single branch by upgrading dependencies directly, with validation and fixes
argument-hint: "[--skip-tests]"
---

# Handle Dependabot PRs

Consolidate open Dependabot PRs and security alerts into a single upgrade branch with validation.

**Workflow:** Research (subagent) → Plan & Confirm → Execute → Validate → PR

**Artifacts:**
- Research: `thoughts/shared/research/{date}-dependabot-upgrade.json`
- Plan: `thoughts/shared/plans/{date}-dependabot-upgrade.md`

## Phase 1: Research (Subagent)

Create tasks for progress tracking, then spawn a `general-purpose` Task subagent to gather all upgrade information. Provide these instructions:

> **Research Dependabot upgrades for this repo. Write findings to `thoughts/shared/research/{date}-dependabot-upgrade.json`.**
>
> 1. **Fetch open Dependabot PRs:**
>    ```bash
>    gh pr list --author "app/dependabot" --json number,title,headRefName,url --state open --limit 100
>    ```
>    If none found, write `{ "empty": true }` and stop.
>
> 2. **Fetch open security alerts** and cross-reference with PRs:
>    ```bash
>    gh api repos/{owner}/{repo}/dependabot/alerts --paginate --jq '[.[] | select(.state == "open")]'
>    ```
>    An alert is "uncovered" if no PR upgrades the same package to the fix version.
>
> 3. **For each npm/yarn PR:**
>    - Parse package name and target version from title
>    - Read **actual** current version from `package.json` (PR titles go stale)
>    - Determine dep type (prod/dev/peer) from `package.json`
>    - Compute bump type (patch/minor/major)
>
> 4. **For each GitHub Actions PR:** Note action name, target version, affected workflow files.
>
> 5. **For each Python PR:** Note package, target version, path (e.g., `scripts/infra/`).
>
> 6. **Detect stale PRs:** Package/action no longer in codebase → mark stale with reason.
>
> 7. **For uncovered security alerts on transitive deps:** Run `yarn why {package}` to identify parent chain.
>
> 8. **For major bumps:** WebSearch for "{package} v{new_major} migration guide" and note breaking changes.
>
> 9. **List all `resolutions` entries** from `package.json` for conflict checking later.
>
> **Output JSON structure:**
> ```json
> {
>   "production": [{ "pr": 123, "package": "...", "current": "...", "target": "...", "bump": "patch" }],
>   "development": [...],
>   "actions": [{ "pr": 123, "action": "owner/action", "current": "v5", "target": "v6", "files": ["..."] }],
>   "python": [{ "pr": 123, "package": "...", "target": "...", "path": "..." }],
>   "stale": [{ "pr": 123, "package": "...", "reason": "..." }],
>   "uncovered_alerts": [{ "alert": 1, "package": "...", "fix": "...", "severity": "...", "cve": "...", "direct": true, "parent": null }],
>   "major_bumps": [{ "package": "...", "from": "...", "to": "...", "breaking_changes": "...", "migration_steps": "..." }],
>   "resolutions": { "package": "version", ... }
> }
> ```

## Phase 2: Plan & Confirm

Read the research file. If `empty: true`, report "No open Dependabot PRs" and exit.

**Write a plan** to `thoughts/shared/plans/{date}-dependabot-upgrade.md` containing:
- Categorized summary tables (production deps, dev deps, actions, python, uncovered security alerts, stale PRs)
- Breaking change details and migration steps for any major bumps
- Ordered upgrade sequence (TypeScript/build tools first, utilities last)
- Resolution conflicts to reconcile
- Known risks and items likely needing manual review

**Present the plan** to user and ask to confirm: "Upgrade all" / "Select specific ones" / "Cancel".

## Phase 3: Execute Upgrades

### 3a: Branch Setup

Verify clean working directory. Create branch from latest main:
```bash
git fetch origin main && git checkout main && git pull origin main
git checkout -b "chore/upgrade-all-dependencies-$(date +%Y-%m-%d)"
```

### 3b: npm/yarn Dependencies

Detect package manager from lockfile. This repo uses Yarn Berry (`yarn up {package}@{version}`).

**Upgrade in order:** TypeScript/build tools → `@types/*` → testing frameworks → app libraries → utilities.

Watch for peer dependency warnings → upgrade peers too (e.g., `@swc/helpers` with `@swc/core`).

### 3c: GitHub Actions

This repo uses **SHA-pinned references** with version comments:
```yaml
uses: actions/setup-python@{sha} # v5
```

For each action: resolve tag → commit SHA (handle annotated vs lightweight tags via `gh api`), then update SHA and version comment in all workflow files.

### 3d: Python Dependencies

If required Python version is available locally, run `pipenv lock` in the dependency directory. Otherwise skip and note for manual review. **Use absolute paths for all subsequent commands** after cd'ing.

### 3e: Reconcile Resolutions

**Critical:** Resolutions in `package.json` override all version resolution. An old resolution makes a dep upgrade a no-op.

1. **Direct conflicts:** Compare every `resolutions` entry against upgraded deps for version mismatches → bump resolution to match.

2. **Transitive conflicts:** For each resolution, run `yarn why {package}` and check if any consumer's required range is unsatisfied by the pinned version.

3. **Bump vs remove:**
   - **Bump** when all consumers need the same range (e.g., `follow-redirects` 1.15.9 → 1.15.11)
   - **Remove** when consumers need different majors that must coexist
   - **Scoped resolution** (e.g., `"parent/package": "version"`) when removing a global pin would re-expose vulnerabilities through other consumers

4. Run `yarn install && yarn dedupe` and verify with `yarn why`.

## Phase 4: Validate (unless --skip-tests)

Run sequentially, fixing at each phase before proceeding:

1. **`yarn tsc`** — For major upgrades, consult migration notes from the research file.
2. **`yarn lint`** — Try `yarn lint --fix` first.
3. **`yarn test:ai`** — Diagnose per-test.

**Delegate fixes to `general-purpose` subagents** for independent issues across different files. If a fix is too complex, note for manual review.

## Phase 5: Commit & PR

**Two separate commits:**
1. **Dependency upgrades:** `package.json`, `yarn.lock`, `.yarn/cache/`, `.github/workflows/`, `Pipfile.lock` — use `Ref #{pr_number}` in body
2. **Code fixes** (if any): separate commit describing what changed and why

**Create PR** via `gh pr create` with: upgrade summary, validation results, manual review items, and `Closes #{pr_number}` for each upgraded PR. Never auto-merge — PR is for manual team review.

**Report** final summary with counts, validation status, and any manual review items.

## Domain Knowledge (Gotchas)

- **GitHub Actions major bumps change defaults silently.** Example: `docker/build-push-action` v3→v6 enables `provenance` by default, changing image format to OCI index — breaks ECS pulls. Always check release notes for behavioral changes, not just API changes.
- **Resolution conflicts are silent.** A resolution pinning an old version makes the dep upgrade completely ineffective. Always reconcile after upgrading.
- **Removing security resolutions has blast radius.** Removing `cookie@0.7.2` global pin to unblock fastify also let `swagger-client` resolve to vulnerable `cookie@0.5.0`. Use scoped resolutions when consumers have mixed requirements.
- **PR title versions are unreliable.** Always read actual version from `package.json`.
- **Yanked/missing versions or no-fix alerts:** Skip, note for manual closure/tracking.
