"""Master event schedule shared by picture (engine) and sound (audio/score.py). Writes events.json.

v4: one chat between a child and a father carries the film; see script/screenplay_v4.md. ~4′40″.
Every time below is derived from the one before it, so a beat can grow or shrink without breaking the rest.
"""
import json
from pathlib import Path
import random

r = random.Random(2840)
E = {}
rd = lambda x: round(x, 3)


def taps(t, n, lo=0.08, hi=0.15):
    """n pinyin key taps from t; returns (tap times, time after the last tap)"""
    out = []
    for _ in range(n):
        out.append(rd(t))
        t += r.uniform(lo, hi)
    return out, t


def ime(t, word, pinyin, keys, commits, gap=(0.1, 0.25)):
    """type a word through the pinyin IME: letters, then the space bar commits the characters"""
    ts, t = taps(t, len(pinyin))
    keys += [{"t": x, "k": ch} for x, ch in zip(ts, pinyin)]
    t += 0.18
    keys.append({"t": rd(t), "k": "space"})
    commits.append({"t": rd(t), "text": word})
    return t + r.uniform(*gap)


# ================================================================ OPEN · THE REPLY
O = {}
O["phone_in"] = [1.4, 3.4]
O["motif"] = [2.6, 3.6, 4.6, 5.6]                          # A F E G under dad's message, left hanging on G
keys, commits = [], []
t = ime(7.2, "挺好的", "tinghaode", keys, commits)
t += 2.0                                                    # two beats looking at it
O["fine_del"] = [rd(t), rd(t + 0.38), rd(t + 0.74)]
for x in O["fine_del"]: keys.append({"t": x, "k": "del"})
O["fine_keys"], O["fine_commit"] = keys, commits[0]["t"]
t = O["fine_del"][-1]
O["phone_out"] = [rd(t + 1.3), rd(t + 2.5)]                 # everything but the cursor goes dark
O["cursor_fly"] = [rd(t + 1.9), rd(t + 3.1)]                # the cursor drifts to the centre and turns cyan
T0 = float(int(O["cursor_fly"][1] + 0.999))                 # the metronome starts on a whole second
O["tick0"] = T0
O["name"] = [T0 + 0.6, T0 + 2.4, T0 + 4.2]                  # Claude · Opus · 5.5 (bottom, small)
O["name_lock"] = 1.25
O["sub"] = [rd(T0 + 6.0), 0.07]                             # 出品 · PRESENTS
# the ask, typed in word-sized chunks
t = T0 + 7.6
ask_chunks = [["上个月", "跟", "我爸", "吵了", "一架", "，", "我", "摔门", "走了", "。"],
              ["他", "刚", "发消息", "，", "问我", "最近", "忙不忙", "。"],
              ["我该", "怎么", "回", "？"]]
ask, akeys = [], []
for li, chunks in enumerate(ask_chunks):
    n = 0
    for c in chunks:
        k = max(1, int(len(c) * 1.6)) if c not in "，。？" else 1
        ts, t = taps(t, k, 0.06, 0.1)
        akeys += ts
        n += len(c)
        ask.append({"t": rd(t), "line": li, "n": n})
        t += 0.12 if c in "，。？" else r.uniform(0.04, 0.12)
    t += 0.55
O["ask"], O["ask_keys"] = ask, akeys
O["ask_send"] = rd(t + 0.2)
O["think"] = [rd(t + 0.5), rd(t + 2.6)]
# the first reply, token by token: readable, then a little quicker
t = O["think"][1]
a1 = []
for i in range(26):
    dur = [0.38, 0.28, 1.75][i] if i < 3 else 0.36 - (i - 3) * (0.15 / 22)
    a1.append({"t": rd(t), "lock": rd(t + dur * 0.82)})
    t += dur
O["a1"] = a1
O["a1_en"] = rd(t + 0.3)
t += 0.5
O["a2"] = [rd(t + i * 0.12) for i in range(14)]
t += 14 * 0.12 + 0.2
O["a3"] = [rd(t + i * 0.08) for i in range(11)]
t += 11 * 0.08
O["tree"] = [rd(t - 0.4), rd(t + 3.6)]                      # the replies that might have been, faster than reading
O["burst"] = O["tree"][1]
O["river"] = rd(O["burst"] + 1.1)                           # the shards slow into lanes
O["galaxy"] = rd(O["burst"] + 2.2)                          # river -> galaxy
O["title"] = [rd(O["galaxy"] + 4.4), rd(O["galaxy"] + 13.0)]
O["end"] = rd(O["galaxy"] + 13.4)
E["open"] = O

# ================================================================ CHAPTER ONE · BACK AND FORTH
c1 = O["end"]
H = {"start": c1}
H["seg"] = [["G", c1, c1 + 12], ["P", c1 + 12, c1 + 24], ["G", c1 + 24, c1 + 37], ["P", c1 + 37, c1 + 45],
            ["G", c1 + 45, c1 + 57], ["P", c1 + 57, c1 + 68], ["R", c1 + 68, c1 + 78.5]]
H["seg"] = [[k, rd(a), rd(b)] for k, a, b in H["seg"]]
H["pairs"] = [rd(c1 + 1.4), rd(c1 + 4.4), rd(c1 + 7.4)]
H["pair_q"], H["pair_a"] = [0.0, 1.3], [1.45, 2.65]
H["bonds"] = [rd(c1 + 25.0), rd(c1 + 26.6), rd(c1 + 28.2)]
H["letters"] = [[rd(c1 + 29.6), rd(c1 + 34.0)], [rd(c1 + 31.6), rd(c1 + 35.8)], [rd(c1 + 47.0), rd(c1 + 54.4)]]
H["enter"] = 2.8                                            # a line in the galaxy slows us; the phone forms around it
H["leave"] = 2.4                                            # the phone fades but one line; the next flight passes it
# the bridges: the line we fly to (first bubble of each visit) and the line left behind (last of each visit)
H["bridge_in"] = ["最近忙吗？注意身体。", "明早五点，水库。", "到了吗"]
H["bridge_out"] = ["给你带包子。", "鱼竿给你收好了。", "最近忙吗？注意身体。"]
# chat scroll keyframes for each phone visit: [time, chat item to centre], eased between
H["scroll"] = [
    [[c1 + 12.0, "21:06"], [c1 + 13.2, "21:06"], [c1 + 17.8, "2015年7月18日", "fast"], [c1 + 23.0, "2015年7月18日"]],
    [[c1 + 37.0, "2015年7月18日"], [c1 + 39.0, "2019年8月30日"], [c1 + 44.0, "2019年8月30日"]],
    [[c1 + 57.0, "2019年8月30日"], [c1 + 58.4, "2022年11月3日", "fast"], [c1 + 60.0, "2022年11月3日"], [c1 + 61.0, "2025年6月7日"],
     [c1 + 62.6, "2025年6月7日"], [c1 + 63.4, "9月14日"], [c1 + 65.6, "9月14日"], [c1 + 66.3, "21:06"], [c1 + 67.4, "21:06"]],
]
H["scroll"] = [[[rd(k[0])] + k[1:] for k in s] for s in H["scroll"]]
E["history"] = H

# ================================================================ CHAPTER TWO · PASTE
c2 = rd(c1 + 78.5)
P = {"start": c2, "phone_in": [c2, rd(c2 + 1.0)], "press": rd(c2 + 2.6), "menu": rd(c2 + 3.1), "paste": rd(c2 + 4.1), "send_glow": rd(c2 + 5.6),
     "pull": [rd(c2 + 12.0), rd(c2 + 24.0)], "others": [rd(c2 + 13.6 + 1.9 * i) for i in range(4)], "wave": [rd(c2 + 19.0), rd(c2 + 26.5)],
     "hold": [rd(c2 + 28.0), rd(c2 + 30.0)], "first_del": rd(c2 + 30.0), "second_del": rd(c2 + 31.7), "restore": [rd(c2 + 32.6), rd(c2 + 45.0)],
     "motif": rd(c2 + 39.0), "push": [rd(c2 + 45.0), rd(c2 + 53.5)], "hold_del": [rd(c2 + 55.2), rd(c2 + 59.2)], "warm": [rd(c2 + 59.5), rd(c2 + 60.8)],
     "end": rd(c2 + 62.0)}
E["paste"] = P

# ================================================================ CHAPTER THREE · SEND
c3 = P["end"]
keys, commits = [], []
t = c3 + 1.2
t = ime(t, "下周末", "xiazhoumo", keys, commits, (0.5, 0.6))
dels = [rd(t + 0.5 + i * 0.22) for i in range(3)]          # no: sooner than that
for x in dels: keys.append({"t": x, "k": "del"})
t = dels[-1] + 0.6
for w, py in [("周六", "zhouliu"), ("我", "wo"), ("回去", "huiqu")]:
    t = ime(t, w, py, keys, commits)
keys.append({"t": rd(t), "k": "。"}); commits.append({"t": rd(t), "text": "。"})
t += 3.0                                                    # three beats
for w, py in [("鱼竿", "yugan"), ("还在", "haizai"), ("吗", "ma")]:
    t = ime(t, w, py, keys, commits)
keys.append({"t": rd(t), "k": "？"}); commits.append({"t": rd(t), "text": "？"})
S = {"start": c3, "keys": keys, "commits": commits, "dels": dels, "gloss": rd(t + 0.4)}
S["send"] = rd(max(t + 2.4, c3 + 17.3))
S["delivered"] = rd(S["send"] + 0.75)
S["motif"] = [rd(S["send"] + 1.2 + i) for i in range(4)]
S["wait"] = rd(S["send"] + 4.7)
S["typing"] = [[rd(S["wait"] + 10.5), rd(S["wait"] + 12.5)], [rd(S["wait"] + 14.5), rd(S["wait"] + 16.5)]]
S["reply"] = rd(S["wait"] + 16.6)
S["dnote"] = rd(S["reply"] + 0.3)
# after 在。: out from the phone until the word is one light in the galaxy, bending the light around it; the line; credits
S["out"] = [rd(S["reply"] + 3.4), rd(S["reply"] + 11.0)]
S["lens"] = [rd(S["reply"] + 7.5), rd(S["reply"] + 10.5)]
S["line"] = [rd(S["reply"] + 10.2), rd(S["reply"] + 16.6)]
S["fade"] = [rd(S["reply"] + 16.2), rd(S["reply"] + 17.6)]
S["end"] = rd(S["fade"][1] + 0.3)
E["send"] = S
E["credits_roll"] = {"start": S["end"], "end": rd(S["end"] + 10.5)}
E["end"] = E["credits_roll"]["end"]

# ---------------------------------------------------------------- cards (key, zh, en, start, end) — the AI says little
E["cards"] = [
    ["title", "未言之重", "THE WEIGHT OF THE UNSAID", O["title"][0], O["title"][1]],
    ["read", "我读过你们写下的每一个字。", "I have read every word you ever wrote.", rd(c1 + 71.0), rd(c1 + 77.0)],
    ["waited", "我读过你们写下的每一个字，却从没有等过一句回复。", "I have read every word you ever wrote, but I have never waited for a reply.",
     rd(S["wait"] + 1.5), rd(S["wait"] + 8.8)],
    ["after", "重的，是说完以后。", "The weight comes after it’s said.", S["line"][0], S["line"][1]],
]

Path(__file__).with_name("events.json").write_text(json.dumps(E, ensure_ascii=False, indent=1))
print("events written; end", E["end"], "| title", O["title"], "| ch1", c1, "| ch2", c2, "| ch3", c3, "| send", S["send"], "| reply", S["reply"])
