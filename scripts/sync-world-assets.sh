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
