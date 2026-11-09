#!/usr/bin/env bash
# Builds a repo: main holds files/base (with the milestone's test plan), branch "m2" adds the milestone's code and tests.
set -eu
here="$(dirname "$0")"
cp -R "$here/files/base/." .
git init -q -b main .
git -c user.name=Fixture -c user.email=fixture@example.com add -A
git -c user.name=Fixture -c user.email=fixture@example.com commit -q -m "Initial project"
git checkout -q -b m2
cp -R "$here/files/change/." .
git -c user.name=Fixture -c user.email=fixture@example.com add -A
git -c user.name=Fixture -c user.email=fixture@example.com commit -q -m "Add shipping fees"
