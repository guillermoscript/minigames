#!/bin/sh
# LA FIESTA: the server runs the SAME pure board reducer as the browser (doc 07 §4.2). One source of truth in docs/style-lab;
# this copies it into the PocketBase hooks dir, where pb_hooks/party.js require()s fiesta-reglas.js (which pulls rng, map and CPU
# with relative requires). Only *.pb.js files run as hooks, so these copies are plain modules. Generated: ignored by git.
# The Margarita board (doc 14) is a second reducer on the same rooms; it requires the rng and the minigame catalog the same way.
# Usage: sync-fiesta-rules.sh <repo-or-staging-root> <pb_hooks dir>
set -eu
source_dir="$1/docs/style-lab"
target_dir="$2"
mkdir -p "$target_dir"
for f in fiesta-rng.js fiesta-mapa-venezuela.js fiesta-reglas.js fiesta-cpu.js; do
  cp "$source_dir/$f" "$target_dir/$f"
done
for f in margarita-grafo.js margarita-reglas.js margarita-cpu.js; do
  cp "$1/docs/margarita/$f" "$target_dir/$f"
done
