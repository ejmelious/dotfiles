#!/usr/bin/env bash
# Claude Code PreToolUse hook for Bash. Exit 2 blocks the command and shows
# the message to Claude. Guardrails, not a security boundary: they catch the
# common mistakes at the moment they happen. Adapted from
# trailofbits/claude-code-config.
set -uo pipefail

input="$(cat)"
cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"
cwd="$(printf '%s' "$input" | jq -r '.cwd // empty')"
[ -n "$cmd" ] || exit 0

# Split on shell separators so each simple command is checked on its own.
segments="$(printf '%s\n' "$cmd" | sed -E 's/(&&|\|\||;|\|)/\n/g')"

while IFS= read -r seg; do
    seg="${seg#"${seg%%[![:space:]]*}"}"   # trim leading space
    words="$seg"

    # rm with both recursive and force flags, in any spelling.
    if printf '%s' "$words" | grep -qE '^(sudo[[:space:]]+)?rm[[:space:]]' \
        && printf '%s' "$words" | grep -qE '(^|[[:space:]])(-[a-zA-Z]*[rR][a-zA-Z]*|--recursive)([[:space:]]|$)' \
        && printf '%s' "$words" | grep -qE '(^|[[:space:]])(-[a-zA-Z]*f[a-zA-Z]*|--force)([[:space:]]|$)'; then
        echo "BLOCKED: rm -rf is not allowed. Use 'trash <path>' so it can be recovered, or ask the user." >&2
        exit 2
    fi

    # A -C path may be quoted, and then may contain spaces.
    dash_c_arg="(\"[^\"]*\"|'[^']*'|[^[:space:]]+)"
    push_re="^git([[:space:]]+-C[[:space:]]+$dash_c_arg)?[[:space:]]+push([[:space:]]|\$)"
    if [[ "$words" =~ $push_re ]]; then
        # Everything after the matched subcommand, so a "push" inside a -C
        # path can't be mistaken for it.
        push_args="${words:${#BASH_REMATCH[0]}}"
        # Explicit push to main/master (including HEAD:main, +main, origin main).
        if printf '%s' "$words" | grep -qE '([[:space:]:+]|^)(main|master)([[:space:]]|$)'; then
            echo "BLOCKED: don't push to main/master directly. Push a feature branch and open a PR." >&2
            exit 2
        fi
        # Bare `git push` / `git push origin` while on main/master.
        # `git -C <dir> push` acts on <dir>, so check that repo's branch.
        target="${cwd:-.}" unresolved=0
        dash_c_re="^git[[:space:]]+-C[[:space:]]+$dash_c_arg"
        if [[ "$words" =~ $dash_c_re ]]; then
            dir="${BASH_REMATCH[1]}"
            # Undo the simple quoting the shell would strip; never eval it.
            case "$dir" in
                \"*\") dir="${dir#\"}"; dir="${dir%\"}" ;;
                \'*\') dir="${dir#\'}"; dir="${dir%\'}" ;;
            esac
            case "$dir" in \~|\~/*) dir="$HOME${dir#\~}" ;; esac
            case "$dir" in
                /*) target="$dir" ;;
                *) target="$target/$dir" ;;
            esac
            # Variables, spaces or odd quoting: we can't tell which repo this
            # is, so treat it like a push from main rather than let it through.
            git -C "$target" rev-parse --git-dir &>/dev/null || unresolved=1
        fi
        branch="$(git -C "$target" branch --show-current 2>/dev/null || true)"
        if [ "$branch" = "main" ] || [ "$branch" = "master" ] || [ "$unresolved" = 1 ]; then
            # Count the non-flag arguments after `push`, wherever the flags are.
            # Two or more means remote plus refspec, which the check above has
            # already cleared. Skip the values of flags that take one, so
            # `-o ci.skip origin` still counts as a bare push.
            read -ra argv <<< "$push_args"
            positional=0 skip_next=0
            # ${a[@]+...}: bash 3.2 (macOS) treats an empty array as unset under set -u.
            for arg in ${argv[@]+"${argv[@]}"}; do
                if [ "$skip_next" = 1 ]; then skip_next=0; continue; fi
                case "$arg" in
                    -o|--push-option|--repo|--receive-pack|--exec) skip_next=1 ;;
                    -*) ;;
                    *) positional=$((positional + 1)) ;;
                esac
            done
            if [ "$positional" -lt 2 ] && [ "$unresolved" = 1 ]; then
                echo "BLOCKED: can't tell which repo the -C path is, so can't rule out pushing main. Use a plain path or name the branch, e.g. git push origin my-branch." >&2
                exit 2
            elif [ "$positional" -lt 2 ]; then
                echo "BLOCKED: you're on $branch and this push would update it. Create a feature branch first." >&2
                exit 2
            fi
        fi
    fi
done <<< "$segments"

exit 0
