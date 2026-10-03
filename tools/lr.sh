#!/bin/bash
# Local software render (SwiftShader) for debugging: tools/lr.sh out/name.png [args]
cd "$(dirname "$0")/.."
LOCAL=1 CHROME=${CHROME:-$(ls -d ~/.cache/ms-playwright/chromium-*/chrome-linux*/chrome 2>/dev/null | head -1)} node engine/render/render.mjs --out "$@"
