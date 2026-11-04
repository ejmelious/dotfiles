#!/usr/bin/env bash
# Builds a small git repo: main holds files/base, branch "feature" adds files/change.
set -eu
here="$(dirname "$0")"
cp -R "$here/files/base/." .
git init -q -b main .
git -c user.name=Fixture -c user.email=fixture@example.com add -A
git -c user.name=Fixture -c user.email=fixture@example.com commit -q -m "Initial project"
git checkout -q -b feature
cp -R "$here/files/change/." .
git -c user.name=Fixture -c user.email=fixture@example.com add -A
git -c user.name=Fixture -c user.email=fixture@example.com commit -q -m "Add feature"
if [ -d "$here/files/node_modules" ]; then cp -R "$here/files/node_modules" ./node_modules; fi
