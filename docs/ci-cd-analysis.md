# CI/CD Workflow Analysis — Yolnoma App

> **Generated:** 2026-09-23T21:58:42+05:00 (UTC+5 Tashkent)  
> **Branch analysed:** `BIG-Score-5` → target `master`  
> **Workflows scanned:** 4 files (`quality-gate.yml`, `release.yml`, `auto-tag.yml`, `mobile-apk.yml`) + `dependabot.yml`

---

## Executive Summary

| Workflow           | Purpose                                                    | Status          | Production-ready?             |
| ------------------ | ---------------------------------------------------------- | --------------- | ----------------------------- |
| `quality-gate.yml` | Frontend build + Rust tests on every PR/push               | ✅ Healthy      | ✅ Yes — minor gaps           |
| `release.yml`      | Build, sign, and publish NSIS installer + updater manifest | ✅ Healthy      | ✅ Yes — solid                |
| `auto-tag.yml`     | Auto-create `v*` Git tag when version changes on master    | ✅ Healthy      | ✅ Yes — well-guarded         |
| `mobile-apk.yml`   | Build debug Android APK on `mobile-v*` tag                 | ⚠️ Experimental | ⚠️ Debug-only, not production |
| `dependabot.yml`   | npm dependency updates (monthly, grouped)                  | ✅ Healthy      | ✅ Yes — conservative         |

**Overall verdict:** The pipeline is **production-grade** for the Windows desktop path. The mobile APK workflow is clearly labelled experimental. There are no critical security holes or broken logic. Several medium-severity improvements are identified below.

---

## 1. `quality-gate.yml` — GA Quality Gate

### What it does

Runs on every `pull_request → master` and on direct pushes to `master`, `hardening/**`, and `release/**`.

- **`frontend` job** (ubuntu-24.04): installs Bun dependencies, builds the Vite/React app, runs Vitest tests, and validates the video CSP policy.
- **`rust` job** (windows-latest): builds the SteamUtility .NET sidecar and runs `cargo test`.

### Strengths

- ✅ Correct runner selection — Rust backend tested on `windows-latest` (matching the production target platform).
- ✅ Both jobs run independently in parallel, shortening CI wall time.
- ✅ `.NET 8` and `rustfmt + clippy` components are explicitly pinned.
- ✅ `frozen-lockfile` ensures reproducible dependency resolution.
- ✅ Frontend build validation catches TypeScript/Vite errors before merge.

### Issues & Recommendations

| Severity  | Issue                                                                                                                                                                             | Recommendation                                                                      |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 🟡 Medium | `rust` job builds the SteamUtility sidecar but does **not run** `cargo clippy` despite declaring `clippy` as a component.                                                         | Add `- run: cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` step. |
| 🟡 Medium | No `rust-cache` on the quality-gate job. Each CI run compiles Rust from scratch (~3-5 min wasted).                                                                                | Add `uses: swatinem/rust-cache@v2` (already used in `release.yml`).                 |
| 🟡 Medium | Frontend tests run with `--reporter=dot`, which suppresses failure details in CI logs.                                                                                            | Use `--reporter=verbose` or keep `dot` but add `--bail` to fail fast.               |
| 🟢 Low    | `typecheck` (`tsc --noEmit`) is not a quality-gate step — only `build` is run. A type error introduced without touching config could slip through if Vite silently transpiles it. | Add `- run: bun run typecheck` before the build step.                               |
| 🟢 Low    | No `lint` step (`eslint`). ESLint errors are only caught by `lint-staged` on the developer's machine pre-commit, not on CI.                                                       | Add `- run: bun run lint`.                                                          |
| 🟢 Low    | `format:check` is not run in CI. A formatting regression committed with `--no-verify` would not be caught until review.                                                           | Add `- run: bun run format:check`.                                                  |

---

## 2. `release.yml` — Release Yolnoma

### What it does

Triggered exclusively by `v*` tag pushes. Two-job pipeline:

1. **`build`**: Sets up Bun + Rust + .NET, builds SteamUtility, validates secrets, builds the Tauri NSIS installer with code-signing keys, validates the built artifact version against the Git tag, prepares updater artifacts, and uploads them.
2. **`publish-release-assets`**: Downloads the build artifacts, generates release notes from Conventional Commits, builds the `latest.json` Tauri updater manifest, creates/updates the GitHub Release, uploads assets, and back-fills the legacy `updates` branch manifest.

### Strengths

- ✅ **Security**: secrets never echoed; `TAURI_SIGNING_PRIVATE_KEY` only injected at build step.
- ✅ **Artifact validation**: the built installer filename is inspected and version-checked against the tag before publishing — prevents the infinite-updater-loop bug.
- ✅ **Independent publish job**: if upload fails, the heavy Rust build is not re-run (artifact uploaded in Job 1, downloaded in Job 2).
- ✅ **Backward compatibility**: legacy `updates` branch manifest is synced so older installed clients (≤ v1.0.15) can migrate.
- ✅ **Release notes auto-generated** from Conventional Commits with emoji sections.
- ✅ **`permissions: contents: write`** scoped minimally at workflow level.
- ✅ `swatinem/rust-cache@v2` significantly speeds up Rust compilation.

### Issues & Recommendations

| Severity  | Issue                                                                                                                                                                                                | Recommendation                                                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 🟡 Medium | The `build` job uses `runs-on: windows-latest`. GitHub periodically rolls `windows-latest` forward (currently `windows-2022 → windows-2025`). A roll could introduce toolchain differences silently. | Pin to `windows-2022` explicitly until you have tested `windows-2025` builds.                                                         |
| 🟡 Medium | `bun-version: 1.4.2` is hardcoded in every workflow. If Bun is updated in `package.json`'s `packageManager` field, all workflows need a manual sync.                                                 | Extract to a workflow-level env or a `.bun-version` file that `oven-sh/setup-bun@v2` picks up automatically with `bun-version: file`. |
| 🟡 Medium | No timeout set on either job. A hung Rust compilation or a stuck `dotnet publish` would consume free GitHub Actions minutes for up to 6 hours.                                                       | Add `timeout-minutes: 60` to the `build` job and `timeout-minutes: 10` to `publish-release-assets`.                                   |
| 🟡 Medium | `gh release create` is called without `--draft` or `--prerelease` flag. The release is immediately public and live.                                                                                  | Consider `--draft` for review before making the release public, or document this is intentional.                                      |
| 🟢 Low    | Commit range for release notes uses `git tag --sort=-version:refname` which relies on semver sort. Non-semver tags (e.g., `mobile-v*`) could be picked as the "previous" tag.                        | Filter with `git tag --sort=-version:refname --list 'v*'` to include only desktop release tags.                                       |
| 🟢 Low    | `retention-days: 7` on uploaded artifacts. If a publish job fails and is retried after 7 days, the artifact is gone.                                                                                 | Increase to `retention-days: 30` or add a re-build fallback.                                                                          |
| 🟢 Low    | PE binary `VersionInfo` read is inside a `try/catch` that silently swallows errors. The `$peVersion` is printed but never validated against `$expectedVersion`.                                      | Either validate `$peVersion` or remove the dead code.                                                                                 |

---

## 3. `auto-tag.yml` — Auto Version Tag

### What it does

Triggers on `master` pushes **only when** `package.json`, `src-tauri/tauri.conf.json`, or `src-tauri/Cargo.toml` are modified. Guards:

1. Reads all three current versions + the previous commit's `package.json` version.
2. Skips (success) if `package.json` version is unchanged.
3. Errors if the three files disagree on version.
4. Skips (success) with a clear message if the tag already exists.
5. Creates and pushes `v<version>` only when all checks pass.
6. Always writes a human-readable `$GITHUB_STEP_SUMMARY`.

### Strengths

- ✅ **Minimal permissions**: only `contents: write`; no `packages`, `pull-requests`, etc.
- ✅ **Idempotent**: safe to re-run — existing tag is detected, not overwritten.
- ✅ **Path filtering** prevents spurious runs on unrelated master commits.
- ✅ **Fail-fast mismatch detection**: mismatched versions block tag creation with a clear `::error::` annotation.
- ✅ Fast runner (`ubuntu-24.04`), no heavy toolchain — runs in ~20 seconds.
- ✅ `fetch-depth: 2` is correctly chosen (only HEAD and HEAD~1 needed).
- ✅ bot identity explicitly set (`github-actions[bot]`) before tag push.

### Issues & Recommendations

| Severity  | Issue                                                                                                                                                                                                                                          | Recommendation                                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 🟡 Medium | `fetch-depth: 2` fails silently if the master branch has only 1 commit (initial commit edge case) — `HEAD~1` would not exist and `git show HEAD~1:package.json` would produce an empty string, causing the version to be treated as "changed". | Wrap in a guard: `git rev-parse HEAD~1 > /dev/null 2>&1 \|\| echo "pkg=" >> "$GITHUB_OUTPUT"` and skip tagging on first commit. |
| 🟡 Medium | The `Cargo.toml` version is parsed with `grep -m1 '^version'`. If a workspace `Cargo.toml` had `[workspace]` table before `[package]`, a workspace-level key could be matched first.                                                           | Use `cargo metadata --no-deps --format-version 1 \| jq -r '.packages[0].version'` for a robust, tool-native parse.              |
| 🟢 Low    | Tag annotation message is `chore(release): v1.5.0`. Some changelog tools expect `Release v1.5.0` or a blank annotation.                                                                                                                        | Align with team convention; current format is fine for a Conventional Commits workflow.                                         |
| 🟢 Low    | No `timeout-minutes` on this job.                                                                                                                                                                                                              | Add `timeout-minutes: 5`.                                                                                                       |

---

## 4. `mobile-apk.yml` — Mobile Android APK Test

### What it does

Triggered by `workflow_dispatch` or a `mobile-v*` tag push. Builds a **debug** Android APK targeting `aarch64`, uploads it as a workflow artifact, and publishes it to a pre-release on GitHub Releases.

### Strengths

- ✅ Clearly scoped to `mobile-v*` tags — no conflict with desktop `v*` release flow.
- ✅ NDK version explicitly pinned (`27.2.12479018`).
- ✅ Mock placeholder for the SteamUtility resource prevents glob validation failures.
- ✅ `workflow_dispatch` allows manual runs for testing.

### Issues & Recommendations

| Severity    | Issue                                                                                                                                                                     | Recommendation                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 🔴 Critical | The APK is a **debug** build published to a **public** pre-release. Debug builds include debug symbols, logging, and may disable security protections.                    | Never distribute a debug APK to end-users. Use `--release` and sign with a keystore, or keep the release private/internal. |
| 🟡 Medium   | `tag_name: mobile-test-${{ github.run_number }}` creates a new lightweight tag per run without any tag-management strategy. Over time this creates dozens of orphan tags. | Use a fixed tag like `mobile-latest` with `--clobber` on the release, or clean up old tags in the workflow.                |
| 🟡 Medium   | No `timeout-minutes`. Android NDK + Gradle builds can hang for hours.                                                                                                     | Add `timeout-minutes: 45`.                                                                                                 |
| 🟡 Medium   | Only `aarch64` is targeted. Modern Android devices also need `arm64-v8a` for store distribution. This is fine for internal testing but should be documented.              | Add a comment clarifying this is an internal-only debug build.                                                             |
| 🟢 Low      | `oven-sh/setup-bun@v2` with `bun-version: 1.4.2` is duplicated across all workflows (same as the release.yml issue).                                                      | Centralise Bun version (see recommendation above).                                                                         |
| 🟢 Low      | The pre-release body text still references `mobile-app-testing` branch name which may be outdated.                                                                        | Keep the release body dynamically accurate or remove the hard-coded branch name.                                           |

---

## 5. `dependabot.yml` — Dependency Automation

### What it does

Monthly npm dependency updates with grouped PRs (production, development, security). Major version updates are ignored. Conventional Commit prefix `chore(deps)` is applied.

### Strengths

- ✅ Grouped PRs reduce PR noise.
- ✅ `open-pull-requests-limit: 3` prevents PR flood.
- ✅ Major version updates locked out — safe for a production app.
- ✅ Security updates handled separately (`applies-to: security-updates`).

### Issues & Recommendations

| Severity  | Issue                                                                                                                                              | Recommendation                                                                                                |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 🟡 Medium | **No `cargo` ecosystem entry.** Rust dependencies (`tauri`, `serde`, `tokio`, etc.) are not tracked by Dependabot.                                 | Add a `cargo` ecosystem block: `- package-ecosystem: cargo` / `directory: "src-tauri"` / `schedule: monthly`. |
| 🟡 Medium | **No `github-actions` ecosystem entry.** All `actions/checkout@v4`, `oven-sh/setup-bun@v2`, `swatinem/rust-cache@v2`, etc. are never auto-updated. | Add `- package-ecosystem: github-actions` / `directory: "/"`.                                                 |
| 🟢 Low    | Monthly cadence is conservative. Security patches could sit for up to 30 days.                                                                     | For the `security-updates` group, schedule could be `weekly`.                                                 |

---

## Cross-cutting Observations

### Bun version duplication

`bun-version: 1.4.2` appears in **3 workflows** (`quality-gate.yml`, `release.yml`, `mobile-apk.yml`). A version bump requires editing 3 files manually.

**Fix:** Add a `.bun-version` file at the repo root containing `1.4.2`. `oven-sh/setup-bun@v2` reads it automatically when `bun-version` is omitted or set to `file`.

```bash
echo "1.4.2" > .bun-version
```

Then in each workflow:

```yaml
- uses: oven-sh/setup-bun@v2
  # bun-version omitted → reads .bun-version automatically
```

---

### No concurrency guards

None of the workflows define `concurrency:` groups. If two pushes land in quick succession, both `release.yml` runs simultaneously and could attempt to create the same GitHub Release.

**Fix** (example for `release.yml`):

```yaml
concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: false # do NOT cancel a running release build
```

For `quality-gate.yml`, `cancel-in-progress: true` is acceptable:

```yaml
concurrency:
  group: quality-${{ github.ref }}
  cancel-in-progress: true
```

---

### No explicit `shell:` on Linux steps

`release.yml` uses `shell: pwsh` correctly on Windows steps. `auto-tag.yml` and `quality-gate.yml` omit `shell:` on bash steps, which is correct (bash is the default on ubuntu runners). No issue here, but worth documenting.

---

## Priority Action List

| Priority | Action                                                                                |
| -------- | ------------------------------------------------------------------------------------- |
| 🔴 1     | Fix `mobile-apk.yml` — stop publishing **debug** APK to public pre-releases.          |
| 🟡 2     | Add `cargo` + `github-actions` ecosystems to `dependabot.yml`.                        |
| 🟡 3     | Add `concurrency:` groups to `quality-gate.yml` and `release.yml`.                    |
| 🟡 4     | Centralise Bun version via `.bun-version` file.                                       |
| 🟡 5     | Add `timeout-minutes:` to all jobs.                                                   |
| 🟡 6     | Add `swatinem/rust-cache@v2` to `quality-gate.yml` rust job.                          |
| 🟡 7     | Add `cargo clippy` step to `quality-gate.yml`.                                        |
| 🟡 8     | Add `typecheck`, `lint`, `format:check` steps to `quality-gate.yml` frontend job.     |
| 🟡 9     | Pin `runs-on: windows-2022` instead of `windows-latest` in `release.yml`.             |
| 🟢 10    | Filter `git tag --list 'v*'` in release notes generation to exclude `mobile-v*` tags. |
| 🟢 11    | Add Dependabot `weekly` schedule for security-only group.                             |
| 🟢 12    | Handle `fetch-depth: 2` edge case (initial commit) in `auto-tag.yml`.                 |
