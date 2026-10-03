#!/usr/bin/env bash
# Local dev: copies ONLY the static game (index.html, css/, img/, js/) into pocketbase/pb_public and serves it with PocketBase.
# Usage: pocketbase/dev.sh [extra pocketbase serve flags]   e.g. HTTP=127.0.0.1:8091 DIR=/tmp/pbtest pocketbase/dev.sh
# Google login: export GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (or put them in ../.env, auto-loaded) before running.
# Re-run (or run `pocketbase/dev.sh sync`) after editing the game files to refresh the copy.
set -euo pipefail
cd "$(dirname "$0")"
ROOT=..
if [ -f "$ROOT/.env" ]; then set -a; . "$ROOT/.env"; set +a; fi
sync_public() {
  rm -rf pb_public && mkdir -p pb_public
  cp "$ROOT/index.html" "$ROOT/sw.js" pb_public/
  cp -R "$ROOT/css" "$ROOT/img" "$ROOT/js" pb_public/
}
sync_public
[ "${1:-}" = "sync" ] && exit 0
[ -x ./pocketbase ] || { echo "pocketbase binary missing: download it from https://github.com/pocketbase/pocketbase/releases into ./pocketbase/ (see README)"; exit 1; }
exec ./pocketbase serve --http="${HTTP:-127.0.0.1:8090}" --dir="${DIR:-./pb_data}" --publicDir=./pb_public --hooksDir=./pb_hooks --migrationsDir=./pb_migrations --indexFallback=false "$@"
