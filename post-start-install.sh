#!/usr/bin/env bash
# Ona runs this after it mounts EFS (install.sh runs before the mount).
#
# Having this file REPLACES Ona's built-in EFS hook. That hook moves all of
# ~/.claude onto EFS with rm -rf, which would wipe the links install.sh just
# made, so we do the narrower set here instead:
#
#   ~/.codex/auth.json  Codex login. Only this file: sharing all of ~/.codex
#                       across environments corrupts its local state.
#   ~/.config/gh        GitHub CLI config and login.
#
# Shell history is shared via HISTFILE in .zshrc rather than a symlink,
# because zsh replaces the history file on save and would break a link.
#
# Claude Code login is deliberately not shared: its tokens refresh in place,
# so an EFS copy goes stale. Run `claude` and sign in once per environment.
set -euo pipefail

DOTFILES="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/common.sh
. "$DOTFILES/lib/common.sh"

EFS="${EFS_MOUNT_POINT:-}"
if [ -z "$EFS" ]; then
    skip "EFS_MOUNT_POINT not set (add it to Ona personal secrets to share logins)"
    exit 0
fi
if [ "$EFS" = "$HOME" ] || [ "$EFS" = "/home/vscode" ]; then
    warn "EFS_MOUNT_POINT must not be your home directory; skipping"
    exit 0
fi
# Don't write credentials onto a plain local directory by mistake.
if [ "${DOTFILES_ASSUME_MOUNTED:-}" != "1" ]; then
    if command -v mountpoint &>/dev/null && ! mountpoint -q "$EFS"; then
        warn "$EFS is not mounted; skipping EFS links"
        exit 0
    fi
fi
if [ ! -d "$EFS" ] || [ ! -w "$EFS" ]; then
    warn "$EFS is not a writable directory; skipping EFS links"
    exit 0
fi

# share_file REL: ~/REL becomes a link to $EFS/REL. The first environment to
# run this seeds EFS from its local copy; later ones back the local copy up.
share_file() {
    local rel="$1" src="$HOME/$1" dst="$EFS/$1"
    mkdir -p "$(dirname "$dst")" "$(dirname "$src")"
    if [ -f "$src" ] && [ ! -L "$src" ] && [ ! -e "$dst" ]; then
        mv "$src" "$dst"
        info "Moved ~/$rel onto EFS"
    fi
    link "$dst" "$src"
}

share_dir() {
    local rel="$1" src="$HOME/$1" dst="$EFS/$1"
    if [ -d "$src" ] && [ ! -L "$src" ] && [ ! -e "$dst" ]; then
        mkdir -p "$(dirname "$dst")"
        mv "$src" "$dst"
        info "Moved ~/$rel onto EFS"
    fi
    mkdir -p "$dst"
    link "$dst" "$src"
}

# An older Ona hook linked the whole ~/.codex to EFS. Undo exactly that link
# so ~/.codex is a real local directory before we touch auth.json; going
# through it would otherwise clobber the shared credentials.
if [ -L "$HOME/.codex" ] && [ "$(readlink "$HOME/.codex")" = "$EFS/.codex" ]; then
    rm -f "$HOME/.codex"
    mkdir -p "$HOME/.codex"
    info "Removed old whole-directory ~/.codex link"
    # The AGENTS.md link and seeded config.toml lived inside it; restore them.
    "$DOTFILES/install.sh" >/dev/null
fi

share_file ".codex/auth.json"
share_dir ".config/gh"

ok "EFS links configured"
