# Yolnoma-App Architecture

## Overview

Yolnoma-App is a Windows-focused desktop utility application. React and TypeScript provide the user interface, Vite provides the frontend build, Tauri v2 provides the desktop shell and IPC boundary, and Rust implements native capabilities and platform integrations.

```text
React UI
  -> feature services and Zustand stores
  -> typed Tauri IPC wrappers
  -> Rust commands
  -> domain modules and native services
  -> local storage, OS APIs, or approved external APIs
```

## Frontend structure

```text
src/
├── app/                 application shell and routing
├── features/            user-facing feature modules
├── plugins/             plugin SDK, registry, loader, and runtime
├── shared/              reusable UI, API, storage, hooks, and stores
└── types/               shared application types
```

Each feature should normally contain its own pages, components, hooks, API functions, stores, types, and utilities. Shared code should be moved to `src/shared` only when it is genuinely reusable.

Feature modules should expose a small public API and should not import another feature's private implementation directly.

## Tauri and Rust structure

```text
src-tauri/src/
├── commands/            Tauri command registration and command handlers
├── domains/             domain-specific native behavior
├── app_state.rs         application state
├── deep_link.rs         deep-link handling
└── lib.rs               application bootstrap and plugin setup
```

Frontend code should call native functionality through typed wrappers. Native commands must validate all untrusted input independently of frontend validation. Long-running work should support cancellation, bounded resource use, and progress reporting where practical.

## Storage and configuration

Account-specific configuration is stored under the user's local application data directory. Configuration changes should remain backward compatible. New fields should have defaults, and breaking changes should use an explicit version and migration path.

Sensitive values such as API keys, credentials, cookies, refresh tokens, and signing keys must not be written to plaintext JSON or frontend storage. Use the supported secure storage mechanism for the platform.

## Plugins

Plugins are registered and activated through the runtime plugin manager. A plugin should declare its identity, version, routes, commands, dependencies, and required permissions. New permissions must be narrowly scoped and disabled by default when they expose files, network access, processes, or shell commands.

Plugin loading should validate package identity and integrity, surface errors to the user, and provide a way to disable a failed or untrusted plugin. Plugin-derived source must preserve its license and attribution.

## Security boundaries

The Tauri capability system is a security boundary, not just a convenience configuration. Add the smallest required permission and prefer separate capabilities for unrelated features. External requests must use approved HTTPS domains, timeouts, response limits, redirect validation, and SSRF protections where applicable. Any new external domain must be reviewed against the CSP.

File paths, URLs, plugin identifiers, account identifiers, uploaded files, and network targets are untrusted input. Validate them at the Rust boundary and avoid path traversal, arbitrary process execution, and unrestricted network scanning.

## Performance principles

Use route-level lazy loading for heavy features, virtualize large lists, cache remote data deliberately, and stream large files instead of loading them entirely into the webview. Expensive image, video, archive, and parsing work should run in Rust or a worker where appropriate.

## Testing expectations

Important pure logic should have unit tests. Tauri commands, account storage, plugin loading, security validators, and updater behavior should have integration coverage. Critical user flows should have end-to-end coverage on supported Windows environments.

## Change checklist

When adding a feature, review:

- frontend route and feature boundaries;
- typed IPC contract and Rust validation;
- storage schema and migration needs;
- Tauri capabilities and CSP;
- external service privacy and failure behavior;
- loading, cancellation, and error states;
- tests and documentation;
- third-party license obligations.
