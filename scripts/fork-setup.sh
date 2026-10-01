#!/usr/bin/env bash
# One-time setup of a fresh clone of a Cameroon fork (see FORK.md).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
repo=$(basename "$(git remote get-url origin)" .git)

git remote get-url upstream >/dev/null 2>&1 ||
  git remote add upstream "https://github.com/agstack/$repo.git"
git remote set-url --push upstream DISABLED_no_push_to_agstack   # never push to agstack by mistake; PRs go through GitHub
git config core.hooksPath .githooks          # pre-commit guard + commit-msg attribution check
git config rerere.enabled true               # remember how merge conflicts were resolved
git config merge.ours.driver true            # used by .gitattributes for fork-owned binary assets
git fetch upstream
git config branch.main.remote upstream
git config branch.main.merge refs/heads/main
echo "OK: upstream=$(git remote get-url upstream), hooks on, rerere on, merge=ours driver on"
