#!/usr/bin/env bash
# Daily job: search → score → tailor (you apply on LinkedIn yourself)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Starting Nest pipeline (search → score → tailor)..."
pnpm run --filter @job-automator/api run:pipeline "$@"
echo "Done. Review with: pnpm dev  (http://127.0.0.1:3000)"
