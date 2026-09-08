#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FEATURE_BRANCH="${1:-feat/dashboard-weather-rust-modules}"
MASTER_BRANCH="${MASTER_BRANCH:-master}"

cd "$REPO_ROOT"

echo "Repository: $REPO_ROOT"
echo "Feature branch: $FEATURE_BRANCH"
echo "Target branch: $MASTER_BRANCH"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: Working tree toza emas. Avval o‘zgarishlarni commit yoki stash qiling."
  git status --short
  exit 1
fi

git fetch origin "$MASTER_BRANCH" "$FEATURE_BRANCH"

if ! git show-ref --verify --quiet "refs/remotes/origin/$FEATURE_BRANCH"; then
  echo "ERROR: origin/$FEATURE_BRANCH topilmadi."
  exit 1
fi

git switch "$MASTER_BRANCH"
git pull --ff-only origin "$MASTER_BRANCH"
git merge --no-ff "origin/$FEATURE_BRANCH" -m "merge: integrate $FEATURE_BRANCH into $MASTER_BRANCH"
git push origin "$MASTER_BRANCH"

echo
echo "Merge muvaffaqiyatli yakunlandi: $FEATURE_BRANCH -> $MASTER_BRANCH"
echo "Keyingi ish uchun: git switch $MASTER_BRANCH && git pull --ff-only"
