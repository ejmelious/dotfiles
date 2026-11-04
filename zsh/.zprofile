[ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)"

# macOS's /etc/zprofile runs path_helper after .zshenv, which moves system
# dirs like /usr/local/bin back in front of ~/.local/bin. Put ours first again
# so e.g. the native `claude` install wins over an old npm one.
# (.zshenv's `typeset -U path` makes this move the entries, not duplicate them.)
export PATH="$HOME/.local/bin:$HOME/bin:$PATH"
