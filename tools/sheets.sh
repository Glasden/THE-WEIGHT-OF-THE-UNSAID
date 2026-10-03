#!/bin/bash
# Contact sheets of a video on the GPU box: tools/sheets.sh <box-video> <local-prefix> [every_s] [width]
# One tile every N seconds (default 2), 6x8 tiles per sheet; made on the box, only the jpgs come back.
set -e
vid=$1; pre=$2; every=${3:-2}; w=${4:-480}
ps1=$(mktemp --suffix=.ps1)
trap 'rm -f "$ps1"' EXIT
cat > "$ps1" <<PS
New-Item -ItemType Directory -Force -Path E:\opus_film\out\sheets | Out-Null
Remove-Item E:\opus_film\out\sheets\s_*.jpg -ErrorAction SilentlyContinue
& 'E:\opus_film\tools\ffmpeg\bin\ffmpeg.exe' -v error -y -i '$vid' -vf 'fps=1/$every,scale=${w}:-1,tile=6x8' -q:v 4 'E:\opus_film\out\sheets\s_%02d.jpg'
PS
winremote --timeout 900 exec -f "$ps1" >/dev/null
dir=$(dirname "$pre"); mkdir -p "$dir"
scp -q "windows-gpu:E:/opus_film/out/sheets/s_*.jpg" "$dir/"
for f in "$dir"/s_*.jpg; do mv "$f" "${pre}_$(basename "$f")"; done
ls "${pre}"_s_*.jpg
