<div>
<img align='left' width="40px" src=".github/images/logo.png" alt="logo">
<h1 align="right">Yolnoma App</h1>
</div>

<img src=".github/images/brand.jpg" alt="yolnoma app brand wallpaper">

| Tool Name | Description | Image |
|---|---|---|
| **Dashboard** | Dashboard. | <img src=".github/images/app/dashboard.png" alt="dashboard" width="100"> |
| **Dev Tools** | Developer Tools(JWT, JSON, MARKDOWN, TOOLS). | <img src=".github/images/app/workspace.png" alt="workspace" width="100"> |
| **BG REMOVER** | Background remover. | <img src=".github/images/app/bg_remover.png" alt="bg remover" width="100">


Yolnoma-App is an independent Windows desktop utility built with React,
TypeScript, Rust, and Tauri. It brings Steam-related tools and practical
developer utilities together in one desktop application.

> Yolnoma-App is not affiliated with, endorsed by, or sponsored by Valve
> Corporation or Steam.

## Features

- AI Chat: Chat with an AI assistant for general questions, coding help, and more.
- Cleaner: 
- CSS Tools: 
- JSON EDIT/VIEW: 
- STEAM IDLER/SAM:
- YT VIDEO DOWNLOADER:
- PORT Scanner

- Developer Tools:
  - JSON FORMATTER 
  - JWT DECODER
  - UUID Generator
  - Markdown Studio
  - IP Lookup
  - QR GENERATOR
  - & more

The exact feature set may change between releases. Consult the source code and
release notes for the version you are using.

## Requirements

- Windows 10 or later for the full desktop feature set
- Node.js and npm for frontend development
- Rust and the Tauri prerequisites for desktop builds
- A Steam account for Steam-related features

Some integrations require their own API credentials. Never commit real keys,
passwords, session tokens, signing keys, or other secrets to this repository.
Use local environment variables or GitHub Actions secrets instead.

## Development

Install dependencies and start the development server:

```bash
npm install
npm run tauri dev
```

Build the frontend:

```bash
npm run build
```

Build the Tauri application locally:

```bash
npm run tauri build
```

The release workflow creates signed updater artifacts. The Tauri updater private
key must remain outside the repository and must be supplied through the
`TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` GitHub
Actions secrets.

## API keys and privacy

The `.env.example` file contains variable names only. Copy it to a local
configuration file and fill in values locally. Values beginning with `VITE_`
are intended for frontend builds and may be visible to users in the compiled
application; they must not be treated as server-side secrets.

Steam credentials and session data must be handled only through the supported
application flows. Users are responsible for complying with Steam's terms and
for protecting their accounts.

## Relationship to Steam Game Idler

Yolnoma-App contains the `libs/SteamUtility` integration and related work
derived from or based on [Steam Game Idler](https://github.com/zevnda/steam-game-idler)
by **zevnda**. The project also maintains a public fork for development and
reference at [hexjasur/steam-game-idler](https://github.com/hexjasur/steam-game-idler).

This is an independent project, not an official Steam Game Idler release and
not an endorsement by its authors. Original copyright and license notices for
derived portions are preserved in [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).

## License

Yolnoma-App original code is source-available under the
[Elastic License 2.0](./LICENSE), Copyright (c) 2026 Jasurbek Haydarov and
contributors, except where a file or notice identifies another license.

This repository includes third-party components that remain under their own
licenses. Read [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md) before
redistributing source or binaries.

Elastic License 2.0 is source-available and is not an OSI-approved open-source
license. It permits use, modification, and redistribution subject to its
terms, including restrictions on hosted services and license-key functionality.

## Acknowledgements

Thank you to the authors and maintainers of Steam Game Idler, SteamKit2, Tauri,
React, and the other open-source projects that make Yolnoma-App possible.

## Security

Do not report private credentials in a public issue. For a suspected security
problem, contact the repository maintainers privately before disclosure.
