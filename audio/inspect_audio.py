"""Spectrogram + short-term loudness plot so the mix can be checked by eye."""
import sys, numpy as np
from scipy.io import wavfile
from scipy import signal
from PIL import Image, ImageDraw
sr, x = wavfile.read(sys.argv[1]); x = x.astype(np.float64)
m = x.mean(1)
f, t, Z = signal.spectrogram(m, sr, nperseg=4096, noverlap=3072)
Z = 10 * np.log10(Z + 1e-12)
# log-frequency rows 20 Hz..20 kHz
rows = 300
lf = np.geomspace(20, 20000, rows)
img = np.array([np.interp(lf, f, Z[:, i]) for i in range(Z.shape[1])]).T[::-1]
img = np.clip((img + 120) / 90, 0, 1)
W = 1600
im = Image.fromarray((img * 255).astype(np.uint8)).resize((W, rows * 2)).convert('RGB')
# loudness strip (400 ms RMS dBFS)
H2 = 160
strip = Image.new('RGB', (W, H2), (10, 10, 10)); d = ImageDraw.Draw(strip)
blk = int(0.4 * sr); dur = len(m) / sr
pts = []
for px in range(W):
    c = int(px / W * len(m)); seg = x[max(0, c - blk // 2): c + blk // 2]
    db = 10 * np.log10((seg ** 2).mean() + 1e-12)
    pts.append((px, H2 - (db + 60) / 60 * H2))
d.line(pts, fill=(255, 190, 90), width=2)
for s in range(0, int(dur) + 1, 5):
    X = s / dur * W; d.line([(X, 0), (X, H2)], fill=(60, 60, 60)); d.text((X + 2, 2), f"{s}s", fill=(200, 200, 200))
out = Image.new('RGB', (W, rows * 2 + H2)); out.paste(im, (0, 0)); out.paste(strip, (0, rows * 2))
out.save(sys.argv[2]); print('saved', sys.argv[2])
