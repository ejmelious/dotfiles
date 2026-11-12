#!/usr/bin/env bash
# Checks PRs against their base branch's current tip before they enter a merge
# queue: merges the base into each PR head in a dedicated worktree (never
# committed, never pushed), then runs typecheck and lint for the workspaces the
# PR touches and the test files it changes. Catches what the PR's own CI can't:
# rules, types or files that landed on the base after the PR's last build.
#
# Usage: pre-queue-check.sh [--workspace-tests] [PR ...]
#   PR                 numbers; default: your open PRs in this repo. N@<sha>
#                      checks that commit of PR N in place of its head
#   --workspace-tests  run each touched workspace's whole unit-test task, not
#                      just the PR's changed test files (slower)
# Run from inside the repo. Logs go to .ai-dev/pre-queue/logs/<run>/.
# Exit 0 when every PR passes, 1 when any fails or conflicts, 2 on usage errors.

set -uo pipefail

workspace_tests=false
prs=()
for arg in "$@"; do
  case "$arg" in
    --workspace-tests) workspace_tests=true ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    -*) echo "unknown option: $arg" >&2; exit 2 ;;
    *) prs+=("${arg#\#}") ;;
  esac
done

repo="$(git rev-parse --show-toplevel)" || exit 2
wt="$repo/.ai-dev/pre-queue/worktree"
run_dir="$repo/.ai-dev/pre-queue/logs/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$run_dir"

if [[ ${#prs[@]} -eq 0 ]]; then
  mapfile -t prs < <(gh pr list --author @me --state open --json number --jq '.[].number')
fi
if [[ ${#prs[@]} -eq 0 ]]; then
  echo "No PRs to check."
  exit 0
fi

if [[ ! -d "$wt" ]]; then
  echo "Creating the check worktree at $wt (one-time; the first install is slow)."
  git -C "$repo" fetch -q origin main
  git -C "$repo" worktree add -q --detach "$wt" origin/main || exit 2
fi

# Discards the previous check's uncommitted merge. Only ever run on this
# script's own worktree, which never holds anyone's work.
reset_worktree() {
  if [[ "$(git -C "$wt" rev-parse --show-toplevel 2>/dev/null)" != "$wt" ]]; then
    echo "refusing to reset $wt: not the pre-queue worktree" >&2
    exit 2
  fi
  git -C "$wt" merge --abort 2>/dev/null
  git -C "$wt" reset -q --hard
}

# The workspace (package.json "name") that owns a repo-relative path, if any.
workspace_of() {
  local dir
  dir="$(dirname "$1")"
  while [[ "$dir" != "." && "$dir" != "/" ]]; do
    if [[ -f "$wt/$dir/package.json" ]]; then
      jq -r '.name // empty' "$wt/$dir/package.json"
      return
    fi
    dir="$(dirname "$dir")"
  done
}

install_if_needed() {
  local stamp="$repo/.ai-dev/pre-queue/installed-lock.sha" lock_sha
  lock_sha="$(git -C "$wt" hash-object pnpm-lock.yaml)"
  if [[ -f "$stamp" && "$(cat "$stamp")" == "$lock_sha" ]]; then
    return 0
  fi
  echo "  installing dependencies (lockfile changed)"
  if (cd "$wt" && pnpm install --frozen-lockfile --prefer-offline) >"$1/install.log" 2>&1; then
    echo "$lock_sha" >"$stamp"
  else
    return 1
  fi
}

failed=0
summary=()
for entry in "${prs[@]}"; do
  pr="${entry%%@*}"
  override_head=""
  [[ "$entry" == *@* ]] && override_head="${entry#*@}"
  log="$run_dir/pr-${entry//@/-}"
  mkdir -p "$log"
  echo "== #$pr"
  reset_worktree

  if ! meta="$(gh pr view "$pr" --json headRefOid,baseRefName,isDraft,files 2>"$log/gh.log")"; then
    summary+=("#$pr ERROR: could not read the PR (see $log/gh.log)"); failed=1; continue
  fi
  head="${override_head:-$(jq -r .headRefOid <<<"$meta")}"
  base="$(jq -r .baseRefName <<<"$meta")"
  mapfile -t files < <(jq -r '.files[].path' <<<"$meta")

  head_ref=()
  git -C "$repo" cat-file -e "$head^{commit}" 2>/dev/null || head_ref=("$head")
  if ! git -C "$repo" fetch -q origin "${head_ref[@]}" "+refs/heads/$base:refs/remotes/origin/$base" 2>"$log/fetch.log"; then
    summary+=("#$pr ERROR: fetch failed (see $log/fetch.log)"); failed=1; continue
  fi
  git -C "$wt" checkout -q --detach "$head" || { summary+=("#$pr ERROR: checkout failed"); failed=1; continue; }

  behind="$(git -C "$wt" rev-list --count "HEAD..origin/$base")"
  if ! git -C "$wt" merge -q --no-commit --no-ff "origin/$base" >"$log/merge.log" 2>&1; then
    conflicts="$(git -C "$wt" diff --name-only --diff-filter=U | paste -sd, -)"
    if [[ -n "$conflicts" ]]; then
      summary+=("#$pr CONFLICT with $base ($behind commits behind): $conflicts")
    else
      summary+=("#$pr ERROR: merging $base failed without conflicts (see $log/merge.log)")
    fi
    failed=1; reset_worktree; continue
  fi

  if ! install_if_needed "$log"; then
    summary+=("#$pr ERROR: pnpm install failed (see $log/install.log)"); failed=1; reset_worktree; continue
  fi

  mapfile -t workspaces < <(for f in "${files[@]}"; do workspace_of "$f"; done | sort -u)
  filters=()
  for w in "${workspaces[@]}"; do filters+=(-F "$w"); done
  mapfile -t tests < <(for f in "${files[@]}"; do
    [[ "$f" =~ \.(test|spec)\.[cm]?[jt]sx?$ && -f "$wt/$f" ]] && echo "$f"
  done)

  problems=()
  if [[ ${#filters[@]} -gt 0 ]]; then
    echo "  typecheck + lint: ${workspaces[*]}"
    (cd "$wt" && turbo typecheck lint "${filters[@]}" --output-logs=errors-only) >"$log/typecheck-lint.log" 2>&1 \
      || problems+=("typecheck/lint")
    if $workspace_tests; then
      echo "  unit tests: ${workspaces[*]}"
      (cd "$wt" && turbo unit-test "${filters[@]}" --output-logs=errors-only) >"$log/unit-test.log" 2>&1 \
        || problems+=("unit tests")
    elif [[ ${#tests[@]} -gt 0 ]]; then
      echo "  changed tests: ${#tests[@]} file(s)"
      (cd "$wt" && just unit-test "${tests[@]}") >"$log/unit-test.log" 2>&1 || problems+=("unit tests")
    fi
  fi

  if [[ ${#problems[@]} -eq 0 ]]; then
    summary+=("#$pr PASS against $base ($behind commits behind; ${#workspaces[@]} workspace(s), ${#tests[@]} test file(s))")
  else
    summary+=("#$pr FAIL against $base: ${problems[*]} (logs: $log)")
    failed=1
  fi
  reset_worktree
done

echo
printf '%s\n' "${summary[@]}"
echo "Logs: $run_dir"
exit "$failed"
