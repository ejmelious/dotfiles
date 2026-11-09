#!/usr/bin/env bash
# Copies the fixture project into the run directory and commits it, so the run can diff its changes.
# Vitest isn't committed: put an installed node_modules in files/ (git-ignored) or install it in the run dir.
set -eu
here="$(dirname "$0")"
cp -R "$here/files/." .
git init -q -b main .
git -c user.name=Fixture -c user.email=fixture@example.com add -A
git -c user.name=Fixture -c user.email=fixture@example.com commit -q -m "Initial project"
