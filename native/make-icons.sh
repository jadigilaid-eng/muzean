#!/usr/bin/env bash
# Generates launcher icons + splash from the original MUZEAN logo (public/assets/muzean-logo.png).
# Usage: native/make-icons.sh <logo.png> <android/app/src/main/res>
set -euo pipefail
# ImageMagick 7 (ubuntu runners) ships only "magick"; ImageMagick 6 ships "convert"/"identify".
if ! command -v convert >/dev/null 2>&1; then
  command -v magick >/dev/null 2>&1 || { sudo apt-get update -qq && sudo apt-get install -y -qq imagemagick; }
  if command -v magick >/dev/null 2>&1; then
    convert() { magick "$@"; }
    identify() { magick identify "$@"; }
  fi
fi
LOGO="$1"; RES="$2"; BG="#008080"
declare -A FG=( [mdpi]=108 [hdpi]=162 [xhdpi]=216 [xxhdpi]=324 [xxxhdpi]=432 )
declare -A LG=( [mdpi]=48 [hdpi]=72 [xhdpi]=96 [xxhdpi]=144 [xxxhdpi]=192 )
TRIM=$(mktemp --suffix=.png); convert "$LOGO" -trim +repage "$TRIM"
for d in "${!FG[@]}"; do
  mkdir -p "$RES/mipmap-$d"
  f=${FG[$d]}; l=${LG[$d]}
  # adaptive foreground: logo inside the 66/108 safe zone
  inner=$(( f * 56 / 108 ))
  convert -size ${f}x${f} xc:none \( "$TRIM" -filter point -resize ${inner}x${inner} \) -gravity center -composite "$RES/mipmap-$d/ic_launcher_foreground.png"
  # legacy square icon
  inner=$(( l * 72 / 100 ))
  convert -size ${l}x${l} xc:"$BG" \( "$TRIM" -filter point -resize ${inner}x${inner} \) -gravity center -composite \
    \( -size ${l}x${l} xc:none -fill white -draw "roundrectangle 0,0,$((l-1)),$((l-1)),$((l/6)),$((l/6))" \) -compose DstIn -composite "$RES/mipmap-$d/ic_launcher.png"
  # legacy round icon
  convert -size ${l}x${l} xc:"$BG" \( "$TRIM" -filter point -resize ${inner}x${inner} \) -gravity center -composite \
    \( -size ${l}x${l} xc:none -fill white -draw "circle $((l/2)),$((l/2)) $((l/2)),0" \) -compose DstIn -composite "$RES/mipmap-$d/ic_launcher_round.png"
done
mkdir -p "$RES/values"
cat > "$RES/values/ic_launcher_background.xml" <<XML
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">$BG</color>
</resources>
XML
# splash: teal background, logo centred (replaces every template splash.png)
for f in $(find "$RES" -name splash.png); do
  dim=$(identify -format '%wx%h' "$f"); w=${dim%x*}; h=${dim#*x}
  m=$(( (w<h?w:h) * 35 / 100 ))
  convert -size ${w}x${h} xc:"$BG" \( "$TRIM" -filter point -resize ${m}x${m} \) -gravity center -composite "$f"
done
rm -f "$TRIM"
