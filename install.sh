#!/usr/bin/env bash
# Entry point for both the laptop and Ona. Ona clones this repo to ~/dotfiles
# and runs this script with no terminal attached, so nothing here may prompt,
# and optional steps skip rather than fail. Safe to re-run.
#
# This script never installs software and never handles credentials. Anything
# that needs the EFS mount lives in post-start-install.sh, which Ona runs
# after the mount is up.
set -euo pipefail

DOTFILES="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/common.sh
. "$DOTFILES/lib/common.sh"

# --- Shared agent rules and skills (~/.agents) -------------------------------
# One source of truth for Claude Code and Codex. Codex reads ~/.agents/skills
# natively; Claude gets per-skill links below.
link "$DOTFILES/agents/AGENTS.md" "$HOME/.agents/AGENTS.md"
for skill in "$DOTFILES"/agents/skills/*/; do
    name="$(basename "$skill")"
    link "$DOTFILES/agents/skills/$name" "$HOME/.agents/skills/$name"
done

# --- Claude Code ---------------------------------------------------------------
# Configures ~/.claude, the default Claude Code folder and the one Ona uses.
# A machine that runs other profiles via CLAUDE_CONFIG_DIR can list them,
# one per line, in ~/.config/dotfiles/claude-dirs (per machine, never
# committed); those replace the default. CLAUDE_CONFIG_DIRS="dir1 dir2"
# overrides both for a single run.
claude_dirs_file="$HOME/.config/dotfiles/claude-dirs"
if [ -n "${CLAUDE_CONFIG_DIRS:-}" ]; then
    claude_dirs="$CLAUDE_CONFIG_DIRS"
elif [ -f "$claude_dirs_file" ]; then
    claude_dirs="$(sed -e 's/#.*//' -e "s|^~|$HOME|" "$claude_dirs_file" | tr -s '[:space:]' ' ')"
else
    claude_dirs="$HOME/.claude"
fi

merge_claude_settings() {
    local target="$1/settings.json" policy="$DOTFILES/claude/settings.json" tmp
    if ! command -v jq &>/dev/null; then
        skip "jq not found; not merging $target"
        return 0
    fi
    [ -f "$target" ] || echo '{}' > "$target"
    if ! jq empty "$target" &>/dev/null; then
        warn "$target is not valid JSON; leaving it alone"
        return 0
    fi
    # Deep merge: the repo policy wins on scalars, arrays are unioned in order,
    # so anything Claude Code or you added locally (allow rules, model,
    # plugins) survives and re-running is a no-op.
    tmp="$(mktemp)"
    jq -s '
        def merge($a; $b):
            if ($a | type) == "object" and ($b | type) == "object" then
                reduce ($b | keys_unsorted[]) as $k ($a; .[$k] = merge($a[$k]; $b[$k]))
            elif ($a | type) == "array" and ($b | type) == "array" then
                $a + [$b[] | select(. as $x | $a | index([$x]) | not)]
            elif $b == null then $a
            else $b end;
        merge(.[0]; .[1])
    ' "$target" "$policy" > "$tmp"
    if cmp -s "$tmp" "$target"; then
        rm -f "$tmp"
    else
        mv "$tmp" "$target"
        ok "Merged policy into ${target/#"$HOME"/$tilde}"
    fi
}

for dir in $claude_dirs; do
    # Only ~/.claude is created if missing; a listed profile must already exist.
    if [ ! -d "$dir" ] && [ "$dir" != "$HOME/.claude" ]; then
        skip "${dir/#"$HOME"/$tilde} doesn't exist; skipping"
        continue
    fi
    mkdir -p "$dir"
    link "$DOTFILES/claude/CLAUDE.md" "$dir/CLAUDE.md"
    link "$DOTFILES/claude/statusline.sh" "$dir/statusline.sh"
    link "$DOTFILES/claude/hooks/guard-bash.sh" "$dir/hooks/guard-bash.sh"
    # Path-scoped rules (Claude Code only): each loads when matching files are in play.
    for rule in "$DOTFILES"/claude/rules/*.md; do
        link "$rule" "$dir/rules/$(basename "$rule")"
    done
    for skill in "$DOTFILES"/agents/skills/*/; do
        name="$(basename "$skill")"
        link "$HOME/.agents/skills/$name" "$dir/skills/$name"
    done
    merge_claude_settings "$dir"
done

# --- Codex ----------------------------------------------------------------------
# Codex rewrites config.toml itself (trusted projects, plugins), so it is
# seeded once and never linked or overwritten.
mkdir -p "$HOME/.codex"
link "$HOME/.agents/AGENTS.md" "$HOME/.codex/AGENTS.md"
if [ ! -e "$HOME/.codex/config.toml" ]; then
    sed "s|@HOME@|$HOME|g" "$DOTFILES/codex/config.toml" > "$HOME/.codex/config.toml"
    chmod 600 "$HOME/.codex/config.toml"
    ok "Seeded ~/.codex/config.toml"
else
    # Only ever add these keys, and only when missing, so Codex's own edits and
    # your choices (e.g. an existing notify) are kept. Top-level keys must come
    # before any table, so they go first.
    add=()
    grep -q '^forced_login_method' "$HOME/.codex/config.toml" || add+=('forced_login_method = "chatgpt"')
    grep -q '^project_doc_fallback_filenames' "$HOME/.codex/config.toml" || add+=('project_doc_fallback_filenames = ["CLAUDE.md"]')
    grep -q '^notify' "$HOME/.codex/config.toml" || add+=("notify = [\"$HOME/.local/bin/agent-notify\", \"Codex\"]")
    if [ "${#add[@]}" -gt 0 ]; then
        tmp="$(mktemp)"
        { printf '%s\n' "${add[@]}"; cat "$HOME/.codex/config.toml"; } > "$tmp"
        chmod 600 "$tmp"
        mv "$tmp" "$HOME/.codex/config.toml"
        ok "Added to ~/.codex/config.toml: ${add[*]%% =*}"
    fi
fi

# --- Shell, git, and helper commands --------------------------------------------
for f in .zshenv .zprofile; do
    link "$DOTFILES/zsh/$f" "$HOME/$f"
done
# ~/.zshrc is a plain file that sources the repo copy, not a link: installers
# (Ona's dev tooling among them) rewrite it to add their own blocks, which
# replaces a link. Their blocks then stay below this line and keep working.
zshrc_stub="source \"$DOTFILES/zsh/.zshrc\""
if [ -L "$HOME/.zshrc" ] && [ "$(readlink "$HOME/.zshrc")" = "$DOTFILES/zsh/.zshrc" ]; then
    rm -f "$HOME/.zshrc"
fi
if ! { [ -f "$HOME/.zshrc" ] && [ ! -L "$HOME/.zshrc" ] && grep -qxF "$zshrc_stub" "$HOME/.zshrc"; }; then
    if [ -e "$HOME/.zshrc" ] || [ -L "$HOME/.zshrc" ]; then
        backup "$HOME/.zshrc"
    fi
    printf '%s\n' "# Written by install.sh. Other tools may add lines below; keep this one." \
        "$zshrc_stub" > "$HOME/.zshrc"
    ok "Wrote ~/.zshrc"
fi
link "$DOTFILES/git/config" "$HOME/.config/git/config"
link "$DOTFILES/git/ignore" "$HOME/.config/git/ignore"
link "$DOTFILES/bin/dotfiles-doctor" "$HOME/.local/bin/dotfiles-doctor"
link "$DOTFILES/bin/agent-notify" "$HOME/.local/bin/agent-notify"
link "$DOTFILES/bin/dotfiles-ai-dev-link" "$HOME/.local/bin/dotfiles-ai-dev-link"
link "$DOTFILES/bin/dotfiles-update" "$HOME/.local/bin/dotfiles-update"

# A displaced ~/.zshrc may have held exported secrets. Don't move them
# automatically; point at where they belong.
if [ -f "$BACKUP_DIR/.zshrc" ] && grep -qE '^export [A-Z_]*(KEY|TOKEN|SECRET|PASSWORD)[A-Z_]*=' "$BACKUP_DIR/.zshrc"; then
    warn "Your old ~/.zshrc exported secrets. Move those lines into ~/.zshrc.local (never committed)."
    warn "Old file: ${BACKUP_DIR/#"$HOME"/$tilde}/.zshrc"
fi

# --- Jira ---------------------------------------------------------------------
# shellcheck source=lib/jira-auth.sh
. "$DOTFILES/lib/jira-auth.sh"
jira_auth

# --- Ona only -----------------------------------------------------------------
if [ "${IS_ON_ONA:-}" = "true" ]; then
    link "$DOTFILES/git/ona.gitconfig" "$HOME/.config/git/config.ona"
fi
if [ "${IS_ON_ONA:-}" = "true" ] && [ "$(uname -s)" = "Linux" ] \
    && [ "${DOTFILES_SKIP_CHSH:-}" != "1" ] && command -v zsh &>/dev/null; then
    zsh_path="$(command -v zsh)"
    if [ "$(getent passwd "$(id -un)" | cut -d: -f7)" = "$zsh_path" ]; then
        skip "Default shell already zsh"
    elif sudo -n true &>/dev/null; then
        sudo -n chsh "$(id -un)" --shell "$zsh_path" && ok "Default shell set to zsh"
    else
        skip "No passwordless sudo; default shell unchanged"
    fi
fi

ok "Dotfiles installed"
