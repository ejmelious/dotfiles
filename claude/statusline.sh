#!/usr/bin/env bash
# Claude Code status line: model | folder | branch | context used | usage.
# Usage is the 5-hour subscription limit when Claude Code reports it, otherwise
# the session's estimated cost. Claude Code passes session JSON on stdin.
# Requires jq.

input="$(cat)"
IFS=$'\x1f' read -r dir model ctx limit cost < <(
    printf '%s' "$input" | jq -r '[
        .workspace.current_dir // .cwd // "",
        .model.display_name // "?",
        (try (100 - (.context_window.remaining_percentage | floor)) catch ""),
        (try (.rate_limits.five_hour.used_percentage | floor) catch ""),
        (try (.cost.total_cost_usd | if . > 0 then (. * 100 | round / 100 | tostring) else empty end) catch "")
    ] | map(. // "" | tostring) | join("\u001f")'
)

out="[$model] ${dir##*/}"
if branch="$(git -C "$dir" branch --show-current 2>/dev/null)" && [ -n "$branch" ]; then
    dirty=""
    [ -n "$(git -C "$dir" status --porcelain 2>/dev/null | head -1)" ] && dirty="*"
    out="$out │ $branch$dirty"
fi
[ -n "$ctx" ] && out="$out │ ctx ${ctx}%"
if [ -n "$limit" ]; then out="$out │ 5h ${limit}%"
elif [ -n "$cost" ]; then out="$out │ \$$cost"; fi
[ "${IS_ON_ONA:-}" = "true" ] && out="$out │ ona"

printf '%s\n' "$out"
