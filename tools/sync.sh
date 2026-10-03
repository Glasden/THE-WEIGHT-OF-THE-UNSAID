#!/bin/bash
# Push engine (and optionally assets) to the Windows GPU box.
set -e
cd "$(dirname "$0")/.."
R=windows-gpu:E:/opus_film/app
winremote exec -c "New-Item -ItemType Directory -Force -Path E:\opus_film\app\engine, E:\opus_film\app\assets\build, E:\opus_film\app\assets\fonts | Out-Null" >/dev/null
tar -cf - engine audio/*.py | ssh windows-gpu "tar -xf - -C E:/opus_film/app"
if [ "$1" == "assets" ]; then
  # small files one at a time (the tunnel drops on long bulk streams); .r8 is rebuilt remotely from PNG
  for f in atlas.json atlas_hi.json corpus.json atlas_hi.png atlas.png; do scp -q assets/build/$f $R/assets/build/$f; done
  winremote exec -c "& 'D:\anaconda\envs\clerk\python.exe' E:\opus_film\app\engine\render\png2r8.py E:\opus_film\app\assets\build\atlas.png E:\opus_film\app\assets\build\atlas_hi.png"
fi
echo synced
