#!/bin/sh
# Ship runtime assets only, excluding lab backups, bot fixtures and design documents.
set -eu
source_dir="$1/docs/style-lab"
target_dir="$2/worlds/venezuela"
mkdir -p "$target_dir"
cp "$source_dir/index.html" "$target_dir/engine.html"
# The public entry is the campaign loader; its engine has a separate filename.
sed "s/fetch('index.html'/fetch('engine.html'/" "$source_dir/jugar.html" > "$target_dir/index.html"
cp "$source_dir/campana.js" "$source_dir/public-ui.js" "$source_dir/juegos-bus.js" "$target_dir/"
cp "$source_dir"/juego-*.js "$target_dir/"
