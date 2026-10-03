// OPEN · THE REPLY — S01 21:06 · S02 the cursor · S03 the ask · S04 thinking · S05 the answer · S06 faster ·
// S07 the burst · S08 river → galaxy, and the title.
import { GlyphLayer } from '../glyphs.js';
import { mulberry32, clamp, lerp, smoothstep, easeInOut, easeOutCubic, integrate, norm, add, sub, scale, mix3, len, track } from '../math.js';
import { project } from '../camera.js';
import { Phone } from '../phone.js';
import { CYAN, HOT, AMBER, WARM, blink, Texts } from './common.js';
import EV from '../events.json' with { type: 'json' };

const O = EV.open;
const GLOSS = [0.95, 0.9, 0.84];
const D0 = 17;                                 // AI plane camera distance
const COL_L = -4.6, COL_W = 9.2;
const ASK_S = 0.4, ASK_Y = [2.6, 1.62, 0.64];
const A_S = 0.42, A1_Y = [-0.5, -1.14], A1_GY = -1.7, A2_Y = -2.62, A3_Y = -3.2, A23_S = 0.36;
const NAME_S = 0.3, NAME_SC = 0.12;

export default async function open(ctx) {
  const { gl, atlas, atlasHi: A, corpus, galaxy, W, H } = ctx;
  const tx = new Texts(corpus.named), meta = corpus.v4;
  const rnd = mulberry32(55);
  const wOf = (ids, s = 1) => ids.reduce((a, id) => a + A.adv[id], 0) * s;
  const ink = (id) => A.meta.entries[id][2] > 0;
  const digit = {};
  [...'0123456789.%'].forEach((ch, i) => (digit[ch] = corpus.named.digits[0].ids[i]));

  // ================================================================ S01: the phone at 21:06
  const phone = new Phone(gl, A, tx, meta);
  const fineIds = tx.ids('phone', meta.draft_fine[0]);
  const phoneCam = (t) => {
    const u = smoothstep(0, O.phone_out[0], t);
    return { pos: [lerp(1.0, 0.75, u), lerp(6.6, 6.8, u), lerp(8.2, 7.4, u)], target: [-0.55, 7.3, 0], up: [0, 1, 0], fov: 30,
      focus: 7.9, coc: 0.03, cocMax: 0.05, near: 0.05 };
  };
  function phoneState(t) {
    const keys = O.fine_keys;
    const commit = O.fine_commit, dels = O.fine_del;
    let segs = [], marked = '';
    const typed = keys.filter((e) => e.t <= t && e.k.length === 1);
    if (t < commit) marked = typed.map((e) => e.k).join('');
    else {
      const n = 3 - dels.filter((d) => t >= d).length;
      if (n > 0) segs = [{ ids: fineIds.slice(0, n), col: WARM }];
    }
    const out = smoothstep(O.phone_out[0], O.phone_out[1], t);
    const typing = keys.some((e) => t >= e.t - 0.1 && t < e.t + 0.45);
    const delGone = dels[dels.length - 1];
    return {
      t, scroll: 'bottom', keyboard: 1, keys, I: smoothstep(O.phone_in[0], O.phone_in[1], t) * (1 - out),
      input: { segs, marked, candidate: marked ? fineIds : null, cursor: t > O.phone_out[0] ? 0 : Math.max(typing ? 1 : 0, blink(t, 0)),
        impression: { ids: fineIds, a: t > delGone ? Math.exp(-(t - delGone) / 1.6) : 0 },
        gloss: { ids: tx.ids('gloss', meta.draft_fine[1]), a: smoothstep(commit + 0.3, commit + 0.8, t) * (1 - smoothstep(dels[0] - 0.4, dels[0], t)) } },
    };
  }

  // ================================================================ the AI window (a plane at z = 0)
  const ui = new GlyphLayer(gl, A, 16000, { dynamic: true });
  const KICK = O.burst;
  const BC = [0, -0.6, 0];                    // where the burst comes from
  const kickV = (p, k = 1) => {
    const d = sub(p, BC);
    const l = Math.max(0.3, Math.hypot(d[0], d[1]));
    const sp = (6 + 20 * rnd()) * k;
    return [(d[0] / l) * sp, (d[1] / l) * sp * 0.8, (8 + 26 * rnd()) * k];
  };
  // one glyph that will shatter at the burst
  const P = (p, s, id, col, I, blur = 0) => ui.push([p[0], p[1], p[2] || 0, s], [1, 0, 0, id], [...col, I], [0, 0, blur, 0], [...kickV(p), -1e4]);
  const line = (ids, x, y, s, col, I, z = 0) => { if (I <= 0.002) return; let pen = x; for (const id of ids) { if (ink(id)) P([pen, y, z], s, id, col, I); pen += A.adv[id] * s; } };
  const rect = (x, y, w, h, col, I) => { if (I > 0.002) ui.push([x, y, 0, 1], [1, 0, 0, -1], [...col, I], [w, h, 0, 0], [...kickV([x, y, 0], 0.7), -1e4]); };
  const cursor = (x, y, h, a, col = HOT) => rect(x, y + h * 0.32, 0.055 * (h / 0.48), h, col, 2.4 * a);
  function pushNumber(v, x, y, s, col, I) { for (const ch of v.toFixed(2)) { P([x, y, 0], s, digit[ch], col, I); x += A.adv[digit[ch]] * s; } }

  // probabilities flicker, then the winner pulls away (from the v3 cold open)
  function probs(p0, tau, dur, seed) {
    const u = clamp((tau - 0.25 * dur) / (0.75 * dur));
    const r = mulberry32(seed + Math.floor(tau * 14));
    const lg = p0.map((p, j) => Math.log(p) + (r() - 0.5) * 1.6 * (1 - u) + (j === 0 ? u * u * 2.4 : 0));
    const mx = Math.max(...lg);
    const ex = lg.map((x) => Math.exp(x - mx));
    const sum = ex.reduce((a, b) => a + b, 0);
    return ex.map((x) => x / sum);
  }
  // a fan of candidates under (or above) a token while it is being chosen
  function fan(x, y, cands, p0, t, t0, lock, size, dir, I, seed) {
    const tau = t - t0, lockT = t - lock, dur = lock - t0;
    if (tau < 0 || lockT > 0.9) return;
    const pr = probs(p0, tau, dur, seed);
    const maxW = Math.max(...cands.map((c) => wOf(c, size)));
    const xBar = x + maxW + size * 1.5;
    const rowH = size * 1.65;
    cands.forEach((ids, r) => {
      if (r === 0 && lockT >= 0) return;
      const fanIn = smoothstep(0.04 * r, 0.04 * r + 0.22, tau);
      const ry = y + dir * (size * 2.6 + r * rowH);
      const scatter = r > 0 ? smoothstep(0, 0.8, lockT) : 0;
      const p = pr[r];
      const a = (0.5 + 1.5 * p) * fanIn * (1 - scatter) * I;
      if (a <= 0.003) return;
      const rr = mulberry32(seed * 7 + r);
      let pen = x;
      for (const id of ids) {
        const s2 = scatter * scatter;
        if (ink(id)) P([pen + (rr() - 0.5) * 1.4 * s2, ry + (rr() - 0.4) * 0.9 * s2, (1 + rr() * 4) * s2], size, id, CYAN, a);
        pen += A.adv[id] * size;
      }
      const barA = fanIn * (1 - smoothstep(0, 0.4, lockT)) * I;
      if (barA > 0.003) {
        rect(xBar, ry + size * 0.3, Math.max(0.006, size * 14 * p), size * 0.32, CYAN, (0.3 + p) * barA);
        rect(xBar, ry + size * 0.3, size * 14, size * 0.05, CYAN, 0.1 * barA);
        pushNumber(p, xBar + size * 14.6, ry, size * 0.8, CYAN, (0.4 + 0.6 * p) * barA);
      }
    });
  }

  // ---- the name, typed into the footer (small): Claude · Opus · 5.5 · 出品 PRESENTS
  let k = 0;
  const nameCands = corpus.opening.map((o) => o.cands.map(() => corpus.named.opening[k++].ids));
  const nameP = corpus.opening.map((o) => o.cands.map((c) => c[1]));
  const subIds = corpus.named.opening[k].ids;
  const nameW = nameCands.map((c) => wOf(c[0], NAME_S));
  const nameTot = nameW.reduce((a, b) => a + b, 0) + NAME_S * 0.3 * 2;
  function footer(t, cx, cy) {
    const x0 = cx - nameTot / 2, y0 = cy - 3.85;
    const dim = 1 - 0.6 * smoothstep(O.sub[0] + 1.6, O.sub[0] + 3.0, t);
    let x = x0, endX = x0;
    for (let i = 0; i < 3; i++) {
      const t0 = O.name[i], lock = t0 + O.name_lock;
      if (t >= lock) {
        const fl = Math.exp(-Math.max(0, t - lock - 0.1) * 4);
        line(nameCands[i][0], x, y0, NAME_S, mix3(CYAN, HOT, fl), (1.1 + fl * 2.5) * dim);
        endX = x + nameW[i];
      }
      fan(x, y0, nameCands[i], nameP[i], t, t0, lock, NAME_SC, 1, 1, 300 + i);
      x += nameW[i] + NAME_S * 0.3;
    }
    const sw = wOf(subIds, NAME_S * 0.55);
    subIds.forEach((id, j) => {
      const tc = O.sub[0] + j * O.sub[1];
      if (t < tc) return;
      const fl = Math.exp(-(t - tc) * 5);
      if (ink(id)) P([cx - sw / 2 + wOf(subIds.slice(0, j), NAME_S * 0.55), y0 - NAME_S * 1.15, 0], NAME_S * 0.55, id, mix3(CYAN, HOT, fl), (0.8 + fl * 2) * dim);
    });
    // its own small cursor while the name is written
    const busy = t >= O.name[0] - 0.4 && t < O.sub[0] + subIds.length * O.sub[1] + 0.3;
    if (busy) {
      const typingSub = t >= O.sub[0] - 0.1;
      const cxp = typingSub ? cx - sw / 2 + wOf(subIds.slice(0, clamp(Math.floor((t - O.sub[0]) / O.sub[1]) + 1, 0, subIds.length)), NAME_S * 0.55) + 0.03 : endX + 0.04;
      cursor(cxp, typingSub ? y0 - NAME_S * 1.15 : y0, typingSub ? NAME_S * 0.6 : NAME_S * 1.1, 1);
    }
  }

  // ---- the ask (human, amber), typed in chunks
  const askIds = meta.ask.map(([zh]) => tx.ids('ask', zh));
  const askGloss = meta.ask.map(([, en]) => tx.ids('gloss', en));
  const lineDone = [0, 1, 2].map((li) => O.ask.filter((c) => c.line === li).pop().t);
  function askState(t) {
    const n = [0, 0, 0];
    for (const c of O.ask) if (t >= c.t) n[c.line] = c.n;
    return n;
  }

  // ---- the answers (AI, cyan), token by token
  const tokIds = (s) => tx.ids('tokens', s);
  function layoutTokens(toks, s, y0, lh, x0 = COL_L, width = COL_W) {
    const out = []; let x = x0, y = y0;
    for (const tk of toks) {
      const ids = tokIds(tk), w = wOf(ids, s);
      if (x + w > x0 + width + 1e-6) { x = x0; y -= lh; }
      out.push({ ids, x, y, w }); x += w;
    }
    return out;
  }
  const a1 = layoutTokens(meta.answer1.map((a) => a.tok), A_S, A1_Y[0], A1_Y[0] - A1_Y[1]);
  const a1c = meta.answer1.map((a) => a.cands.map(([c]) => tokIds(c)));
  const a1p = meta.answer1.map((a) => a.cands.map(([, p]) => p));
  const a1en = meta.answer1_en.map((l) => tx.ids('gloss', l));
  const a2 = layoutTokens(meta.answer2, A23_S, A2_Y, 0.6);
  const a3 = layoutTokens(meta.answer3, A23_S, A3_Y, 0.6);
  // quick alternatives for the fast replies: other words from the same replies
  const altPool = [...new Set([...meta.answer2, ...meta.answer3, '我', '你', '最近', '还好', '没事', '都好'])].filter((s) => corpus.named.tokens.some((l) => l.text === s));
  const altFor = (i) => [0, 1, 2].map((j) => tokIds(altPool[(i * 5 + j * 3) % altPool.length]));

  function answers(t) {
    // A1: deliberate, then readable
    a1.forEach((tk, i) => {
      const ev = O.a1[i];
      if (t >= ev.lock) {
        const fl = Math.exp(-Math.max(0, t - ev.lock) * 4.5);
        line(tk.ids, tk.x, tk.y, A_S, mix3(CYAN, HOT, fl), (1.25 + fl * 2.2) * (1 + 0.5 * smoothstep(O.tree[0], O.burst, t)));
      }
      fan(tk.x, tk.y, a1c[i], a1p[i], t, ev.t, ev.lock, i === 2 ? 0.2 : 0.16, -1, i === 2 ? 1 : 0.8, 10 + i);
    });
    const enA = smoothstep(O.a1_en, O.a1_en + 0.6, t) * (1 - smoothstep(O.tree[0] + 1.0, O.tree[0] + 2.4, t));
    a1en.forEach((ids, i) => line(ids, COL_L, A1_GY - i * 0.3, 0.2, GLOSS, 0.75 * enA));
    // A2, A3: faster than the fans can settle
    const fast = (toks, times, seed) => toks.forEach((tk, i) => {
      const t0 = times[i], lock = t0 + 0.07;
      if (t >= lock) { const fl = Math.exp(-(t - lock) * 6); line(tk.ids, tk.x, tk.y, A23_S, mix3(CYAN, HOT, fl), 1.0 + fl * 1.6); }
      if (t >= t0 - 0.02 && t < lock + 0.25) altFor(seed + i).forEach((ids, r) => line(ids, tk.x, tk.y - 0.36 - r * 0.2, 0.13, CYAN, 0.6 * (1 - smoothstep(lock, lock + 0.25, t))));
    });
    fast(a2, O.a2, 40); fast(a3, O.a3, 80);
    // where the AI's cursor is
    let cx = COL_L, cy = A1_Y[0], ch = A_S * 1.15;
    const doneIdx = O.a1.filter((e) => t >= e.lock).length;
    if (doneIdx > 0) { const tk = a1[doneIdx - 1]; cx = tk.x + tk.w + 0.04; cy = tk.y; }
    const a2n = O.a2.filter((x) => t >= x + 0.07).length, a3n = O.a3.filter((x) => t >= x + 0.07).length;
    if (a2n) { const tk = a2[a2n - 1]; cx = tk.x + tk.w + 0.04; cy = tk.y; ch = A23_S * 1.15; }
    if (a3n) { const tk = a3[a3n - 1]; cx = tk.x + tk.w + 0.04; cy = tk.y; ch = A23_S * 1.15; }
    return { cx, cy, ch };
  }

  // ---- more replies: all over the screen, one after another, then more and more — each written token by token
  const blocks = new GlyphLayer(gl, A, 40000);
  const pool = corpus.named.tree.map((l) => ({ text: l.text, ids: l.ids }));
  const dadComma = [...tokIds('爸'), ...tokIds('，')];
  // cut a reply into tokens of one or two characters; punctuation stands alone
  const PUNCT = '，。？！、…';
  const toTokens = (text, ids) => {
    const chars = [...text], out = [];
    for (let i = 0; i < chars.length;) {
      const m = !PUNCT.includes(chars[i]) && i + 1 < chars.length && !PUNCT.includes(chars[i + 1]) && rnd() < 0.55 ? 2 : 1;
      out.push(ids.slice(i, i + m)); i += m;
    }
    return out;
  };
  const T0 = O.tree[0] + 0.3, TB = O.burst;
  const camDAt = (t) => lerp(D0, 25, easeInOut(smoothstep(O.tree[0] - 0.5, O.burst, t)));
  const camYAt = (t) => lerp(-0.25, -1.0, smoothstep(O.tree[0] - 0.5, O.burst, t));
  const tanV = Math.tan((15 * Math.PI) / 180), asp = W / H;
  const replyBlocks = [];
  const placed = [];
  for (let k = 0; ; k++) {
    const born = T0 + 0.5 * Math.log2(k + 1);          // twice as many every half second
    if (born > TB - 0.25 || k > 170) break;
    const src = pool[(k * 7 + 3) % pool.length];                       // the same replies come back: there are only so many
    const toks = [dadComma.slice(0, 1), dadComma.slice(1), ...toTokens(src.text, src.ids)];
    const D = camDAt(born), cy = camYAt(born);
    const z = -lerp(1.0, 26, Math.pow(k / 170, 0.8)) * (0.65 + 0.35 * rnd());
    const half = (D - z) * tanV;
    const size = 0.34 * ((D - z) / D) * (0.8 + 0.3 * rnd());
    // somewhere free on screen: the near ones keep clear of the first reply's column
    let best = null, bestD = -1;
    for (let tries = 0; tries < 24; tries++) {
      const sx = (rnd() * 2 - 1) * 0.88, sy = (rnd() * 2 - 1) * 0.8;
      if (k < 40 && Math.abs(sx * half * asp) < 6.2 * ((D - z) / D) && sy > -0.85 && sy < 0.75) continue;
      let md = 9;
      for (const q of placed) md = Math.min(md, Math.hypot((q[0] - sx) * asp, q[1] - sy) / (0.6 + 0.4 * q[2]));
      if (md > bestD) { bestD = md; best = [sx, sy]; }
    }
    if (!best) best = [rnd() < 0.5 ? -0.75 : 0.75, (rnd() - 0.5) * 1.2];
    placed.push([best[0], best[1], Math.min(1, size / 0.3)]);
    const x0 = best[0] * half * asp - 3.2 * size, y0 = cy + best[1] * half;
    const rate = lerp(5, 24, smoothstep(T0, TB, born));
    const I = lerp(1.0, 0.55, Math.pow(k / 170, 0.6));
    const glyphsOut = [];
    let x = x0, y = y0, tc = born;
    const wrapW = 10 * size;
    for (const tk of toks) {
      const w = tk.reduce((a_, id) => a_ + A.adv[id], 0) * size;
      if (x + w > x0 + wrapW && x > x0) { x = x0; y -= size * 1.5; }
      for (const id of tk) {
        if (ink(id)) {
          const p = [x, y, z];
          blocks.push([p[0], p[1], p[2], size], [1, 0, 0, id], [...CYAN, I], [0, 0, 0, rnd()], [...kickV(p, 0.9), tc]);
          glyphsOut.push(p);
        }
        x += A.adv[id] * size;
      }
      tc += 1 / rate;
      if (tc > TB) break;
    }
    replyBlocks.push({ born, end: tc, z, size, glyphs: glyphsOut, toks, x0, y0, wrapW, rate, I });
  }
  blocks.upload();
  // each block's cursor while it writes
  function blockCursors(t) {
    for (const b of replyBlocks) {
      if (t < b.born - 0.1 || t > b.end + 0.25 || t >= KICK) continue;
      let x = b.x0, y = b.y0, n = 0;
      const done = Math.floor((t - b.born) * b.rate) + 1;
      for (const tk of b.toks) {
        if (n >= done) break;
        const w = tk.reduce((a_, id) => a_ + A.adv[id], 0) * b.size;
        if (x + w > b.x0 + b.wrapW && x > b.x0) { x = b.x0; y -= b.size * 1.5; }
        x += w; n++;
      }
      const h = b.size * 1.15;
      ui.push([x + 0.03 * b.size, y + h * 0.32, b.z, 1], [1, 0, 0, -1], [...HOT, 2.0 * b.I], [0.055 * (h / 0.48), h, 0, 0], [...kickV([x, y, b.z], 0.9), -1e4]);
    }
  }
  const blockPts = replyBlocks.flatMap((b) => b.glyphs);

  // ---- shards: amber human words inside every cyan one (galaxy atlas)
  const shards = new GlyphLayer(gl, atlas, 40000);
  const lay = ['digital', 'print', 'classical'].map((n) => corpus.layers[n]);
  for (let i = 0; i < 22000; i++) {
    const src = lay[i % 3][Math.floor(rnd() * lay[i % 3].length)];
    const id = src[Math.floor(rnd() * src.length)];
    if (!(atlas.meta.entries[id][2] > 0)) continue;
    const fromBlock = blockPts.length && rnd() < 0.6;
    const q = fromBlock ? blockPts[Math.floor(rnd() * blockPts.length)] : null;
    const p = fromBlock ? [q[0] + (rnd() - 0.5) * 0.3, q[1] + (rnd() - 0.5) * 0.3, q[2]] : [COL_L + rnd() * COL_W, 3 - rnd() * 6.5, (rnd() - 0.5) * 0.4];
    const d = sub(p, BC), l = Math.max(0.4, Math.hypot(d[0], d[1]));
    const sp = 3 + Math.pow(rnd(), 0.8) * 22;
    const v = [(d[0] / l) * sp, (d[1] / l) * sp * 0.75, 3 + rnd() * 12];
    const c = 0.8 + rnd() * 0.35;
    shards.push([p[0], p[1], p[2], 0.1 + rnd() * 0.18], [1, 0, 0, id], [AMBER[0], AMBER[1] * c, AMBER[2] * c, 0.5 + rnd() * 0.9], [0, 0, 0, rnd()], [...v, KICK + rnd() * 0.06]);
  }
  shards.upload();

  // far behind: a few out-of-focus amber words — what the AI is made of, waiting
  const bokeh = new GlyphLayer(gl, atlas, 900, { dynamic: true });
  const bk = [];
  for (let i = 0; i < 70; i++) {
    const L = lay[i % 3][Math.floor(rnd() * lay[i % 3].length)];
    const z = -60 - rnd() * 200;
    bk.push({ id: L[0], p: [(rnd() - 0.5) * 2.4 * -z * 0.6, (rnd() - 0.5) * -z * 0.55, z], s: 0.7 + rnd() * 0.8, I: 0.5 + rnd() * 0.9 });
  }
  function buildBokeh(t, toward) {
    bokeh.clear();
    const u = smoothstep(O.think[0], O.burst, t);
    for (const b of bk) {
      const p = [lerp(b.p[0], toward[0] + (b.p[0] - toward[0]) * 0.35, u), lerp(b.p[1], toward[1] + (b.p[1] - toward[1]) * 0.35, u), b.p[2] * lerp(1, 0.55, u)];
      bokeh.push([...p, b.s], [1, 0, 0, b.id], [...AMBER, b.I]);
    }
    bokeh.upload();
  }

  // ---- the AI camera
  const startXY = [COL_L, ASK_Y[0] + 0.15];
  function aiCam(t) {
    const u = smoothstep(O.ask[0].t, lineDone[0] + 0.6, t);
    let cx = lerp(startXY[0], 0, u), cy = lerp(startXY[1], -0.25, u);
    const pull = smoothstep(O.tree[0] - 0.5, O.burst, t);
    const into = smoothstep(O.burst, O.burst + 1.6, t);
    let D = lerp(D0, 25, easeInOut(pull)) * Math.exp(-1.1 * easeInOut(into));
    cy = lerp(cy, -1.0, pull);
    const shake = t > O.burst ? Math.exp(-(t - O.burst) * 3) * 0.12 : 0;
    cx += Math.sin(t * 47) * shake; cy += Math.sin(t * 61 + 1) * shake;
    return { pos: [cx, cy, D], target: [cx, cy, 0], fov: 30, focus: D, coc: lerp(0.024, 0.011, pull), cocMax: 0.03, near: 0.05, nearFade: [1.0, 4.0] };
  }

  function buildAI(t) {
    ui.clear();
    const cam = aiCam(t);
    footer(t, cam.pos[0], cam.pos[1]);
    // the ask
    const n = askState(t);
    const sent = t >= O.ask_send;
    askIds.forEach((ids, li) => {
      if (!n[li]) return;
      line(ids.slice(0, n[li]), COL_L, ASK_Y[li], ASK_S, WARM, sent ? 0.95 : 1.15);
      const ga = smoothstep(lineDone[li] + 0.25, lineDone[li] + 0.8, t);
      line(askGloss[li], COL_L, ASK_Y[li] - 0.38, 0.19, GLOSS, 0.65 * ga);
    });
    // the main cursor: arriving from the phone, waiting, the ask, thinking, the answers
    let c = null;
    const typingAsk = O.ask_keys.some((x) => t >= x - 0.05 && t < x + 0.4);
    if (t < O.ask[0].t) c = { x: startXY[0], y: ASK_Y[0], h: ASK_S * 1.15, a: t < O.cursor_fly[1] ? 1 : blink(t, O.tick0) };
    else if (!sent) {
      const li = n[2] ? 2 : n[1] ? 1 : 0;
      c = { x: COL_L + wOf(askIds[li].slice(0, n[li]), ASK_S) + 0.04, y: ASK_Y[li], h: ASK_S * 1.15, a: typingAsk ? 1 : blink(t, O.tick0) };
    } else if (t < O.think[1]) {
      const br = 0.55 + 0.45 * Math.sin((t - O.think[0]) * 3.2);
      c = { x: COL_L, y: A1_Y[0], h: A_S * 1.15, a: t < O.think[0] ? blink(t, O.tick0) : br };
    }
    const a = answers(t);
    if (!c && t < O.burst) c = { x: a.cx, y: a.cy, h: a.ch, a: 1 };
    if (c) cursor(c.x, c.y, c.h, c.a);
    blockCursors(t);
    ui.upload();
    return cam;
  }

  // ================================================================ S07–S08: lanes, then the river in the galaxy
  const camD = 8;
  const tanH = Math.tan((15 * Math.PI) / 180), hh = camD * tanH, hw = hh * (W / H);
  const lanes = new GlyphLayer(gl, atlas, 30000, { dynamic: true });
  const laneDefs = [];
  { const r2 = mulberry32(909);
    const src = [...corpus.layers.digital, ...corpus.layers.print.slice(0, 400), ...corpus.layers.classical.slice(0, 400)];
    for (let li = 0; li < 30; li++) {
      const y = -hh * 1.15 + (li + 0.5) * ((hh * 2.0) / 22) + (r2() - 0.5) * 0.1;
      const z = -(y + hh * 1.15) * 2.2 + (r2() - 0.5) * 1.5;
      const span = ((camD - z) * tanH * (W / H)) * 2.8;
      const em = 0.22 + r2() * 0.1;
      const gl_ = []; let x = 0;
      while (x < span) {
        for (const id of src[Math.floor(r2() * src.length)]) { if (atlas.meta.entries[id][2] > 0) gl_.push([x, id]); x += atlas.adv[id] * em; }
        x += em * (1.5 + r2() * 3);
      }
      laneDefs.push({ y, z, em, glyphs: gl_, span: x, speed: 0.7 + r2() * 0.8, phase: r2() * x, bright: 0.6 + r2() * 0.7, hwL: (camD - z) * tanH * (W / H) * 1.3 });
    }
  }
  function buildLanes(t) {
    lanes.clear();
    const inA = smoothstep(O.river, O.river + 0.9, t);
    if (inA > 0) {
      const flow = Math.pow(Math.max(0, t - O.river + 1.2), 2.0) * 1.6;
      for (const L of laneDefs) for (const [gx, id] of L.glyphs) {
        const x = (((gx + L.phase + flow * L.speed) % L.span) + L.span) % L.span - L.span / 2;
        if (Math.abs(x) > L.hwL) continue;
        const v = 0.8 + 0.35 * ((gx * 7.3) % 1);
        lanes.push([x, L.y, L.z, L.em], [1, 0, 0, id], [AMBER[0], AMBER[1] * v, AMBER[2] * v, inA * 0.9 * L.bright]);
      }
    }
    lanes.upload();
  }

  // the river becomes an arm of the galaxy (v3's S04, a little quicker)
  const pickLine = galaxy.lines.find((l) => l.era === 3 && l.r > 770 && l.r < 790 && Math.abs(l.y) < 1.2) || galaxy.lines[0];
  const R0 = pickLine.r, YL = pickLine.y;
  const G0 = O.galaxy, RIVER_LEN = O.end - O.galaxy - 1.5;
  const grate = (u) => lerp(5.0, 0.15, smoothstep(0.4, 5.5, u));
  const Tg = (tl) => integrate(grate, tl, 1 / 120);
  const radAt = (ph) => [Math.cos(ph), 0, Math.sin(ph)];
  const tanAt = (ph) => [-Math.sin(ph), 0, Math.cos(ph)];
  const ph = pickLine.phase + 0.004;
  const anchor = add(scale(radAt(ph), R0 - 2.6), [0, YL + 0.9, 0]);
  const al = (38 * Math.PI) / 180;
  const fwd0 = norm(add(scale(tanAt(ph), Math.cos(al)), scale(radAt(ph), Math.sin(al))));
  function riverCam(tl) {
    const lp = easeInOut(clamp((tl - 0.6) / (RIVER_LEN - 0.6)));
    const d = Math.exp(lerp(Math.log(9), Math.log(1550), lp));
    const target = mix3(add(anchor, scale(fwd0, 9)), [0, 210, 0], smoothstep(0.12, 0.8, lp));
    const uS = norm(add(scale(fwd0, -1), [0, 0.12, 0]));
    const uE = norm(add(scale(radAt(ph - 0.35), Math.cos(0.42)), [0, Math.sin(0.42), 0]));
    const u = norm(mix3(uS, uE, smoothstep(0.05, 0.95, lp)));
    const pos = add(target, scale(u, d));
    return { pos: [pos[0], pos[1] + Math.sin(tl * 0.7) * 0.15 * (1 - lp), pos[2]], target, d, lp };
  }

  // ================================================================ render
  function renderPhone(c, t) {
    phone.build(phoneState(t));
    const cam = c.cam(phoneCam(t));
    c.scene();
    phone.draw(cam);
    // the cursor leaves the phone and becomes the AI's
    if (t >= O.cursor_fly[0]) {
      const sp = project(cam, phone.cursorAt);
      const ac = aiCam(O.ask[0].t - 0.01);
      const camA = c.cam(ac);
      const th = Math.tan((camA.fov * Math.PI) / 360);
      const from = sp ? [ac.pos[0] + ((2 * sp[0]) / W - 1) * th * ac.pos[2] * (W / H), ac.pos[1] + (1 - (2 * sp[1]) / H) * th * ac.pos[2]] : startXY;
      const u = easeInOut(clamp((t - O.cursor_fly[0]) / (O.cursor_fly[1] - O.cursor_fly[0])));
      ui.clear();
      const x = lerp(from[0] - 0.03, startXY[0], u), y = lerp(from[1] - 0.25, ASK_Y[0], u);
      const hgt = lerp(1.0, ASK_S * 1.15, u);
      rect(x, y + hgt * 0.32, 0.055 * (hgt / 0.48), hgt, mix3([1, 0.95, 0.88], HOT, u), 2.4);
      ui.upload();
      ui.draw(camA);
    }
  }

  function renderAI(c, t) {
    const ac = buildAI(t);
    const cam = c.cam(ac);
    buildBokeh(t, [COL_L, A1_Y[0], -40]);
    c.scene();
    bokeh.draw(cam, { uIntensity: smoothstep(O.tick0, O.tick0 + 5, t) * 0.75 * (1 - smoothstep(O.burst, O.burst + 0.4, t)) });
    const kick = { uReveal: 1, uKickT: KICK, uKickDrag: 1.2, uKickFlash: 1.2, uKillAt: [0.06, 0.4], uTime: t };
    ui.draw(cam, kick);
    blocks.draw(cam, { ...kick, uRevealFlash: 1.6, uRevealFade: 0.06 });
    if (t >= KICK) {
      shards.draw(cam, { uReveal: 1, uKickT: KICK, uKickDrag: lerp(0.9, 2.6, smoothstep(KICK, O.river + 0.6, t)), uTime: t, uRevealFade: 0.05,
        uIntensity: 1 - smoothstep(O.river + 0.2, O.galaxy - 0.1, t) });
      buildLanes(t);
      const lc = c.cam({ pos: [0, 0, camD], target: [0, 0, 0], fov: 30, focus: camD, coc: 0.03, cocMax: 0.06, nearFade: [camD * 0.12, camD * 0.45] });
      lanes.draw(lc);
    }
    // the shockwave: a ring of bent light racing outward
    const age = t - KICK;
    const lenses = age > 0 && age < 0.8 ? [[W / 2, H * 0.55, lerp(0.02, 0.9, Math.sqrt(age / 0.8)) * W, 0.04 * (1 - age / 0.8)]] : [];
    return { lenses, ringGain: 0.6 };
  }

  function renderGalaxy(c, t) {
    const tl = t - G0;
    const rc = riverCam(tl);
    const cam = c.cam({ pos: rc.pos, target: rc.target, fov: lerp(40, 36, rc.lp), focus: lerp(11, rc.d, smoothstep(0, 0.4, rc.lp)),
      coc: lerp(0.022, 0.0015, smoothstep(0, 0.5, rc.lp)), cocMax: 0.05, nearFade: [0.8, 3.0], far: 1e5 });
    c.scene();
    galaxy.draw(cam, { T: Tg(tl), intensity: lerp(0.38, 1.0, smoothstep(0.1, 0.5, rc.lp)), hazeIntensity: smoothstep(0.15, 0.6, rc.lp) });
  }

  const gradeAI = (t) => ({ bloom: 0.07 + 0.03 * smoothstep(O.tree[0], O.burst, t), streak: 0.22 + 0.08 * smoothstep(O.tree[0], O.burst, t), streakThreshold: 0.6,
    grain: 0.03, vignette: 0.45, exposure: (1 - 0.25 * smoothstep(O.tree[0], O.burst, t)) * (1 + 0.5 * Math.exp(-Math.max(0, t - KICK) * 6) * (t > KICK ? 1 : 0)) });
  const shotAI = (id, s, e, mb) => ({ id, start: s, end: e, mb, render: (c, tl, t) => renderAI(c, t), post: (tl, t) => gradeAI(t) });
  ctx.poses.openEnd = riverCam(O.end - G0);
  return [
    { id: 'S01', start: 0, end: O.cursor_fly[1], mb: 2, render: (c, tl, t) => renderPhone(c, t),
      post: (tl, t) => ({ bloom: 0.06, streak: 0.06, streakThreshold: 0.9, grain: 0.025, vignette: 0.5, fade: smoothstep(O.phone_in[0] - 0.4, O.phone_in[1], t) }) },
    shotAI('S02', O.cursor_fly[1], O.ask[0].t - 0.3, 1),
    shotAI('S03', O.ask[0].t - 0.3, O.ask_send + 0.3, 1),
    shotAI('S04', O.ask_send + 0.3, O.think[1], 1),
    shotAI('S05', O.think[1], O.a1_en + 0.6, 1),
    shotAI('S06', O.a1_en + 0.6, O.burst, 4),
    shotAI('S07', O.burst, G0, 6),
    { id: 'S08', start: G0, end: O.end, mb: 4, cardY: 0.3, render: (c, tl, t) => renderGalaxy(c, t),
      post: () => ({ bloom: 0.08, streak: 0.18, streakThreshold: 0.8, grain: 0.028, vignette: 0.4, sat: 1.12 }) },
  ];
}
