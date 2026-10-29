#!/bin/sh
# Margarita EN LÍNEA on a real PocketBase, for testing with phones on the same Wi-Fi (doc 14 M3).
# Needs the binary at pocketbase/pocketbase. Refreshes the reducer copies in pb_hooks, then serves a public dir that LINKS the repo's
# app, fonts, the Venezuela world (pocketbase/pb_public/worlds, made by pocketbase/dev.sh) and the two lab folders the island page and
# its minigame iframe need (docs/margarita, docs/style-lab). Data and public dir live in pocketbase/pb_dev/ (ignored by git), so the
# normal pocketbase/pb_data is never touched.
# Usage: scripts/margarita-online-dev.sh [port]   →   on the phones: http://<this computer's LAN IP>:<port>/docs/margarita/
set -eu
REPO="$(cd "$(dirname "$0")/.." && pwd)"; PORT="${1:-8090}"; OUT="$REPO/pocketbase/pb_dev"
[ -x "$REPO/pocketbase/pocketbase" ] || { echo "pocketbase binary missing: put it at pocketbase/pocketbase"; exit 1; }
sh "$REPO/scripts/sync-fiesta-rules.sh" "$REPO" "$REPO/pocketbase/pb_hooks"
rm -rf "$OUT/pub"; mkdir -p "$OUT/pub/docs" "$OUT/data"
for f in index.html sw.js manifest.webmanifest css img js audio fonts; do ln -s "$REPO/$f" "$OUT/pub/$f"; done
[ -d "$REPO/pocketbase/pb_public/worlds" ] && ln -s "$REPO/pocketbase/pb_public/worlds" "$OUT/pub/worlds"
ln -s "$REPO/docs/margarita" "$OUT/pub/docs/margarita"
ln -s "$REPO/docs/style-lab" "$OUT/pub/docs/style-lab"
IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I 2>/dev/null | cut -d' ' -f1 || echo localhost)"
echo "Margarita online: http://$IP:$PORT/docs/margarita/  (this computer: http://localhost:$PORT/docs/margarita/)"
exec "$REPO/pocketbase/pocketbase" serve --http="0.0.0.0:$PORT" --dir="$OUT/data" --publicDir="$OUT/pub" \
  --hooksDir="$REPO/pocketbase/pb_hooks" --migrationsDir="$REPO/pocketbase/pb_migrations" --indexFallback=false
