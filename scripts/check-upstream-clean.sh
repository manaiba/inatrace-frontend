#!/usr/bin/env bash
# Checks that a branch meant for an upstream pull request (agstack)
# carries no Cameroon-specific content.
#
#   scripts/check-upstream-clean.sh <branch> [base]      base defaults to upstream/main
#
# Fails (exit 1) when the lines the branch adds contain a word listed in
# .fork/forbidden-words. Warns (exit 0) when it touches a path listed in
# .fork/brand-paths: legitimate for a white-label change that edits upstream
# defaults, suspicious otherwise, so review those files by hand.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

branch=${1:?usage: $0 <branch> [base]}
base=${2:-upstream/main}
range="$base...$branch"

read_list() { grep -v '^\s*\(#\|$\)' "$1" 2>/dev/null || true; }

status=0
words=$(read_list .fork/forbidden-words | paste -sd'|' -)
if [[ -n "$words" ]]; then
  hits=$(git diff --unified=0 "$range" | grep '^+' | grep -v '^+++' | grep -inE "$words" || true)
  if [[ -n "$hits" ]]; then
    echo "ERROR: fork-specific words in lines added by $branch (vs $base):"
    echo "$hits" | head -40 | sed 's/^/  /'
    status=1
  fi
  names=$(git diff --name-only "$range" | grep -iE "$words" || true)
  if [[ -n "$names" ]]; then
    echo "ERROR: fork-specific file names:"; echo "$names" | sed 's/^/  /'
    status=1
  fi
fi

mapfile -t patterns < <(read_list .fork/brand-paths)
touched=()
while IFS= read -r f; do
  for p in "${patterns[@]}"; do
    # shellcheck disable=SC2053
    if [[ $f == $p ]]; then touched+=("$f"); break; fi
  done
done < <(git diff --name-only "$range")
if ((${#touched[@]})); then
  echo "WARNING: $branch touches brand-overlay paths; check they only hold upstream defaults:"
  printf '  %s\n' "${touched[@]}"
fi

if ((status == 0)); then
  echo "OK: $branch has no Cameroon-specific content (vs $base)."
fi
exit $status
