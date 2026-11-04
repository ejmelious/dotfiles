# shellcheck shell=bash
# Signs the Atlassian CLI (acli) in to Jira from the JIRA_API_TOKEN Ona secret.
# Sourced by install.sh. acli keeps its login in each machine's keyring, which
# EFS can't share, so this runs in every new environment. Never installs acli
# and never prints the token.

jira_auth() {
    local site="${JIRA_SITE:-vanta.atlassian.net}" email token_file

    if [ -z "${JIRA_API_TOKEN:-}" ]; then
        skip "JIRA_API_TOKEN not set (add it as an Ona personal secret for Jira sign-in)"
        return 0
    fi
    if ! command -v acli &>/dev/null; then
        skip "acli not installed; skipping Jira sign-in"
        return 0
    fi
    if acli jira auth status &>/dev/null; then
        skip "acli already signed in to Jira"
        return 0
    fi

    # The token is only valid with your Vanta email. Fall back to git's email
    # only when it is a Vanta address (on Ona git often has a noreply one).
    email="${JIRA_EMAIL:-}"
    if [ -z "$email" ]; then
        email="$(git config --global --get user.email 2>/dev/null || true)"
        case "$email" in *@vanta.com) ;; *) email="" ;; esac
    fi
    if [ -z "$email" ]; then
        skip "Jira sign-in: set JIRA_EMAIL in Ona secrets to your Vanta email"
        return 0
    fi

    # acli reads the token from stdin but mishandles pipes, so use a file only
    # we can read, removed as soon as acli returns. A file redirect also keeps
    # the token out of the process list.
    token_file="$(umask 077 && mktemp)"
    printf '%s' "$JIRA_API_TOKEN" > "$token_file"
    if acli jira auth login --site "$site" --email "$email" --token < "$token_file" &>/dev/null; then
        ok "acli signed in to Jira as $email"
    else
        warn "acli Jira sign-in failed; check JIRA_API_TOKEN and JIRA_EMAIL"
    fi
    rm -f "$token_file"
}
