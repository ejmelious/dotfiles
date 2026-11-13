#!/usr/bin/env bash
# Runs install.sh and post-start-install.sh against a throwaway $HOME and
# checks the result. Never touches your real home directory.
set -euo pipefail

DOTFILES="$(cd "$(dirname "$0")/.." && pwd)"
SANDBOX="$(mktemp -d)"
trap '[ -n "${KEEP:-}" ] || rm -rf "$SANDBOX"' EXIT
export HOME="$SANDBOX/home"
mkdir -p "$HOME" "$SANDBOX/tmp"
export TMPDIR="$SANDBOX/tmp" DOTFILES_SKIP_CHSH=1
# Never let the EFS hook scan the real /workspaces.
export WORKSPACES_ROOT="$SANDBOX/workspaces"
unset CLAUDE_CONFIG_DIR CLAUDE_CONFIG_DIRS IS_ON_ONA EFS_MOUNT_POINT USE_EFS_HOME \
    JIRA_API_TOKEN JIRA_EMAIL JIRA_SITE XDG_CONFIG_HOME GIT_CONFIG_GLOBAL GH_TOKEN ZDOTDIR

fail() { printf '\033[31mFAIL\033[0m %s\n' "$1"; exit 1; }
pass() { printf '\033[32mPASS\033[0m %s\n' "$1"; }
is_link_to() { [ -L "$1" ] && [ "$(readlink "$1")" = "$2" ] || fail "$1 -> $(readlink "$1" 2>/dev/null || echo missing), want $2"; }

# Pre-existing state like a real laptop: a second Claude profile with its own
# settings, a ~/.zshrc holding a secret, and a Codex config Codex owns.
mkdir -p "$HOME/.claude-vanta" "$HOME/.codex"
echo '{"model":"opus","permissions":{"allow":["Bash(ls:*)"],"deny":["Bash(foo)"]}}' > "$HOME/.claude-vanta/settings.json"
echo 'export SOME_API_KEY=placeholder' > "$HOME/.zshrc"
printf '%s\n' 'model = "keep-me"' '' '[projects."/x"]' 'trust_level = "trusted"' > "$HOME/.codex/config.toml"

"$DOTFILES/install.sh" > "$SANDBOX/run1.log" 2>&1 || { cat "$SANDBOX/run1.log"; fail "install.sh run 1"; }
grep -q "exported secrets" "$SANDBOX/run1.log" || fail "no warning about secrets in old .zshrc"
pass "install.sh ran"

is_link_to "$HOME/.agents/AGENTS.md" "$DOTFILES/agents/AGENTS.md"
is_link_to "$HOME/.codex/AGENTS.md" "$HOME/.agents/AGENTS.md"
zshrc_stub="source \"$DOTFILES/zsh/.zshrc\""
if ! { [ -f "$HOME/.zshrc" ] && [ ! -L "$HOME/.zshrc" ] && grep -qxF "$zshrc_stub" "$HOME/.zshrc"; }; then
    fail "$HOME/.zshrc is not a plain file that sources the repo .zshrc"
fi
is_link_to "$HOME/.config/git/config" "$DOTFILES/git/config"
check_claude_dir() {
    local dir="$1"
    is_link_to "$dir/CLAUDE.md" "$DOTFILES/claude/CLAUDE.md"
    is_link_to "$dir/statusline.sh" "$DOTFILES/claude/statusline.sh"
    is_link_to "$dir/hooks/guard-bash.sh" "$DOTFILES/claude/hooks/guard-bash.sh"
    is_link_to "$dir/rules/typescript.md" "$DOTFILES/claude/rules/typescript.md"
    for skill in "$DOTFILES"/agents/skills/*/; do
        name="$(basename "$skill")"
        is_link_to "$dir/skills/$name" "$HOME/.agents/skills/$name"
        [ -f "$dir/skills/$name/SKILL.md" ] || fail "$dir/skills/$name/SKILL.md not reachable"
    done
}
check_claude_dir "$HOME/.claude"
grep -q "Code Quality Standards\|eslint" "$HOME/.agents/AGENTS.md" && fail "TypeScript rules belong in claude/rules, not the shared AGENTS.md"
pass "links in place"

# By default only ~/.claude is configured; other profiles are left alone.
[ ! -e "$HOME/.claude-vanta/CLAUDE.md" ] || fail "configured an unlisted profile"
[ "$(jq -c . "$HOME/.claude-vanta/settings.json")" = '{"model":"opus","permissions":{"allow":["Bash(ls:*)"],"deny":["Bash(foo)"]}}' ] \
    || fail "touched an unlisted profile's settings"
pass "default touches only ~/.claude"

# Opting a machine into extra profiles via ~/.config/dotfiles/claude-dirs.
mkdir -p "$HOME/.config/dotfiles"
# shellcheck disable=SC2088 # a literal ~ on purpose: install.sh expands it
printf '%s\n' '# laptop profiles' '~/.claude-vanta' '~/.claude-personal' > "$HOME/.config/dotfiles/claude-dirs"
"$DOTFILES/install.sh" > "$SANDBOX/run1b.log" 2>&1 || { cat "$SANDBOX/run1b.log"; fail "install.sh with claude-dirs"; }
check_claude_dir "$HOME/.claude-vanta"
[ ! -e "$HOME/.claude-personal" ] || fail "created a listed profile that didn't exist"
grep -q "claude-personal doesn't exist" "$SANDBOX/run1b.log" || fail "no notice for missing listed profile"
pass "claude-dirs configures listed profiles"

s="$HOME/.claude-vanta/settings.json"
[ "$(jq -r .model "$s")" = "opus" ] || fail "lost existing model setting"
jq -e '.permissions.allow | index("Bash(ls:*)")' "$s" >/dev/null || fail "lost existing allow rule"
jq -e '.permissions.deny | index("Bash(foo)")' "$s" >/dev/null || fail "lost existing deny rule"
jq -e '.permissions.deny | index("Read(~/.ssh/**)")' "$s" >/dev/null || fail "policy deny rule missing"
jq -e '.hooks.PreToolUse | length == 1' "$s" >/dev/null || fail "hook missing"
[ "$(jq -r .forceLoginMethod "$s")" = "claudeai" ] || fail "forceLoginMethod not set"
jq -e '.permissions.allow | index("Bash(git status)")' "$s" >/dev/null || fail "read-only allow rules missing"
jq -e '.hooks.Notification[0].hooks[0].command | test("agent-notify")' "$s" >/dev/null || fail "Notification hook missing"
jq -e '.hooks.Stop[0].hooks[0].command | test("agent-notify")' "$s" >/dev/null || fail "Stop hook missing"
pass "settings merged"

c="$HOME/.codex/config.toml"
[ "$(head -1 "$c")" = 'forced_login_method = "chatgpt"' ] || fail "forced_login_method not first line of Codex config"
{ grep -q keep-me "$c" && grep -q 'trust_level = "trusted"' "$c"; } || fail "lost existing Codex settings"
[ "$(grep -c '^forced_login_method' "$c")" = 1 ] || fail "forced_login_method duplicated"
grep -qx 'project_doc_fallback_filenames = \["CLAUDE.md"\]' "$c" || fail "Codex CLAUDE.md fallback not added"
grep -qxF "notify = [\"$HOME/.local/bin/agent-notify\", \"Codex\"]" "$c" || fail "Codex notify not added"
pass "Codex config keeps its settings and gains the missing keys"

# An existing notify is the user's choice and is left alone.
printf '%s\n' 'notify = ["mine"]' > "$SANDBOX/codex-notify.toml"
cp "$c" "$SANDBOX/codex-saved.toml"
cp "$SANDBOX/codex-notify.toml" "$c"
"$DOTFILES/install.sh" > "$SANDBOX/run1c.log" 2>&1 || { cat "$SANDBOX/run1c.log"; fail "install.sh with existing notify"; }
{ [ "$(grep -c '^notify' "$c")" = 1 ] && grep -qxF 'notify = ["mine"]' "$c"; } || fail "replaced an existing Codex notify"
cp "$SANDBOX/codex-saved.toml" "$c"
pass "Codex keeps an existing notify"

# Git: shared settings everywhere, large-repo settings only on Ona.
[ "$(git config --global --get diff.colorMoved)" = "default" ] || fail "git diff.colorMoved not set"
[ "$(git config --global --get pull.rebase)" = "false" ] || fail "git pull should merge, not rebase"
[ "$(git config --global --get diff.algorithm)" = "histogram" ] || fail "git diff.algorithm not set"
[ "$(git config --global --get merge.conflictStyle)" = "zdiff3" ] || fail "git merge.conflictStyle not set"
[ "$(git config --global --get alias.s)" = "status -sb" ] || fail "git aliases missing"
git config --global --includes --get feature.manyFiles >/dev/null && fail "Ona git settings applied off Ona"
git init -q "$SANDBOX/ig" && mkdir -p "$SANDBOX/ig/pkg/.ai-dev" && touch "$SANDBOX/ig/pkg/.ai-dev/plan.md"
git -C "$SANDBOX/ig" check-ignore -q pkg/.ai-dev/plan.md || fail ".ai-dev not globally ignored"
ln -s "$SANDBOX" "$SANDBOX/ig/.ai-dev"
git -C "$SANDBOX/ig" check-ignore -q .ai-dev || fail ".ai-dev symlink not globally ignored"
is_link_to "$HOME/.local/bin/dotfiles-doctor" "$DOTFILES/bin/dotfiles-doctor"
is_link_to "$HOME/.local/bin/agent-notify" "$DOTFILES/bin/agent-notify"
pass "git config and helper links"

before="$(cat "$s")"
codex_before="$(cat "$c")"
"$DOTFILES/install.sh" > "$SANDBOX/run2.log" 2>&1 || { cat "$SANDBOX/run2.log"; fail "install.sh run 2"; }
[ "$before" = "$(cat "$s")" ] || fail "second run changed settings.json"
[ "$codex_before" = "$(cat "$c")" ] || fail "second run changed Codex config"
grep -q "Backed up" "$SANDBOX/run2.log" && fail "second run backed something up"
grep -q "Linked" "$SANDBOX/run2.log" && fail "second run relinked something"
grep -q "Wrote ~/.zshrc" "$SANDBOX/run2.log" && fail "second run rewrote ~/.zshrc"
pass "install.sh is idempotent"

# Ona's dev tooling rewrites ~/.zshrc (new file + rename) to add its own
# blocks. Re-running install must keep those blocks and not back them up.
{ cat "$HOME/.zshrc"; echo '# >>> dev block >>>'; } > "$SANDBOX/zshrc.new"
mv "$SANDBOX/zshrc.new" "$HOME/.zshrc"
"$DOTFILES/install.sh" > "$SANDBOX/run3.log" 2>&1 || { cat "$SANDBOX/run3.log"; fail "install.sh after tool rewrote .zshrc"; }
grep -qxF '# >>> dev block >>>' "$HOME/.zshrc" || fail "re-install dropped a tool's ~/.zshrc block"
grep -q "Backed up" "$SANDBOX/run3.log" && fail "re-install backed up a tool-edited ~/.zshrc"
pass "tool edits to ~/.zshrc survive re-install"

# Machines set up before the stub have ~/.zshrc linked to the repo.
rm -f "$HOME/.zshrc"
ln -s "$DOTFILES/zsh/.zshrc" "$HOME/.zshrc"
"$DOTFILES/install.sh" > "$SANDBOX/run4.log" 2>&1 || { cat "$SANDBOX/run4.log"; fail "install.sh over old .zshrc link"; }
if [ -L "$HOME/.zshrc" ] || ! grep -qxF "$zshrc_stub" "$HOME/.zshrc"; then
    fail "old ~/.zshrc link not replaced by the stub"
fi
grep -q "Backed up" "$SANDBOX/run4.log" && fail "backed up our own ~/.zshrc link"
pass "old ~/.zshrc link migrates to the stub"

# Hook behaviour.
hook="$DOTFILES/claude/hooks/guard-bash.sh"
repo="$SANDBOX/repo"; git init -q -b main "$repo"
check() { # expect cmd
    local rc=0
    jq -n --arg c "$2" --arg d "$repo" '{tool_input:{command:$c},cwd:$d}' | "$hook" 2>/dev/null || rc=$?
    if [ "$1" = block ] && [ "$rc" -ne 2 ]; then fail "hook allowed: $2"; fi
    if [ "$1" = allow ] && [ "$rc" -ne 0 ]; then fail "hook blocked: $2"; fi
}
check block "rm -rf build"
check block "rm -fr build"
check block "cd x && rm -r -f build"
check block "rm --recursive --force build"
check block "git push origin main"
check block "git push origin HEAD:main"
check block "git push"
check block "git push -u origin"
check allow "rm -r build"
check allow "rm -f file"
check allow "git push origin feature/maintenance"
check allow "git push -u origin my-branch"
check allow "echo main"
# On main, a push naming another branch is fine wherever its flags go.
check allow "git push origin --delete old-branch"
check allow "git push --delete origin old-branch"
check allow "git push origin -u my-branch"
check block "git push origin --delete main"
# A flag's value isn't a branch name, so this is still a bare push of main.
check block "git push -o ci.skip origin"
check block "git push --push-option ci.skip origin"
# The shell strips quotes around a -C path before git sees it.
check block 'git -C "." push'
check block "git -C '$repo' push origin"
check allow "git -C \"$repo\" push origin my-branch"
git -C "$repo" checkout -q -b feature
check allow "git push"
# From a feature branch, `git -C` aimed at a repo on main checks that repo.
other="$SANDBOX/other"; git init -q -b main "$other"
check block "git -C $other push origin"
check block "git -C ../other push"
check allow "git -C $other push origin my-branch"
# "push" inside the -C path isn't the subcommand.
pushrepo="$SANDBOX/push-repo"; git init -q -b main "$pushrepo"
check block "git -C $pushrepo push origin"
# A -C path the hook can't resolve (spaces, variables) fails closed.
# shellcheck disable=SC2016 # a literal, unexpanded variable on purpose
check block 'git -C "$SOME_REPO" push origin'
check block "git -C \"$SANDBOX/no such dir\" push origin"
pass "guard-bash hook"

# Status line renders.
out="$(jq -n --arg d "$repo" '{workspace:{current_dir:$d},model:{display_name:"Opus"},context_window:{remaining_percentage:70}}' | "$DOTFILES/claude/statusline.sh")"
[ "$out" = "[Opus] repo │ feature │ ctx 30%" ] || fail "statusline: '$out'"
out="$(jq -n --arg d "$repo" '{workspace:{current_dir:$d},model:{display_name:"Opus"},rate_limits:{five_hour:{used_percentage:23.7}},cost:{total_cost_usd:1.234}}' | "$DOTFILES/claude/statusline.sh")"
[ "$out" = "[Opus] repo │ feature │ 5h 23%" ] || fail "statusline with rate limit: '$out'"
out="$(jq -n --arg d "$repo" '{workspace:{current_dir:$d},model:{display_name:"Opus"},cost:{total_cost_usd:1.234}}' | "$DOTFILES/claude/statusline.sh")"
[ "$out" = "[Opus] repo │ feature │ \$1.23" ] || fail "statusline with cost: '$out'"
pass "statusline"

# agent-notify: uses osascript when present, passes text as arguments (not
# spliced into AppleScript), maps Codex's JSON to "Finished", never fails.
nbin="$SANDBOX/notifybin"; mkdir -p "$nbin"
printf '#!/usr/bin/env bash\ncat >/dev/null; printf "%%s|" "$@" > "%s"\n' "$SANDBOX/osascript-args" > "$nbin/osascript"
chmod +x "$nbin/osascript"
(cd "$repo" && PATH="$nbin:$PATH" "$HOME/.local/bin/agent-notify" "Codex" '{"type":"agent-turn-complete"}') || fail "agent-notify failed"
[ "$(cat "$SANDBOX/osascript-args")" = "-|Codex|Finished|repo|" ] || fail "agent-notify args: $(cat "$SANDBOX/osascript-args")"
PATH="/usr/bin:/bin" DISPLAY="" "$DOTFILES/bin/agent-notify" "X" "Y" || fail "agent-notify should succeed with no notifier"
pass "agent-notify"

# EFS hook: first environment seeds EFS, second one links to it.
export EFS_MOUNT_POINT="$SANDBOX/efs" DOTFILES_ASSUME_MOUNTED=1
mkdir -p "$EFS_MOUNT_POINT" "$HOME/.config/gh"
echo '{"token":"placeholder"}' > "$HOME/.codex/auth.json"
echo 'placeholder' > "$HOME/.config/gh/hosts.yml"
"$DOTFILES/post-start-install.sh" > "$SANDBOX/efs1.log" 2>&1 || { cat "$SANDBOX/efs1.log"; fail "post-start run 1"; }
is_link_to "$HOME/.codex/auth.json" "$EFS_MOUNT_POINT/.codex/auth.json"
is_link_to "$HOME/.config/gh" "$EFS_MOUNT_POINT/.config/gh"
[ -f "$EFS_MOUNT_POINT/.codex/auth.json" ] || fail "auth.json not moved onto EFS"
[ ! -L "$HOME/.codex" ] || fail "\$HOME/.codex should stay a local directory"
[ ! -e "$EFS_MOUNT_POINT/.claude" ] || fail "created an EFS Claude folder nobody asked for"
# Ona sets CLAUDE_CONFIG_DIR to a folder on EFS that install.sh never saw.
export CLAUDE_CONFIG_DIR="$EFS_MOUNT_POINT/.claude"
"$DOTFILES/post-start-install.sh" > "$SANDBOX/efs1b.log" 2>&1 || { cat "$SANDBOX/efs1b.log"; fail "post-start with CLAUDE_CONFIG_DIR"; }
check_claude_dir "$CLAUDE_CONFIG_DIR"
jq -e '.hooks.PreToolUse | length == 1' "$CLAUDE_CONFIG_DIR/settings.json" >/dev/null || fail "EFS Claude settings not merged"
"$DOTFILES/post-start-install.sh" > "$SANDBOX/efs2.log" 2>&1 || fail "post-start run 2"
grep -qE "Backed up|Linked|Moved" "$SANDBOX/efs2.log" && fail "post-start not idempotent"

# Legacy whole-dir ~/.codex link from Ona's old hook gets undone safely.
rm -rf "$HOME/.codex"; mkdir -p "$EFS_MOUNT_POINT/.codex"; ln -s "$EFS_MOUNT_POINT/.codex" "$HOME/.codex"
"$DOTFILES/post-start-install.sh" > "$SANDBOX/efs3.log" 2>&1 || { cat "$SANDBOX/efs3.log"; fail "post-start legacy"; }
[ -d "$HOME/.codex" ] && [ ! -L "$HOME/.codex" ] || fail "legacy ~/.codex link not replaced"
[ -f "$EFS_MOUNT_POINT/.codex/auth.json" ] || fail "legacy migration destroyed shared auth.json"
is_link_to "$HOME/.codex/AGENTS.md" "$HOME/.agents/AGENTS.md"
# That rerun seeded a fresh Codex config from codex/config.toml.
grep -qxF "notify = [\"$HOME/.local/bin/agent-notify\", \"Codex\"]" "$HOME/.codex/config.toml" || fail "seeded Codex config has wrong notify path"
grep -q '@HOME@' "$HOME/.codex/config.toml" && fail "seeded Codex config kept the @HOME@ placeholder"
# GNU stat first: on Linux `stat -f` means filesystem status and doesn't fail.
[ "$(stat -c %a "$HOME/.codex/config.toml" 2>/dev/null || stat -f %Lp "$HOME/.codex/config.toml")" = 600 ] || fail "seeded Codex config not mode 600"

# .ai-dev: every repo links to EFS, worktrees share the main repo's folder,
# and a local .ai-dev is merged in without losing either side.
ws="$WORKSPACES_ROOT"; mkdir -p "$ws"
git init -q -b main "$ws/proj"
git -C "$ws/proj" -c user.name=t -c user.email=t@example.com commit -q --allow-empty -m init
git -C "$ws/proj" worktree add -q "$ws/proj-wt" -b wt
git init -q -b main "$ws/other"
mkdir -p "$ws/other/.ai-dev" "$EFS_MOUNT_POINT/ai-dev/other" "$ws/not-a-repo"
echo local-only > "$ws/other/.ai-dev/local.md"
echo local > "$ws/other/.ai-dev/both.md"
echo efs > "$EFS_MOUNT_POINT/ai-dev/other/both.md"
"$DOTFILES/post-start-install.sh" > "$SANDBOX/aidev1.log" 2>&1 || { cat "$SANDBOX/aidev1.log"; fail "post-start with repos"; }
is_link_to "$ws/proj/.ai-dev" "$EFS_MOUNT_POINT/ai-dev/proj"
is_link_to "$ws/proj-wt/.ai-dev" "$EFS_MOUNT_POINT/ai-dev/proj"
is_link_to "$ws/other/.ai-dev" "$EFS_MOUNT_POINT/ai-dev/other"
[ -d "$EFS_MOUNT_POINT/ai-dev/proj" ] || fail "EFS .ai-dev folder not created"
[ ! -e "$ws/not-a-repo/.ai-dev" ] || fail "linked .ai-dev in a directory that isn't a repo"
[ "$(cat "$ws/other/.ai-dev/local.md")" = local-only ] || fail "local .ai-dev file not merged onto EFS"
[ "$(cat "$ws/other/.ai-dev/both.md")" = efs ] || fail "local .ai-dev overwrote a file already on EFS"
backups=("$ws"/other.ai-dev-backup-*)
[ "$(cat "${backups[0]}/both.md" 2>/dev/null)" = local ] || fail "local .ai-dev not kept as a backup"
"$DOTFILES/post-start-install.sh" > "$SANDBOX/aidev2.log" 2>&1 || fail "post-start with repos, run 2"
grep -qE "Linked|Merged" "$SANDBOX/aidev2.log" && fail ".ai-dev linking not idempotent"
is_link_to "$HOME/.local/bin/dotfiles-ai-dev-link" "$DOTFILES/bin/dotfiles-ai-dev-link"
"$HOME/.local/bin/dotfiles-ai-dev-link" >/dev/null 2>&1 || fail "dotfiles-ai-dev-link via ~/.local/bin"
# Never write plans to an EFS path that isn't mounted.
git init -q -b main "$ws/late"
DOTFILES_ASSUME_MOUNTED='' "$DOTFILES/bin/dotfiles-ai-dev-link" >/dev/null 2>&1 || fail "dotfiles-ai-dev-link with EFS unmounted"
if command -v mountpoint &>/dev/null; then
    [ ! -e "$ws/late/.ai-dev" ] || fail "linked .ai-dev to an unmounted EFS path"
fi

unset EFS_MOUNT_POINT CLAUDE_CONFIG_DIR
"$DOTFILES/post-start-install.sh" >/dev/null 2>&1 || fail "post-start should exit 0 without EFS"
pass "post-start-install.sh"

# Ona install with a Jira token: a fake acli records what it receives.
fakebin="$SANDBOX/fakebin"; mkdir -p "$fakebin"
cat > "$fakebin/acli" <<EOF
#!/usr/bin/env bash
case "\$*" in
    "jira auth status") [ -f "$SANDBOX/acli-authed" ] ;;
    "jira auth login "*) printf '%s\n' "\$*" > "$SANDBOX/acli-args"; cat > "$SANDBOX/acli-token"; touch "$SANDBOX/acli-authed" ;;
    *) exit 1 ;;
esac
EOF
chmod +x "$fakebin/acli"
token="test-token-$RANDOM$RANDOM"
PATH="$fakebin:$PATH" IS_ON_ONA=true JIRA_API_TOKEN="$token" JIRA_EMAIL="me@vanta.com" \
    "$DOTFILES/install.sh" > "$SANDBOX/ona.log" 2>&1 || { cat "$SANDBOX/ona.log"; fail "install.sh on Ona"; }
[ "$(cat "$SANDBOX/acli-token")" = "$token" ] || fail "acli didn't receive the token on stdin"
grep -q -- "--email me@vanta.com" "$SANDBOX/acli-args" || fail "acli didn't get the email"
grep -q "$token" "$SANDBOX/acli-args" && fail "token passed as a command-line argument"
grep -q "$token" "$SANDBOX/ona.log" && fail "token printed in install output"
grep -rqs "$token" "$TMPDIR" && fail "token left behind in a temp file"
PATH="$fakebin:$PATH" IS_ON_ONA=true JIRA_API_TOKEN="$token" JIRA_EMAIL="me@vanta.com" \
    "$DOTFILES/install.sh" > "$SANDBOX/ona2.log" 2>&1 || fail "install.sh on Ona, run 2"
grep -q "already signed in" "$SANDBOX/ona2.log" || fail "re-signed in to Jira when already signed in"
rm -f "$SANDBOX/acli-authed" "$SANDBOX/acli-token"
PATH="$fakebin:$PATH" JIRA_API_TOKEN="$token" "$DOTFILES/install.sh" > "$SANDBOX/ona3.log" 2>&1 || fail "install.sh without email"
grep -q "set JIRA_EMAIL" "$SANDBOX/ona3.log" || fail "didn't skip Jira sign-in without a Vanta email"
[ ! -e "$SANDBOX/acli-token" ] || fail "signed in to Jira with a non-Vanta email"
pass "Jira sign-in from JIRA_API_TOKEN"

is_link_to "$HOME/.config/git/config.ona" "$DOTFILES/git/ona.gitconfig"
[ "$(git config --global --includes --get feature.manyFiles)" = "true" ] || fail "Ona git settings not applied"
git config --global --includes --get-all credential.https://github.com.helper | grep -q "gh auth git-credential" \
    || fail "gh credential helper not set on Ona"
pass "Ona git settings"

# Doctor: runs, reports, and never prints secrets.
touch "$SANDBOX/acli-authed"
export EFS_MOUNT_POINT="$SANDBOX/efs"
rc=0
PATH="$fakebin:$PATH" IS_ON_ONA=true JIRA_API_TOKEN="$token" USE_EFS_HOME=1 \
    "$HOME/.local/bin/dotfiles-doctor" > "$SANDBOX/doctor.log" 2>&1 || rc=$?
unset EFS_MOUNT_POINT
grep -q "✓ acli jira auth status" "$SANDBOX/doctor.log" || fail "doctor didn't check acli"
grep -q "✓ shared AGENTS.md" "$SANDBOX/doctor.log" || fail "doctor didn't check links"
grep -q "✓ ~/.claude-vanta settings include the guard hook" "$SANDBOX/doctor.log" || fail "doctor didn't check Claude settings"
grep -q "✓ Codex limited to ChatGPT sign-in" "$SANDBOX/doctor.log" || fail "doctor didn't check Codex login method"
grep -qE "[✓✗] git [0-9]+\.[0-9]+" "$SANDBOX/doctor.log" || fail "doctor didn't check the git version"
grep -q "✓ agent-notify" "$SANDBOX/doctor.log" || fail "doctor didn't check agent-notify"
grep -q "✓ Ona git settings" "$SANDBOX/doctor.log" || fail "doctor didn't check Ona git settings"
grep -q "USE_EFS_HOME" "$SANDBOX/doctor.log" || fail "doctor didn't flag USE_EFS_HOME"
grep -q "$token" "$SANDBOX/doctor.log" && fail "doctor printed a secret"
[ "$rc" -gt 0 ] || fail "doctor should fail when USE_EFS_HOME is set"
pass "dotfiles-doctor"

for f in "$DOTFILES"/zsh/.zsh*; do zsh -n "$f" || fail "zsh syntax: $f"; done
pass "zsh syntax"

# Interactive zsh loads cleanly and sets up keys, prompt, and aliases.
zout="$(cd "$repo" && TERM=xterm zsh -i -c 'bindkey "^[[A"; alias g; print -r -- $PROMPT; vcs_info; print -r -- $vcs_info_msg_0_' 2>"$SANDBOX/zsh.err")" \
    || { cat "$SANDBOX/zsh.err"; fail "interactive zsh exited non-zero"; }
[ ! -s "$SANDBOX/zsh.err" ] || { cat "$SANDBOX/zsh.err"; fail "interactive zsh printed errors"; }
grep -q "up-line-or-beginning-search" <<<"$zout" || fail "up-arrow prefix search not bound"
grep -q "g=git" <<<"$zout" || fail "aliases not loaded"
grep -q "(feature)" <<<"$zout" || fail "prompt doesn't show the git branch: $zout"
pass "interactive zsh"

# dotfiles-update: pulls a clean main and re-runs install, refuses otherwise.
# Runs last because it relinks $HOME to a scratch clone.
up="$SANDBOX/upstream"; mkdir -p "$up"
tar -C "$DOTFILES" --exclude=.git -cf - . | tar -C "$up" -xf -
git -C "$up" init -q -b main
git -C "$up" add -A
git -C "$up" -c user.name=t -c user.email=t@example.com commit -q -m base
git clone -q "$up" "$SANDBOX/dot"
"$SANDBOX/dot/bin/dotfiles-update" > "$SANDBOX/upd1.log" 2>&1 || { cat "$SANDBOX/upd1.log"; fail "dotfiles-update, nothing to pull"; }
grep -q "Already up to date" "$SANDBOX/upd1.log" || fail "dotfiles-update didn't report being up to date"
is_link_to "$HOME/.local/bin/dotfiles-update" "$SANDBOX/dot/bin/dotfiles-update"
echo new > "$up/NEW"
git -C "$up" add NEW
git -C "$up" -c user.name=t -c user.email=t@example.com commit -q -m new
"$HOME/.local/bin/dotfiles-update" > "$SANDBOX/upd2.log" 2>&1 || { cat "$SANDBOX/upd2.log"; fail "dotfiles-update with a new commit"; }
[ -f "$SANDBOX/dot/NEW" ] || fail "dotfiles-update didn't pull"
grep -q "Dotfiles installed" "$SANDBOX/upd2.log" || fail "dotfiles-update didn't run install.sh"
echo local >> "$SANDBOX/dot/README.md"
echo newer > "$up/NEW"
git -C "$up" -c user.name=t -c user.email=t@example.com commit -q -am newer
"$SANDBOX/dot/bin/dotfiles-update" > "$SANDBOX/upd3.log" 2>&1 && fail "dotfiles-update pulled over uncommitted changes"
[ "$(cat "$SANDBOX/dot/NEW")" = new ] || fail "dotfiles-update pulled over uncommitted changes"
git -C "$SANDBOX/dot" checkout -q -- README.md
git -C "$SANDBOX/dot" checkout -q -b feature
"$SANDBOX/dot/bin/dotfiles-update" > "$SANDBOX/upd4.log" 2>&1 && fail "dotfiles-update pulled on a branch other than main"
grep -q "not main" "$SANDBOX/upd4.log" || fail "dotfiles-update didn't say why it refused"
pass "dotfiles-update"

echo "All checks passed."
