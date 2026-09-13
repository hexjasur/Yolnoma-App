#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

VERSION="${1:-1.0.6}"
TAG="v${VERSION}"
BRANCH="master"
export VERSION

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Invalid version: $VERSION" >&2
  exit 1
fi

if [[ "$(git branch --show-current)" != "$BRANCH" ]]; then
  echo "Run this script from the $BRANCH branch." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit or stash changes first." >&2
  exit 1
fi

if git rev-parse "$TAG" >/dev/null 2>&1 || git ls-remote --exit-code --tags origin "refs/tags/$TAG" >/dev/null 2>&1; then
  echo "Tag already exists: $TAG" >&2
  exit 1
fi

# Keep the app, Tauri package, Cargo package, and lockfiles synchronized.
perl -0pi -e 's/"version": "v1\.0\.5"/"version": "v$ENV{VERSION}"/g' package.json package-lock.json
perl -0pi -e 's/(^version = ")1\.0\.5("$)/${1}$ENV{VERSION}${2}/m' src-tauri/Cargo.toml
perl -0pi -e 's/(name = "yolnoma-app"\nversion = ")1\.0\.5("$)/${1}$ENV{VERSION}${2}/m' src-tauri/Cargo.lock
perl -0pi -e 's/"version": "1\.0\.5"/"version": "$ENV{VERSION}"/' package-lock.json

npm run validate:video-csp
npm run build

git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore: 🚀 release v${VERSION}"
git tag -a "$TAG" -m "🚀 Yolnoma v${VERSION}"
git push origin "$BRANCH"
git push origin "$TAG"

echo "Released $TAG from $BRANCH."
