# Yolnoma-App Collaboration Guide

This guide describes the recommended workflow for maintainers and collaborators working on Yolnoma-App.

## Work planning

Start with a focused issue or task. Describe the user problem, expected result, acceptance criteria, affected features, and any security or privacy considerations. Keep one issue or pull request focused on one logical change.

Before implementation, inspect the relevant feature, shared state, Tauri command, storage schema, and documentation. Reuse established patterns instead of introducing a parallel architecture.

## Branch workflow

Keep `master` releasable. Create a short-lived branch from the latest `master`:

```bash
git checkout master
git pull --ff-only origin master
git checkout -b feature/<short-name>
```

Use `feature/`, `fix/`, `security/`, `docs/`, or `chore/` prefixes. Rebase or merge the latest `master` before review when the branch is stale.

## Implementation standards

Prefer small, reviewable commits. Explain non-obvious decisions in code comments or documentation. Preserve existing user data and add migrations for incompatible configuration changes. Update security documentation when data flows, permissions, external services, or credentials change.

For UI work, consider loading, empty, error, disabled, keyboard, and narrow-window states. For native work, consider cancellation, timeouts, path validation, error mapping, and platform behavior.

## Review process

A pull request should contain:

- a concise summary;
- the user problem and solution;
- test commands and results;
- screenshots for UI changes;
- security, privacy, performance, and compatibility notes;
- migration or release-note information when applicable.

Reviewers should evaluate correctness, maintainability, security, accessibility, performance, documentation, and license compliance. Resolve review comments explicitly and avoid unrelated scope expansion.

## Communication

Use issues for decisions that should be searchable. Use pull request comments for implementation details. Keep discussions respectful and evidence-based. When a decision affects architecture, security, storage, or public behavior, record it in the relevant documentation.

## Release coordination

Before a release, confirm that the frontend build, native build, relevant tests, updater metadata, release notes, and third-party notices are consistent. Never place updater private keys or other secrets in the repository. Verify that release artifacts are signed through the protected release workflow.

## Security and privacy

Do not share passwords, API keys, cookies, session tokens, private source code, or personal data in issues, pull requests, logs, screenshots, or chat. Follow [SECURITY.md](../SECURITY.md) for vulnerability reports. Use only systems and accounts that you are authorized to access, and follow applicable service terms for Steam, network, file, and automation features.

## Contributor checklist

- [ ] I understand the affected feature and architecture.
- [ ] I tested the change or documented the limitation.
- [ ] I checked for data migration and backward compatibility.
- [ ] I reviewed permissions, CSP, and external data flow.
- [ ] I removed secrets and sensitive data from the change.
- [ ] I updated documentation or release notes where needed.
- [ ] I preserved third-party attribution and license notices.
