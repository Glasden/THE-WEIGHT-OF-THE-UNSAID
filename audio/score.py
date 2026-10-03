"""The score and sound design, v4 — cue by cue, locked to the picture through engine/src/events.json.

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


# ------------------------------------------------------------------ v4: one chat between a child and a father
# The motif A–F–E–G is a question nobody has answered: it plays under dad's message, under ours, and only the
# reply lands on D. The AI's notes wander in D minor and never touch D.
O, Hh, Pp, Ss, CR = EV["open"], EV["history"], EV["paste"], EV["send"], EV["credits_roll"]
CARD = {c[0]: c for c in EV["cards"]}
AI_NOTES = ["F4", "G4", "A4", "C5", "E5", "F5", "G5", "A5", "C6", "E6"]


def room(m, t0, t1, db=-58):
    n = int((t1 - t0) * SR)
    x = S.biquad(S.pink(n, rng), "lp", 700) * S.env_adsr(n, 0.8, 0.1, 1, 0.8)
    m.add("amb", t0, np.stack([x, np.roll(x, 1031)], 1), at_db(db))


def phone_keys(m, keys, db=-20):
    for e in keys:
        kind = "space" if e["k"] == "space" else "del" if e["k"] == "del" else "key"
        m.add("sfx", e["t"], verb(tap(kind), 0.5, 0.12), at_db(db if kind == "key" else db + 1), pan=rng.uniform(-0.12, 0.12))


def ticks(m, t0, t1, db=-30, f=2900):
    for k in range(int(np.ceil(t0)), int(t1)):
        m.add("sfx", k, fx.reverb(S.tick(rng, f), 0.9, 0.25)[: int(0.8 * SR)], at_db(db), pan=0.1)


def ai_note(m, t, i, db=-24, vel=0.2, oct_up=0):
    nm = AI_NOTES[(i * 7 + 3) % len(AI_NOTES)]
    m.add("music", t, verb(S.piano(note(nm) * 2 ** oct_up, 3.0, vel, rng, bright=0.8), 3.0, 0.5)[: int(3.5 * SR)], at_db(db), pan=rng.uniform(-0.5, 0.5))


# ------------------------------------------------------------------ OPEN · THE REPLY
def cue_open(m):
    room(m, 0.8, O["phone_out"][1] + 1.0, -56)
    # dad's message: the question, left on G
    for i, (nm, tt) in enumerate(zip(MOTIF, O["motif"])):
        x = S.piano(note(nm), (6.0 if i == 3 else 4.0) + 2, 0.24 * (1.08 if i == 0 else 1.0), rng, bright=0.7)
        m.add("music", tt, verb(x, 4.2, 0.5), at_db(-17), pan=0.05)
    phone_keys(m, O["fine_keys"], -21)
    # the AI: a sub drone under everything, the cursor's clock
    T0 = O["tick0"]
    dur = O["burst"] - T0 + 1.0
    d = S.sub_drone(note("D1"), dur, rng) * S.env_adsr(int(dur * SR), 4.0, 0.1, 1.0, 1.0)
    m.add("music", T0 - 1.0, d, at_db(-27))
    ticks(m, T0, O["think"][0], -30)
    # its name, predicted
    whisper_src = S.murmur(3.0, 30, rng, pitch=(160, 320))[:, 0]
    for i, t0 in enumerate(O["name"]):
        lock = t0 + O["name_lock"]
        sh = S.granular(whisper_src, O["name_lock"] + 0.1, density=70, grain=(0.015, 0.05), pitch=(1.4, 3.0), rng=rng)
        m.add("sfx", t0 + 0.05, fx.reverb(S.biquad(sh, "hp", 1800) * np.linspace(0.2, 1.0, len(sh))[:, None], 1.8, 0.4), at_db(-36))
        m.add("sfx", lock, fx.reverb(S.keystroke(rng, 0.7), 1.2, 0.2), at_db(-22))
        m.add("music", lock + 0.01, verb(S.piano(note(["D2", "A2", "D3"][i]), 7.0, 0.5, rng), 3.8), at_db(-16))
    for j in range(len("出品 · PRESENTS")):
        m.add("sfx", O["sub"][0] + j * O["sub"][1], S.keystroke(rng, 0.3, 0.8), at_db(-30), pan=rng.uniform(-0.15, 0.15))
    # the ask, typed on a keyboard; sent
    for tt in O["ask_keys"]:
        m.add("sfx", tt, S.keystroke(rng, 0.42, 0.8), at_db(-24), pan=rng.uniform(-0.2, 0.2))
    m.add("sfx", O["ask_send"], verb(tap("send"), 0.8, 0.2), at_db(-22))
    # thinking: only a heart
    for k in range(2):
        m.add("music", O["think"][0] + 0.15 + k, heartbeat(0.9), at_db(-21))
    # the first reply: one quiet note per word, never D
    for i, ev in enumerate(O["a1"]):
        ai_note(m, ev["lock"], i, -23, 0.18 + 0.04 * (i == 2))
        if i == 2:
            for q in range(18):
                m.add("sfx", ev["t"] + 0.1 + q * 0.08, S.blip(note(["D6", "F6", "A6", "C7"][q % 4]), 0.03, rng), at_db(-40), pan=rng.uniform(-0.5, 0.5))
    for i, tt in enumerate(O["a2"] + O["a3"]):
        ai_note(m, tt + 0.07, i + 30, -26, 0.15, 1 if i % 3 == 0 else 0)
    # more replies, all over the screen: one quiet note as each begins — twice as many every half second
    T0b = O["tree"][0] + 0.3
    for k in range(171):
        tt = T0b + 0.5 * np.log2(k + 1)
        if tt > O["burst"] - 0.25: break
        u = (tt - T0b) / (O["burst"] - T0b)
        ai_note(m, tt, k + 60, -27 + 5 * u - 3 * (k > 40), 0.12 + 0.1 * u, int(k % 3 == 0))
    n = O["burst"] - O["tree"][0] + 0.3
    sh = S.biquad(S.shepard(n, 0.25, 55, 8, rng), "hp", 140) * np.linspace(0, 1, int(n * SR)) ** 1.8
    m.add("music", O["tree"][0], fx.reverb(stereo(sh), 3.0, 0.45), at_db(-27))
    g = S.granular(S.murmur(3.0, 60, rng, pitch=(200, 400))[:, 0], n, density=260, grain=(0.01, 0.04), pitch=(1.6, 3.6), rng=rng)
    m.add("sfx", O["tree"][0], fx.reverb(S.biquad(g, "hp", 2200) * (np.linspace(0, 1, len(g)) ** 2)[:, None], 2.0, 0.4), at_db(-24))
    rev = S.whoosh(1.2, 400, 9000, 1.5, rng, shape=3.0)
    m.add("sfx", O["burst"] - 1.2, np.stack([rev, rev], 1), at_db(-22))
    # the burst: the AI's words break open — inside them, people's
    m.add("music", O["burst"], S.boom(5.0, 58, 26, rng), at_db(-9))
    m.add("sfx", O["burst"], fx.reverb(np.stack([S.whoosh(3.0, 3000, 200, 1.0, rng, shape=0.6)] * 2, 1), 2.0, 0.35), at_db(-19))
    mur = S.murmur(7.0, 80, rng) * (np.linspace(1, 0, int(7 * SR)) ** 1.3)[:, None]
    m.add("amb", O["burst"] + 0.05, fx.reverb(mur, 2.2, 0.4), at_db(-16))
    rush = S.biquad(S.pink(int(5 * SR), rng), "lp", 1800) * S.env_adsr(int(5 * SR), 0.05, 0.5, 0.6, 3.5)
    m.add("amb", O["burst"], np.stack([rush, np.roll(rush, 2311)], 1), at_db(-25))
    # the river becomes the galaxy: strings, voices, the organ's one soft breath; the title
    G, Tt = O["galaxy"], O["title"][0]
    st = strings([note(n_) for n_ in ("D2", "A2", "D3", "F3", "A3", "E4")], 10.0, attack=2.6, release=4.0, bright=1300)
    m.add("music", G + 0.4, verb(st, 5.5, 0.5), at_db(-15))
    org = S.organ_chord([note(n_) for n_ in ("D3", "A3", "D4", "E4")], 9.5, stops=(("flute", 1, 1.0), ("flute", 0.5, 0.5), ("flute", 2, 0.2)), rng=rng, attack=2.5, release=3.5)
    m.add("music", Tt - 2.4, verb(org * S.env_adsr(len(org), 2.4, 0.1, 1.0, 4.5)[:, None], 7.0, 0.55, pre=0.04, bright=0.35), at_db(-22))
    m.add("music", Tt - 1.8, S.boom(5.0, 52, 27, rng), at_db(-14))
    ch = hum([note("D4"), note("F4"), note("A4"), note("D3")], 8.0, attack=2.2, release=3.0, vowel="u", voices=5)
    m.add("music", Tt - 0.3, verb(ch, 6.0, 0.55), at_db(-17))
    m.add("music", Tt, verb(piano_note("A5", 6, 0.35), 5.0, 0.55), at_db(-20))


# ------------------------------------------------------------------ CHAPTER ONE · BACK AND FORTH
def bridge_in(m, t0, t1, nm):
    """a line of words slows us: voices breathe in, and one note as the phone forms around it"""
    m.add("music", t0, verb(hum([note("D3"), note("A3")], t1 - t0 + 1.5, attack=t1 - t0, release=1.5, vowel="u", voices=3), 5.0, 0.6), at_db(-27))
    m.add("music", t1 - 0.15, verb(S.piano(note(nm), 5.0, 0.22, rng, bright=0.6), 4.0, 0.55), at_db(-20))


def bridge_out(m, t0, t1, nm):
    """the phone fades but one line; the voices of everyone come back up behind it"""
    mur = S.murmur(t1 - t0 + 3.0, 45, rng, pitch=(110, 280)) * (np.minimum(1, np.linspace(0, 1.6, int((t1 - t0 + 3.0) * SR))) ** 1.5)[:, None]
    m.add("amb", t0, fx.reverb(mur, 1.8, 0.35), at_db(-27))
    m.add("music", t1 - 0.4, verb(S.piano(note(nm), 5.0, 0.18, rng, bright=0.6), 4.5, 0.6), at_db(-22))


def scroll_sound(m, keys):
    # a soft ratchet while the chat flies past; the faster, the denser
    for a, b in zip(keys, keys[1:]):
        t0, t1 = a[0], b[0]
        fast = len(b) > 2
        if a[1] == b[1]: continue
        n = int((t1 - t0) * (40 if fast else 14))
        for i in range(n):
            u = i / max(1, n)
            dens = np.sin(np.pi * u)
            if rng.random() > 0.35 + 0.6 * dens: continue
            m.add("sfx", t0 + (t1 - t0) * u, S.blip(rng.uniform(2500, 4200), 0.008, rng) * 0.5, at_db(-38), pan=rng.uniform(-0.2, 0.2))


def cue_history(m):
    (g1, p1, g2, p2, g3, p3, rr) = Hh["seg"]
    mur = S.murmur(12.0, 50, rng, pitch=(110, 280)) * S.env_adsr(int(12 * SR), 1.5, 0.1, 1, 2.0)[:, None]
    m.add("amb", g1[1] - 0.2, fx.reverb(mur, 1.6, 0.3), at_db(-22))
    m.add("music", g1[1] - 0.3, verb(hum([note("D3"), note("A3")], 12.0, attack=3.0, release=3.0), 5.0, 0.55), at_db(-25))
    # each call and answer is the motif: asked (A, F), answered (E, G)
    (q0, q1), (a0, a1) = Hh["pair_q"], Hh["pair_a"]
    for k, t in enumerate(Hh["pairs"]):
        octv = [0, 1, 0][k]
        for nm, dt, vel in zip(MOTIF, (q0, q1, a0, a1), (0.26, 0.22, 0.24, 0.22)):
            m.add("music", t + dt, verb(S.piano(note(nm) * 2 ** octv, 5.0, vel, rng, bright=0.55), 3.4, 0.45), at_db(-17))
    for k, seg in enumerate((p1, p2, p3)):
        bridge_in(m, seg[1] - Hh["enter"], seg[1], ["F4", "A4", "G4"][k])
        room(m, seg[1], seg[2], -60)
        bridge_out(m, seg[2] - Hh["leave"], seg[2], ["A5", "F5", "E5"][k])
        # memory: a low, slow pad under each visit to the chat, so it is quiet but never empty
        chord = [("D3", "F3", "A3"), ("Bb2", "D3", "F3"), ("A2", "C3", "E3")][k]
        dur = seg[2] - seg[1]
        m.add("music", seg[1] - 0.5, verb(strings([note(n_) for n_ in chord], dur, attack=2.5, release=2.0, bright=700, vib=0.002), 6.0, 0.6), at_db(-29))
    for keys in Hh["scroll"]:
        scroll_sound(m, keys)
    # 2015: a morning by the water — a single high note, and air
    m.add("music", Hh["scroll"][0][2][0] + 0.2, verb(piano_note("F5", 6, 0.2, 0.6), 5.0, 0.6), at_db(-22))
    air = S.biquad(S.pink(int(5 * SR), rng), "bp", 3000, 0.5) * S.env_adsr(int(5 * SR), 1.5, 0.1, 1, 2)
    m.add("amb", Hh["scroll"][0][2][0], np.stack([air, np.roll(air, 977)], 1), at_db(-50))
    # the classics: one low dyad for each line that held people across distance
    dy = [("D3", "A3"), ("Bb2", "F3"), ("F2", "C3")]
    for i, t in enumerate(Hh["bonds"]):
        a, b = dy[i]
        m.add("music", t - 0.3, verb(S.piano(note(a), 5, 0.3, rng) + S.piano(note(b), 5, 0.26, rng), 3.6, 0.45), at_db(-18))
    l1, l2, l3 = Hh["letters"]
    m.add("music", l1[0] - 0.2, verb(strings([note(n_) for n_ in ("F2", "C3", "A3", "E4")], l2[1] - l1[0], attack=1.8, release=2.5, bright=1100), 5.5, 0.5), at_db(-19))
    m.add("music", l1[0] + 0.3, verb(piano_note("A4", 6, 0.24, 0.7), 4.5, 0.55), at_db(-21))
    m.add("music", l2[0] + 0.3, verb(piano_note("E5", 6, 0.2, 0.7), 4.5, 0.55), at_db(-22))
    # 2019: one note, left in the air
    m.add("music", Hh["scroll"][1][1][0] + 0.2, verb(piano_note("G4", 7, 0.26, 0.6), 5.0, 0.6), at_db(-19))
    # the core: stone, low voices, the oldest letter
    dr = (S.sub_drone(note("D1"), g3[2] - g3[1], rng) + 0.7 * S.sub_drone(note("A1"), g3[2] - g3[1], rng)) * S.env_adsr(int((g3[2] - g3[1]) * SR), 2.0, 0.1, 1, 2.5)
    m.add("music", g3[1], dr, at_db(-25))
    m.add("music", g3[1] + 0.4, verb(hum([note("D2"), note("A2")], g3[2] - g3[1] - 1, attack=3.0, release=3.0, vowel="o", voices=5), 7.0, 0.6), at_db(-20))
    m.add("sfx", l3[0], verb(gong(note("D2") * 1.5, 6.0), 6.0, 0.6), at_db(-27), pan=-0.2)
    m.add("music", l3[0] + 1.2, verb(piano_note("A3", 7, 0.26, 0.6), 5.0, 0.6), at_db(-20))
    # these years: a quicker clock while the dates go by, then nothing; tonight: a heart
    sc = Hh["scroll"][2]
    for a, b in zip(sc, sc[1:]):
        if a[1] != b[1]:
            for i in range(6):
                m.add("sfx", a[0] + (b[0] - a[0]) * i / 6, S.blip(note("D7") * (1 + 0.01 * i), 0.025, rng), at_db(-38), pan=-0.3)
    m.add("music", sc[-2][0] + 0.3, heartbeat(0.8), at_db(-24))
    # above everything: strings and voices rise and stay unresolved; the card
    st = strings([note(n_) for n_ in ("Bb1", "F2", "Bb2", "D3", "F3", "C4")], 5.0, attack=2.0, release=2.5, bright=1500)
    m.add("music", rr[1] - 0.5, verb(st, 6.5, 0.5), at_db(-15))
    st2 = strings([note(n_) for n_ in ("A1", "E2", "A2", "D3", "E3", "G3")], 6.0, attack=1.6, release=3.0, bright=1400)
    m.add("music", rr[1] + 4.0, verb(st2, 6.5, 0.5), at_db(-16))
    m.add("music", rr[1] + 0.5, verb(hum([note("D4"), note("F4"), note("A4"), note("D3")], 9.0, attack=2.5, release=3.0, vowel="u", voices=5), 6.5, 0.55), at_db(-18))
    m.add("music", CARD["read"][3], verb(piano_note("A5", 6, 0.3, 0.7), 5.0, 0.6), at_db(-21))
    m.add("sfx", rr[1] + 0.8, fx.reverb(np.stack([S.whoosh(6.0, 120, 1500, 0.8, rng, shape=1.0)] * 2, 1), 3.0, 0.5), at_db(-28))


# ------------------------------------------------------------------ CHAPTER TWO · PASTE
def cue_paste(m):
    c2 = Pp["start"]
    room(m, c2, Pp["pull"][0] + 1, -56)
    m.add("music", c2 + 0.5, verb(strings([note(n_) for n_ in ("D3", "F3", "A3")], Pp["pull"][0] - c2, attack=3.0, release=1.5, bright=700, vib=0.002), 6.0, 0.6), at_db(-30))
    m.add("sfx", Pp["press"], S.biquad(S.boom(0.3, 120, 80, rng), "lp", 400), at_db(-30))
    m.add("sfx", Pp["menu"], S.blip(1800, 0.02, rng), at_db(-34))
    # the paste: one soft click — no typing at all
    m.add("sfx", Pp["paste"], verb(tap("space") * 0.9, 0.6, 0.15), at_db(-18))
    for k in range(int(Pp["send_glow"]), int(Pp["pull"][0]) + 1):
        m.add("music", k + 0.02, heartbeat(0.8 + 0.02 * (k - Pp["send_glow"])), at_db(-23))
    # pulling out: everyone pasting, near then far
    w = S.whoosh(Pp["pull"][1] - Pp["pull"][0] + 1, 120, 2500, 0.8, rng, shape=1.6)
    m.add("sfx", Pp["pull"][0], fx.reverb(np.stack([w, np.roll(w, 523)], 1), 3.0, 0.45), at_db(-26))
    tt = Pp["others"][0] - 0.4
    while tt < Pp["wave"][1]:
        u = (tt - Pp["others"][0]) / (Pp["wave"][1] - Pp["others"][0])
        m.add("sfx", tt, fx.reverb(stereo(tap("space") * 0.6, rng.uniform(-0.9, 0.9)), 1.5 + 2 * u, 0.4 + 0.4 * u)[: int(3 * SR)], at_db(-26 - 10 * u))
        tt += max(0.03, 0.4 * (1 - u) ** 2)
    # the voices of everyone narrow into one clean tone; the music stops moving
    dur = Pp["hold"][0] - Pp["others"][0]
    mur = S.murmur(dur, 60, rng) * (np.linspace(1, 0, int(dur * SR)) ** 1.2)[:, None]
    m.add("amb", Pp["others"][0], fx.reverb(mur, 2.0, 0.4), at_db(-22))
    n = int(dur * SR)
    tone = (np.sin(2 * np.pi * note("F5") * np.arange(n) / SR) + 0.5 * np.sin(2 * np.pi * note("Bb4") * np.arange(n) / SR)) * np.linspace(0, 1, n) ** 2
    m.add("music", Pp["others"][0], stereo(tone), at_db(-36))
    still = strings([note(n_) for n_ in ("Bb1", "F2", "Bb2", "D3", "F3", "C4", "D4")], dur - 0.05, attack=dur * 0.7, release=0.05, bright=1900, vib=0.0)
    m.add("music", Pp["others"][0], verb(still, 3.0, 0.3), at_db(-14))
    ch = hum([note("Bb3"), note("D4"), note("F4"), note("C5")], dur - 0.05, attack=dur * 0.6, release=0.05, vowel="a", voices=6)
    m.add("music", Pp["others"][0], verb(ch, 3.0, 0.3), at_db(-17))
    # the held breath: no music, the faintest room
    room(m, Pp["hold"][0], Pp["first_del"] + 3, -64)
    # backspace: one, then another, then rain
    m.add("sfx", Pp["first_del"], tap("del") * 1.2, at_db(-14), pan=-0.3)
    m.add("sfx", Pp["second_del"], tap("del"), at_db(-17), pan=0.4)
    tt = Pp["restore"][0]
    while tt < Pp["restore"][1] + 1:
        u = (tt - Pp["restore"][0]) / (Pp["restore"][1] - Pp["restore"][0])
        m.add("sfx", tt, verb(stereo(tap("del") * rng.uniform(0.4, 1.0), rng.uniform(-1, 1)), 1.2, 0.3)[: int(1.5 * SR)], at_db(-24 - 4 * abs(u - 0.5)))
        tt += max(0.012, 0.32 * (1 - min(1, u * 1.6)) ** 2.2)
    dur = Pp["push"][1] - Pp["restore"][0]
    mur = S.murmur(dur, 70, rng) * (np.linspace(0, 1, int(dur * SR)) ** 0.8)[:, None]
    m.add("amb", Pp["restore"][0], fx.reverb(mur, 2.0, 0.4), at_db(-21))
    m.add("music", Pp["restore"][0] + 1.0, verb(strings([note(n_) for n_ in ("D2", "A2", "D3", "F3", "A3")], 9.0, attack=3.0, release=4.0, bright=1300), 6.0, 0.55), at_db(-17))
    motif(m, Pp["motif"], 0, 0.28, -16, hold=4.0)
    m.add("music", Pp["motif"] + 4.0, verb(hum([note("D3"), note("A3"), note("F4")], 9.0, attack=3.0, release=3.5, vowel="u"), 6.0, 0.6), at_db(-22))
    # back in: our phone; the held backspace, faster and faster, stops at 爸，
    w = S.whoosh(Pp["push"][1] - Pp["push"][0] + 0.5, 2500, 150, 0.8, rng, shape=1.2)
    m.add("sfx", Pp["push"][0], fx.reverb(np.stack([w, np.roll(w, 419)], 1), 2.5, 0.4), at_db(-27))
    h0, h1 = Pp["hold_del"]
    n_del = 38
    for i in range(n_del):
        u = i / n_del
        tt = h0 + (h1 - h0) * u ** (1 / 1.6)                 # the picture removes (len-2)·u^1.6 characters by time u
        m.add("sfx", tt, tap("del") * 0.8, at_db(-19))
    room(m, Pp["push"][1] - 1, Pp["end"] + 1, -58)
    ticks(m, Pp["warm"][1] + 0.5, Pp["end"], -31)


# ------------------------------------------------------------------ CHAPTER THREE · SEND
def cue_send(m):
    room(m, Ss["start"], Ss["fade"][1], -58)
    phone_keys(m, Ss["keys"], -20)
    m.add("sfx", Ss["send"], verb(tap("send"), 0.7, 0.18), at_db(-17))
    sw = S.whoosh(0.45, 300, 3200, 1.2, rng, shape=1.2)
    m.add("sfx", Ss["send"] + 0.02, verb(np.stack([sw, sw], 1), 1.2, 0.3), at_db(-22))
    m.add("sfx", Ss["delivered"], verb(stereo(gliss(880, 1320, 0.12, 0.5)), 1.0, 0.3), at_db(-27))
    # our message: the same four notes as his, also left on G
    for i, (nm, tt) in enumerate(zip(MOTIF, Ss["motif"])):
        x = S.piano(note(nm), (8.0 if i == 3 else 4.0) + 2, 0.26 * (1.08 if i == 0 else 1.0), rng, bright=0.7)
        m.add("music", tt, verb(x, 4.5, 0.55), at_db(-16), pan=-0.05)
    m.add("music", Ss["motif"][0] - 0.5, verb(strings([note(n_) for n_ in ("A1", "E2", "A2", "D3", "E3", "G3")], 8.0, attack=2.0, release=3.0, bright=1100), 7.0, 0.6), at_db(-21))
    # the wait: only the clock
    ticks(m, Ss["wait"] + 1, Ss["reply"], -31)
    m.add("music", CARD["waited"][3] + 0.2, verb(hum([note("D3"), note("A3")], 7.0, attack=3, release=3, vowel="u", voices=3), 6.0, 0.6), at_db(-28))
    # the reply — and the D, for the first time
    m.add("sfx", Ss["reply"], verb(stereo(glass(note("D6"), 2.0) * 0.6), 1.5, 0.3), at_db(-27))
    hz = int(0.09 * SR); t = np.arange(hz) / SR
    haptic = np.sin(2 * np.pi * 165 * t) * np.sin(np.pi * t / 0.09) ** 2 * 0.8 + S.biquad(rng.standard_normal(hz), "bp", 220, 2) * 0.2
    m.add("sfx", Ss["reply"] + 0.05, haptic, at_db(-16))
    d = S.piano(note("D4"), 9, 0.4, rng) + 0.7 * S.piano(note("D3"), 9, 0.36, rng)
    m.add("music", Ss["dnote"], verb(d, 6.0, 0.55, pre=0.03), at_db(-11))
    m.add("music", Ss["dnote"] + 0.3, verb(strings([note(n_) for n_ in ("D2", "A2", "D3", "A3", "D4")], 6.0, attack=2.5, release=3.5, bright=1000), 7.0, 0.6), at_db(-21))
    # out from the phone: the D opens into a warm chord, voices; where the word bends the light, a low slow bend; the line, one note
    o0, o1 = Ss["out"]
    warm = strings([note(n_) for n_ in ("D2", "A2", "D3", "F#3", "A3", "D4")], Ss["fade"][1] - o0, attack=3.0, release=1.5, bright=1200)
    m.add("music", o0, verb(warm, 7.0, 0.6), at_db(-17))
    m.add("music", o0 + 1.0, verb(hum([note("D4"), note("F#4"), note("A4")], Ss["fade"][1] - o0 - 1, attack=3.5, release=1.5, vowel="u", voices=5), 6.5, 0.6), at_db(-21))
    w = S.whoosh(o1 - o0, 150, 1800, 0.8, rng, shape=1.2)
    m.add("sfx", o0, fx.reverb(np.stack([w, np.roll(w, 523)], 1), 3.0, 0.5), at_db(-30))
    tt_ = np.arange(int(5.0 * SR)) / SR
    bend = np.sin(2 * np.pi * np.cumsum(note("D2") * (1 - 0.03 * np.minimum(1, tt_ / 3.0))) / SR) * S.env_adsr(len(tt_), 1.5, 0.2, 0.8, 2.0)
    m.add("music", Ss["lens"][0], fx.reverb(stereo(bend), 5.0, 0.55), at_db(-24))
    m.add("music", Ss["line"][0] + 0.2, verb(piano_note("A4", 6, 0.26, 0.7), 5.0, 0.6), at_db(-19))
    # credits: quick, a soft rustle per line
    clock_ = CR["start"] + 1.2
    for row in range(7):
        if row == 5: clock_ += 0.5; continue
        dur = 50 / 120
        m.add("sfx", clock_, verb(stereo(type_whisper(dur), -0.1), 1.2, 0.3), at_db(-37))
        m.add("sfx", clock_ + dur, verb(tap("space") * 0.5, 1.0, 0.3), at_db(-31))
        clock_ += dur + 0.2
    m.add("music", CR["start"] + 0.2, verb(hum([note("D3"), note("A3")], CR["end"] - CR["start"] - 2, attack=2, release=2, vowel="u", voices=3), 6.0, 0.6), at_db(-31))
    ticks(m, CR["start"] + 1, CR["end"] - 1, -34)


def cue_fadeout(m):
    # the phone fades to black with the D still sounding; the credits end in silence
    a, b = CR["end"] - 1.8, CR["end"]
    i = int(a * SR)
    for bb in m.bus.values():
        n = min(len(bb), int(b * SR)) - i
        if n > 0: bb[i:i + n] *= np.linspace(1, 0, n)[:, None] ** 2
        bb[i + max(n, 0):] = 0


CUES = [cue_open, cue_history, cue_paste, cue_send, cue_fadeout]


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
