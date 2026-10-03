"""The score and sound design, v2 — cue by cue, locked to the picture through engine/src/events.json.

Palette: piano, soft strings, humming choir, a little glass; the organ appears once (flute stops, at the title).
The motif A–F–E–G never resolves to D until the message is delivered.

usage: python score.py <start_s> <end_s> <out.wav>
"""
import sys, json
from pathlib import Path
import numpy as np
from scipy.io import wavfile
import synth as S
from synth import SR, note, stereo
import fx

rng = np.random.default_rng(11)
EV = json.loads((Path(__file__).resolve().parent.parent / "engine" / "src" / "events.json").read_text(encoding="utf-8"))


class Mix:
    def __init__(self, dur):
        self.n = int(dur * SR)
        self.bus = {k: np.zeros((self.n, 2)) for k in ("music", "sfx", "amb")}

    def add(self, bus, t, x, gain=1.0, pan=0.0):
        if x.ndim == 1: x = stereo(x, pan)
        i = int(round(t * SR))
        if i >= self.n: return
        if i < 0: x = x[-i:]; i = 0
        j = min(self.n, i + len(x))
        self.bus[bus][i:j] += x[: j - i] * gain

    def total(self):
        return sum(self.bus.values())


def at_db(db): return 10 ** (db / 20)


# ------------------------------------------------------------------ instruments built on synth.py

def heartbeat(strength=1.0):
    n = int(0.6 * SR); t = np.arange(n) / SR
    def thump(t0, f, a):
        x = np.zeros(n); i = int(t0 * SR); tt = t[: n - i]
        x[i:] = (np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.07) + S.biquad(rng.standard_normal(n - i), "lp", 120) * np.exp(-tt / 0.03) * 0.5) * a
        return x
    return (thump(0, 52, 1.0) + thump(0.27, 46, 0.7)) * strength


def gong(f0, dur):
    ratios, amps = [1, 2.32, 4.25, 6.63, 9.38, 12.6], [1, 0.6, 0.45, 0.3, 0.18, 0.1]
    x = S.additive([f0 * r for r in ratios], amps, dur, decays=[dur * k for k in (1, 0.7, 0.5, 0.35, 0.25, 0.18)], rng=rng)
    return x * np.minimum(1, np.arange(len(x)) / (0.004 * SR))


def strings(freqs, dur, attack=2.0, release=2.5, bright=1500, vib=0.003):
    """soft string section: detuned band-limited saws, dark low-pass, slow bow"""
    n = int((dur + release) * SR)
    out = np.zeros((n, 2))
    tt = np.arange(n) / SR
    for f in freqs:
        for d, pan in ((-8, -0.5), (0, 0.0), (7, 0.5)):
            fm = np.full(n, f * 2 ** (d / 1200)) * (1 + vib * np.sin(2 * np.pi * rng.uniform(4.6, 5.6) * tt + rng.uniform(0, 6)))
            x = S.saw_bl(fm, n / SR, rng, max_h=50)
            out += stereo(S.biquad(S.biquad(x, "lp", bright), "lp", bright * 1.6), pan)
    return out * S.env_adsr(n, attack, 0.5, 0.85, release)[:, None] / np.sqrt(3 * len(freqs))


def hum(freqs, dur, attack=2.5, release=3.0, vowel="m", voices=4):
    return S.choir(freqs, dur, vowel, voices, rng, attack=attack, release=release, breath=0.04)


def staccato(f, dur=0.22, bright=2400):
    n = int((dur + 0.15) * SR)
    x = sum(S.saw_bl(np.full(n, f * 2 ** (d / 1200)), n / SR, rng, max_h=40) for d in (-6, 0, 6)) / 3
    x = S.biquad(x, "lp", bright)
    return x * S.env_adsr(n, 0.01, 0.08, 0.5, 0.12, sustain_len=dur * 0.4)


def glass(f, dur=2.5):
    """FM bell — the little sound of a message arriving"""
    t = S.t_axis(dur)
    mod = np.sin(2 * np.pi * f * 3.5 * t) * 2.2 * np.exp(-t / 0.25)
    return np.sin(2 * np.pi * f * t + mod) * np.exp(-t / 0.9) * np.minimum(1, t / 0.002)


def gliss(f0, f1, dur, amp=1.0):
    n = int(dur * SR)
    f = np.exp(np.linspace(np.log(f0), np.log(f1), n))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * amp * S.env_adsr(n, 0.05, 0.1, 0.9, 0.3)


def tap(kind="key"):
    """a phone's soft key tap: a muted glassy click over a tiny felt thud"""
    n = int(0.07 * SR); t = np.arange(n) / SR
    f = {"key": 1500, "space": 1150, "del": 1000, "send": 1300}[kind] * rng.uniform(0.96, 1.04)
    x = S.biquad(S.biquad(rng.standard_normal(n), "hp", 1800), "lp", 6000) * np.exp(-t / 0.0009) * 0.35
    x += np.sin(2 * np.pi * f * t) * np.exp(-t / 0.005) * 0.25
    x += np.sin(2 * np.pi * 170 * t) * np.exp(-t / 0.014) * 0.35
    return S.biquad(x, "lp", 7000)


def type_whisper(dur):
    """the credits being written: a faint, granular rustle rather than key clicks"""
    n = int(dur * SR)
    out = np.zeros(n)
    for _ in range(int(dur * 22)):
        i = rng.integers(0, max(1, n - 400))
        m = int(rng.uniform(0.002, 0.006) * SR)
        out[i:i + m] += S.biquad(rng.standard_normal(m), "bp", rng.uniform(2500, 4500), 2.0) * np.hanning(m) * rng.uniform(0.2, 1.0)
    return out * np.hanning(n) ** 0.3


def softkey(level=0.4):
    return S.biquad(S.keystroke(rng, level, 0.7), "hp", 420)


def piano_note(name, dur=6, vel=0.4, bright=1.0):
    return S.piano(note(name), dur, vel, rng, bright=bright)


def verb(x, t60=3.6, mix=0.42, pre=0.025, bright=0.5):
    return fx.reverb(x, t60, mix, pre=pre, bright=bright)


MOTIF = ["A4", "F4", "E4", "G4"]


def motif(m, t0, octave=0, vel=0.38, gain=-14, beat=1.0, hold=2.6, pan=0.1):
    for i, nm in enumerate(MOTIF):
        f = note(nm) * 2 ** octave
        x = S.piano(f, (hold if i == 3 else 4.0) + 3, vel * (1.08 if i == 0 else 1.0), rng)
        m.add("music", t0 + i * beat, verb(x), at_db(gain), pan=pan)


# ------------------------------------------------------------------ COLD OPEN 0–50

def cue_cold(m):
    d = S.sub_drone(note("D1"), 22.5, rng) * S.env_adsr(int(22.5 * SR), 6.0, 0.1, 1.0, 4.0)
    m.add("music", 2.0, d, at_db(-26))
    d2 = (S.sub_drone(note("A1"), 14.0, rng, trem=0.12) + 0.5 * S.sub_drone(note("D2"), 14.0, rng)) * S.env_adsr(int(14 * SR), 3.0, 0.1, 1.0, 2.0)
    m.add("music", 21.5, d2, at_db(-30))
    air = S.biquad(S.pink(int(20 * SR), rng), "bp", 5000, 0.4) * S.env_adsr(int(20 * SR), 5, 0.1, 1, 2)
    m.add("amb", 2.0, np.stack([air, np.roll(air, 977)], 1), at_db(-52))
    for k in range(3, 22):
        m.add("sfx", k, fx.reverb(S.tick(rng), 0.9, 0.25, bright=0.7)[: int(0.8 * SR)], at_db(-27 if k < 8 else -31), pan=-0.25)
    TOK, lock_notes = [8.6, 11.9, 15.0], ["D2", "A2", "D3"]
    whisper_src = S.murmur(3.0, 30, rng, pitch=(160, 320))[:, 0]
    for i, t0 in enumerate(TOK):
        sh = S.granular(whisper_src, 2.3, density=90, grain=(0.015, 0.05), pitch=(1.4, 3.0), rng=rng)
        sh = S.biquad(sh, "hp", 1800) * np.linspace(0.2, 1.0, len(sh))[:, None]
        m.add("sfx", t0 + 0.05, fx.reverb(sh, 1.8, 0.4), at_db(-30))
        scale_ = [note(n) for n in ("D6", "F6", "G6", "A6", "C7", "D7")]
        for q in range(int(2.1 * 12)):
            tt = t0 + 0.45 + q / 12
            if tt > t0 + 2.2: break
            m.add("sfx", tt, S.blip(scale_[rng.integers(len(scale_))] * rng.choice([1, 1, 0.5]), 0.03, rng), at_db(-40), pan=rng.uniform(-0.5, 0.5))
        tl = t0 + 2.2
        m.add("sfx", tl, fx.reverb(S.keystroke(rng, 1.0), 1.2, 0.2), at_db(-14))
        m.add("music", tl + 0.01, verb(S.piano(note(lock_notes[i]), 9.0, 0.62, rng), 3.8), at_db(-9))
        m.add("music", tl, S.boom(1.5, 70, 40, rng), at_db(-26))
    for j in range(14):
        m.add("sfx", 18.5 + j * 0.1 + rng.uniform(-0.01, 0.01), S.keystroke(rng, 0.45, 0.8), at_db(-21), pan=rng.uniform(-0.15, 0.15))
    hi = S.additive([note("A5"), note("E6"), note("A6") * 1.002], [0.6, 0.35, 0.2], 6.0) * S.env_adsr(int(6 * SR), 3.5, 0.1, 1, 2.0)
    m.add("music", 19.0, fx.reverb(stereo(hi, 0.2), 5.0, 0.6), at_db(-34))
    # the dive
    w = S.whoosh(11.6, 90, 5200, 1.4, rng, shape=2.2)
    m.add("sfx", 22.4, fx.reverb(np.stack([w, np.roll(w, 501)], 1), 2.5, 0.35), at_db(-21))
    sh = S.biquad(S.shepard(11.8, 0.16, 55, 8, rng), "hp", 140) * np.linspace(0, 1, int(11.8 * SR)) ** 1.6
    m.add("music", 22.2, fx.reverb(stereo(sh), 3.0, 0.45), at_db(-31))
    mur = S.murmur(13.0, 70, rng) * (np.linspace(0, 1, int(13 * SR)) ** 1.5)[:, None]
    m.add("amb", 24.5, fx.reverb(mur, 2.2, 0.35), at_db(-20))
    bloom = S.granular(S.murmur(2.0, 40, rng, pitch=(200, 400))[:, 0], 3.0, density=160, grain=(0.01, 0.04), pitch=(2.0, 4.0), rng=rng)
    bloom = S.biquad(bloom, "hp", 2500) * S.env_adsr(int(3 * SR), 0.6, 0.6, 0.4, 1.6)[:, None]
    m.add("sfx", 23.3, fx.reverb(bloom, 3.0, 0.5), at_db(-24))
    m.add("music", 23.6, verb(piano_note("D6", 5, 0.3), 4.0, 0.6), at_db(-22))
    rain = ["D5", "F5", "A5", "C6", "E6", "F6", "A6", "D7"]
    tt = 23.6
    while tt < 33.6:
        u = (tt - 23.6) / 10
        m.add("music", tt, verb(piano_note(rain[rng.integers(len(rain))], 3.0, 0.18 + 0.15 * u, 0.7), 3.5, 0.55)[: int(4 * SR)], at_db(-27 + 4 * u), pan=rng.uniform(-0.8, 0.8))
        tt += max(0.07, 0.75 * (1 - u) ** 2.2)
    rush = S.biquad(S.pink(int(8 * SR), rng), "lp", 1800) * S.env_adsr(int(8 * SR), 1.6, 0.5, 0.7, 3.5)
    m.add("amb", 31.2, np.stack([rush, np.roll(rush, 2311)], 1), at_db(-27))
    # river -> galaxy: the reveal — strings and humming voices, the organ only as a soft flute colour
    m.add("amb", 34.0, fx.reverb(S.murmur(6.0, 60, rng) * np.linspace(1, 0, int(6 * SR))[:, None] ** 1.5, 2.0, 0.4), at_db(-19))
    wd = S.whoosh(5.0, 3000, 200, 1.0, rng, shape=0.6) * np.linspace(1, 0, int(5 * SR)) ** 0.5
    m.add("sfx", 35.0, fx.reverb(np.stack([wd, np.roll(wd, 733)], 1), 2.0, 0.35), at_db(-21))
    st = strings([note(n) for n in ("D2", "A2", "D3", "F3", "A3", "E4")], 10.0, attack=2.6, release=4.0, bright=1300)
    m.add("music", 36.6, verb(st, 5.5, 0.5), at_db(-15))
    org = S.organ_chord([note(n) for n in ("D3", "A3", "D4", "E4")], 9.5, stops=(("flute", 1, 1.0), ("flute", 0.5, 0.5), ("flute", 2, 0.2)), rng=rng, attack=2.5, release=3.5)
    m.add("music", 38.0, verb(org * S.env_adsr(len(org), 2.4, 0.1, 1.0, 4.5)[:, None], 7.0, 0.55, pre=0.04, bright=0.35), at_db(-22))
    m.add("music", 38.6, S.boom(5.0, 52, 27, rng), at_db(-13))
    ch = hum([note("D4"), note("F4"), note("A4"), note("D3")], 8.0, attack=2.2, release=3.0, vowel="u", voices=5)
    m.add("music", 40.2, verb(ch, 6.0, 0.55), at_db(-17))
    m.add("music", 40.5, verb(piano_note("A5", 6, 0.35), 5.0, 0.55), at_db(-20))


# ------------------------------------------------------------------ CHAPTER ONE · READ 50–98

def cue_read(m):
    mur = S.murmur(13.0, 50, rng, pitch=(110, 280)) * S.env_adsr(int(13 * SR), 1.5, 0.1, 1, 2.0)[:, None]
    m.add("amb", 49.8, fx.reverb(mur, 1.6, 0.3), at_db(-21))
    m.add("music", 49.5, verb(hum([note("D3"), note("A3")], 13.0, attack=3.0, release=3.0), 5.0, 0.55), at_db(-25))
    # each call and response *is* the motif: question sent, arrives; answer sent, arrives — A, F, E, G
    (q0, q1), (a0, a1) = EV["pair_q"], EV["pair_a"]
    for k, pr in enumerate(EV["pairs"]):
        t, octv = pr["t"], [0, 0, 1, 0, -1][k]
        for nm, dt, vel in zip(MOTIF, (q0, q1, a0, a1), (0.26, 0.22, 0.24, 0.22)):
            m.add("music", t + dt, verb(S.piano(note(nm) * 2 ** octv, 5.0, vel, rng, bright=0.55), 3.4, 0.45), at_db(-17))
    for tc in EV["credits"]:
        sh = S.granular(S.murmur(1.5, 40, rng, pitch=(250, 420))[:, 0], 2.0, 120, (0.01, 0.03), (2.5, 4.0), rng)
        m.add("sfx", tc - 1.4, fx.reverb(S.biquad(sh, "hp", 3000), 2.5, 0.5), at_db(-31))
    for td, dur, _ in EV["dashes"]:
        w = S.whoosh(dur + 0.4, 120, 6000, 1.0, rng, shape=1.4)
        n = len(w); w *= np.concatenate([np.ones(int(n * 0.7)), np.linspace(1, 0, n - int(n * 0.7))])
        m.add("sfx", td - 0.1, fx.reverb(np.stack([w, np.roll(w, 811)], 1), 2.0, 0.35), at_db(-18))
        m.add("music", td + dur * 0.55, S.boom(2.5, 60, 32, rng), at_db(-20))
    # what people always wrote to each other: soft strings, one low dyad per line
    prog = [("D3", "F3", "A3"), ("Bb2", "F3", "D4"), ("F2", "C3", "A3"), ("C3", "G3", "E4")]
    for i, ch in enumerate(prog):
        m.add("music", 64.8 + i * 2.6, verb(strings([note(n) for n in ch], 2.8, attack=1.0, release=1.6, bright=1200), 5.5, 0.5), at_db(-19))
    dy = [("D3", "A3"), ("Bb2", "F3"), ("F2", "C3"), ("C3", "G3")]
    for i, t in enumerate(EV["bonds"]):
        a, b = dy[i % 4]
        m.add("music", t - 0.3, verb(S.piano(note(a), 5, 0.3, rng) + S.piano(note(b), 5, 0.26, rng), 3.6, 0.45), at_db(-17))
    motif(m, 67.5, 1, 0.26, -19)
    m.add("music", 66.0, verb(hum([note("A3"), note("D4"), note("F4")], 8.0, attack=3.0, release=2.5, vowel="u"), 6.0, 0.55), at_db(-23))
    # the first marks: an open fifth, low voices, stone
    dr = (S.sub_drone(note("D1"), 11, rng) + 0.7 * S.sub_drone(note("A1"), 11, rng)) * S.env_adsr(int(11 * SR), 2.0, 0.1, 1, 3.0)
    m.add("music", 75.6, dr, at_db(-25))
    m.add("music", 76.4, verb(hum([note("D2"), note("A2")], 9.0, attack=3.0, release=3.0, vowel="o", voices=5), 7.0, 0.6), at_db(-20))
    for i, t in enumerate(EV["ancient"]):
        m.add("sfx", t - 0.5, verb(gong(note("D2") * [1, 1.5, 1.335, 1.189, 1.122][i], 5.0), 6.0, 0.6), at_db(-28), pan=(-0.4 if i % 2 == 0 else 0.4))
    # the rise: strings and voices open out; the motif, high, as the cards speak
    st = strings([note(n) for n in ("Bb1", "F2", "Bb2", "D3", "F3", "C4")], 6.0, attack=2.2, release=3.0, bright=1500)
    m.add("music", 84.2, verb(st, 6.5, 0.5), at_db(-15))
    st2 = strings([note(n) for n in ("A1", "E2", "A2", "D3", "E3", "G3")], 8.0, attack=1.6, release=4.0, bright=1400)
    m.add("music", 89.5, verb(st2, 6.5, 0.5), at_db(-16))
    m.add("music", 85.0, verb(hum([note("D4"), note("F4"), note("A4"), note("D3")], 11.0, attack=2.5, release=3.5, vowel="u", voices=5), 6.5, 0.55), at_db(-18))
    m.add("music", 87.0, verb(piano_note("A5", 6, 0.3, 0.7), 5.0, 0.6), at_db(-21))
    motif(m, 92.6, 1, 0.24, -19, hold=4.0)


# ------------------------------------------------------------------ CHAPTER TWO · MEASURE 98–152

def cue_measure(m):
    M = EV["measure"]
    C = {c[0]: c for c in EV["cards"]}
    for k in range(int(M["start"]) + 1, int(M["hud_out"][1])):
        m.add("sfx", k, fx.reverb(S.tick(rng, 1800), 1.2, 0.3)[: int(SR)], at_db(-31), pan=0.2)
        m.add("music", k, S.boom(0.6, 48, 40, rng) * 0.5, at_db(-29))
    m.add("music", M["start"] + 0.2, S.sub_drone(note("D1"), 21, rng, trem=0.05) * S.env_adsr(int(21 * SR), 2.5, 0.1, 1, 3), at_db(-27))
    hi = S.additive([note("E6"), note("F6") * 1.001], [0.5, 0.4], 10.0) * S.env_adsr(int(10 * SR), 4, 0.1, 1, 3)
    m.add("music", M["start"] + 1, fx.reverb(stereo(hi, -0.3), 5, 0.6), at_db(-38))
    # the scale appears; the words pour into their pan — each landing almost weightless
    m.add("music", M["scale_in"], verb(stereo(S.additive([note("D3"), note("A3")], [0.5, 0.35], 4.0) * S.env_adsr(int(4 * SR), 1.0, 0.2, 0.8, 2.0)), 4.0, 0.5), at_db(-27))
    n = 12
    for i in range(n):
        t0 = M["pour"][0] + i * ((M["pour"][1] - M["pour"][0]) / n) + 0.5
        m.add("sfx", t0, verb(stereo(S.piano(note(["A6", "F6", "E6", "G6"][i % 4]), 1.5, 0.12, rng, bright=0.5), -0.35), 2.0, 0.4)[: int(2 * SR)], at_db(-31))
    # the beam tips: a deep, slow thud of something heavy that isn't there
    th = S.boom(3.0, 58, 34, rng) + 0.4 * gong(note("D2") * 0.5, 3.0)
    m.add("music", M["tip"][0] + 0.1, verb(stereo(th), 4.0, 0.45), at_db(-15))
    cr = S.sweep_bp(S.pink(int(1.4 * SR), rng), 180, 420, 6.0) * np.hanning(int(1.4 * SR))
    m.add("sfx", M["tip"][0], verb(stereo(cr, 0.1), 2.0, 0.4), at_db(-28))
    for i in range(10):
        m.add("sfx", M["numbers"][0] + i * 0.13, S.blip(note("D7") * (1 + 0.01 * i), 0.03, rng), at_db(-34), pan=-0.4)
    m.add("music", M["deficit"] - 0.2, verb(strings([note("D2"), note("Eb3"), note("A3")], 6.0, attack=1.5, release=3.0, bright=900), 5.0, 0.5), at_db(-20))
    # the trajectories: each predicted escape a thin tone sliding away
    for i in range(7):
        m.add("sfx", M["ghosts"][0] + i * 0.3, fx.reverb(stereo(gliss(note("E5"), note("E4"), 3.2, 0.3), -0.6 + 0.2 * i), 3.0, 0.55), at_db(-33))
    for i in range(7):
        m.add("sfx", M["reticles"] + i * 0.35, S.blip(note("A6") * (1.5 if i % 2 else 1), 0.05, rng), at_db(-33), pan=rng.uniform(-0.7, 0.7))
    # "too light": a tense open fifth. "yet you didn't": the harmony turns warm. "something I cannot see": a question
    m.add("music", C["light"][3] - 0.2, verb(strings([note("D2"), note("A2"), note("E3")], 7.5, attack=2.2, release=2.5, bright=900), 5.0, 0.5), at_db(-19))
    m.add("music", C["didnt"][3] - 0.2, verb(strings([note("F2"), note("C3"), note("A3"), note("G4")], 4.0, attack=1.0, release=3.5, bright=1300), 6.0, 0.55), at_db(-18))
    m.add("music", C["didnt"][3], verb(piano_note("A4", 6, 0.28, 0.7), 4.5, 0.55), at_db(-20))
    m.add("music", C["unseen"][3] + 0.2, verb(piano_note("E5", 5, 0.22, 0.6) + piano_note("B5", 5, 0.18, 0.6), 5.0, 0.6), at_db(-21))
    m.add("music", C["unseen"][3], verb(hum([note("D3"), note("A3")], 5.0, attack=2.0, release=3.0, vowel="u"), 6.0, 0.6), at_db(-26))
    # lensing view
    sw = S.whoosh(M["scan"][1] - M["scan"][0] + 0.3, 300, 2400, 2.5, rng, shape=0.5)
    pan = np.linspace(-1, 1, len(sw))
    m.add("sfx", M["scan"][0], fx.reverb(np.stack([sw * np.cos((pan + 1) * np.pi / 4), sw * np.sin((pan + 1) * np.pi / 4)], 1), 2.5, 0.4), at_db(-24))
    tt = np.arange(int(26 * SR)) / SR
    bend = np.sin(2 * np.pi * np.cumsum(note("D2") * (1 + 0.03 * np.sin(2 * np.pi * 0.11 * tt) + 0.015 * np.sin(2 * np.pi * 0.37 * tt))) / SR)
    bend = (bend + 0.4 * np.sin(2 * np.pi * np.cumsum(note("A2") * (1 + 0.025 * np.sin(2 * np.pi * 0.09 * tt + 1))) / SR)) * S.env_adsr(len(tt), 3, 0.1, 1, 4)
    m.add("music", M["lens_on"], fx.reverb(stereo(bend), 6.0, 0.55), at_db(-24))
    for i in range(14):
        m.add("sfx", M["lens_on"] + 0.5 + i * 0.4 + rng.uniform(0, 0.2), fx.reverb(stereo(gliss(rng.uniform(300, 600), rng.uniform(150, 250), 0.6, 0.4), rng.uniform(-0.8, 0.8)), 2.0, 0.5)[: int(2 * SR)], at_db(-33))
    m.add("music", M["lens_on"] + 1.5, verb(hum([note("D3"), note("G3"), note("C4")], 12.0, attack=4, release=3, vowel="o"), 7.0, 0.6), at_db(-25))
    # into the void; the found cards
    rum = S.biquad(S.pink(int(15 * SR), rng), "lp", 90) * np.linspace(0.2, 1, int(15 * SR)) ** 2
    m.add("music", M["push"][0], np.stack([rum, np.roll(rum, 300)], 1), at_db(-20))
    for i in range(12):
        wsp = S.murmur(1.6, 14, rng, pitch=(140, 260))[::-1] * np.hanning(int(1.6 * SR))[:, None]
        m.add("amb", M["push"][0] + 2 + i * 1.2 + rng.uniform(0, 0.5), fx.reverb(S.biquad(wsp, "bp", 1800, 0.7), 3.5, 0.6), at_db(-26))
    m.add("music", M["push"][0] + 5, verb(strings([note("D3"), note("G3"), note("A3")], 12.0, attack=4.0, release=4.0, bright=700), 6.0, 0.6), at_db(-22))
    m.add("music", C["found"][3] + 0.1, verb(piano_note("D4", 6, 0.26, 0.6), 5.0, 0.6), at_db(-20))
    m.add("music", C["drafts"][3] + 0.1, verb(piano_note("F4", 6, 0.22, 0.6), 5.0, 0.6), at_db(-21))


# ------------------------------------------------------------------ CHAPTER THREE · COMPLETE 152–208

def cue_complete(m):
    R = EV["req"]
    k0 = int(R["t"])
    for k in range(k0, int(EV["burst"])):
        m.add("sfx", k, fx.reverb(S.tick(rng), 0.8, 0.2)[: int(0.8 * SR)], at_db(-27), pan=0.1)
        m.add("music", k + 0.02, heartbeat(1.0 + (k - k0) * 0.03), at_db(-22 + (k - k0) * 0.3))
    for tt in R["prefix"]:
        m.add("sfx", tt, softkey(0.4), at_db(-26))
    for tt in R["line"]:
        m.add("sfx", tt, fx.reverb(softkey(0.5), 1.0, 0.2), at_db(-23))
    # everyone else's request: a chorus of distant typing, each void blooming open
    pans = [-0.7, -0.3, 0.3, 0.8, -0.9, 0.9, -0.5, -0.1, 0.5, 0.1]
    for j, t0 in enumerate(EV["voids_on"]):
        bl = S.biquad(S.pink(int(1.5 * SR), rng), "bp", 600, 1.0) * S.env_adsr(int(1.5 * SR), 0.5, 0.3, 0.3, 0.7)
        m.add("amb", t0, fx.reverb(stereo(bl, pans[j]), 3.0, 0.6), at_db(-30))
        for c in range(21):
            tk = t0 + 0.35 + (c * 0.04 if c < 9 else 9 * 0.04 + 0.2 + (c - 9) * 0.05)
            m.add("sfx", tk, fx.reverb(stereo(S.keystroke(rng, 0.25, 0.7), pans[j]), 2.5, 0.55)[: int(0.6 * SR)], at_db(-30))
    # the flare: every cursor at once
    rev = S.whoosh(1.0, 400, 9000, 1.5, rng, shape=3.0)
    m.add("sfx", EV["burst"] - 1.0, np.stack([rev, rev], 1), at_db(-19))
    m.add("music", EV["burst"], S.boom(6.0, 60, 25, rng), at_db(-8))
    roar = S.granular(S.murmur(4.0, 80, rng, pitch=(120, 360))[:, 0], 18.0, 700, (0.02, 0.08), (0.8, 2.2), rng)
    roar *= (np.linspace(0, 1, len(roar)) ** 1.2)[:, None]
    m.add("amb", EV["flood"] - 0.1, fx.reverb(roar, 3.0, 0.45), at_db(-21))
    # the build: string ostinato climbing a step every four seconds, doubling its pace; voices; a filtered ascent
    sh = S.biquad(S.shepard(30.0, 0.2, 110, 7, rng), "hp", 200) * np.linspace(0.3, 1, int(30 * SR)) ** 1.5
    m.add("music", EV["burst"], fx.reverb(stereo(sh), 3.5, 0.45), at_db(-26))
    steps = [("D3", "A3"), ("E3", "B3"), ("F3", "C4"), ("G3", "D4"), ("A3", "E4")]
    tt, i = EV["flood"], 0
    while tt < EV["cut"] - 0.05:
        k = min(4, int((tt - EV["flood"]) / 4))
        lo, hi_ = steps[k]
        dt = 0.25 if tt < EV["flood"] + 11.6 else 0.125
        m.add("music", tt, stereo(staccato(note(lo if i % 2 == 0 else hi_), 0.18 if dt > 0.2 else 0.1, 1800 + 300 * k), (-0.3 if i % 2 else 0.3)), at_db(-21 + k))
        tt += dt; i += 1
    for k, (lo, hi_) in enumerate(steps):
        m.add("music", EV["flood"] + 4 * k, verb(strings([note(lo) / 2, note(lo), note(hi_)], 4.2, attack=0.8, release=0.3, bright=1500 + 400 * k), 4.0, 0.4), at_db(-18 + k))
    ch = hum([note(n) for n in ("D4", "F4", "A4", "D5")], 28.0, attack=6.0, release=0.05, vowel="a", voices=6)
    m.add("music", EV["flood"] + 0.1, verb(ch * np.linspace(0.2, 1.0, len(ch))[:, None], 6.0, 0.5), at_db(-17))
    tb = EV["flood"] + 0.6
    while tb < EV["cut"] - 0.2:
        u = (tb - EV["flood"]) / (EV["cut"] - EV["flood"])
        m.add("music", tb, S.boom(1.2, 66, 40, rng), at_db(-20 + 6 * u))
        tb += 1.0 if tb < EV["flood"] + 11.6 else 0.5
    dr = S.sweep_bp(S.pink(int(10 * SR), rng), 4000, 200, 3.0) * np.hanning(int(10 * SR))
    lfo = np.sin(2 * np.pi * 0.5 * np.arange(len(dr)) / SR)
    m.add("sfx", EV["absorb"], fx.reverb(np.stack([dr * (1 + lfo) / 2, dr * (1 - lfo) / 2], 1), 3.0, 0.4), at_db(-19))
    # collapse: a cluster creeps in over the pedal; glitches
    cl = strings([note(n) for n in ("D2", "Eb3", "Ab3", "Db4")], 12.0, attack=4.0, release=0.05, bright=2400)
    m.add("music", EV["collapse"], verb(cl * np.linspace(0, 1, len(cl))[:, None] ** 2, 4.0, 0.4), at_db(-16))
    for i in range(60):
        m.add("sfx", EV["collapse"] + 3 + rng.uniform(0, 8.9), S.blip(rng.uniform(200, 4000), rng.uniform(0.01, 0.05), rng) * rng.uniform(0.3, 1), at_db(-25), pan=rng.uniform(-1, 1))


def cue_cut(m):
    """saturate the music bus through the collapse; at the cut the world goes deaf, not dead:
    the last half-second continues as a muffled, underwater tail, a ring in the ears, then near-silence."""
    i0, i1 = int(EV["collapse"] * SR), int(EV["cut"] * SR)
    seg = m.bus["music"][i0:i1]
    drive = np.linspace(1.0, 3.0, len(seg))[:, None] ** 1.2
    m.bus["music"][i0:i1] = np.tanh(seg * drive) / np.tanh(drive) * np.linspace(1, 1.25, len(seg))[:, None]
    last = sum(b[i1 - int(0.6 * SR):i1] for b in m.bus.values()).copy()
    for b in m.bus.values():
        b[i1:int(EV["rewind"] * SR)] = 0.0
    # underwater tail: the final instant, low-passed and smeared into a long dark reverb
    muff = S.biquad(S.biquad(last, "lp", 320), "lp", 320)
    tail = fx.reverb(muff, 3.2, 1.0, pre=0.0, bright=0.1, hp=0)[int(0.6 * SR):]
    n = min(len(tail), int(3.0 * SR))
    tail = tail[:n] * (np.exp(-np.arange(n) / SR / 0.7))[:, None]
    m.add("music", EV["cut"], tail / (np.abs(tail).max() + 1e-9), at_db(-14))
    m.add("music", EV["cut"], S.biquad(S.boom(3.5, 46, 26, rng), "lp", 160), at_db(-12))
    # the ring in the ears after an overload
    t = S.t_axis(3.6)
    ring = (np.sin(2 * np.pi * 3150 * t) + 0.7 * np.sin(2 * np.pi * 3157 * t)) * np.exp(-t / 1.1) * np.minimum(1, t / 0.05)
    m.add("sfx", EV["cut"] + 0.05, stereo(ring, 0.0), at_db(-36))
    # never digital zero: the faintest room
    n2 = int((EV["rewind"] - EV["cut"]) * SR)
    room = S.biquad(S.pink(n2, rng), "lp", 900) * np.minimum(1, np.arange(n2) / (0.8 * SR))
    m.add("amb", EV["cut"], np.stack([room, np.roll(room, 1031)], 1), at_db(-62))


def cue_s17(m):
    x = verb(piano_note("D1", 12, 0.45), 6.0, 0.5)
    t0 = EV["cut"] + 3.2
    n = int((EV["rewind"] - t0 - 0.1) * SR)
    m.add("music", t0, x[:n] * np.linspace(1, 0, n)[:, None] ** 0.5, at_db(-11))


# ------------------------------------------------------------------ CHAPTER FOUR · THE BLANK 208–246

def cue_blank(m):
    st = strings([note(n) for n in ("D2", "A2", "D3", "F3", "A3", "E4")], 12.0, attack=0.4, release=3.0, bright=1500)
    ch = hum([note("D4"), note("A4")], 12.0, attack=0.5, release=3.0, vowel="a")
    n17 = int(17 * SR)
    wet = (verb(st, 7.0, 0.7)[:n17] + 0.7 * verb(ch, 7.0, 0.7)[:n17])[::-1]
    wet *= np.linspace(0.2, 1, len(wet))[:, None] ** 2 * np.concatenate([np.ones(len(wet) - int(1.5 * SR)), np.linspace(1, 0, int(1.5 * SR))])[:, None]
    m.add("music", EV["rewind"] + 0.2, wet, at_db(-16))
    tape = S.whoosh(17.0, 6000, 150, 0.8, rng, shape=0.3)[::-1] * 0.6
    m.add("sfx", EV["rewind"], np.stack([tape, np.roll(tape, 400)], 1), at_db(-27))
    rm = S.murmur(10.0, 60, rng)[::-1] * np.linspace(1, 0, int(10 * SR))[:, None]
    m.add("amb", EV["rewind"] + 0.5, fx.reverb(rm, 2.5, 0.5), at_db(-23))
    motif(m, EV["rewind"] + 13.0, 0, 0.3, -16, hold=4.0)
    # every request taken back — theirs, then ours
    pans = [-0.7, -0.3, 0.3, 0.8, -0.9, 0.9, -0.5, -0.1, 0.5, 0.1]
    for j, t in enumerate(EV["void_unprefix"]):
        for c in range(9):
            m.add("sfx", t + c * 0.03, stereo(softkey(0.2), pans[j]), at_db(-34))
    for t in EV["hero_unprefix"]:
        m.add("sfx", t, verb(softkey(0.45), 1.0, 0.2), at_db(-26))
    for k in range(int(EV["blank"]) + 2, int(EV["blank_end"])):
        m.add("sfx", k, fx.reverb(S.tick(rng), 0.9, 0.25)[: int(0.8 * SR)], at_db(-30), pan=0.1)
    motif(m, EV["blank"] + 4.5, 1, 0.22, -20, hold=3.0)
    warm = strings([note(n) for n in ("Bb2", "F3", "Bb3", "C4", "F4")], 8.0, attack=2.5, release=4.0, bright=1100)
    yours = [c for c in EV["cards"] if c[0] == "yours"][0][3]
    m.add("music", yours - 0.4, verb(warm, 7.0, 0.6, bright=0.35), at_db(-18))
    m.add("music", yours + 0.1, verb(hum([note("F4"), note("A4"), note("C5")], 7.0, attack=3.0, release=4.0, vowel="u"), 6.0, 0.6), at_db(-23))


# ------------------------------------------------------------------ CODA 246–284

def cue_coda(m):
    T20 = EV["field"]["start"]; T21 = EV["credits_roll"]["start"]; P = EV["phone"]
    writer = [c for c in EV["cards"] if c[0] == "writer"][0][3]
    prog = [(("Bb1", "F2", "Bb2", "D3", "F3", "C4"), T20 + 0.2, 4.0), (("F1", "C2", "F2", "A2", "C3", "F3"), T20 + 4.0, 3.5),
            (("G1", "D2", "G2", "Bb2", "D3", "F3"), T20 + 7.3, 2.5), (("A1", "E2", "A2", "D3", "E3", "G3"), T20 + 9.6, 2.6)]
    for ch, tt, dur in prog:
        m.add("music", tt, verb(strings([note(n) for n in ch], dur, attack=1.2, release=2.4, bright=1400), 7.0, 0.55), at_db(-15))
    m.add("music", T20 + 0.5, verb(hum([note("D4"), note("F4"), note("A4"), note("D3")], 10.5, attack=3.0, release=3.5, vowel="u", voices=5), 7.0, 0.6), at_db(-18))
    # under the last card the motif rises once more — and still stops on G
    m.add("music", writer - 0.6, verb(strings([note(n) for n in ("A1", "E2", "A2", "D3", "E3", "G3")], 5.0, attack=2.0, release=3.0, bright=1200), 7.0, 0.6), at_db(-17))
    motif(m, writer + 0.2, 1, 0.26, -17, hold=4.0)
    for k in range(int(T21 - 1), int(P["start"])):
        m.add("sfx", k, fx.reverb(S.tick(rng), 0.9, 0.25)[: int(0.8 * SR)], at_db(-31), pan=0.1)
    # one soft rustle per credit line, a quiet "tock" as each line completes
    clock = T21 + 0.6
    for row in range(7):
        if row == 5: clock += 0.5; continue
        dur = 60 / 70
        m.add("sfx", clock, verb(stereo(type_whisper(dur), -0.1), 1.2, 0.3), at_db(-36))
        m.add("sfx", clock + dur, verb(tap("space") * 0.6, 1.0, 0.3), at_db(-30))
        clock += dur + 0.35
    m.add("music", T21, verb(hum([note("D3"), note("A3")], 11.0, attack=4, release=3, vowel="u", voices=3), 6.0, 0.6), at_db(-29))
    # the phone
    for e in P["keys"]:
        kind = "space" if e["k"] == "space" else "del" if e["k"] == "del" else "key"
        m.add("sfx", e["t"], verb(tap(kind), 0.5, 0.12), at_db(-20 if kind == "key" else -19), pan=rng.uniform(-0.12, 0.12))
    m.add("sfx", P["send"], verb(tap("send"), 0.7, 0.18), at_db(-17))
    sw = S.whoosh(0.45, 300, 3200, 1.2, rng, shape=1.2)
    m.add("sfx", P["send"] + 0.02, verb(np.stack([sw, sw], 1), 1.2, 0.3), at_db(-22))
    m.add("sfx", P["send"] + 0.62, verb(stereo(gliss(880, 1320, 0.12, 0.5)), 1.0, 0.3), at_db(-26))
    hz = int(0.09 * SR); t = np.arange(hz) / SR
    haptic = np.sin(2 * np.pi * 165 * t) * np.sin(np.pi * t / 0.09) ** 2 * 0.8 + S.biquad(rng.standard_normal(hz), "bp", 220, 2) * 0.2
    m.add("sfx", P["haptic"], haptic, at_db(-14))
    # and the D — for the first time
    d = S.piano(note("D4"), 9, 0.4, rng) + 0.7 * S.piano(note("D3"), 9, 0.36, rng)
    m.add("music", P["dnote"], verb(d, 6.0, 0.55, pre=0.03), at_db(-11))


def cue_fadeout(m):
    a, b = EV["phone"]["fade"]
    i = int(a * SR)
    for bb in m.bus.values():
        n = min(len(bb), int(b * SR)) - i
        if n > 0: bb[i:i + n] *= np.linspace(1, 0, n)[:, None] ** 2
        bb[i + max(n, 0):] = 0


CUES = [cue_cold, cue_read, cue_measure, cue_complete, cue_cut, cue_s17, cue_blank, cue_coda, cue_fadeout]


def render(t0, t1, path, master=True):
    m = Mix(t1)
    for c in CUES:
        c(m)
    x = m.total()[int(t0 * SR):]
    if master: x = fx.master(x, -16.0, -1.0)
    wavfile.write(path, SR, x.astype(np.float32))
    print("wrote", path, f"{len(x) / SR:.1f}s", f"LUFS {fx.loudness(x):.1f}", f"peak {20 * np.log10(np.abs(x).max()):.1f} dB")


if __name__ == "__main__":
    render(float(sys.argv[1]), float(sys.argv[2]), sys.argv[3])
