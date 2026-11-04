# Interactive zsh. Secrets and one-machine tweaks go in ~/.zshrc.local,
# which is sourced last and never committed.

# Profile startup with `ZSHRC_PROFILE=1 zsh`; the report prints at the end.
[[ -n "${ZSHRC_PROFILE:-}" ]] && zmodload zsh/zprof

# --- History --------------------------------------------------------------------
# On Ona with EFS, keep history on the shared drive so it follows you between
# environments. (A symlink would break: zsh replaces the file when saving.)
if [[ "${IS_ON_ONA:-}" == "true" && -n "${EFS_MOUNT_POINT:-}" && -d "$EFS_MOUNT_POINT" && -w "$EFS_MOUNT_POINT" ]]; then
  HISTFILE="$EFS_MOUNT_POINT/.zsh_history"
else
  HISTFILE="$HOME/.zsh_history"
fi
HISTSIZE=50000
SAVEHIST=50000
# Write each command as it runs, with a timestamp; drop duplicates and
# commands typed with a leading space. Not SHARE_HISTORY: on Ona the file is on
# EFS, and several environments merging into it live risks corrupting it.
setopt INC_APPEND_HISTORY EXTENDED_HISTORY HIST_IGNORE_ALL_DUPS \
  HIST_FIND_NO_DUPS HIST_IGNORE_SPACE HIST_REDUCE_BLANKS

# --- Completion -------------------------------------------------------------------
autoload -Uz compinit && compinit -i
# Arrow-key menu; case-insensitive, then partial-word matching.
zstyle ':completion:*' menu select
zstyle ':completion:*' matcher-list 'm:{a-zA-Z}={A-Za-z}' 'r:|=*' 'l:|=* r:|=*'
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"

# --- Options and keys -------------------------------------------------------------
# Type a directory name to cd into it; cd keeps a stack (`cd -<TAB>`).
# Not EXTENDED_GLOB: it breaks pasted commands like `git reset HEAD^`.
setopt AUTO_CD AUTO_PUSHD PUSHD_IGNORE_DUPS PUSHD_SILENT INTERACTIVE_COMMENTS
bindkey -e
# Up/down search history for commands starting with what's already typed.
autoload -Uz up-line-or-beginning-search down-line-or-beginning-search
zle -N up-line-or-beginning-search
zle -N down-line-or-beginning-search
bindkey '^[[A' up-line-or-beginning-search '^[OA' up-line-or-beginning-search
bindkey '^[[B' down-line-or-beginning-search '^[OB' down-line-or-beginning-search
# Ctrl-X Ctrl-E opens the current command in $EDITOR.
autoload -Uz edit-command-line && zle -N edit-command-line
bindkey '^X^E' edit-command-line

# --- Prompt -----------------------------------------------------------------------
# Exit code when non-zero, user@host over SSH, folder, git branch (and
# merge/rebase state). Override PROMPT in ~/.zshrc.local if you prefer.
autoload -Uz vcs_info add-zsh-hook
zstyle ':vcs_info:*' enable git
zstyle ':vcs_info:git:*' formats ' %F{green}(%b)%f'
zstyle ':vcs_info:git:*' actionformats ' %F{green}(%b|%a)%f'
add-zsh-hook precmd vcs_info
setopt PROMPT_SUBST
PROMPT='%(?..%F{red}%?%f )${SSH_CONNECTION:+%n@%m }%F{blue}%~%f${vcs_info_msg_0_} %# '

# --- Aliases ----------------------------------------------------------------------
alias ..='cd ..' ...='cd ../..' g=git reload='exec zsh'
alias path='print -l ${(s.:.)PATH}'
mkcd() { mkdir -p -- "$1" && cd -- "$1"; }

# --- Tools ------------------------------------------------------------------------
if [[ "$OSTYPE" == darwin* ]]; then
  export PNPM_HOME="$HOME/Library/pnpm"
else
  export PNPM_HOME="$HOME/.local/share/pnpm"
fi
[[ ":$PATH:" == *":$PNPM_HOME:"* ]] || export PATH="$PNPM_HOME:$PATH"

command -v fnm &>/dev/null && eval "$(fnm env --use-on-cd --shell zsh)"

# Optional tools: wired up only when installed, never installed here.
# fzf 0.48+: Ctrl-R history, Ctrl-T files, Alt-C directories.
if command -v fzf &>/dev/null && fzf --zsh &>/dev/null; then
  source <(fzf --zsh)
  command -v rg &>/dev/null && export FZF_DEFAULT_COMMAND='rg --files --hidden -g "!.git"'
fi
if command -v zoxide &>/dev/null; then eval "$(zoxide init zsh)"; fi
if command -v direnv &>/dev/null; then eval "$(direnv hook zsh)"; fi

export EDITOR="${EDITOR:-vim}"

# --- Local overrides --------------------------------------------------------------
[[ -r "$HOME/.zshrc.local" ]] && source "$HOME/.zshrc.local"

[[ -n "${ZSHRC_PROFILE:-}" ]] && zprof
