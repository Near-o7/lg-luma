#!/bin/sh
# Update the fork's mirror and merge a stable official release into the personal branch.
set -eu
cd "$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)"
if [ "$(git branch --show-current)" != personal/home-grid ]; then
  printf '%s\n' 'Switch to personal/home-grid before updating.' >&2
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  printf '%s\n' 'Commit or save local changes before updating.' >&2
  exit 1
fi
command -v gh >/dev/null
FORK_REPO=$(gh repo view "$(git remote get-url origin)" --json nameWithOwner --jq .nameWithOwner)
RELEASE=${1:-$(gh release view --repo ecklf/lg-luma --json tagName --jq .tagName)}
printf '%s\n' "$RELEASE" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+$' || {
  printf '%s\n' 'Use a stable official release tag, for example v2.8.5.' >&2
  exit 1
}
gh repo sync "$FORK_REPO" --branch main
git fetch upstream main --tags
git fetch origin main
git rev-parse --verify "refs/tags/$RELEASE^{commit}" >/dev/null
git merge --no-edit "$RELEASE"
printf '\n%s\n' \
  'Official release merged locally. Resolve any conflicts before continuing.' \
  'Run the documented checks, push personal/home-grid, and build it with CI workflow_dispatch.' \
  'Install the new IPK only after the checks pass. The TV is never updated by this script.'
