#!/usr/bin/env bash
# Browser tests for Wearwise (headless Chrome via Playwright for Python).
# Usage: from the repo root: bash wearwise/tests/e2e/run_all.sh
# Serves the repo root on :8765 and runs every suite against /wearwise.html.
set -u
cd "$(dirname "$0")/../../.."
mkdir -p /tmp/wearwise-e2e
(curl -s -o /dev/null http://localhost:8765/wearwise.html) || { python3 -m http.server 8765 >/dev/null 2>&1 & sleep 2; }
here=wearwise/tests/e2e
# cutout.py makes the synthetic photos the upload tests use, so it runs first.
for t in cutout upload_retry flow phase2 polish cal share forward migrate inspiration sync_sim; do
  printf '%-14s ' "$t"; timeout 600 python3 "$here/$t.py" "${@}" 2>&1 | grep -E "^SUMMARY|^FAIL" | tr '\n' ' '; echo
done
printf '%-14s ' "sync (old db)"; timeout 600 python3 "$here/sync_sim.py" old-table 2>&1 | grep -E "^SUMMARY|^FAIL" | tr '\n' ' '; echo
printf "%-14s " "tip jar (off)"; timeout 600 python3 "$here/tip.py" off 2>&1 | grep -E "^SUMMARY|^FAIL" | tr "\n" " "; echo
