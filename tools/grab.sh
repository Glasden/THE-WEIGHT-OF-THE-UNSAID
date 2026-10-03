#!/bin/bash
# Grab single frames (seconds) from a video on the GPU box: tools/grab.sh <box-video> <local-dir> t1 t2 ...
set -e
vid=$1; dir=$2; shift 2
ps1=$(mktemp --suffix=.ps1)
trap 'rm -f "$ps1"' EXIT
{ echo "New-Item -ItemType Directory -Force -Path E:\\opus_film\\out\\grab | Out-Null"
  echo "Remove-Item E:\\opus_film\\out\\grab\\g_*.jpg -ErrorAction SilentlyContinue"
  for t in "$@"; do echo "& 'E:\\opus_film\\tools\\ffmpeg\\bin\\ffmpeg.exe' -v error -y -ss $t -i '$vid' -frames:v 1 -q:v 3 'E:\\opus_film\\out\\grab\\g_$t.jpg'"; done; } > "$ps1"
winremote --timeout 900 exec -f "$ps1" >/dev/null
mkdir -p "$dir"
scp -q "windows-gpu:E:/opus_film/out/grab/g_*.jpg" "$dir/"
ls "$dir"/g_*.jpg | head -50
