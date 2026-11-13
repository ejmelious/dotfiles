---
name: pre-queue-check
description: Check open PRs against their base branch's current tip before they enter a merge queue. Merges the base into each PR head in a dedicated worktree, without committing or pushing, and runs typecheck, lint and tests for the packages each PR touches. Use when the user is about to queue PRs, asks whether PRs still pass on the latest main, asks whether a branch needs syncing with main, or after a change lands on main that could affect other open PRs (a lint rule, a shared type, a schema).
---

# Pre-queue check

A PR's own CI tested it against the base as it was at its last push. A merge queue tests it against the base as it is now. Anything that landed in between, such as a new lint rule, a changed shared type or a moved file, fails the PR in the queue and costs a queue slot. This check runs that same combination locally first, and pushes nothing.

## Run it

```bash
~/.agents/skills/pre-queue-check/scripts/pre-queue-check.sh            # your open PRs
~/.agents/skills/pre-queue-check/scripts/pre-queue-check.sh 222198 222755
~/.agents/skills/pre-queue-check/scripts/pre-queue-check.sh --workspace-tests 222198
```

Run it from inside the repo. It uses one worktree at `.ai-dev/pre-queue/worktree`, which is created on the first run and reused after. It installs dependencies only when the lockfile has changed, so the turbo cache stays warm between runs. Each PR's logs go to `.ai-dev/pre-queue/logs/<run>/pr-<n>/`.

For each PR it reports:
- **PASS**, with how many commits behind the base the PR is;
- **CONFLICT**, with the conflicted files;
- **FAIL**, with which step failed (typecheck/lint or unit tests) and the log path;
- **ERROR**, when the PR, fetch or install couldn't be read.

The default test scope is the PR's own changed test files. Use `--workspace-tests` for each touched workspace's whole unit-test task. That's slower, but it catches a change on main breaking a test the PR didn't edit.

## What to do with the result

- **PASS:** queue it. Don't merge main into the branch just to be current. On a repo that requires approval of the last push, the extra push costs a re-approval and gains nothing.
- **CONFLICT or FAIL:** read the log, then merge the base into the branch (`git merge origin/main`, never rebase or force-push), fix, verify, and push. Re-run this check before queueing.
- **The PR's CI fails on files the PR doesn't change** (for example a file ratchet blaming the base's changes): the CI diff base is probably stale. Merging the base usually fixes it. Check the build's resolved diff base before assuming the PR is at fault.

Report the summary lines to the user as they are, including FAILs and ERRORs. Don't push, comment or queue anything from this skill unless the user asks.

## Limits

- It runs typecheck, lint and unit tests only: no file ratchets, integration tests or builds. A PASS here means the PR's packages still compile, lint and pass their tests on the new base. It doesn't predict every queue check.
- Workspaces come from the nearest `package.json` above each changed file. Changes outside any workspace, such as root config, get no typecheck or lint; say so when a PR is mostly root files.
- One worktree means one run at a time. Don't start a second run while one is going.
