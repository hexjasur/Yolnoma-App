# Yolnoma-App Release Guide

This guide describes the two supported release paths: desktop Windows releases and Android test releases. Both paths are executed by GitHub Actions; ordinary commits do not create a release build.

## Prerequisites

Before creating a release, make sure the working tree is clean, the intended branch has been pushed, and the version in `src-tauri/tauri.conf.json` matches the release tag. Desktop releases also require the configured Tauri signing and application secrets in the repository settings.

## Desktop Windows EXE Release

Update the application version in `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`, commit the change, and push it to the release branch. Then create and push a version tag:

```bash
git checkout master
git pull --ff-only origin master
# Update both version fields, then commit the change
git add src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "chore: prepare v1.0.16"
git push origin master

git tag v1.0.16
git push origin v1.0.16
```

The `Release Yolnoma` workflow builds the signed Windows NSIS installer, creates the GitHub Release, generates `latest.json`, and uploads the installer, signature, and manifest to that same release. The in-app updater reads the latest manifest from:

```text
https://github.com/hexjasur/Yolnoma-App/releases/latest/download/latest.json
```

The workflow is triggered only by tags matching `v*`.

## Android APK Test Release

Use the `mobile-app-testing` branch for Android-specific work. After the mobile changes are pushed and tested, create a mobile tag from that branch:

```bash
git checkout mobile-app-testing
git pull --ff-only origin mobile-app-testing

git tag mobile-v0.1.0
git push origin mobile-v0.1.0
```

The `Mobile Android APK Test` workflow then builds an ARM64 debug APK and publishes it as both a workflow artifact and a prerelease asset. It is triggered only by tags matching `mobile-v*` or manually from the GitHub Actions page using **Run workflow**.

For a one-off build without a tag, open **Actions → Mobile Android APK Test → Run workflow**. Do not push a normal commit expecting an APK build; ordinary branch pushes do not trigger this workflow.

## Release Conventions

| Release type | Tag format | Output | Workflow trigger |
| --- | --- | --- | --- |
| Windows desktop | `v1.0.16` | Signed NSIS `.exe`, `.sig`, `latest.json` | Push a `v*` tag |
| Android testing | `mobile-v0.1.0` | ARM64 debug `.apk` | Push a `mobile-v*` tag or run manually |

Desktop releases are intended for end users and updater delivery. Android builds are currently testing builds; desktop-only features may be hidden or unavailable on Android.

## Verification Checklist

After a desktop release, verify that the GitHub Release contains the `.exe`, `.sig`, and `latest.json`, and that `latest.json` points to the same release tag. After an Android build, download the APK from the workflow artifact or prerelease and install it on an ARM64 Android device for testing.
