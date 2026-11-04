# Read by every zsh, including the non-interactive ones agents spawn, so keep
# it to environment only.

# Ona only loads personal secrets into bash; pull them into zsh too.
[ -r /etc/profile.d/ona-secrets.sh ] && . /etc/profile.d/ona-secrets.sh

# Keep PATH entries unique so nested shells don't keep prepending duplicates.
typeset -U path PATH
export PATH="$HOME/.local/bin:$HOME/bin:$PATH"
