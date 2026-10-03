"""Instrument and sound-design primitives. Everything is synthesized; nothing is sampled.

All functions return float64 arrays at SR, mono (N,) or stereo (N, 2).
"""
import numpy as np
from scipy import signal

SR = 48000
rng_global = np.random.default_rng(20261003)


def t_axis(dur):
    return np.arange(int(round(dur * SR))) / SR


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


NOTE = {n: i for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}
NOTE.update({"Db": 1, "Eb": 3, "Gb": 6, "Ab": 8, "Bb": 10})


def note(name):
    """'D2' -> frequency"""
    p, o = name[:-1], int(name[-1])
    return midi(12 * (o + 1) + NOTE[p])


def stereo(x, pan=0.0, width=0.0):
    """equal-power pan; pan in [-1, 1]"""
    a = (pan + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], axis=1)


def env_adsr(n, a, d, s, r, sustain_len=None):
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    sl = n - a - d - r if sustain_len is None else int(sustain_len * SR)
    sl = max(sl, 0)
    e = np.concatenate([np.linspace(0, 1, a, endpoint=False) ** 1.5 if a else [], np.linspace(1, s, d, endpoint=False) if d else [],
                        np.full(sl, s), np.linspace(s, 0, r) ** 1.3 if r else []])
    if len(e) < n:
        e = np.concatenate([e, np.zeros(n - len(e))])
    return e[:n]


def fade(x, fin=0.01, fout=0.01):
    x = x.copy()
    a, b = int(fin * SR), int(fout * SR)
    if a: x[:a] *= np.linspace(0, 1, a)[:, None] if x.ndim == 2 else np.linspace(0, 1, a)
    if b: x[-b:] *= np.linspace(1, 0, b)[:, None] if x.ndim == 2 else np.linspace(1, 0, b)
    return x


# ------------------------------------------------------------------ filters

def biquad(x, kind, f, q=0.707, gain_db=0.0):
    w = 2 * np.pi * np.clip(f, 10, SR * 0.49) / SR
    alpha = np.sin(w) / (2 * q)
    c = np.cos(w)
    A = 10 ** (gain_db / 40)
    if kind == "lp": b = [(1 - c) / 2, 1 - c, (1 - c) / 2]; a = [1 + alpha, -2 * c, 1 - alpha]
    elif kind == "hp": b = [(1 + c) / 2, -(1 + c), (1 + c) / 2]; a = [1 + alpha, -2 * c, 1 - alpha]
    elif kind == "bp": b = [alpha, 0, -alpha]; a = [1 + alpha, -2 * c, 1 - alpha]
    elif kind == "peak": b = [1 + alpha * A, -2 * c, 1 - alpha * A]; a = [1 + alpha / A, -2 * c, 1 - alpha / A]
    elif kind == "lowshelf":
        sa = 2 * np.sqrt(A) * alpha
        b = [A * ((A + 1) - (A - 1) * c + sa), 2 * A * ((A - 1) - (A + 1) * c), A * ((A + 1) - (A - 1) * c - sa)]
        a = [(A + 1) + (A - 1) * c + sa, -2 * ((A - 1) + (A + 1) * c), (A + 1) + (A - 1) * c - sa]
    elif kind == "highshelf":
        sa = 2 * np.sqrt(A) * alpha
        b = [A * ((A + 1) + (A - 1) * c + sa), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - sa)]
        a = [(A + 1) - (A - 1) * c + sa, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - sa]
    else: raise ValueError(kind)
    return signal.lfilter(np.array(b) / a[0], np.array(a) / a[0], x, axis=0)


def sweep_bp(x, f0, f1, q=2.0, block=256):
    """band-pass whose centre glides exponentially from f0 to f1 (state-variable filter, per-sample)"""
    n = len(x)
    fc = np.exp(np.linspace(np.log(f0), np.log(f1), n))
    return svf(x, fc, q, "bp")


def svf(x, fc, q, mode="lp"):
    """Chamberlin/Simper SVF with per-sample cutoff (array). mode lp|bp|hp"""
    n = len(x)
    fc = np.broadcast_to(np.asarray(fc, dtype=np.float64), (n,))
    g = np.tan(np.pi * np.clip(fc, 10, SR * 0.45) / SR)
    k = 1.0 / q
    a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2
    out = np.empty(n)
    ic1 = ic2 = 0.0
    xs = np.asarray(x, dtype=np.float64)
    for i in range(n):
        v3 = xs[i] - ic2
        v1 = a1[i] * ic1 + a2[i] * v3
        v2 = ic2 + a2[i] * ic1 + a3[i] * v3
        ic1 = 2 * v1 - ic1
        ic2 = 2 * v2 - ic2
        out[i] = v2 if mode == "lp" else v1 if mode == "bp" else xs[i] - k * v1 - v2
    return out


def pink(n, rng=rng_global):
    w = rng.standard_normal(n)
    b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
    a = [1, -2.494956002, 2.017265875, -0.522189400]
    return signal.lfilter(b, a, w) * 8


# ------------------------------------------------------------------ oscillators

def additive(freqs, amps, dur, phases=None, decays=None, rng=rng_global):
    """sum of sinusoids; freqs may be arrays (glides). decays = T60 per partial (s) or None"""
    t = t_axis(dur)
    out = np.zeros_like(t)
    for i, (f, a) in enumerate(zip(freqs, amps)):
        if a == 0: continue
        ph = phases[i] if phases is not None else rng.uniform(0, 2 * np.pi)
        if np.ndim(f) == 0:
            if f >= SR * 0.45: continue
            s = np.sin(2 * np.pi * f * t + ph)
        else:
            s = np.sin(2 * np.pi * np.cumsum(f) / SR + ph)
            s[f >= SR * 0.45] = 0
        if decays is not None: s *= np.exp(-6.91 * t / decays[i])
        out += a * s
    return out


def saw_bl(freq, dur, rng=rng_global, max_h=None):
    """band-limited saw via additive (freq scalar or array)"""
    f_ref = np.max(freq) if np.ndim(freq) else freq
    H = int(min(max_h or 200, (SR * 0.45) // f_ref))
    t = np.arange(len(freq)) / SR if np.ndim(freq) else t_axis(dur)
    phase = 2 * np.pi * (np.cumsum(np.broadcast_to(freq, t.shape)) / SR) + rng.uniform(0, 2 * np.pi)
    out = np.zeros_like(t)
    for h in range(1, H + 1):
        out += np.sin(h * phase) / h
    return out * (2 / np.pi)


# ------------------------------------------------------------------ instruments

def piano(f0, dur=8.0, vel=0.7, rng=rng_global, bright=1.0):
    """Modal piano: 3 detuned strings, inharmonic partials with two-stage decay, hammer thump."""
    t = t_axis(dur)
    out = np.zeros_like(t)
    B = 0.00012 * (f0 / 65) ** 1.1
    T1 = np.clip(18 * (65 / f0) ** 0.62, 1.2, 22)                # fundamental T60
    hp = 1 / 7.3                                                  # hammer position
    nmax = int(min(40, (SR * 0.42) // f0))
    for s, det in enumerate((-0.45, 0.0, 0.5)):
        fs = f0 * 2 ** (det / 1200)
        for n in range(1, nmax + 1):
            fn = n * fs * np.sqrt(1 + B * n * n)
            if fn > SR * 0.42: break
            a = (1 / n ** 0.85) * abs(np.sin(np.pi * n * hp)) * np.exp(-n * fs / (2500 + 6000 * vel * bright))
            T = T1 / (1 + 0.22 * (n - 1) * (fn / 1000) ** 0.4)
            fast = 0.35 * np.exp(-6.91 * t / (T * 0.12))
            slow = 0.65 * np.exp(-6.91 * t / T)
            out += a * np.sin(2 * np.pi * fn * t + rng.uniform(0, 6.28)) * (fast + slow)
    out /= 3
    # hammer: short felt thump
    hn = int(0.02 * SR)
    th = rng.standard_normal(hn) * np.exp(-np.linspace(0, 8, hn))
    th = biquad(th, "lp", 400 + 2500 * vel)
    out[:hn] += th * 0.06 * vel
    att = np.minimum(1, t / 0.002)
    return out * att * vel


def organ_pipe(f, dur, rank="principal", rng=rng_global, attack=0.09, release=0.25):
    """single flue pipe: harmonic spectrum + wind noise + chiff"""
    t = t_axis(dur + release)
    n_h = int(min(24, (SR * 0.42) // f))
    det = 2 ** (rng.uniform(-1.2, 1.2) / 1200)
    f = f * det
    if rank == "principal": amps = [1 / h ** 1.25 * (1.15 if h % 2 else 1) for h in range(1, n_h + 1)]
    elif rank == "flute": amps = [1 / h ** 2.6 for h in range(1, n_h + 1)]
    elif rank == "reed": amps = [1 / h ** 0.75 for h in range(1, n_h + 1)]
    else: amps = [1 / h ** 1.6 for h in range(1, n_h + 1)]
    # slight wind flutter
    flutter = 1 + 0.0009 * np.sin(2 * np.pi * rng.uniform(4.5, 6.5) * t + rng.uniform(0, 6))
    phase = 2 * np.pi * f * np.cumsum(flutter) / SR
    tone = np.zeros_like(t)
    for h, a in enumerate(amps, 1):
        tone += a * np.sin(h * phase + rng.uniform(0, 6.28))
    e = np.ones_like(t)
    na = int(attack * SR)
    e[:na] = (np.linspace(0, 1, na)) ** 1.8
    nr = int(release * SR)
    e[-nr:] *= np.linspace(1, 0, nr) ** 1.5
    tone *= e
    # chiff: 2nd harmonic + noise burst on speech
    nc = int(0.07 * SR)
    ch = np.sin(2 * f * 2 * np.pi * t[:nc]) * np.exp(-np.linspace(0, 5, nc)) * 0.25
    ch += biquad(rng.standard_normal(nc), "bp", min(f * 4, 9000), 3) * np.exp(-np.linspace(0, 6, nc)) * 0.15
    tone[:nc] += ch
    wind = biquad(rng.standard_normal(len(t)), "bp", min(f * 2, 8000), 1.2) * 0.006 * e
    return tone + wind


def organ_chord(notes, dur, stops=(("principal", 1, 1.0), ("principal", 2, 0.5), ("flute", 0.5, 0.6), ("principal", 4, 0.22), ("reed", 1, 0.0)),
                rng=rng_global, attack=0.12, release=0.6, spread=0.6):
    """notes: list of freqs. stops: (rank, footage multiplier, level). Returns stereo."""
    n = int(round((dur + release) * SR))
    out = np.zeros((n, 2))
    for i, f in enumerate(notes):
        pan = (i / max(1, len(notes) - 1) - 0.5) * spread
        for rank, mult, lv in stops:
            if lv <= 0: continue
            p = organ_pipe(f * mult, dur, rank, rng, attack, release)[:n]
            out[:len(p)] += stereo(p * lv, pan + rng.uniform(-0.1, 0.1))
    return out


FORMANTS = {  # (freq, bw, gain dB) for sung vowels, female / male-ish
    "a": [(800, 80, 0), (1150, 90, -4), (2900, 120, -20), (3900, 130, -36)],
    "o": [(450, 70, 0), (800, 80, -9), (2830, 100, -16), (3800, 130, -28)],
    "u": [(325, 50, 0), (700, 60, -12), (2700, 170, -30), (3800, 180, -40)],
    "e": [(400, 60, 0), (1600, 80, -24), (2700, 120, -30), (3300, 150, -35)],
    "i": [(270, 60, 0), (2140, 90, -12), (2950, 100, -26), (3900, 120, -26)],
    "m": [(280, 60, 0), (1000, 200, -30), (2200, 200, -40), (3300, 200, -50)],
}


def formant_filter(src, vowel, shift=1.0):
    out = np.zeros_like(src)
    for f, bw, g in FORMANTS[vowel]:
        out += biquad(src, "bp", f * shift, f * shift / bw) * 10 ** (g / 20)
    return out


def choir(f0s, dur, vowel="a", voices=6, rng=rng_global, attack=1.5, release=2.0, breath=0.08):
    """formant choir; f0s list of pitches (one part each). stereo"""
    n = int(round((dur + release) * SR))
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for pi_, f0 in enumerate(f0s):
        shift = 1.0 if f0 > 200 else 0.88
        for v in range(voices):
            det = 2 ** (rng.normal(0, 7) / 1200)
            vib = 1 + 0.006 * np.sin(2 * np.pi * rng.uniform(4.8, 6.0) * t + rng.uniform(0, 6)) * np.minimum(1, t / 1.5)
            jit = 1 + 0.002 * np.cumsum(rng.standard_normal(n)) / np.sqrt(np.arange(1, n + 1))
            f = f0 * det * vib * jit
            src = saw_bl(f, n / SR, rng, max_h=60)
            src += rng.standard_normal(n) * breath
            y = formant_filter(src, vowel, shift * rng.uniform(0.97, 1.03))
            e = env_adsr(n, attack * rng.uniform(0.8, 1.2), 0.3, 0.9, release)
            out += stereo(y * e, rng.uniform(-0.7, 0.7))
    return out / (voices * len(f0s)) ** 0.5


def shepard(dur, rate_oct_per_s=0.12, base=55.0, n_oct=8, rng=rng_global, direction=1):
    """Endless rise. Gaussian spectral envelope over log-frequency."""
    t = t_axis(dur)
    out = np.zeros_like(t)
    center = np.log2(base) + n_oct / 2
    for k in range(n_oct):
        lf = np.log2(base) + ((k + direction * rate_oct_per_s * t) % n_oct)
        f = 2 ** lf
        amp = np.exp(-0.5 * ((lf - center) / (n_oct / 6)) ** 2)
        out += amp * np.sin(2 * np.pi * np.cumsum(f) / SR + rng.uniform(0, 6))
    return out / n_oct ** 0.5


def sub_drone(f, dur, rng=rng_global, trem=0.08):
    t = t_axis(dur)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t + 0.3) + 0.12 * np.sin(6 * np.pi * f * t)
    return x * (1 + trem * np.sin(2 * np.pi * 0.13 * t))


def keystroke(rng=rng_global, soft=1.0, bright=1.0):
    """mechanical key: click + thock + bottom-out"""
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    click = biquad(rng.standard_normal(n), "hp", 2500) * np.exp(-t / 0.0025) * 0.5 * bright
    ping = np.sin(2 * np.pi * rng.uniform(3200, 4200) * t) * np.exp(-t / 0.006) * 0.15 * bright
    thock = (np.sin(2 * np.pi * rng.uniform(150, 210) * t) * np.exp(-t / 0.018) * 0.7
             + biquad(rng.standard_normal(n), "lp", 900) * np.exp(-t / 0.012) * 0.35)
    d = int(rng.uniform(0.006, 0.012) * SR)
    bottom = np.zeros(n)
    bottom[d:] = (np.sin(2 * np.pi * rng.uniform(90, 120) * t[: n - d]) * np.exp(-t[: n - d] / 0.02) * 0.5
                  + biquad(rng.standard_normal(n - d), "bp", 1800, 1.5) * np.exp(-t[: n - d] / 0.006) * 0.2)
    return (click + ping + thock + bottom) * soft


def tick(rng=rng_global, f=2900):
    """the cursor's clock tick: a tiny, dry, high click"""
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.0035) * 0.6
    x += biquad(rng.standard_normal(n), "bp", 6000, 2) * np.exp(-t / 0.0015) * 0.4
    x += np.sin(2 * np.pi * 1200 * t) * np.exp(-t / 0.008) * 0.12
    return x


def blip(f, dur=0.035, rng=rng_global):
    t = t_axis(dur)
    return np.sin(2 * np.pi * f * t) * np.exp(-t / (dur * 0.3)) * np.minimum(1, t / 0.001)


def whoosh(dur, f0=150, f1=7000, q=1.6, rng=rng_global, shape=2.0):
    n = int(dur * SR)
    x = pink(n, rng)
    y = sweep_bp(x, f0, f1, q)
    e = np.linspace(0, 1, n) ** shape
    return y * e


def murmur(dur, density=40.0, rng=rng_global, pitch=(95, 260), bright=1.0):
    """A sea of human voices: thousands of formant syllables, unintelligible."""
    n = int(dur * SR)
    out = np.zeros((n, 2))
    count = int(density * dur)
    vowels = list("aoeiu")
    for _ in range(count):
        L = rng.uniform(0.08, 0.32)
        m = int(L * SR)
        start = rng.integers(0, max(1, n - m))
        f0 = rng.uniform(*pitch)
        tt = np.arange(m) / SR
        contour = f0 * (1 + rng.uniform(-0.15, 0.15) * tt / L)
        src = saw_bl(contour, L, rng, max_h=40) + rng.standard_normal(m) * 0.15
        y = formant_filter(src, rng.choice(vowels), rng.uniform(0.9, 1.15) * (1.15 if f0 > 170 else 1.0))
        e = np.sin(np.pi * np.linspace(0, 1, m)) ** 1.5
        # consonant noise at onset
        cn = int(0.02 * SR)
        y[:cn] += biquad(rng.standard_normal(cn), "bp", rng.uniform(2500, 6000), 2) * np.linspace(1, 0, cn) * 0.3
        out[start:start + m] += stereo(y * e * rng.uniform(0.3, 1.0), rng.uniform(-0.9, 0.9))
    out = biquad(out, "lp", 3500 * bright)
    return out / np.sqrt(max(1, density))


def granular(src, dur, density=60, grain=(0.02, 0.09), pitch=(0.5, 2.0), rng=rng_global):
    """scatter grains of src (mono) over dur, stereo"""
    n = int(dur * SR)
    out = np.zeros((n, 2))
    for _ in range(int(density * dur)):
        g = int(rng.uniform(*grain) * SR)
        p = rng.uniform(*pitch)
        pos = rng.integers(0, max(1, len(src) - int(g * p) - 1))
        idx = pos + np.arange(g) * p
        seg = np.interp(idx, np.arange(len(src)), src)
        seg *= np.hanning(g)
        st = rng.integers(0, max(1, n - g))
        out[st:st + g] += stereo(seg, rng.uniform(-1, 1))
    return out


def boom(dur=4.0, f0=55, f1=28, rng=rng_global):
    t = t_axis(dur)
    f = f1 + (f0 - f1) * np.exp(-t / 0.35)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 1.4)
    x = np.tanh(x * 1.6) / np.tanh(1.6)
    x += biquad(rng.standard_normal(len(t)), "lp", 180) * np.exp(-t / 0.25) * 0.4
    return x


def braam(freqs, dur, rng=rng_global, open_t=0.6):
    """brassy low swell: detuned saws through an opening low-pass, saturated"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for f in freqs:
        for d in (-6, 0, 7):
            x += saw_bl(f * 2 ** (d / 1200), dur, rng, max_h=80)
    fc = 120 + 2600 * (1 - np.exp(-t / open_t)) * np.exp(-np.maximum(0, t - 1.2) / 2.5)
    y = svf(x, fc, 0.9, "lp")
    y = np.tanh(y * 0.8)
    return y * env_adsr(n, 0.08, 0.4, 0.7, 1.8)
