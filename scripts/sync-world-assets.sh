#!/bin/sh
# Ship runtime assets only, excluding lab backups, bot fixtures and design documents.
set -eu
source_dir="$1/docs/style-lab"
target_dir="$2/worlds/venezuela"
mkdir -p "$target_dir"
# Public entry loads only the runtime; laboratory HTML and controls are never shipped.
rm -f "$target_dir/engine.html" "$target_dir/lab-ui.js" "$target_dir/public-ui.js"
cp "$source_dir/public.html" "$target_dir/index.html"
cp "$source_dir/engine.js" "$target_dir/"
cp "$source_dir/campana.js" "$source_dir/juegos-bus.js" "$target_dir/"
cp "$source_dir"/juego-*.js "$target_dir/"
cp "$source_dir"/fiesta-*.js "$source_dir/fiesta.html" "$target_dir/"
# Margarita (docs/margarita) loads ../style-lab/fiesta*.js and iframes ../style-lab/fiesta.html, so both folders ship under docs/ at the same relative paths.
if [ -f "$1/docs/margarita/index.html" ]; then
  mkdir -p "$2/docs/margarita" "$2/docs/style-lab"
  cp "$1/docs/margarita/index.html" "$1/docs/margarita"/*.js "$2/docs/margarita/"
  cp "$source_dir/engine.js" "$source_dir/campana.js" "$source_dir/juegos-bus.js" "$source_dir"/juego-*.js "$source_dir"/fiesta-*.js "$source_dir/fiesta.html" "$source_dir/jugar.html" "$2/docs/style-lab/"
fi
