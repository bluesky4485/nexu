#!/usr/bin/env bash

set -u
set -o pipefail

capture_dir="${NEXU_DESKTOP_CHECK_CAPTURE_DIR:-.tmp/desktop-ci-test}"
exit_code=0

# Use dev.sh directly (non-blocking tmux mode) for CI compatibility.
# pnpm start uses dev-launchd.sh which is blocking.
./apps/desktop/dev.sh start
exit_code=$?

if [ "$exit_code" -eq 0 ]; then
  node scripts/desktop-ci-check.mjs dev --capture-dir "$capture_dir"
  exit_code=$?
fi

./apps/desktop/dev.sh stop
stop_code=$?

if [ "$exit_code" -eq 0 ] && [ "$stop_code" -ne 0 ]; then
  exit_code=$stop_code
fi

exit "$exit_code"
