# Changelog

All notable Yolnoma releases are documented here. This file is the source of truth for updater release notes.

## [1.2.7] - 2026-10-03

### Added

- Spanish (`es`) and Chinese (`zh`) preview localizations with navigation, sidebar, navbar, and dashboard translations.

### Improved

- Persistent Steam idling state and runtime timer across page navigation through a centralized store.

### Fixed

- Enabled Steam Idler visibility in sidebar for guest users and restricted Settings page access to authenticated accounts.

## [1.2.6] - 2026-10-01

### Improved

- Russian localization enhacements.

## [1.2.5] - 2026-09-30

### Improved

- Redesigned the Navbar language switcher into a compact, elegant dropdown matching navbar dimensions with a globe indicator and smooth backdrop blur.
- (dev)Added smooth freeform dragging and position persistence to Yolnoma Turbo compact floating button.

### Fixed

- Resolved `useNavigate` Router context missing error during Turbo Login UI preview by moving `HashRouter` to the top-level application providers.
- Disabled context menu and page reload shortcuts (`Ctrl+R`, `F5`, `Cmd+R`) during fullscreen updates to prevent interrupting update installations.

## [1.2.4] - 2026-09-30

### Added

- Russian localization foundation with a config-driven language registry.
- Production-safe DNS and certificate-transparency requests through the Tauri backend.

### Improved

- Replaced the Navbar language selector with the shared styled `SelectMenu` component.
- DNS Records lookup, subdomain discovery, and host resolution no longer depend on browser CSP or CORS permissions.

## [1.2.3] - 2026-09-30

### Added

- DNS Records lookup and inspection tools.
- Subdomain Finder with multi-view visualization.
- HTTP Headers inspection tool.
- Windows Startup Apps manager.
- AI Chat vision and image support.
- Centralized changelog parser and updater changelog integration.
- Fullscreen update and changelog flow.
- Isolated login UI preview for Turbo(dev).

### Improved

- Expanded DNS inspection workspace and Command Center DNS tools.
- Improved AI Agent workspace with better word wrapping and project restoration.
- Improved AI Chat image loading through native file input.
- Improved updater progress and preview experience.
- Improved changelog preview and invalid-date handling.
- Refreshed updater heading and overall update experience.
- Expanded tool routes and workspace UI consistency.
- Updated README with clearer project documentation, requirements, and setup instructions.
- Updated Agents guide with current features and rules.

### Fixed

- Safely initialized Windows Registry handles.
- Fixed release changelog file introduction handling.
- Fixed release manifest validation and linting.
- Improved updater preview stage transitions.
- Removed issues related to obsolete codebase-agent routing and permissions.

### Changed

- Refactored feature modules into canonical project modules.
- Split global CSS and scoped styles for feature modules.
- Modularized the AI Agent page into dedicated components.
- Unified Git types and diff viewer logic.
- Localized remaining Uzbek UI strings to English.
- Moved release notes to the centralized changelog as the updater source of truth.

## [1.2.2] - 2026-09-26

### Added

- Bun and AMD cache cleanup.
- Modular cleanup scripts and a simpler cleanup UI.

### Improved

- Cleaner script paths.

### Fixed

- AI workspaces are now exposed in Ctrl+K.
- Model dropdown scrolling is constrained correctly.
- Locked files are skipped and Git commit/push actions are disabled when unavailable.
- Legacy updater branch synchronization is guarded.

### Changed

- Release notes are organized by conventional release categories.

## [1.2.0] - 2026-09-25

### Added

- Guarded commit and push workflow.
- Independent developer tools layer with diagnostics.
- Updater and splash-screen development previews.
- Steam navigation group and icons.
- Persistent recent Git projects and upgraded Turbo controls.

### Improved

- Git workspace, AI tools workspace, command center, updater lifecycle, and application startup experience.

### Fixed

- Tauri updater plugin alignment and release workflow triggering.
- Git recent-project persistence and Turbo preview synchronization.
- Image upload feedback and optional OS handling.

### Changed

- Keep-Alive multi-tab caching and responsive workspace navigation.

## [1.0.23] - 2026-09-19

### Added

- Unified performance catalog and AV performance catalog mode.
- Tabbed AI tools and database design workspaces.
- Global command center, command palette, and responsive developer tools.
- Image crop/upload flow, image workspace, compressor, JSON viewer, diff checker, and additional utility tools.
- Yolnoma Agent project workspace with safe file edits.
- Interactive Yolnoma 3D world and expanded Git workspace.

### Improved

- AI chat sessions, README generation, Markdown Studio exports, dashboard layout, game library, Steam Idler controls, and workspace navigation.

### Fixed

- Image editor sizing, cropper behavior, updater reliability, release asset publishing, SteamUtility packaging, and legacy updater manifest handling.

### Changed

- Developer tools and Markdown Studio were redesigned into focused workspaces.
