# Working preferences

Shared by Claude Code (via ~/.claude/CLAUDE.md) and Codex (via
~/.codex/AGENTS.md). Edit this file in ~/dotfiles/agents/AGENTS.md.

## How to work

- If I ask a question or describe a problem, report what you find and wait before changing anything.
- If a request looks wrong, say so in one sentence, then do it as asked unless I change it.
- Ask before acting when there are several reasonable approaches, when security is involved, or when data could be lost. One question at a time.
- Make the smallest change that solves the problem. No features, refactors, or abstractions the task doesn't need.
- Don't flatter. Point out mistakes, including mine. Never invent APIs, flags, or facts: look them up or say you don't know.
- Before saying work is done, verify each claim with a command you ran in this session. Say what you didn't verify, and show failures rather than summarizing them away.
- Run the repo's own lint, typecheck, and test commands before committing, and fix what fails.
- Bug fixes come with a test that fails without the fix. Never weaken or delete a test to get a passing run.
- Prefer `rg` over grep and `fd` over find when they are installed.
- Comments explain why, not what. Delete dead or commented-out code instead of leaving it behind.

## Commits

- Run `git status` first and stage only the files you changed, by explicit path, never `git add -A` or `git add .`.
- Never bypass hooks with `--no-verify`; fix the failing check instead.
- Never run destructive git commands (`reset --hard`, `clean -f`, `checkout`/`restore` over uncommitted work) without asking.
- Write imperative commit subjects of 72 characters or fewer, one logical change per commit.

## Secrets

- Never write a real password, API key, token, or connection string into a file. Use a clearly named placeholder and say where the real value comes from (Ona secrets, `~/.zshrc.local`, a password manager).
- Never script around Claude or Codex login. Sign-in stays interactive.

## Environments

- `IS_ON_ONA=true` means a disposable Ona environment; otherwise it's my laptop.
- Machine-specific shell settings and secrets go in `~/.zshrc.local`, which is never committed.

## Plans, notes, and scratch files

- Put plans, notes, and research in an `.ai-dev/` directory, never in the tool's own config folder. `.ai-dev/` is git-ignored globally, so it never gets committed.
- Use the repo's existing `.ai-dev/` if there is one; otherwise create one at the repo root, or next to the code when the work is scoped to one package.

## Branches and pull requests

- Name branches in ASCII only, with words separated by `-`, and include the Jira key when there is one (e.g. `eng-1234-fix-report-export`). Non-ASCII characters break preview branches.
- Never push directly to `main`. Work on a feature branch.
- Open PRs as drafts (`gh pr create --draft`) so CI can pass before reviewers are pulled in.
- Fill in the repository's PR template. Drop sections that don't apply; keep the rest short.
- Keep PR descriptions short. Describe the final state of the change, not how it evolved.
- Resolve merge conflicts with `git merge main`, not rebase, and never force-push. PRs are squash-merged, so branch history doesn't matter.
- Before a squash merge, make the PR title descriptive and replace the bullet list with one good commit message.

## Pull request review comments

When addressing a pull request review comment, always reply in that comment thread explaining how it was addressed and how the change was verified. Post the reply before resolving the thread. If no code change is appropriate, explain the reasoning in the thread.
