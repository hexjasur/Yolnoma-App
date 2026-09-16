# Contributing to Yolnoma-App

Thank you for contributing to Yolnoma-App. This guide explains the development setup, branch and commit conventions, review expectations, and security boundaries.

## Before you start

Read the [README](./README.md), [architecture guide](./docs/ARCHITECTURE.md), [collaboration guide](./docs/COLLABORATION.md), [security policy](./SECURITY.md), and [third-party notices](./THIRD-PARTY-NOTICES.md).

## Development setup

Yolnoma-App is a React, TypeScript, Vite, Tauri v2, and Rust desktop application. The full desktop build currently targets Windows 10 or later.

```bash
git clone https://github.com/hexjasur/Yolnoma-App.git
cd Yolnoma-App
npm install
npm run tauri dev
```

Useful checks:

```bash
npm run build
npm run validate:video-csp
npm run tauri build
```

## Branches and commits

Use one focused branch per change:

```text
feature/<short-name>
fix/<short-name>
security/<short-name>
docs/<short-name>
chore/<short-name>
```

Prefer clear conventional prefixes:

```text
feat: add command palette
fix: handle malformed JWT input
security: restrict plugin file access
refactor: isolate Tauri IPC wrappers
docs: update plugin permissions
chore: update dependencies
```

Never commit API keys, signing keys, passwords, cookies, session tokens, personal data, generated installers, or unrelated formatting changes.

## Pull requests

Describe the problem, implementation, testing, and security, privacy, performance, or compatibility impact. Mention configuration migrations and documentation updates. Include screenshots for meaningful UI changes.

Before requesting review:

- [ ] The change is limited to the stated purpose.
- [ ] `npm run build` passes, or the limitation is documented.
- [ ] Relevant Rust checks or manual Tauri tests were completed.
- [ ] No secrets or sensitive user data were added.
- [ ] External domains and CSP changes were reviewed.
- [ ] Third-party license and attribution requirements were preserved.
- [ ] Documentation and config migrations were updated where needed.
- [ ] The UI works at supported window sizes.

## Code and architecture rules

- Place new functionality under `src/features/<feature-name>`.
- Keep genuinely reusable UI, API, storage, and utilities in `src/shared`.
- Keep platform-specific behavior behind Tauri commands and typed frontend wrappers.
- Do not import another feature's private implementation directly.
- Validate untrusted input in the frontend and at the Rust boundary.
- Use the smallest required Tauri capability and plugin permission.
- Do not store credentials or tokens in plaintext.
- Explain clearly before sending confidential context to an external AI provider.
- Prefer cancellable, bounded, and streaming operations for large files and network requests.

## Issues and security

Bug reports should include the app version, operating system, reproduction steps, expected behavior, actual behavior, and logs with secrets removed. Feature requests should explain the user problem, proposed behavior, alternatives, and privacy implications.

Do not publish exploitable vulnerability details, credentials, cookies, access tokens, or personal data in a public issue. Follow [SECURITY.md](./SECURITY.md) for security reports.

## Third-party code

Check the license before adding dependencies or copying source. Preserve required notices and update [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md) when appropriate. Do not remove attribution from Steam Game Idler-derived components.

## Review and conduct

Reviewers may request changes for correctness, maintainability, security, performance, accessibility, documentation, or license compliance. Communicate respectfully and focus feedback on the work. Harassment, discrimination, doxxing, credential sharing, and malicious behavior are not acceptable.

By contributing, you agree that your contribution may be distributed under the applicable terms in [LICENSE](./LICENSE) and [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).
