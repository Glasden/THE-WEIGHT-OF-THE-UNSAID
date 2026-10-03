#!/bin/bash
# Render on the GPU box inside the interactive session: tools/rr.sh <out-name> [render.mjs args...]
# Output lands in E:/opus_film/out/<out-name> and is copied to ./out/ (unless NOFETCH=1).
set -e
cd "$(dirname "$0")/.."
name=$1; shift
argline="--out E:/opus_film/out/$name $*"
ps1=$(mktemp --suffix=.ps1)
trap 'rm -f "$ps1"' EXIT
cat > "$ps1" <<PS
\$j = 'E:\opus_film\job'
Remove-Item "\$j\done.txt","\$j\out.log","\$j\err.log" -ErrorAction SilentlyContinue
Set-Content "\$j\args.txt" '$argline' -Encoding utf8
Start-ScheduledTask -TaskName OpusFilmRender
\$t0 = Get-Date
while (-not (Test-Path "\$j\done.txt")) {
  Start-Sleep -Seconds 2
  if (((Get-Date) - \$t0).TotalSeconds -gt ${TIMEOUT:-7000}) { 'TIMEOUT'; break }
}
Get-Content "\$j\out.log" -ErrorAction SilentlyContinue | Where-Object { \$_ -notmatch 'Permissions policy|favicon|Failed to load resource' } | Select-Object -Last ${TAIL:-12}
Get-Content "\$j\err.log" -ErrorAction SilentlyContinue | Select-Object -Last 8
Get-Content "\$j\done.txt" -ErrorAction SilentlyContinue
PS
winremote --timeout ${WTIMEOUT:-7200} exec -f "$ps1"
mkdir -p out
if [ -z "$NOFETCH" ]; then
  if [[ "$name" == *%* ]]; then scp -q "windows-gpu:E:/opus_film/out/${name%%%*}*" out/ 2>/dev/null || true
  else scp -q "windows-gpu:E:/opus_film/out/$name" out/ || true; fi
fi
