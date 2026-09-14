# Security Policy

## Scope

Yolnoma-App is a Windows desktop application built with Tauri. This document explains the project’s security boundaries, local-data behavior, external integrations, and the preferred way to report a vulnerability.

## Local data and chat privacy

AI Chat conversations are persisted locally on the user’s computer as JSON session files. On Windows, the current implementation stores them under:

```text
%LOCALAPPDATA%\Yolnoma\accounts\<user-id>\ai-chat\sessions\<session-id>.json
```

The conversation history is not uploaded to a Yolnoma-owned database by the application. Account configuration and other local application data are also stored on the user’s device.

This local-storage statement does **not** mean that AI messages never leave the computer. When a user sends a prompt through AI Chat or an AI-powered workspace, Yolnoma sends the prompt, selected context, and the required request metadata to the provider selected by the feature—currently OpenRouter—so that the provider can generate a response. Users should avoid sending passwords, private keys, access tokens, personal data, or confidential source code unless they understand and accept the provider’s terms and privacy practices.

The application also requests the public model catalog from OpenRouter when the AI feature is opened and an API key is available. API requests use the user-provided key; Yolnoma does not provide a shared server-side key for this feature.

## Credentials and secrets

- Never commit API keys, signing keys, passwords, cookies, session tokens, or private certificates.
- `VITE_*` variables are bundled into frontend builds and must be treated as public runtime values, not as server-side secrets.
- Tauri updater signing private keys must remain in GitHub Actions secrets or an equivalent protected secret store.
- Store Steam credentials only through the application’s supported account flows and protect the Windows user account that contains the local data.
- Rotate any credential immediately if it was committed, pasted into a public issue, or exposed in a build log.

## Third-party integrations

Yolnoma uses third-party services and libraries. Their availability, logging, retention, and data-processing practices are governed by their own policies. The relevant service URLs and the project’s attribution information are documented in the source and in [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).

## Reporting a vulnerability

Please do not publish exploitable details, credentials, proof-of-concept payloads, or personal data in a public issue. Report suspected vulnerabilities privately to the repository maintainer through the contact method listed on the [GitHub repository](https://github.com/hexjasur/Yolnoma-App), including:

1. A short description of the issue and its security impact.
2. The affected version, operating system, and configuration.
3. Reproduction steps or a minimal proof of concept that does not contain real secrets.
4. Any suggested mitigation.

The maintainer may request additional details, coordinate a fix, and publish a security notice after users have a reasonable opportunity to update.

## Supported versions

Security fixes are normally prepared for the latest published release. Users should keep the application updated and should not rely on an obsolete installer or an old updater endpoint.

## Responsible use

Yolnoma’s network, Steam, file, and automation features must be used only on systems and accounts the user is authorized to access and in compliance with the applicable service terms and laws.
