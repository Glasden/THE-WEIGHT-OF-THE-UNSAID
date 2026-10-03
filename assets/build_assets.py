"""Build the text corpus and the SDF glyph atlas the renderer draws from.

Outputs (assets/build/):
  atlas.png   8-bit single-channel SDF atlas
  atlas.json  per-entry rects/advances + metrics
  corpus.json layers of lines, each line a list of atlas entry ids
"""
import json, random, re, sys, glob, unicodedata
from pathlib import Path
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import distance_transform_edt
from fontTools.ttLib import TTFont
import opencc

ROOT = Path(__file__).resolve().parent
FONTS = ROOT / "fonts"
RAW = ROOT / "corpus" / "raw"
OUT = ROOT / "build"
sys.path.insert(0, str(ROOT / "corpus"))
import curated as C

rng = random.Random(20261003)
t2s = opencc.OpenCC("t2s")

CELL = 64          # atlas cell height (px)
SPREAD = 8         # SDF range in px
SS = 4             # supersampling for SDF source
EM = 44            # em size in px inside the cell
ATLAS_W = 8192

STYLE_FONTS = {
    "serif": [("NotoSerifSC.ttf", 500), ("NotoSerif.ttf", 450), ("NotoSerifJP.ttf", 500), ("NotoSerifKR.ttf", 500)],
    "sans": [("NotoSansSC.ttf", 450), ("NotoSerifKR.ttf", 500), ("NotoSerif.ttf", 450)],
    "mono": [("JetBrainsMono.ttf", 450), ("NotoSansSC.ttf", 450)],
    "ital": [("NotoSerif-Italic.ttf", 400), ("NotoSerif.ttf", 400), ("NotoSansSC.ttf", 400)],
    "anc": [("NotoSansCuneiform.ttf", None), ("NotoSansEgyptianHieroglyphs.ttf", None), ("NotoSansLinearB.ttf", None),
            ("NotoSansPhoenician.ttf", None), ("NotoSansUgaritic.ttf", None), ("NotoSansOldPersian.ttf", None)],
}
SHAPED_FONTS = {"Arab": "NotoNaskhArabic.ttf", "Hebr": "NotoSerifHebrew.ttf", "Deva": "NotoSerifDevanagari.ttf"}

_cmaps = {}
def cmap(fname):
    if fname not in _cmaps:
        _cmaps[fname] = set(TTFont(FONTS / fname, lazy=True).getBestCmap().keys())
    return _cmaps[fname]

def font_for(ch, style):
    for fname, w in STYLE_FONTS[style]:
        if ord(ch) in cmap(fname):
            return fname, w
    return None

def shaped_script(word):
    for ch in word:
        n = unicodedata.name(ch, "")
        if n.startswith("ARABIC"): return "Arab"
        if n.startswith("HEBREW"): return "Hebr"
        if n.startswith("DEVANAGARI"): return "Deva"
    return None

# ---------------------------------------------------------------- corpus text

def gutenberg_lines(pid, lo=12, hi=64, n=2500):
    txt = (RAW / f"pg{pid}.txt").read_text(encoding="utf-8", errors="ignore")
    m1 = re.search(r"\*\*\* ?START OF.*?\*\*\*", txt); m2 = re.search(r"\*\*\* ?END OF", txt)
    txt = txt[m1.end() if m1 else 0: m2.start() if m2 else None]
    out = []
    for ln in txt.splitlines():
        ln = re.sub(r"\s+", " ", ln.strip().replace("_", ""))
        if lo <= len(ln) <= hi and not ln.isupper() and not re.search(r"[\[\]{}<>@#|\\]|gutenberg|chapter", ln, re.I):
            out.append(ln)
    rng.shuffle(out)
    return out[:n]

def cjk_split(paragraphs, lo=4, hi=24):
    out = []
    for p in paragraphs:
        p = t2s.convert(p)
        for seg in re.split(r"(?<=[。！？；])", p):
            seg = seg.strip()
            if lo <= len(seg) <= hi and not re.search(r"[□\[\]（）()0-9a-zA-Z]", seg):
                out.append(seg)
    return out

def chinese_classics():
    J = lambda f: json.loads((RAW / f).read_text(encoding="utf-8"))
    paras = []
    for d in J("shijing.json"): paras += d["content"]
    for d in J("chuci.json"): paras += d["content"]
    for d in J("lunyu.json"): paras += d["paragraphs"]
    for f in ("tang0.json", "tang1000.json", "ci0.json"):
        for d in J(f): paras += d["paragraphs"]
    lines = cjk_split(paras)
    rng.shuffle(lines)
    return lines[:9000]

def chinese_prose():
    g = json.loads((RAW / "guwen.json").read_text(encoding="utf-8"))
    paras = []
    def walk(x):
        if isinstance(x, dict):
            for k, v in x.items():
                if k in ("paragraphs", "content") and isinstance(v, list) and v and isinstance(v[0], str): paras.extend(v)
                else: walk(v)
        elif isinstance(x, list):
            for v in x: walk(v)
    walk(g.get("content", g))
    lines = cjk_split(paras, 6, 22)
    rng.shuffle(lines)
    return lines[:6000]

def code_lines(n=24):
    out = []
    for f in sorted(glob.glob("/usr/lib/python3.12/*.py"))[:200]:
        for ln in Path(f).read_text(errors="ignore").splitlines():
            s = ln.strip()
            if 12 <= len(s) <= 56 and s.isascii() and not s.startswith(("#", '"', "'")) and "\t" not in s:
                out.append(s)
    rng.shuffle(out)
    return out[:n] + C.CODE

def ancient_lines(n=2500):
    pools = []
    for fname, _ in STYLE_FONTS["anc"]:
        cps = sorted(c for c in cmap(fname) if c > 0x10000)
        pools.append(cps)
    # weight: cuneiform & hieroglyphs dominate, the rest are accents
    lim = [260, 260, 90, 22, 30, 36]
    pools = [rng.sample(p, min(len(p), l)) for p, l in zip(pools, lim)]
    weights = [0.38, 0.34, 0.12, 0.06, 0.05, 0.05]
    out = []
    for _ in range(n):
        p = rng.choices(pools, weights)[0]
        out.append("".join(chr(rng.choice(p)) for _ in range(rng.randint(5, 14))))
    return out

def ancient_from(font_idx, n, seed):
    """one line of signs from a single script"""
    r2 = random.Random(seed)
    fname = STYLE_FONTS["anc"][font_idx][0]
    cps = sorted(c for c in cmap(fname) if c > 0x10000)
    return "".join(chr(r2.choice(cps)) for _ in range(n))

# Oracle-bone script has no open font: draw the best-known pictographs as carved strokes (unit box, y up).
import math
def _circle(cx, cy, r, n=20, a0=0.0, a1=2 * math.pi):
    return [(cx + r * math.cos(a0 + (a1 - a0) * i / n), cy + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]
ORACLE = {
    "日": [_circle(0.5, 0.5, 0.36), [(0.38, 0.5), (0.62, 0.5)]],
    # crescent: outer and inner arcs meet at both horns; a short stroke inside
    "月": [_circle(0.6, 0.5, 0.45, 18, math.radians(115), math.radians(245)),
           _circle(0.95, 0.5, math.hypot(0.95 - 0.41, 0.408), 14, math.atan2(0.408, 0.41 - 0.95), math.atan2(-0.408, 0.41 - 0.95) + 2 * math.pi),
           [(0.215, 0.58), (0.215, 0.42)]],
    "山": [[(0.06, 0.18), (0.94, 0.18)], [(0.06, 0.18), (0.18, 0.72), (0.33, 0.24), (0.5, 0.92), (0.67, 0.24), (0.82, 0.72), (0.94, 0.18)]],
    "水": [[(0.5, 0.98), (0.4, 0.76), (0.6, 0.52), (0.4, 0.28), (0.5, 0.04)], [(0.2, 0.82), (0.26, 0.7)], [(0.2, 0.4), (0.26, 0.28)],
           [(0.8, 0.66), (0.74, 0.54)], [(0.8, 0.24), (0.74, 0.12)]],
    "人": [[(0.6, 0.96), (0.5, 0.62), (0.4, 0.34), (0.22, 0.02)], [(0.5, 0.62), (0.7, 0.4), (0.78, 0.22)]],
    "大": [[(0.5, 0.96), (0.5, 0.46)], [(0.12, 0.72), (0.88, 0.72)], [(0.5, 0.46), (0.22, 0.02)], [(0.5, 0.46), (0.78, 0.02)]],
    "木": [[(0.5, 0.98), (0.5, 0.02)], [(0.5, 0.72), (0.2, 0.96)], [(0.5, 0.72), (0.8, 0.96)], [(0.5, 0.3), (0.18, 0.04)], [(0.5, 0.3), (0.82, 0.04)]],
    "雨": [[(0.08, 0.94), (0.92, 0.94)], [(0.5, 0.94), (0.5, 0.62)]] + [[(x, y), (x, y - 0.16)] for x in (0.24, 0.76) for y in (0.8, 0.46)] + [[(0.5, 0.46), (0.5, 0.3)]],
}

def raster_strokes(strokes, EM, CELL, SPREAD, SS):
    size = EM * SS
    pad = SPREAD * SS
    W = int(np.ceil((size * 1.0 + 2 * pad) / SS / 4) * 4) * SS
    H = CELL * SS
    img = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(img)
    base = pad + 0.86 * size
    wpx = max(2, int(0.075 * size))
    for st in strokes:
        pts = [(pad + x * size * 0.92 + size * 0.04, base - y * size * 0.92 - size * 0.02) for x, y in st]
        d.line(pts, fill=255, width=wpx, joint="curve")
        for p in (pts[0], pts[-1]):
            d.ellipse([p[0] - wpx / 2, p[1] - wpx / 2, p[0] + wpx / 2, p[1] + wpx / 2], fill=255)
    a = np.asarray(img) > 127
    din = distance_transform_edt(a); dout = distance_transform_edt(~a)
    sd = ((dout - din) / SS).reshape(H // SS, SS, W // SS, SS).mean(axis=(1, 3))
    v = np.clip(0.5 - sd / (2 * SPREAD), 0, 1)
    return (v * 255 + 0.5).astype(np.uint8), EM * 1.12

ANCIENT_CAPS = [("楔形文字 · 约公元前 3200 年", "CUNEIFORM · c. 3200 BCE"), ("埃及圣书体 · 约公元前 3100 年", "EGYPTIAN HIEROGLYPHS · c. 3100 BCE"),
                ("线形文字 B · 约公元前 1450 年", "LINEAR B · c. 1450 BCE"), ("甲骨文 · 约公元前 1250 年", "ORACLE BONE SCRIPT · c. 1250 BCE"),
                ("腓尼基字母 · 约公元前 1050 年", "PHOENICIAN · c. 1050 BCE")]

def digital_lines():
    stamps = ["", "", "", "23:47 ", "08:12 ", "已读 ", "[语音] 12″ ", "↩ ", "Sent ", "✓✓ "]
    out = []
    for _ in range(6):
        for m in C.DIGITAL:
            out.append((rng.choice(stamps) + m).strip())
    return out

# ---------------------------------------------------------------- tokenize

entries = {}      # key -> dict(kind, text, style, font, weight)
def key_for(ch, style):
    k = f"{style}:{ch}"
    if k not in entries:
        if ch == " ":
            entries[k] = dict(kind="space", text=" ", style=style)
        else:
            f = font_for(ch, style)
            if f is None: return None
            entries[k] = dict(kind="glyph", text=ch, style=style, font=f[0], weight=f[1])
    return k

def tokenize(line, style):
    """Return list of keys, or None if a glyph can't be covered."""
    words = line.split(" ")
    if any(shaped_script(w) for w in words):
        keys = []
        scr_words = [w for w in words if w]
        rtl = any(shaped_script(w) in ("Arab", "Hebr") for w in scr_words)
        seq = list(reversed(scr_words)) if rtl else scr_words
        for i, w in enumerate(seq):
            s = shaped_script(w)
            if s:
                k = f"w:{w}"
                entries.setdefault(k, dict(kind="word", text=w, style="shaped", font=SHAPED_FONTS[s], weight=None, script=s))
                keys.append(k)
            else:
                for ch in w:
                    kk = key_for(ch, style)
                    if kk is None: return None
                    keys.append(kk)
            if i < len(seq) - 1: keys.append(key_for(" ", style))
        return keys
    keys = []
    for ch in line:
        k = key_for(ch, style)
        if k is None: return None
        keys.append(k)
    return keys

# ---------------------------------------------------------------- SDF raster

_fonts = {}
def get_font(fname, weight, size):
    k = (fname, weight, size)
    if k not in _fonts:
        f = ImageFont.truetype(str(FONTS / fname), size, layout_engine=ImageFont.Layout.RAQM)
        if weight is not None:
            try:
                axes = f.get_variation_axes()
                # wght is the axis whose min..max spans 100..900
                vals = [weight if a["minimum"] <= weight <= a["maximum"] and a["maximum"] >= 700 else a["default"] for a in axes]
                f.set_variation_by_axes(vals)
            except Exception:
                pass
        _fonts[k] = f
    return _fonts[k]

def raster(args):
    """Returns (sdf uint8 array HxW at 1x, advance_px at 1x)."""
    e, (EM, CELL, SPREAD, SS) = args
    if e["kind"] == "strokes":
        return raster_strokes(ORACLE[e["text"]], EM, CELL, SPREAD, SS)
    if e["kind"] == "space":
        return None, EM * (0.27 if e["style"] == "ital" else 0.5 if e["style"] in ("serif", "sans") else 0.6)
    size = EM * SS
    f = get_font(e["font"], e.get("weight"), size)
    kw = {}
    if e["kind"] == "word":
        kw = dict(direction="rtl" if e["script"] in ("Arab", "Hebr") else "ltr")
    adv = f.getlength(e["text"], **kw)
    pad = SPREAD * SS
    W = int(np.ceil((adv + 2 * pad) / SS / 4) * 4) * SS
    W = max(W, 2 * pad + SS * 4)
    H = CELL * SS
    img = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(img)
    base = pad + 0.86 * size
    d.text((pad, base), e["text"], font=f, fill=255, anchor="ls", **kw)
    a = np.asarray(img) > 127
    if not a.any():
        return None, adv / SS
    din = distance_transform_edt(a)
    dout = distance_transform_edt(~a)
    sd = (dout - din) / SS                                  # +outside, px @1x
    sd = sd.reshape(H // SS, SS, W // SS, SS).mean(axis=(1, 3))
    v = np.clip(0.5 - sd / (2 * SPREAD), 0, 1)
    return (v * 255 + 0.5).astype(np.uint8), adv / SS

# ---------------------------------------------------------------- main

def main():
    OUT.mkdir(exist_ok=True)
    layers_src = {
        "ancient": [(l, "anc") for l in ancient_lines()],
        "classical": [(l, "serif") for l in chinese_classics()]
                     + [(l, "serif") for pid in (10, 227, 1000) for l in gutenberg_lines(pid, n=500)],
        "print": [(l, "serif") for l in chinese_prose()]
                 + [(l, "serif") for pid in (100, 2701, 1342, 2000, 17489, 2229, 1322, 12242, 1661, 84) for l in gutenberg_lines(pid, n=260)],
        "digital": [(l, "sans") for l in digital_lines()] + [(l, "mono") for l in code_lines()],
    }
    named_src = {}
    # Han glyph budget: keep the most frequent characters per style
    from collections import Counter
    freq = Counter()
    for lines in layers_src.values():
        for l, s in lines:
            for ch in l: freq[(s, ch)] += 1
    han = lambda ch: "㐀" <= ch <= "鿿"
    budget = {"serif": 5200, "sans": 2400, "mono": 2400}
    keep = set()
    for s, b in budget.items():
        hs = [ch for (st, ch), _ in freq.most_common() if st == s and han(ch)]
        keep |= {(s, ch) for ch in hs[:b]}
    def allowed(l, s):
        return all(not han(ch) or (s, ch) in keep for ch in l)

    corpus = {"layers": {}, "named": {}}
    dropped = 0
    for name, lines in layers_src.items():
        arr = []
        for l, s in lines:
            if not allowed(l, s): dropped += 1; continue
            t = tokenize(l, s)
            if t: arr.append(t)
            else: dropped += 1
        corpus["layers"][name] = arr
    print("dropped", dropped, "entries", len(entries), {k: len(v) for k, v in corpus["layers"].items()})

    keys = sorted(entries.keys())
    idx = {k: i for i, k in enumerate(keys)}
    corpus["layers"] = {n: [[idx[k] for k in t] for t in arr] for n, arr in corpus["layers"].items()}
    build_atlas("atlas", keys, (EM, CELL, SPREAD, SS))
    # the pasted reply, in the galaxy's own (low-res) atlas: the uniform state repeats it everywhere
    ans = "".join(t for t, _ in C.ANSWER1)
    uni = [idx.get(f"sans:{ch}", idx.get(f"serif:{ch}")) for ch in ans]
    missing = [ch for ch, i in zip(ans, uni) if i is None]
    if missing: print("uniform: not in the galaxy atlas:", "".join(missing))
    corpus["uniform"] = [i for i in uni if i is not None]

    # hi-res atlas for hero text seen up close (v4: the story of one chat, see script/screenplay_v4.md)
    named_src.update(v4_named())
    entries.clear()
    named = {}
    for name, lines in named_src.items():
        arr = []
        for l, s in lines:
            t = tokenize(l, s)
            if t is None: raise SystemExit(f"named line not coverable: {name}: {l!r}")
            arr.append({"text": l, "keys": t})
        named[name] = arr
    hkeys = sorted(entries.keys())
    hidx = {k: i for i, k in enumerate(hkeys)}
    corpus["named"] = {n: [{"text": d["text"], "ids": [hidx[k] for k in d["keys"]]} for d in arr] for n, arr in named.items()}
    corpus["opening"] = [{"token": tok, "cands": [[c, p] for c, p in cands]} for tok, cands in C.OPENING_TOKENS]
    corpus["v4"] = v4_meta()
    build_atlas("atlas_hi", hkeys, (EM * 4, CELL * 4, SPREAD * 3, 2))
    (OUT / "corpus.json").write_text(json.dumps(corpus, ensure_ascii=False, separators=(",", ":")))


def uniq(seq):
    seen, out = set(), []
    for x in seq:
        if x not in seen: seen.add(x); out.append(x)
    return out

def v4_named():
    chat = [it[1] for it in C.CHAT_LOG]
    gloss = [it[2] for it in C.CHAT_LOG if it[0] != "date" and it[2]] + [C.DRAFT_FINE[1], C.FINAL_MSG[1], C.DAD_REPLY[1]] \
        + [en for _, en in C.ASK] + C.ANSWER1_EN + [l[2] for l in C.LETTERS] + [l[4] for l in C.LETTERS] \
        + [o[2] for o in C.OTHERS if o[0] not in ("Sam",)]
    toks = uniq([t for t, _ in C.ANSWER1] + [c for _, cs in C.ANSWER1 for c, _ in cs] + C.ANSWER2 + C.ANSWER3)
    fill = [m for m in C.DIGITAL if not any(ord(ch) > 0x2fff and not ("\u3000" <= ch <= "\u9fff" or "\uff00" <= ch <= "\uffef") for ch in m)][:60]
    return {
        "opening": [(c, "sans") for _, cands in C.OPENING_TOKENS for c, _ in cands] + [(C.OPENING_SUB, "sans")],
        "digits": [(C.OPENING_DIGITS, "sans")],
        "pairs": [(l, "sans") for pr in C.PAIRS for l in pr],
        "bonds": [(l, "serif") for l in C.CLASSIC_BONDS],
        "keys": [(ch, "sans") for row in C.KEY_ROWS for ch in row],
        "chat": [(l, "sans") for l in uniq(chat)],
        "gloss": [(l, "ital") for l in uniq(gloss)],
        "phone": [(l, "sans") for l in uniq(C.PHONE_UI + [C.DRAFT_FINE[0], C.DRAFT_LATER, C.FINAL_MSG[0], C.DAD_REPLY[0], "的了我你是在吧好"])],
        "ask": [(zh, "sans") for zh, _ in C.ASK],
        "tokens": [(t, "sans") for t in toks],
        "answers": [("".join(t for t, _ in C.ANSWER1), "sans"), ("".join(C.ANSWER2), "sans"), ("".join(C.ANSWER3), "sans")],
        "tree": [(l, "sans") for l in C.REPLY_POOL],
        "letters": [(l[0], l[1]) for l in C.LETTERS],
        "letter_caps": [(l[3], "sans") for l in C.LETTERS],
        "others": [(l, "sans") for o in C.OTHERS for l in (o[0], o[1], o[3])] + [("我们能谈谈吗？", "sans")],
        "names": [(l, "sans") for l in C.OTHER_NAMES],
        "fill": [(l, "sans") for l in fill],
    }

def v4_meta():
    """structure the engine needs alongside the glyphs: which chat line is whose, what each token's alternatives are"""
    return {
        "chat": [{"k": it[0], "text": it[1], "gloss": None if it[0] == "date" else it[2]} for it in C.CHAT_LOG],
        "draft_fine": list(C.DRAFT_FINE), "draft_later": C.DRAFT_LATER, "final": list(C.FINAL_MSG), "reply": list(C.DAD_REPLY),
        "ask": [list(a) for a in C.ASK],
        "answer1": [{"tok": t, "cands": [[c, p] for c, p in cs]} for t, cs in C.ANSWER1], "answer1_en": C.ANSWER1_EN,
        "answer2": C.ANSWER2, "answer3": C.ANSWER3,
        "letters": [{"text": l[0], "gloss": l[2], "cap": l[3], "cap_en": l[4]} for l in C.LETTERS],
        "pairs": C.PAIRS_V4, "bonds": C.BONDS_V4,
        "others": [{"name": o[0], "msg": o[1], "gloss": o[2], "reply": o[3]} for o in C.OTHERS],
    }

def build_atlas(name, keys, spec):
    EM, CELL, SPREAD, SS = spec
    with Pool(4) as pool:
        results = pool.map(raster, [(entries[k], spec) for k in keys], chunksize=16)
    # shelf pack
    x = y = 0
    rects = []
    for (img, adv) in results:
        if img is None:
            rects.append((0, 0, 0, 0)); continue
        h, w = img.shape
        if x + w > ATLAS_W: x, y = 0, y + CELL
        rects.append((x, y, w, h)); x += w
    H = y + CELL
    H = 1 << (H - 1).bit_length()
    if H > 8192: raise SystemExit(f"{name}: atlas would be {ATLAS_W}x{H}; trim the named lines or the em size")
    atlas = np.zeros((H, ATLAS_W), np.uint8)
    for (img, _), (rx, ry, w, h) in zip(results, rects):
        if img is not None: atlas[ry:ry + h, rx:rx + w] = img
    Image.fromarray(atlas).save(OUT / f"{name}.png", optimize=True)
    atlas.tofile(OUT / f"{name}.r8")
    meta = {
        "cell": CELL, "spread": SPREAD, "em": EM, "width": ATLAS_W, "height": H, "baseline": SPREAD + 0.86 * EM,
        "entries": [[rx, ry, w, h, round(adv, 2)] for (rx, ry, w, h), (_, adv) in zip(rects, results)],
        "styles": [entries[k]["style"] for k in keys],
    }
    (OUT / f"{name}.json").write_text(json.dumps(meta, separators=(",", ":")))
    print(name, len(keys), "entries", ATLAS_W, "x", H)

if __name__ == "__main__":
    main()
