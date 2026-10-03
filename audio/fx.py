"""Space and mastering: generated convolution reverbs, delay, compression, limiting, loudness."""
import numpy as np
from scipy import signal
from synth import SR, biquad, rng_global


def make_ir(t60=4.0, pre=0.02, early=0.08, bright=0.5, width=1.0, length=None, rng=None):
    """Stereo IR: sparse early reflections + exponentially decaying noise tail whose
    high frequencies decay faster (air absorption)."""
    rng = rng or np.random.default_rng(7)
    L = int((length or t60 * 1.3) * SR)
    t = np.arange(L) / SR
    ir = np.zeros((L, 2))
    # tail: three bands with different decay times
    for lo, hi, k in ((20, 400, 1.15), (400, 3000, 1.0), (3000, 18000, 0.55 + 0.4 * bright)):
        n = rng.standard_normal((L, 2))
        n = biquad(n, "hp", lo) if lo > 20 else n
        n = biquad(n, "lp", hi)
        ir += n * np.exp(-6.91 * t / (t60 * k))[:, None]
    # decorrelate channels slightly / width
    m = ir.mean(1, keepdims=True)
    ir = m + (ir - m) * width
    onset = np.clip((t - pre) / max(early, 1e-3), 0, 1) ** 1.5
    ir *= onset[:, None]
    # early reflections
    for _ in range(18):
        d = pre + rng.uniform(0.003, early)
        i = int(d * SR)
        if i < L:
            ir[i] += rng.uniform(-1, 1, 2) * 0.9 * np.exp(-d / early)
    ir[: int(pre * SR)] = 0
    ir /= np.sqrt((ir ** 2).sum())
    return ir


_ir_cache = {}


def reverb(x, t60=4.0, mix=0.35, pre=0.02, bright=0.5, width=1.0, hp=120):
    key = (t60, pre, bright, width)
    if key not in _ir_cache: _ir_cache[key] = make_ir(t60, pre, bright=bright, width=width)
    ir = _ir_cache[key]
    if x.ndim == 1: x = np.stack([x, x], 1)
    wet_in = biquad(x, "hp", hp) if hp else x
    wet = np.stack([signal.fftconvolve(wet_in[:, 0], ir[:, 0]) + signal.fftconvolve(wet_in[:, 1], ir[:, 1]) * 0.15,
                    signal.fftconvolve(wet_in[:, 1], ir[:, 1]) + signal.fftconvolve(wet_in[:, 0], ir[:, 0]) * 0.15], 1)
    out = np.zeros((max(len(x), len(wet)), 2))
    out[: len(x)] += x * (1 - mix)
    out[: len(wet)] += wet * mix * 3.0
    return out


def delay(x, time=0.375, fb=0.35, mix=0.25, lp=4000):
    n = len(x)
    d = int(time * SR)
    out = x.copy()
    buf = x.copy()
    for k in range(1, 8):
        buf = biquad(buf, "lp", lp) * fb
        if d * k >= n: break
        out[d * k:] += buf[: n - d * k] * mix / fb
    return out


def compress(x, thresh_db=-18, ratio=3.0, attack=0.01, release=0.2, makeup_db=0.0):
    lvl = np.abs(x).max(axis=1) if x.ndim == 2 else np.abs(x)
    a = np.exp(-1 / (attack * SR)); r = np.exp(-1 / (release * SR))
    env = signal.lfilter([1 - r], [1, -r], lvl)  # cheap smoothing
    env = np.maximum(env, 1e-9)
    db = 20 * np.log10(env)
    over = np.maximum(0, db - thresh_db)
    gain = 10 ** ((-over * (1 - 1 / ratio) + makeup_db) / 20)
    gain = signal.lfilter([1 - a], [1, -a], gain)
    return x * (gain[:, None] if x.ndim == 2 else gain)


def limiter(x, ceiling_db=-1.0, lookahead=0.005, release=0.08):
    ceil = 10 ** (ceiling_db / 20)
    peak = np.abs(x).max(axis=1)
    la = int(lookahead * SR)
    # running max over lookahead window
    from scipy.ndimage import maximum_filter1d
    pk = maximum_filter1d(peak, size=2 * la + 1, origin=0)
    g = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
    r = np.exp(-1 / (release * SR))
    # smooth: instant down, slow up
    out = np.empty_like(g)
    cur = 1.0
    for i in range(len(g)):
        cur = g[i] if g[i] < cur else cur * r + g[i] * (1 - r)
        out[i] = cur
    y = x * out[:, None]
    return np.clip(y, -ceil, ceil)


def k_weight(x):
    # BS.1770 pre-filter (48 kHz coefficients)
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]; a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]; a2 = [1.0, -1.99004745483398, 0.99007225036621]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=0), axis=0)


def loudness(x):
    """integrated LUFS (gated), stereo"""
    y = k_weight(x)
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    ms = []
    for i in range(0, len(y) - blk, hop):
        ms.append((y[i:i + blk] ** 2).mean(axis=0).sum())
    ms = np.array(ms)
    if not len(ms): return -70.0
    l = -0.691 + 10 * np.log10(np.maximum(ms, 1e-12))
    g = ms[l > -70]
    if not len(g): return -70.0
    rel = -0.691 + 10 * np.log10(g.mean()) - 10
    g2 = ms[(l > -70) & (l > rel)]
    return -0.691 + 10 * np.log10(g2.mean())


def master(x, target_lufs=-16.0, ceiling_db=-1.0):
    x = compress(x, -14, 1.8, 0.02, 0.3)
    lu = loudness(x)
    x = x * 10 ** ((target_lufs - lu) / 20)
    return limiter(x, ceiling_db)
