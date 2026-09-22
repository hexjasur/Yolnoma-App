# Third-Party Notices

Yolnoma-App is an independent desktop utility application. This file records
known third-party software and source-derived components included in or used by
the project. Each component remains subject to its original license.

## Steam Game Idler

Yolnoma-App includes the `libs/SteamUtility` component and related integration
work derived from or based on the architecture and source distribution of
[Steam Game Idler](https://github.com/zevnda/steam-game-idler) by **zevnda**.

- Original copyright: Copyright (c) 2024-2026 zevnda
- Original license: [Elastic License 2.0](https://www.elastic.co/licensing/elastic-license)
- Original project: https://github.com/zevnda/steam-game-idler
- Fork used for reference: https://github.com/hexjasur/steam-game-idler

The original copyright and license terms apply to the portions derived from
Steam Game Idler. Modified files must retain appropriate attribution and must
identify material modifications as required by the applicable license.

## SteamKit2 and Steamworks.NET

The project uses Steam integration libraries and native interfaces. Their
licenses, copyright notices, and redistribution requirements apply to the
corresponding source files and distributed binaries. Before redistributing a
release, verify the exact versions and include the notices supplied by each
upstream package.

## JavaScript and TypeScript dependencies

The frontend uses React, Vite, Tauri plugins, Tailwind CSS, Three.js, and other
npm packages. Their individual package licenses apply. The lockfile is the
authoritative dependency version record for a release.

Notable licenses identified during the release audit include:

- `lightgallery`: GPL-3.0
- `highlight.js`: BSD-3-Clause
- `typescript`: Apache-2.0
- Most other listed frontend packages: MIT, ISC, BSD-family, or MPL-2.0

The GPL-3.0 dependency must be reviewed before distributing a combined binary
under Elastic License 2.0. If the dependency is not needed at runtime, remove
it; otherwise, obtain a legal compatibility review or replace it with a
compatible alternative before calling the entire distributed application
Elastic-licensed.

## Steam and Valve branding

Steam, the Steam logo, Valve, and related product names and artwork are
trademarks or copyrighted materials of their respective owners. Yolnoma-App is
not affiliated with, endorsed by, or sponsored by Valve Corporation or Steam.

## License scope

The root `LICENSE` file applies only to Yolnoma-App original code to the extent
that no source file or notice identifies another license. It does not replace,
modify, or relicense third-party terms.

This notice is informational and does not grant additional rights beyond the
licenses provided by the respective copyright holders.
