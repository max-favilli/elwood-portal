#!/usr/bin/env bash
# Start the sibling Runtime API and this portal. Ctrl+C stops both.
set -euo pipefail
cd "$(dirname "$0")"
exec node scripts/start-dev.mjs
