# shellcheck shell=bash
# Shared helpers for install.sh and post-start-install.sh. Source, don't run.

info() { printf '\033[34m[info]\033[0m %s\n' "$1"; }
skip() { printf '\033[33m[skip]\033[0m %s\n' "$1"; }
ok()   { printf '\033[32m[ ok ]\033[0m %s\n' "$1"; }
warn() { printf '\033[31m[warn]\033[0m %s\n' "$1" >&2; }

# Anything we displace is moved here instead of deleted, mirroring its path
# relative to $HOME. Created lazily so clean runs leave nothing behind.
BACKUP_DIR="${BACKUP_DIR:-$HOME/.dotfiles-backup/$(date +%Y%m%d-%H%M%S)}"

backup() {
    local path="$1" rel dest
    rel="${path#"$HOME"/}"
    dest="$BACKUP_DIR/$rel"
    mkdir -p "$(dirname "$dest")"
    mv "$path" "$dest"
    info "Backed up ~/$rel -> ${dest/#"$HOME"/\~}"
}

# link SRC DST: make DST a symlink to SRC. Idempotent; backs up whatever was
# at DST (file, dir, or a symlink pointing elsewhere) before replacing it.
link() {
    local src="$1" dst="$2"
    if [ -L "$dst" ] && [ "$(readlink "$dst")" = "$src" ]; then
        return 0
    fi
    if [ -e "$dst" ] || [ -L "$dst" ]; then
        backup "$dst"
    fi
    mkdir -p "$(dirname "$dst")"
    ln -s "$src" "$dst"
    ok "Linked ${dst/#"$HOME"/\~}"
}
