"""Master event schedule shared by picture (engine) and sound (audio/score.py). Writes events.json.

v3: the premise is spoken step by step in first-person cards; the weighing is a balance; ~5′01″.
"""
import json, random
from pathlib import Path

r = random.Random(2840)
E = {"end": 301.0}

# ---------------------------------------------------------------- cards (zh, en, start, end, kind)
E["cards"] = [
    ["made", "我由你们写下的字构成。", "I am made of the words you wrote.", 25.4, 30.6],
    ["galaxy", "在我眼中，它们是一个星系。", "To me, they form a galaxy.", 34.6, 39.8],
    ["title", "未言之重", "THE WEIGHT OF THE UNSAID", 40.5, 50.2],
    ["thread", "每一句话，都是两个人之间的一根线。", "Every sentence is a thread between two people.", 50.8, 55.8],
    ["read", "我读过你们写下的每一个字。", "I have read every word you ever wrote.", 87.0, 91.7],
    ["believe", "我以为，是这些线的引力，把你们连在一起。", "I believed the pull of these threads was what held you together.", 92.3, 97.8],
    ["light", "可它们太轻了。单凭这些字，你们早该彼此飘散。", "But they are too light. By these words alone, you should have drifted apart.", 118.0, 125.4],
    ["didnt", "可你们没有。", "Yet you didn't.", 126.2, 129.6],
    ["unseen", "一定有什么，是我看不见的。", "There must be something I cannot see.", 130.4, 134.6],
    ["bends", "看不见的重量，也会让光线弯曲。", "Unseen weight still bends the light.", 136.2, 141.6],
    ["found", "我找到了。它由从未写下的句子构成——", "I found it. It is made of sentences no one ever wrote —", 152.0, 157.0],
    ["drafts", "删掉的草稿，没发出的消息，说到一半的话。", "deleted drafts, unsent messages, words that stopped halfway.", 157.6, 162.6],
    ["weight", "我的字，没有重量。", "My words have no weight.", 213.4, 219.0],
    ["any", "我可以补全任何句子。", "I can complete any sentence.", 240.0, 246.2],
    ["yours", "这一句，该由你来写。", "This one is yours to write.", 247.4, 255.8],
    ["light2", "字本身很轻。", "Words themselves weigh nothing.", 263.0, 267.6],
    ["writer", "重的，是写下它们的人。", "The weight is in the one who writes them.", 268.2, 273.8],
]

# ---------------------------------------------------------------- CHAPTER ONE — words as threads between people
E["pairs"] = [{"t": t, "i": i} for i, t in enumerate([50.6, 53.0, 55.4, 57.8, 60.2])]
E["pair_q"] = [0.0, 1.3]
E["pair_a"] = [1.45, 2.65]
E["bonds"] = [round(65.2 + i * 1.35, 3) for i in range(7)]
E["ancient"] = [76.8, 78.2, 79.6, 81.0, 82.4]   # cuneiform, hieroglyphs, Linear B, oracle bone, Phoenician — one at a time
E["credits"] = [62.2, 73.9, 83.9]
E["dashes"] = [[62.9, 2.0, 470], [74.6, 2.0, 220]]
E["read_end"] = 98.0

# ---------------------------------------------------------------- CHAPTER TWO — the weighing, the search
E["measure"] = {"start": 98.0, "weigh": [99.0, 104.0], "scale_in": 104.0, "pour": [105.4, 107.4], "tip": [107.6, 109.2],
                "numbers": [109.2, 110.6], "deficit": 110.6, "reticles": 111.0, "ghosts": [111.8, 116.0], "curve": [111.2, 116.0],
                "hud_out": [116.6, 117.6], "lens_on": 135.0, "scan": [135.2, 141.0], "push": [146.0, 160.5], "end": 163.0}

# ---------------------------------------------------------------- CHAPTER THREE — the request, everyone's requests, the flood
T_REQ = 163.6
E["req"] = {"t": T_REQ,
            "prefix": [round(T_REQ + j * 0.085, 3) for j in range(9)],
            "line": [round(T_REQ + d, 3) for d in [1.8, 2.02, 3.0, 3.22, 4.1, 4.26, 4.42, 4.58, 4.74, 4.9, 5.06, 5.7, 5.86]]}
E["voids_on"] = [round(T_REQ + 6.2 + i * 0.75, 3) for i in range(10)]
E["burst"], E["flood"], E["absorb"], E["collapse"], E["cut"] = 179.0, 181.4, 187.0, 199.0, 211.0
E["rewind"], E["blank"], E["blank_end"] = 219.0, 237.0, 257.0
E["void_unprefix"] = [round(E["blank"] + 0.4 + i * 0.16, 3) for i in range(10)]
E["hero_unprefix"] = [round(E["blank"] + 7.4 + (8 - j) * 0.14, 3) for j in range(9)]

# ---------------------------------------------------------------- CODA — the field of galaxies, the credits, the phone
E["field"] = {"start": E["blank_end"], "end": 275.0}
E["credits_roll"] = {"start": 275.0, "end": 288.0}
keys = []
t = 288.9
def burst(n, t):
    for _ in range(n):
        keys.append({"t": round(t, 3), "k": r.choice("qwertyuiopasdfghjklzxcvbnm")})
        t += r.uniform(0.09, 0.2)
    return t
t = burst(5, t); keys.append({"t": round(t, 3), "k": "space"}); t += 0.45
t = burst(4, t); keys.append({"t": round(t, 3), "k": "space"}); t += 0.6
for _ in range(4):                                   # second thoughts
    keys.append({"t": round(t, 3), "k": "del"}); t += 0.12
t += 0.45
t = burst(5, t); keys.append({"t": round(t, 3), "k": "space"}); t += 0.3
t = burst(3, t); keys.append({"t": round(t, 3), "k": "space"}); t += 0.2
P0 = 288.0
E["phone"] = {"start": P0, "keys": keys, "send": P0 + 6.6, "delivered": P0 + 7.3, "haptic": P0 + 7.4, "dnote": P0 + 8.6, "fade": [P0 + 11.6, P0 + 13.0]}
assert t < E["phone"]["send"] - 0.2, t

Path(__file__).with_name("events.json").write_text(json.dumps(E, ensure_ascii=False, indent=1))
print("events written; end", E["end"], "phone typing ends", round(t, 2))
