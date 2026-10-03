// CHAPTER THREE · COMPLETE (S13–S17) and FOUR · THE BLANK (S18–S19)
// One request, then everyone's: each void holds an unfinished sentence and a plea to finish it.
// The completions pour into every void; the weightless words replace the unseen weight; the rings go out;
// the galaxy comes apart. Two seconds of nothing. Then everything taken back, and the pens returned.
import { GlyphLayer, MODE } from '../glyphs.js';
import { mulberry32, clamp, lerp, smoothstep, norm, add, sub, scale, cross, len, easeInOut, track, mix3 } from '../math.js';
import { project } from '../camera.js';
import { vCirc } from '../galaxy.js';
import { galT, hudText, hudLine, hudScale, HUD_CYAN } from './common.js';
import { CYAN, HOT, blink } from './cold.js';
import EV from '../events.json' with { type: 'json' };

const UP = [0, -1, 0];
const AMBER_H = [1.0, 0.68, 0.38];
const R = EV.req;
const T_BURST = EV.burst, T_FLOOD = EV.flood, T_ABSORB = EV.absorb, T_COLLAPSE = EV.collapse, T_CUT = EV.cut;
const T_REWIND = EV.rewind, T_BLANK = EV.blank, T_END = EV.blank_end;
const D_FAR = 270;                   // camera distance once every void is in view

export default async function complete(ctx) {
  const { gl, atlasHi: A, corpus, galaxy, W, H } = ctx;
  const named = corpus.named;
  const V = ctx.poses.voidStar, U = ctx.poses.voidDir;
  const { right: RV, up: UV } = ctx.poses.voidFrame;
  const voids = ctx.voids, K = ctx.lensK;
  const story = voids.filter((v) => v.story !== undefined);
  const rnd = mulberry32(1580);
  const wOf = (ids, s) => ids.reduce((a, id) => a + A.adv[id], 0) * s;
  const xs = (ids, s) => { const o = []; let x = 0; for (const id of ids) { o.push(x); x += A.adv[id] * s; } return o; };

  // ---------------------------------------------------------------- requests: ours up close, ten others across the halo
  const preIds = named.request[0].ids;
  const C13 = add(V, scale(U, D_FAR));
  function makeRequest(center, lineIds, s2, s1, preT, lineT) {
    const w2 = wOf(lineIds, s2);
    const base = add(center, scale(RV, -w2 / 2));
    return {
      lineIds, s1, s2, preT, lineT,
      preX: xs(preIds, s1), lineX: xs(lineIds, s2), w2,
      L1: (x) => add(add(base, scale(RV, x)), scale(UV, s2 * 1.9)),
      L2: (x) => add(base, scale(RV, x)),
    };
  }
  const hero = makeRequest(add(V, scale(U, 6)), named.request[1].ids, 0.44, 0.3, R.prefix, R.line);
  hero.unprefix = EV.hero_unprefix;
  const others = story.map((v, j) => {
    const D = len(sub(C13, v.p));
    const t0 = EV.voids_on[j];
    const ids = named.voids[j].ids;
    const preT = preIds.map((_, k) => t0 + 0.35 + k * 0.04);
    const lineT = ids.map((_, k) => t0 + 0.35 + preIds.length * 0.04 + 0.2 + k * 0.05);
    const rq = makeRequest(add(v.p, scale(U, D * 0.03)), ids, 0.0165 * D, 0.0115 * D, preT, lineT);
    rq.unprefix = preIds.map((_, k) => EV.void_unprefix[j] + (preIds.length - 1 - k) * 0.03);
    rq.v = v; rq.on = t0;
    return rq;
  });
  const all = [hero, ...others];

  const texts = new GlyphLayer(gl, A, 6000, { dynamic: true });
  function buildTexts(tS, tU, s19, flare) {
    texts.clear();
    for (const rq of all) {
      const isHero = rq === hero;
      let nPre = 0;
      preIds.forEach((id, j) => {
        if (tS < rq.preT[j]) return;
        if (s19 && tU >= rq.unprefix[j]) return;
        nPre = j + 1;
        const fl = Math.exp(-(tS - rq.preT[j]) * 6);
        texts.push([...rq.L1(rq.preX[j]), rq.s1], [...RV, id], [...mix3(CYAN, HOT, fl), (isHero ? 1.1 : 1.4) + fl]);
      });
      let nL = 0;
      rq.lineIds.forEach((id, j) => {
        if (tS < rq.lineT[j]) return;
        nL = j + 1;
        const fl = Math.exp(-(tS - rq.lineT[j]) * 5);
        texts.push([...rq.L2(rq.lineX[j]), rq.s2], [...RV, id], [...mix3(AMBER_H, [1, 0.9, 0.8], fl), (isHero ? 1.7 : 2.0) + fl * 1.5]);
      });
      // cursor: follows typing; afterwards blinks at the end of the sentence (or of the request while it is erased)
      if (tS < rq.preT[0] - 0.6) continue;
      const typing = tS < rq.lineT[rq.lineT.length - 1] + 0.3;
      const erasing = s19 && tU > rq.unprefix[rq.unprefix.length - 1] - 0.2 && tU < rq.unprefix[0] + 0.3;
      let cx, ch;
      if (erasing) { cx = rq.L1(nPre ? rq.preX[nPre - 1] + A.adv[preIds[nPre - 1]] * rq.s1 : 0); ch = rq.s1 * 1.15; }
      else if (nL === 0 && nPre < preIds.length) { cx = rq.L1(nPre ? rq.preX[nPre - 1] + A.adv[preIds[nPre - 1]] * rq.s1 : 0); ch = rq.s1 * 1.15; }
      else { cx = rq.L2(nL ? rq.lineX[nL - 1] + A.adv[rq.lineIds[nL - 1]] * rq.s2 + rq.s2 * 0.07 : 0); ch = rq.s2 * 1.15; }
      const a = Math.max(typing || erasing ? 1 : 0, blink(tU, 0));
      const glow = 2.4 + flare * 30;
      if (a > 0.001 || flare > 0) texts.push([...add(cx, scale(UV, ch * 0.32)), 1], [...RV, -1], [...HOT, glow * Math.max(a, flare)], [0.055 * ch / 0.5, ch, 0, 0]);
    }
    texts.upload();
  }
  const cursorOf = (rq) => rq.L2(rq.w2 + rq.s2 * 0.07);

  // ---------------------------------------------------------------- the flood: completions pouring from every cursor into every void
  const burst = new GlyphLayer(gl, A, 160000, { mode: MODE.BURST });
  const cands = named.candidates.map((l) => l.ids);
  const emit = (rq, count, sizeK, delayMax, gain = 1) => {
    const origin = cursorOf(rq), sink = rq === hero ? V : rq.v.p;
    const kExp = 0.85, TB = 6.5;
    for (let i = 0; i < count; i++) {
      const u = (i + rnd() * 0.5) / count;
      const birth = T_FLOOD + (rq === hero ? 0 : 0.15 * others.indexOf(rq) + 0.2) + Math.log(1 + u * (Math.exp(kExp * TB) - 1)) / kExp;
      let d = [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1];
      while (len(d) > 1 || len(d) < 0.1) d = [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1];
      d = norm(add(norm(d), scale(U, 0.5)));
      const speed = (6 + Math.pow(rnd(), 1.6) * 60) * sizeK;
      const size = (0.16 + rnd() * 0.3) * sizeK;
      const ids = cands[Math.floor(rnd() * cands.length)];
      const w = wOf(ids, 1);
      const I = (1.0 + rnd() * 1.4) * 1.1 * gain;
      const delay = 0.2 + rnd() * delayMax;
      const jit = [(rnd() - 0.5) * 0.2 * sizeK, (rnd() - 0.5) * 0.2 * sizeK, (rnd() - 0.5) * 0.2 * sizeK];
      let pen = -w / 2;
      for (const id of ids) {
        if (A.meta.entries[id][2] > 0) burst.push([...add(origin, jit), size], [...sink, id], [...CYAN, I], [birth, speed, pen, 0], [...d, delay]);
        pen += A.adv[id];
      }
    }
  };
  emit(hero, 2600, 1.0, 9.5);
  for (const rq of others) emit(rq, 420, Math.max(1.5, rq.s2 / 0.44 * 0.4), 9.0, 0.6);
  // weightless streams during the collapse: cyan lines crossing in dead-straight paths, unbent by any ring
  for (let i = 0; i < 900; i++) {
    const ids = cands[Math.floor(rnd() * cands.length)];
    const w = wOf(ids, 1);
    const birth = T_COLLAPSE - 4 + rnd() * 12;
    const start = add(add(add(V, scale(RV, -420 - rnd() * 80)), scale(UV, (rnd() - 0.5) * 240)), scale(U, (rnd() - 0.6) * 260));
    const size = 1.0 + rnd() * 2.0;
    let pen = -w / 2;
    for (const id of ids) {
      if (A.meta.entries[id][2] > 0) burst.push([...start, size], [0, 0, 0, id], [...CYAN, 1.2], [birth, 60 + rnd() * 40, pen, 1], [...norm(add(RV, scale(UV, (rnd() - 0.5) * 0.04))), 1e9]);
      pen += A.adv[id];
    }
  }
  burst.upload();

  // ---------------------------------------------------------------- camera
  function camAt(t) {
    let d, orbit = 0;
    if (t < T_BURST) d = t < R.line[R.line.length - 1] + 1.2 ? lerp(18, 15, smoothstep(R.t - 0.6, R.line[R.line.length - 1], t))
      : Math.exp(lerp(Math.log(15), Math.log(D_FAR), easeInOut(clamp((t - (R.line[R.line.length - 1] + 1.2)) / 7.8))));
    else if (t < T_COLLAPSE) { d = Math.exp(lerp(Math.log(D_FAR), Math.log(720), easeInOut(smoothstep(T_FLOOD, T_FLOOD + 6.1, t)))); orbit = 0.14 * smoothstep(T_FLOOD - 0.4, T_COLLAPSE, t); }
    else { d = lerp(720, 1500, smoothstep(T_COLLAPSE, T_CUT, t)); orbit = 0.14 + 0.16 * smoothstep(T_COLLAPSE, T_CUT, t); }
    const dir = norm(add(scale(U, Math.cos(orbit)), scale(RV, Math.sin(orbit))));
    const pos = add(V, scale(dir, d));
    const target = mix3(V, [0, 0, 0], smoothstep(T_ABSORB + 2, T_CUT, t) * 0.35);
    const sh = smoothstep(T_COLLAPSE - 2, T_CUT, t) * 0.004 * d;
    const n = (k) => Math.sin(t * 37.1 + k) * 0.6 + Math.sin(t * 61.7 + 2 * k) * 0.4;
    return { pos: add(pos, [n(1) * sh, n(2) * sh, n(3) * sh]), target, d };
  }

  // ---------------------------------------------------------------- lenses: rings go out — the others first, ours last
  const offAt = (v) => (v.hero ? T_COLLAPSE + 4.6 : v.story !== undefined ? T_COLLAPSE + 0.6 + v.story * 0.38 : T_COLLAPSE + 3 + len(sub(v.p, V)) / 500);
  function lensesFor(cam, t) {
    const out = [];
    for (const v of voids) {
      const sp = project(cam, v.p);
      if (!sp) continue;
      const te = (K * v.m) / Math.sqrt(len(sub(v.p, cam.pos)));
      const base = v.hero || v.story !== undefined ? 1 : 0.5;
      const s = base * (1 - smoothstep(offAt(v), offAt(v) + (v.hero ? 1.6 : 0.7), t));
      if (s > 0.001 && sp[0] > -te * 3 && sp[0] < W + te * 3 && sp[1] > -te * 3 && sp[1] < H + te * 3) out.push([sp[0], H - sp[1], te, s]);
    }
    return out;
  }

  function renderAt(c, t, opts = {}) {
    const p = camAt(t);
    if (opts.dPush) { p.pos = add(V, scale(U, opts.dPush)); p.target = V; p.d = opts.dPush; }
    const near = p.d < 40;
    const cam = c.cam({ pos: p.pos, target: p.target, up: UP, fov: 36, focus: near ? p.d - 6 : p.d,
      coc: near ? 0.005 : lerp(0.004, 0.0012, smoothstep(40, 300, p.d)), cocMax: 0.03, nearFade: [0.5, 3], far: 1e5 });
    const T = galT(Math.min(t, T_BURST)) + (t > T_BURST ? (t - T_BURST) * 0.3 : 0);
    const unbind = 280 * Math.pow(smoothstep(T_COLLAPSE + 4.5, T_CUT, t), 1.5);
    const escR = [lerp(900, 120, smoothstep(T_COLLAPSE + 4.5, T_COLLAPSE + 10, t)), lerp(1300, 600, smoothstep(T_COLLAPSE + 4.5, T_COLLAPSE + 10, t))];
    const split = len(sub(V, cam.pos));
    c.scene();
    galaxy.draw(cam, { T, up: UP, unbind, escR, split, splitSide: 1, hazeIntensity: 0.35 });
    c.fg();
    galaxy.draw(cam, { T, up: UP, unbind, escR, split, splitSide: 2, hazeIntensity: 0.35 });
    const flare = t >= T_BURST && t < T_BURST + 1.2 ? Math.exp(-(t - T_BURST) * 4) * smoothstep(T_BURST, T_BURST + 0.05, t) : 0;
    buildTexts(t, opts.uiT ?? t, !!opts.s19, flare);
    texts.draw(cam, { uUp: UV, uIntensity: 1 - smoothstep(T_FLOOD + 2, T_FLOOD + 5, t) * (1 - smoothstep(T_COLLAPSE + 2, T_COLLAPSE + 6, t)) * 0.6 });
    if (t > T_FLOOD - 0.1) burst.draw(cam, { uTime: t, uOrigin: [0, 0, 0], uSinkMode: 1, uAbsorb: t - T_ABSORB, uSwirlAxis: U, uGrow: 0.035 });
    return { lenses: lensesFor(cam, t), coreDark: 1.0, useFg: true };
  }

  // ---------------------------------------------------------------- HUD: the rotation curve gives way
  function hudCollapse(c, tl, t, g) {
    const a = smoothstep(T_COLLAPSE + 3, T_COLLAPSE + 4, t) * (1 - smoothstep(T_CUT - 0.8, T_CUT - 0.1, t));
    if (a <= 0) return 0;
    const k = hudScale(H);
    const x0 = W * 0.73, y0 = H * 0.91, pw = W * 0.2, ph = H * 0.16;
    const X = (r) => x0 + (r / 1050) * pw, Y = (v) => y0 - (v / 2.6) * ph;
    const vPred = (r) => (r < 160 ? vCirc(r) : vCirc(160) * Math.sqrt(160 / r));
    hudLine(g, H, [[x0, y0 - ph], [x0, y0], [x0 + pw, y0]], { alpha: 0.6 * a });
    hudText(g, H, '转速曲线 · ROTATION CURVE', x0, y0 - ph - 14 * k, { size: 11, alpha: 0.75 * a, font: 'JBMono, SansSC', track: 0.1 });
    const pts = [];
    for (let r = 10; r <= 1020; r += 10) pts.push([X(r), Y(vPred(r))]);
    hudLine(g, H, pts, { alpha: 0.8 * a, dash: [7, 6], width: 1.6, color: 'rgba(255,190,120,' });
    const fall = smoothstep(T_COLLAPSE + 4, T_COLLAPSE + 9.5, t);
    for (let i = 0; i < 26; i++) {
      const r = 30 + i * 38;
      const v = lerp(vCirc(r), vPred(r), smoothstep(0, 1, fall * 1.4 - (i / 26) * 0.4));
      g.fillStyle = HUD_CYAN + 0.9 * a + ')';
      g.beginPath(); g.arc(X(r), Y(v), 2.4 * k, 0, Math.PI * 2); g.fill();
    }
    hudText(g, H, `看不见的重量 · UNSEEN WEIGHT  ${Math.round(85 * (1 - fall))}%`, x0, y0 + 30 * k, { size: 15, alpha: 0.95 * a, font: 'JBMono, SansSC', color: 'rgba(255,200,140,', track: 0.06 });
    return 1.3;
  }

  // ---------------------------------------------------------------- shots
  const T_HOLD = EV.voids_on[EV.voids_on.length - 1] + 1.2;     // every request written, every cursor waiting
  const rewindT = (t) => lerp(T_CUT - 0.1, T_HOLD, easeInOut(clamp((t - T_REWIND) / (T_BLANK - T_REWIND))));
  const s19D = (t) => (t < T_BLANK + 0.8 ? D_FAR : t < T_BLANK + 7 ? Math.exp(lerp(Math.log(D_FAR), Math.log(15), easeInOut((t - T_BLANK - 0.8) / 6.2))) : lerp(15, 13.4, smoothstep(T_BLANK + 7, T_END, t)));
  const grade = (t) => ({ bloom: 0.06 + 0.06 * smoothstep(T_BURST, T_BURST + 17, t), streak: 0.08 + 0.12 * smoothstep(T_BURST, T_BURST + 12, t), streakThreshold: 0.8, grain: 0.03, vignette: 0.45,
    sat: 0.92, wb: [0.95, 0.98, 1.05], exposure: track([[R.t - 0.6, 0.5], [T_BURST - 0.1, 0.5], [T_BURST + 0.1, 0.85], [T_BURST + 3, 0.55], [T_ABSORB, 0.45], [T_COLLAPSE - 2, 0.5], [T_COLLAPSE + 1, 0.7], [T_CUT - 0.1, 1.15]], t) });
  const S = (id, s, e, mb, render, extra = {}) => ({ id, start: s, end: e, mb, render, post: (tl, t) => grade(t), ...extra });
  return [
    S('S13', R.t - 0.6, T_BURST, 2, (c, tl, t) => renderAt(c, t)),
    S('S14', T_BURST, T_COLLAPSE, 6, (c, tl, t) => renderAt(c, t)),
    S('S15', T_COLLAPSE, T_CUT, 5, (c, tl, t) => renderAt(c, t), { hud: hudCollapse,
      // the last quarter second overloads to white
      post: (tl, t) => ({ ...grade(t), exposure: grade(t).exposure * (1 + 7 * smoothstep(T_CUT - 0.3, T_CUT, t) ** 2) }) }),
    // overload: time nearly stops; the image drifts on in slow motion and sinks like an afterimage
    { id: 'S16', start: T_CUT, end: T_CUT + 2, mb: 2, render: (c, tl, t) => renderAt(c, T_CUT - 0.05 + (t - T_CUT) * 0.12),
      post: (tl, t) => ({ ...grade(T_CUT), exposure: 1.15 * lerp(8, 1, smoothstep(0, 0.35, tl)), bloom: 0.2 * (1 - smoothstep(0, 1.2, tl)) + 0.06,
        fade: Math.exp(-tl * 2.4) * (1 - smoothstep(1.2, 1.8, tl)), sat: lerp(0.3, 0.9, smoothstep(0, 0.6, tl)), grain: 0.025 }) },
    { id: 'S17', start: T_CUT + 2, end: T_REWIND, mb: 1, render: (c) => { c.scene(); }, post: () => ({ fade: 0, grain: 0.02 }) },
    S('S18', T_REWIND, T_BLANK, 6, (c, tl, t) => renderAt(c, rewindT(t), { uiT: rewindT(t) }), {
      post: (tl, t) => ({ ...grade(rewindT(t)), fade: smoothstep(T_REWIND, T_REWIND + 0.6, t), sat: 0.82 }) }),
    S('S19', T_BLANK, T_END, 2, (c, tl, t) => renderAt(c, T_HOLD, { s19: true, uiT: t, dPush: s19D(t) }), {
      cardY: 0.76, post: (tl, t) => ({ ...grade(T_HOLD), exposure: 0.48 }) }),
  ];
}
