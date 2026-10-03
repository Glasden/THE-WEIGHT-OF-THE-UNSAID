// CHAPTER ONE · BACK AND FORTH — S09 the outer arm (people writing to each other) · S10 scrolling up to 2015 ·
// S11 the classics: letters home · S12 2019 · S13 the core: the oldest letter · S14 these years, back to tonight ·
// S15 above the galaxy. Galaxy legs fly inward through time; the phone visits scroll forward to tonight.
// The bridges: a line of people's words ahead in the galaxy becomes a bubble, and the phone forms around it;
// leaving, the phone fades but for its last line, which the next flight passes on its way.
import { GlyphLayer } from '../glyphs.js';
import { mulberry32, clamp, lerp, smoothstep, norm, add, sub, scale, cross, dot, len, mix3, easeInOut, easeOutCubic, track } from '../math.js';
import { Phone, placement, scrollTrack } from '../phone.js';
import { WARM, Texts, clock } from './common.js';
import EV from '../events.json' with { type: 'json' };

const H = EV.history;
const UP = [0, -1, 0];                         // as in v3: galactic -Y is up, so lines read left-to-right flying inward
const CLS = [1.0, 0.64, 0.32], GLOSS = [0.95, 0.9, 0.84], CAP = [1.0, 0.86, 0.72];
const PS = 0.8;                                // phone scale in the galaxy: its words the size of the lines around it

const slerp = (a, b, u) => norm(add(scale(a, 1 - u), scale(b, u)));

export default async function history(ctx) {
  const { gl, atlasHi: A, corpus, galaxy } = ctx;
  const tx = new Texts(corpus.named), meta = corpus.v4, named = corpus.named;
  const rnd = mulberry32(505);
  const wOf = (ids, s) => ids.reduce((a, id) => a + A.adv[id], 0) * s;
  const [G1, P1, G2, P2, G3, P3, R] = H.seg;

  // ---------------------------------------------------------------- the three legs: radial flights inward
  const legs = [
    { seg: G1, r0: 992, th0: 0.9, y0: -18, speed: (u) => 2.2 },
    { seg: G2, r0: 405, th0: 2.35, y0: -9, speed: (u) => (u < 4.2 ? 3.4 : 0.6) },
    { seg: G3, r0: 236, th0: 4.1, y0: -36, tilt: -0.34, speed: (u) => (u < 1.6 ? 3.0 : 0.15) },
  ];
  for (const L of legs) {
    const dur = L.seg[2] - L.seg[1] + 1.5, N = Math.ceil(dur * 240);
    const tab = [L.r0];
    // every flight starts from rest: it begins where the last phone visit left the camera
    for (let i = 1; i <= N; i++) { const u = (i - 0.5) / 240; tab.push(tab[i - 1] - (L.speed(u) * smoothstep(0, 1.8, u)) / 240); }
    L.rOf = (u) => { const f = clamp(u * 240, 0, N - 1.001), i = Math.floor(f); return lerp(tab[i], tab[i + 1], f - i); };
  }
  const inDisk = (L, u) => {
    const r = L.rOf(u), th = L.th0 + u * 0.0012 + 0.01 * Math.sin(u * 0.21);
    return [r * Math.cos(th), L.y0 + 0.5 * Math.sin(u * 0.45) + 0.25 * Math.sin(u * 1.1 + 1), r * Math.sin(th)];
  };
  // heading from the path without its sway: slow stretches must not let the drift steer the camera
  const baseAt = (L, u) => { const r = L.rOf(u), th = L.th0 + u * 0.0012; return [r * Math.cos(th), L.y0, r * Math.sin(th)]; };
  function legFrame(L, u) {
    const p = inDisk(L, u);
    const path = norm(sub(baseAt(L, u + 1.0), baseAt(L, u)));
    const side = norm(cross(path, UP));
    let fwd = norm(add(scale(path, Math.cos(0.18)), scale(side, Math.sin(0.18))));
    fwd = norm(add(fwd, scale(UP, L.tilt ?? 0.15)));
    const right = norm(cross(fwd, UP));
    return { pos: p, fwd, path, right, up: cross(right, fwd) };
  }

  // ---------------------------------------------------------------- threads: two lights and the words between them (from v3)
  const threads = new GlyphLayer(gl, A, 9000, { dynamic: true });
  const bez = (a, m, b, u) => add(add(scale(a, (1 - u) * (1 - u)), scale(m, 2 * u * (1 - u))), scale(b, u * u));
  const bezT = (a, m, b, u) => norm(add(scale(sub(m, a), 2 * (1 - u)), scale(sub(b, m), 2 * u)));
  function makeArc(a, m, b) {
    const N = 64, pts = [], acc = [0];
    for (let i = 0; i <= N; i++) pts.push(bez(a, m, b, i / N));
    for (let i = 1; i <= N; i++) acc.push(acc[i - 1] + len(sub(pts[i], pts[i - 1])));
    const L = acc[N];
    const at = (s) => {
      const x = clamp(s, 0, L);
      let i = 1; while (i < N && acc[i] < x) i++;
      const u = (i - 1 + (x - acc[i - 1]) / Math.max(1e-6, acc[i] - acc[i - 1])) / N;
      return { p: bez(a, m, b, u), t: bezT(a, m, b, u) };
    };
    return { L, at };
  }
  function lineOnArc(arc, ids, size, sc, col, alpha) {
    const w = wOf(ids, size);
    let pen = sc - w / 2;
    for (const id of ids) {
      const adv = A.adv[id] * size;
      if (A.meta.entries[id][2] > 0) {
        const a = alpha * smoothstep(-0.15, 0.35, Math.min(pen, arc.L - (pen + adv)));
        if (a > 0.003) { const { p, t } = arc.at(pen); threads.push([...p, size], [...t, id], [...col, a]); }
      }
      pen += adv;
    }
  }
  const lineAt = (ids, p, right, size, col, a) => { if (a > 0.003) threads.pushLine(ids, p, right, size, [...col, a]); };
  const light = (P, I) => threads.push([...P, 1], [1, 0, 0, -1], [1.0, 0.9, 0.78, I], [0.07, 0.07, 0, 0]);

  const legOf = (t) => legs.find((L) => t >= L.seg[1] - 0.01 && t < L.seg[2] + 0.01) || legs[0];
  const frameAt = (t) => { const L = legOf(t); return legFrame(L, t - L.seg[1]); };

  // S09: people writing to each other
  const pairs = H.pairs.map((t, k) => {
    const f = frameAt(t + 1.35);
    const i = meta.pairs[k];
    let C = add(add(f.pos, scale(f.path, 6.6)), scale(f.up, 1.25 + (rnd() - 0.5) * 0.2));
    const half = 2.0 + rnd() * 0.4;
    let Ap = add(add(C, scale(f.right, -half)), scale(f.up, (rnd() - 0.5) * 0.5));
    let Bp = add(add(add(C, scale(f.right, half)), scale(f.up, (rnd() - 0.5) * 0.5)), scale(f.fwd, 0.8));
    const mid = scale(add(Ap, Bp), 0.5);
    return { t, A: Ap, B: Bp,
      q: { arc: makeArc(Ap, add(mid, scale(f.up, 0.65)), Bp), ids: named.pairs[i * 2].ids },
      a: { arc: makeArc(Ap, add(mid, scale(f.up, -0.55)), Bp), ids: named.pairs[i * 2 + 1].ids } };
  });
  // S11: lines people have always written across distance
  const bonds = H.bonds.map((t, k) => {
    const f = frameAt(t);
    const ids = named.bonds[meta.bonds[k]].ids;
    const C = add(add(f.pos, scale(f.fwd, 7.0)), scale(f.up, (rnd() - 0.5) * 0.8 + (k % 2 ? 0.45 : -0.45)));
    const half = Math.max(2.8, wOf(ids, 0.42) * 0.62);
    const Ap = add(C, scale(f.right, -half)), Bp = add(add(C, scale(f.right, half)), scale(f.fwd, 1.2));
    return { t, A: Ap, B: Bp, arc: makeArc(Ap, add(scale(add(Ap, Bp), 0.5), scale(f.up, 0.8 * (k % 2 ? 1 : -1))), Bp), ids };
  });
  // S11, S13: letters home, held up in the dark long enough to read
  const lt = meta.letters.map((L, i) => ({ main: named.letters[i].ids, gloss: tx.ids('gloss', L.gloss), cap: named.letter_caps[i].ids, capEn: tx.ids('gloss', L.cap_en) }));
  const letters = H.letters.map(([t0, t1], i) => {
    const f = frameAt(t0 + 0.4);
    const big = i === 2;
    const size = big ? 0.66 : 0.5;
    const D = big ? 12.5 : 13;
    const lat = big ? 0 : i === 0 ? -1.5 : 1.3, h = big ? 0.6 : i === 0 ? 1.1 : -0.9;
    const w = wOf(lt[i].main, size);
    const origin = add(add(add(f.pos, scale(f.fwd, D)), scale(f.right, lat - w / 2)), scale(f.up, h));
    return { t0, t1, size, origin, right: f.right, up: f.up, ...lt[i] };
  });

  function buildThreads(t, camPos) {
    threads.clear();
    const kick = (x, x0) => (x > x0 ? Math.exp(-(x - x0) * 4) : 0);
    for (const pr of pairs) {
      const lt_ = t - pr.t;
      if (lt_ < -2.5 || lt_ > 7) continue;
      const on = smoothstep(-2.5, -1.2, lt_) * smoothstep(3.0, 4.2, len(sub(scale(add(pr.A, pr.B), 0.5), camPos)));
      const [q0, q1] = H.pair_q, [a0, a1] = H.pair_a;
      light(pr.A, on * (2.5 + 5 * (kick(lt_, q0) + kick(lt_, a1))));
      light(pr.B, on * (2.5 + 5 * (kick(lt_, a0) + kick(lt_, q1))));
      const wordFade = 1;
      if (lt_ > q0) {
        const p = easeOutCubic((lt_ - q0) / (q1 - q0));
        lineOnArc(pr.q.arc, pr.q.ids, 0.34, lerp(-wOf(pr.q.ids, 0.34) * 0.5, pr.q.arc.L / 2, p), WARM, on * wordFade * lerp(1.6, 1.0, smoothstep(q1, q1 + 1.5, lt_)));
      }
      if (lt_ > a0) {
        const p = easeOutCubic((lt_ - a0) / (a1 - a0));
        lineOnArc(pr.a.arc, pr.a.ids, 0.34, lerp(pr.a.arc.L + wOf(pr.a.ids, 0.34) * 0.5, pr.a.arc.L / 2, p), WARM, on * wordFade * lerp(1.6, 1.0, smoothstep(a1, a1 + 1.5, lt_)));
      }
    }
    for (const b of bonds) {
      const x = t - b.t;
      if (x < -3 || x > 3) continue;
      const on = smoothstep(-3, -1.4, x) * smoothstep(3.6, 5.6, len(sub(scale(add(b.A, b.B), 0.5), camPos)));
      light(b.A, on * 2.0); light(b.B, on * 2.0);
      lineOnArc(b.arc, b.ids, 0.42, b.arc.L / 2, CLS, on * 1.35);
    }
    for (const L of letters) {
      const a = smoothstep(L.t0, L.t0 + 0.9, t) * (1 - smoothstep(L.t1 - 0.8, L.t1, t));
      if (a <= 0.003) continue;
      const s = L.size, o = L.origin, r = L.right, u = L.up;
      const at = (dy, dx = 0) => add(add(o, scale(u, dy)), scale(r, dx));
      lineAt(L.main, o, r, s, [1.0, 0.78, 0.5], 2.0 * a);
      lineAt(L.gloss, at(-s * 0.95), r, s * 0.42, GLOSS, 1.1 * smoothstep(L.t0 + 0.8, L.t0 + 1.6, t) * a);
      lineAt(L.cap, at(-s * 1.55), r, s * 0.32, CAP, 0.8 * smoothstep(L.t0 + 1.2, L.t0 + 2.0, t) * a);
      lineAt(L.capEn, at(-s * 1.95), r, s * 0.3, CAP, 0.65 * smoothstep(L.t0 + 1.4, L.t0 + 2.2, t) * a);
    }
    threads.upload();
  }

  // ---------------------------------------------------------------- galactic time and the rise
  const T = clock((t) => (t < R[1] ? 0.15 : lerp(0.15, 420, smoothstep(R[1] + 0.8, R[1] + 4.5, t))), H.start, 40);
  const Ptop = [260, -1750, 900];
  function riseCam(t) {
    const x = t - R[1];
    const u = easeOutCubic(clamp(x / 9));
    const pos = add(Ptop, scale(norm(Ptop), -380 * (1 - u)));
    return { pos, target: [0, 40, 0], up: UP, fov: 36, focus: len(pos), coc: 0.0005, cocMax: 0.05, far: 1e5 };
  }
  const riseFrame = () => {
    const c = riseCam(R[1]), fwd = norm(sub(c.target, c.pos)), right = norm(cross(fwd, UP));
    return { pos: c.pos, fwd, right, up: cross(right, fwd), fov: 36 };
  };

  // ---------------------------------------------------------------- the phone visits, and the bridges in and out
  const phone = new Phone(gl, A, tx, meta);
  const viewH = phone.viewH(0);
  const visits = [P1, P2, P3].map((seg, i) => {
    const sc = scrollTrack(phone, H.scroll[i], viewH);
    // the camera looks where the story is: high on the screen for the past, low for tonight
    const camY = (t) => track(H.scroll[i].map(([tk, key]) => [tk, key === '21:06' ? 4.3 : 10.0]), t);
    const v = { i, seg, sc, camY, inT: [seg[1] - H.enter, seg[1]], outT: [seg[2] - H.leave, seg[2]] };
    // in: a line of words ahead in the galaxy, exactly where its bubble will be
    const L = legs[i];
    const f0 = legFrame(L, v.inT[0] - L.seg[1]);
    const inIds = tx.ids('chat', H.bridge_in[i]);
    const [bx, by] = phone.textPos(H.bridge_in[i], sc.at(seg[1]), 0);
    const B = add(add(add(f0.pos, scale(f0.fwd, 11)), scale(f0.right, -wOf(inIds, 0.34 * PS) / 2)), scale(f0.up, -0.4));
    v.f0 = f0; v.B = B;
    v.v0 = scale(sub(inDisk(L, v.inT[0] - L.seg[1] + 0.02), inDisk(L, v.inT[0] - L.seg[1])), 1 / 0.02);
    v.plIn = placement(sub(B, scale(add(scale(f0.right, bx), scale(f0.up, by - 7.5)), PS)), scale(f0.fwd, -1), f0.up, PS);
    // out: the phone sits so that the camera, holding still on it, is exactly where the next flight begins
    const yE = camY(seg[2]);
    const f1 = i < 2 ? { ...legFrame(legs[i + 1], 0), fov: 42 } : riseFrame();
    const n1 = scale(f1.fwd, -1);
    v.f1 = f1;
    v.plOut = placement(sub(f1.pos, scale(add(scale(f1.up, yE - 7.5), scale(n1, 9.6)), PS)), n1, f1.up, PS);
    return v;
  });
  const visitOf = (t) => visits.find((v) => t >= v.inT[0] - 0.01 && t < v.seg[2] + 0.01);
  const leftBehind = (t) => visits.find((v) => t >= v.seg[2] && t < v.seg[2] + 5);
  function phoneCam(v, t) {
    const y = v.camY(t);
    const still = smoothstep(v.outT[0] - 0.8, v.outT[0] + 0.4, t);   // settle before leaving
    const x = t - v.seg[1];
    const fov = lerp(32, v.f1.fov, smoothstep(v.outT[0], v.outT[1], t));
    return { pos: [0.35 * Math.sin(x * 0.3) * (1 - still), y + 0.4 * (1 - still), 9.6], target: [0, y, 0], up: [0, 1, 0], fov, focus: 9.6, coc: 0.012, cocMax: 0.03, near: 0.05 };
  }
  // in: keep flying as we were, slow down on the line, settle where the phone will be read
  function enterCam(v, t) {
    const T_ = H.enter, u = clamp((t - v.inT[0]) / T_), e = easeInOut(u);
    const E = v.plIn.camW(phoneCam(v, v.seg[1]));
    const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2;
    const pos = add(add(scale(v.f0.pos, h00), scale(v.v0, h10 * T_)), scale(E.pos, h01));
    const fwd = slerp(v.f0.fwd, norm(sub(E.target, E.pos)), e);
    const focus = lerp(len(sub(v.B, v.f0.pos)), E.focus, e);
    return { pos, target: add(pos, scale(fwd, 10)), up: slerp(v.f0.up, E.up, e), fov: lerp(42, 32, e), focus, coc: lerp(0.009, 0.012, e), cocMax: 0.03,
      near: 0.02, nearFade: [0.6, 2.5], far: 1e5 };
  }
  function phoneStateAt(v, t) {
    const inI = smoothstep(v.inT[0] + 1.1, v.inT[1] - 0.1, t), outI = 1 - smoothstep(v.outT[0] + 0.2, v.outT[0] + 1.6, t);
    let keep = null;
    if (t < v.seg[1] + 0.5) keep = { text: H.bridge_in[v.i], I: Math.max(inI, smoothstep(v.inT[0], v.inT[0] + 0.9, t)) };
    if (t > v.outT[0]) keep = { text: H.bridge_out[v.i], I: 1 };
    return { t, scroll: v.sc.at(t), speed: v.sc.speed(t), keyboard: 0, glossA: 1, I: Math.min(inI, outI), keep, input: { segs: [] } };
  }

  // ---------------------------------------------------------------- render
  function legCamOpts(f, t) {
    const L = legOf(t);
    const core = L === legs[2] ? 1 : 0;
    return { pos: f.pos, target: add(f.pos, scale(f.fwd, 10)), up: UP, fov: 42, focus: focusAt(t, f.pos), coc: core ? 0.014 : 0.009, cocMax: core ? 0.03 : 0.016, nearFade: [0.6, 2.5], far: 1e5 };
  }
  const focusTargets = [...pairs.map((p) => ({ t: p.t + 1.35, P: scale(add(p.A, p.B), 0.5) })), ...bonds.map((b) => ({ t: b.t, P: scale(add(b.A, b.B), 0.5) })),
    ...letters.map((L) => ({ t0: L.t0, t1: L.t1, P: L.origin }))];
  function focusAt(t, pos) {
    let best = 7.5;
    for (const o of focusTargets) {
      if (o.t !== undefined ? Math.abs(t - o.t) < 1.6 : t > o.t0 && t < o.t1) best = Math.max(2.5, len(sub(o.P, pos)));
    }
    return best;
  }
  const galI = (t) => {
    const L = legOf(t);
    return L === legs[2] ? 0.07 : L === legs[1] ? 0.22 : 0.35;
  };
  const dimNearFor = (t) => (legOf(t) === legs[2] ? [3, 45, 0.08] : [2, 26, 0.12]);

  // the last line of a visit, left in the galaxy: drawn with the phone's own camera so its tiny details stay exact
  function drawLeftBehind(c, t, wcam) {
    const v = leftBehind(t);
    if (!v) return;
    const a = 1 - smoothstep(v.seg[2] + 0.6, v.seg[2] + 3.2, t);
    if (a <= 0.003) return;
    phone.build({ t, scroll: v.sc.at(v.seg[2]), keyboard: 0, I: 0, keep: { text: H.bridge_out[v.i], I: a }, input: { segs: [] } });
    phone.draw(c.cam({ ...v.plOut.cam(wcam), nearFade: [3.0, 8.0] }));
  }

  function render(c, tl, t) {
    const Tg = T(t);
    if (R && t >= R[1]) {
      // above the whole galaxy: time-lapse, every orbit drawn out into a trail; tonight's message falls away into it
      const rc = riseCam(t);
      const cam = c.cam(rc);
      c.scene();
      galaxy.draw(cam, { T: Tg, up: UP, intensity: 1.0, hazeIntensity: 1.0 });
      drawLeftBehind(c, t, rc);
      return;
    }
    const v = visitOf(t);
    if (!v) {
      // flying a leg (and passing the line the last visit left behind)
      const f = frameAt(t);
      const opts = legCamOpts(f, t);
      const cam = c.cam(opts);
      buildThreads(t, f.pos);
      c.scene();
      galaxy.draw(cam, { T: Tg, up: UP, intensity: galI(t), hazeIntensity: 0.03, dimNear: dimNearFor(t) });
      threads.draw(cam, { uUp: UP });
      drawLeftBehind(c, t, opts);
      return;
    }
    c.scene();
    let pcam, wcam;
    if (t < v.seg[1]) {
      // in: the flight slows on a line of words; the galaxy dims; the phone forms around that line
      wcam = enterCam(v, t);
      pcam = { ...v.plIn.cam(wcam), nearFade: [0.3, 1.2] };
      const gA = 1 - smoothstep(v.inT[0] + 0.6, v.inT[1], t);
      const cam = c.cam(wcam);
      buildThreads(t, wcam.pos);
      galaxy.draw(cam, { T: Tg, up: UP, intensity: galI(v.inT[0]) * gA, hazeIntensity: 0.03, dimNear: dimNearFor(v.inT[0]) });
      threads.draw(cam, { uUp: UP, uIntensity: gA });
    } else {
      pcam = phoneCam(v, t);
      if (t > v.outT[0]) {
        // out: the phone fades but one line; behind it, where the next flight begins, the galaxy comes up
        wcam = { ...v.plOut.camW(pcam), nearFade: [0.6, 2.5] };
        const gA = smoothstep(v.outT[0] + 0.3, v.outT[1], t);
        if (v.i < 2) {
          const nl = legs[v.i + 1];
          galaxy.draw(c.cam({ ...wcam, coc: 0.009, cocMax: 0.016, focus: 7.6, far: 1e5 }), { T: Tg, up: UP, intensity: galI(nl.seg[1] + 0.02) * gA, hazeIntensity: 0.03, dimNear: dimNearFor(nl.seg[1] + 0.02) });
        } else {
          galaxy.draw(c.cam({ ...riseCam(R[1]), fov: wcam.fov }), { T: Tg, up: UP, intensity: gA, hazeIntensity: gA });
        }
      }
    }
    phone.build(phoneStateAt(v, t));
    phone.draw(c.cam(pcam));
  }

  const grade = (t) => {
    const L = legOf(t);
    const deep = L === legs[2] ? 1 : 0;
    const rise = R ? smoothstep(R[1], R[1] + 3, t) : 0;
    return { bloom: lerp(0.05, 0.08, rise), streak: 0.07, streakThreshold: 0.9, grain: 0.028, vignette: 0.45, sat: 1.1 + deep * 0.08,
      wb: [1, 1 - deep * 0.05, 1 - deep * 0.12], exposure: lerp(deep ? 0.7 : 1.0, 1.0, rise), fade: R ? 1 - smoothstep(R[2] - 1.0, R[2], t) : 1 };
  };
  const shot = (id, seg, mb, extra = {}) => ({ id, start: seg[1], end: seg[2], mb, render, post: (tl, t) => grade(t), ...extra });
  return [shot('S09', G1, 3, { cardY: 0.88 }), shot('S10', P1, 4), shot('S11', G2, 3), shot('S12', P2, 4), shot('S13', G3, 3), shot('S14', P3, 4),
    shot('S15', R, 10, { cardY: 0.85 })];
}
