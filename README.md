# dotfiles

Shell, git, Claude Code and Codex config for my laptop and for Ona environments.

## Install

```sh
git clone git@github.com:ejmelious/dotfiles.git ~/dotfiles
~/dotfiles/install.sh
```

On Ona, set this repo as your dotfiles repository. Ona clones it to `~/dotfiles`
and runs `install.sh` without a terminal, then runs `post-start-install.sh` once EFS
is mounted. Pushed changes only reach **new** environments.

`install.sh` is safe to re-run. It installs no software and never prompts. Anything it
replaces is moved to `~/.dotfiles-backup/<timestamp>/`, never deleted. If the old
`~/.zshrc` exported anything that looks like a secret, it warns you to move those lines
into `~/.zshrc.local`.

## What goes where

| Repo | Becomes | How |
|---|---|---|
| `agents/AGENTS.md` | `~/.agents/AGENTS.md` | link; the one shared rules file |
| | `~/.codex/AGENTS.md` | link to the above |
| `claude/CLAUDE.md` | `<claude dir>/CLAUDE.md` | link; one line, `@~/.agents/AGENTS.md` |
| `agents/skills/*` | `~/.agents/skills/*` | link; Codex reads these directly |
| | `<claude dir>/skills/*` | link to the above |
| `claude/settings.json` | `<claude dir>/settings.json` | **merged**, not linked |
| `claude/hooks/guard-bash.sh`, `claude/statusline.sh` | `<claude dir>/…` | link |
| `claude/rules/*.md` | `<claude dir>/rules/` | link; path-scoped rules, e.g. TypeScript rules load only for `.ts`/`.tsx` work |
| `codex/config.toml` | `~/.codex/config.toml` | copied **once** if missing |
| `zsh/.zshenv`, `.zprofile` | `~/` | link |
| `zsh/.zshrc` | `~/.zshrc` | **sourced** from a small plain file, so tools that add to `~/.zshrc` don't break it |
| `git/config`, `git/ignore` | `~/.config/git/` | link |
| `git/ona.gitconfig` | `~/.config/git/config.ona` | link, **Ona only** |
| `bin/dotfiles-doctor`, `bin/agent-notify` | `~/.local/bin/` | link |

`<claude dir>` is `~/.claude` by default, which is what Ona and most machines use.

A machine that runs separate profiles through `CLAUDE_CONFIG_DIR` lists them in
`~/.config/dotfiles/claude-dirs`, one per line. That file stays on the machine and is
never committed, and its list replaces the default. For example, on my laptop:

```sh
mkdir -p ~/.config/dotfiles
printf '%s\n' '~/.claude-vanta' '~/.claude-personal' > ~/.config/dotfiles/claude-dirs
```

Only profiles that already exist are configured. The profile aliases belong in
`~/.zshrc.local`:

```sh
alias claude-vanta='CLAUDE_CONFIG_DIR=~/.claude-vanta command claude'
alias claude-personal='CLAUDE_CONFIG_DIR=~/.claude-personal command claude'
alias claude="echo 'Use claude-vanta or claude-personal'"
```

For a single run, `CLAUDE_CONFIG_DIRS="dir1 dir2" ./install.sh` overrides both.

### Why settings are merged and config.toml is copied

Claude Code and Codex both write to their own config (allow rules, trusted projects,
plugins). `install.sh` deep-merges the repo's `claude/settings.json` into each Claude
folder. Repo values win, lists are combined, and machine-specific settings (model,
allow rules, plugins) are kept. Codex's `config.toml` is only seeded on a fresh
machine. On an existing one, `install.sh` adds only these top-level keys, each only
if it's missing, and touches nothing else: `forced_login_method = "chatgpt"`,
`project_doc_fallback_filenames = ["CLAUDE.md"]`, and a `notify` pointing at
`agent-notify` (an existing `notify` is kept).

## Claude Code guardrails

- **Deny rules** stop Claude's file tools reading credential stores (SSH, GPG, AWS,
  Azure, gcloud, kube, Docker, gh, acli, `.netrc`/`.npmrc`/`.pypirc`, Codex/Claude
  auth, `~/.zshrc.local`, shell history, Ona secrets, Keychains, browser and Slack
  data) or editing `~/.ssh` and `~/.zshrc.local`. They also block the Bash commands
  `rm -rf`, `sudo`, `mkfs`, `dd`, force-push, `git reset --hard`, and piping
  `curl`/`wget` into a shell. The read rules don't stop a Bash command such as `cat`;
  turn on `/sandbox` to enforce them for Bash too.
- **`guard-bash.sh` hook** blocks `rm -rf` in any spelling (suggests `trash`) and any
  push that would update `main`/`master`, including a bare `git push` while on main.
- **Project MCP servers** stay off until approved (`enableAllProjectMcpServers: false`).
- **Status line**: model │ folder │ branch (`*` when there are uncommitted changes) │
  context used │ 5-hour usage (or session cost when no limit is reported) │ `ona`.
- **Read-only allow list**: `git status/diff/log/show` and `gh pr view/list/diff/checks`
  run without a prompt.
- **Notifications**: `agent-notify` shows a macOS (or Linux desktop) notification when
  Claude needs you or finishes, and when a Codex turn finishes. Silent on Ona. On a
  new Mac, nothing appears until you allow it once: macOS shows these as coming from
  Script Editor, so turn on System Settings → Notifications → Script Editor with Banners
  or Alerts. If Script Editor isn't listed, run `display notification "hi"` in Script
  Editor and accept the prompt. Focus modes also hide them.
- **Subscription sign-in only**: `forceLoginMethod: "claudeai"` for Claude and
  `forced_login_method = "chatgpt"` for Codex, so neither falls back to a model API key.

## Shell and git

- **zsh**, no framework: menu completion that ignores case, up/down arrows search
  history for what you've typed, `Ctrl-X Ctrl-E` edits the command in `$EDITOR`,
  `AUTO_CD`, a prompt with exit code, folder and git branch (plus user@host over SSH),
  and aliases `..`, `...`, `g`, `reload`, `path`, `mkcd`. 50,000 lines of history,
  written as each command runs, without duplicates or commands typed with a leading
  space. `~/.local/bin` is on `PATH`, Homebrew is loaded on macOS, and pnpm is set
  up. fnm, fzf, zoxide and direnv are hooked up only if installed. Set your own
  `PROMPT` in `~/.zshrc.local` to override. `ZSHRC_PROFILE=1 zsh` shows what slows
  startup.
- **git**: pulls merge rather than rebase, new branches push without
  `--set-upstream`, fetch prunes, rerere is on. Histogram diffs, `zdiff3` conflict
  markers (git 2.35+, checked by `dotfiles-doctor`), branches sorted by recent commit,
  `commit.verbose`, `help.autocorrect=prompt`, and aliases `s`, `lg`, `last`,
  `unstage`, `whoami`. Commits use my GitHub noreply email unless `~/.gitconfig` or
  `~/.config/git/config.local` sets another.

## Global gitignore

`git/ignore` ignores `.DS_Store`, `.env`, `.env.local`, `.claude/settings.local.json`
and `.ai-dev/` in every repo. `AGENTS.md` tells agents to put plans, notes and research
in `.ai-dev/`, so scratch work never lands in a commit.

## Ona and EFS

`post-start-install.sh` replaces Ona's built-in EFS hook (the built-in one moves all of
`~/.claude` onto EFS and would wipe these links). It shares only:

- `~/.codex/auth.json` — Codex login. The rest of `~/.codex` stays local; sharing the
  whole folder corrupts Codex state.
- `~/.config/gh` — GitHub CLI login.
- Shell history, via `HISTFILE` in `.zshrc`.

Ona sets `CLAUDE_CONFIG_DIR=/efs/.claude`, so Claude Code's whole folder, login
included, already lives on EFS. `install.sh` runs before the mount and can't set that
folder up, so `post-start-install.sh` re-runs it for `$CLAUDE_CONFIG_DIR` (or an
existing `$EFS_MOUNT_POINT/.claude`) to add the skills, rules, hooks and settings.
Never script around Claude or Codex login.

To enable, add `EFS_MOUNT_POINT=/efs` to your Ona personal secrets. EFS has no
backups.

`.zshenv` loads `/etc/profile.d/ona-secrets.sh`, since Ona only loads secrets into bash.
`IS_ON_ONA=true` tells Ona apart from the laptop. Remove the legacy `USE_EFS_HOME`
secret if you still have it.

On Ona, git also gets large-repo speedups (`feature.manyFiles`, parallel checkout, no
tag fetching) and uses `gh` for GitHub sign-in. `install.sh` also makes zsh the
default shell when passwordless `sudo` is available (`DOTFILES_SKIP_CHSH=1` skips it).

### Jira

`install.sh` signs `acli` in to Jira when these Ona personal secrets are set (type
"environment variable"):

- `JIRA_API_TOKEN` — personal Atlassian API token
- `JIRA_EMAIL` — your Vanta email (falls back to git's email only if it's a Vanta address)
- `JIRA_SITE` — optional; defaults to `vanta.atlassian.net`

The token goes to `acli` through a private temporary file that's deleted right away. It
never appears in output, logs or the process list. This runs in each new environment,
because `acli` keeps its login in the machine's keychain, which EFS can't share. It
skips quietly if `acli` or the secrets are missing.

## Checking a machine

```sh
dotfiles-doctor
```

Checks tools (`git`, `jq`, `gh`, `claude`, `codex`, `acli`, `zsh`), `gh auth status`,
`acli jira auth status`, the git version, the dotfiles links and Claude/Codex settings,
and on Ona the git settings, the EFS mount and shared logins. It never prints secret
values, and its exit code is the number of failed checks. Run it in
a new environment, then in a second one in the same region to confirm logins carry over.

## Secrets

Nothing secret lives in this repo (CI runs gitleaks). Put secrets and one-machine
settings in:

- `~/.zshrc.local` — sourced last by `.zshrc`
- `~/.config/git/config.local` — included by `git/config` (signing key, work email)
- Ona personal secrets

## VS Code

Not managed here. Settings Sync from the laptop already covers Ona.

## Testing

```sh
./scripts/test.sh
```

Runs everything against a throwaway `$HOME` and checks links, the settings merge,
idempotency, the hook, the status line, `agent-notify`, the EFS migration, Jira
sign-in (with a fake `acli`, including that the token never leaks), the Ona git
settings, `dotfiles-doctor`, and that interactive zsh loads cleanly. Set `KEEP=1` to keep the sandbox for inspection. CI runs it on macOS and
Linux, plus shellcheck and gitleaks.
