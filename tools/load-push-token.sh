#!/usr/bin/env bash
# Load the GitHub push token (fine-grained PAT) into the ephemeral sandbox git
# credential store so `git push` works without a prompt. The token lives in
# .secrets/gh-token (gitignored, persists on the user's disk). The Cowork sandbox
# is wiped between sessions, so run this once per session before pushing.
# Safe to re-run. Affects only the sandbox (~/.git-credentials), never Windows.
set -e
root="$(git rev-parse --show-toplevel)"
tok="$root/.secrets/gh-token"
[ -f "$tok" ] || { echo "no token at $tok — ask the user to re-add the PAT"; exit 1; }
git config --global credential.helper store
printf 'https://talpinkas:%s@github.com\n' "$(tr -d '\r\n' < "$tok")" > ~/.git-credentials
chmod 600 ~/.git-credentials
echo "push token loaded"
