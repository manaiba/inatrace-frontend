# Cameroon fork of `inatrace-frontend`

This repository is the Prosygma deployment of INATrace for Cameroon, a fork of
[agstack/inatrace-frontend](https://github.com/agstack/inatrace-frontend)
(keep the upstream licence and copyright notices).

Two goals drive how it is organised:

1. **Keep pulling agstack's work** with as few conflicts as possible.
2. **Contribute back to agstack** with pull requests that contain *no*
   Cameroon-specific text, tenants, data or configuration.

## Branches

| Branch | Content | Rule |
|---|---|---|
| `main` | exact copy of `upstream/main` | only `git merge --ff-only upstream/main`, never commit here; GitHub default branch |
| `cameroon` | `main` + Cameroon features and fixes | the only branch deployed; receives `main` by **merge** |
| `feat/*`, `fix/*` | generic work, candidate for agstack | branch from **`main`**, PR to agstack, then merge into `cameroon` |
| `cm/*` | Cameroon-only work | branch from **`cameroon`**, PR to `prosygma/inatrace-frontend:cameroon` |
| `archive/*` | history before this model (2026-10-01) | read-only |

## First time on a new clone

```bash
scripts/fork-setup.sh     # upstream remote, push to agstack disabled, hooks, rerere, merge=ours driver
```

## Pulling agstack's changes

```bash
git fetch upstream
git switch main && git merge --ff-only upstream/main && git push origin main
git switch -c cm/sync-agstack-YYYY-MM cameroon && git merge main   # resolve, build, test
git switch cameroon && git merge cm/sync-agstack-YYYY-MM && git push origin cameroon
```

`rerere` replays conflict resolutions you already made once. Watch database
migrations: an agstack migration must never reuse a version number already
taken by a Cameroon migration (and the other way round).

## Sending a change to agstack

```bash
git switch -c feat/my-change main     # from main, NOT from cameroon
# ... work, commit (English, generic wording, upstream defaults) ...
scripts/check-upstream-clean.sh feat/my-change
git push origin feat/my-change
git switch cameroon && git merge feat/my-change
```

`prosygma/inatrace-frontend` is not a GitHub fork of agstack, so GitHub cannot open a PR
from it directly: push the branch to a GitHub fork of agstack (for example
`manaiba/inatrace-frontend`) and open the PR from there, base = agstack `main`.

Rules for an upstream-bound change:

- never mention Prosygma, Cameroon, `inatrace.cm` or a tenant name;
- no client data, credentials or server addresses;
- new user-visible text: add the key to every upstream locale with neutral wording.

`check-upstream-clean.sh` fails on the words in `.fork/forbidden-words` and
warns about paths in `.fork/brand-paths`.

## Commits

Plain commit messages: no `Co-Authored-By: Claude` trailer and no
"Generated with Claude" line. `.githooks/commit-msg` rejects them.

## Deploying

Production is built from `cameroon` only (`deploy.sh` in the workspace refuses
any other branch or a dirty tree).
