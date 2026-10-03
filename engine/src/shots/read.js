// CHAPTER ONE · READ — S05–S08, one continuous take. Words as threads between people:
// S05 the present (call and response between two lights) · S06 what people always wrote across distance ·
// S07 the first marks · S08 rise above the whole galaxy.
// Convention for this take: galactic -Y is "up", so lines read left-to-right while we fly inward.
import { GlyphLayer } from '../glyphs.js';
import { mulberry32, clamp, lerp, smoothstep, norm, add, sub, scale, cross, mix3, catmull, easeInOut, easeOutCubic, track, len } from '../math.js';
import { galT, HeroLines } from './common.js';
import EV from '../events.json' with { type: 'json' };

const UP = [0, -1, 0];
const WARM = [1.0, 0.86, 0.68], CLS = [1.0, 0.64, 0.32];

export default async function read(ctx) {
  const { gl, atlasHi: A, corpus, galaxy } = ctx;
  const named = corpus.named;
  const rnd = mulberry32(505);

  // ---------------------------------------------------------------- camera path (cylindrical r, θ, y)
  const bump = (t, t0, dur, travel) => { const u = (t - t0) / dur; return u > 0 && u < 1 ? (travel / (dur / 2)) * Math.sin(Math.PI * u) ** 2 : 0; };
  const [d1, d2] = EV.dashes;
  const speed = (t) => (t < d1[0] + 0.2 ? 2.2 : t < d2[0] + 0.2 ? 6 : lerp(4, 2.5, smoothstep(76.6, 84, t))) + bump(t, ...d1) + bump(t, ...d2);
  const R0 = 992;
  const rTab = [R0];
  for (let i = 1; i <= 48 * 240; i++) rTab.push(rTab[i - 1] - speed(50 + (i - 0.5) / 240) / 240);
  const rOf = (t) => { const f = clamp((t - 50) * 240, 0, rTab.length - 1.001), i = Math.floor(f); return lerp(rTab[i], rTab[i + 1], f - i); };
  // keep the sideways (tangential) drift gentle: at r≈1000 even 0.016 rad/s is 16 units/s
  const thOf = (t) => 0.9 + (t - 50) * 0.0012 + 0.01 * Math.sin((t - 50) * 0.21);
  const yOf = (t) => -18 + 0.5 * Math.sin((t - 50) * 0.45) + 0.25 * Math.sin((t - 50) * 1.1 + 1);   // above the disc (UP = -Y)
  const inDisk = (t) => { const r = rOf(t), th = thOf(t); return [r * Math.cos(th), yOf(t), r * Math.sin(th)]; };
  const P84 = inDisk(84);
  const thEnd = thOf(84);
  const Ptop = [Math.cos(thEnd + 0.25) * 1300, -1650, Math.sin(thEnd + 0.25) * 1300];
  function camAt(t) {
    if (t <= 84) {
      const p = inDisk(t), q = inDisk(t + 0.35);
      const path = norm(sub(q, p));
      const side = norm(cross(path, UP));
      const yaw = t < EV.dashes[0][0] ? 0.18 : 0.36;
      let fwd = norm(add(scale(path, Math.cos(yaw)), scale(side, Math.sin(yaw))));
      fwd = norm(add(fwd, scale(UP, 0.15)));
      return { pos: p, target: add(p, scale(fwd, 10)), fwd, path };
    }
    const u = easeOutCubic(clamp((t - 84) / 10));
    const lu = smoothstep(0, 1, u);
    const mid = [P84[0] * 1.6, -380, P84[2] * 1.6];
    const pos = catmull([P84, P84, mid, Ptop, Ptop], lu * 0.999);
    const target = mix3(camAt(84).target, [0, 120, 0], smoothstep(0.0, 0.75, lu));
    return { pos, target, fwd: norm(sub(target, pos)) };
  }
  const camFrame = (t) => {
    const c = camAt(t);
    const right = norm(cross(c.fwd, UP));
    return { ...c, right, up: cross(right, c.fwd) };
  };

  // ---------------------------------------------------------------- threads: lines that travel between two lights
  const threads = new GlyphLayer(gl, A, 8000, { dynamic: true });
  const wOf = (ids, s) => ids.reduce((a, id) => a + A.adv[id], 0) * s;
  const bez = (a, m, b, u) => add(add(scale(a, (1 - u) * (1 - u)), scale(m, 2 * u * (1 - u))), scale(b, u * u));
  const bezT = (a, m, b, u) => norm(add(scale(sub(m, a), 2 * (1 - u)), scale(sub(b, m), 2 * u)));
  function makeArc(a, m, b) {
    // arc-length table so glyphs keep even spacing along the curve
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
    return { a, m, b, L, at };
  }
  // lay a line along an arc with its centre at arc-distance sc; glyphs beyond the ends fade out
  function lineOnArc(arc, ids, size, sc, col, alpha) {
    const w = wOf(ids, size);
    let pen = sc - w / 2;
    for (const id of ids) {
      const adv = A.adv[id] * size;
      if (A.meta.entries[id][2] > 0) {
        const edge = Math.min(pen, arc.L - (pen + adv));
        const a = alpha * smoothstep(-0.15, 0.35, edge);
        if (a > 0.003) {
          const { p, t } = arc.at(pen);
          threads.push([...p, size], [...t, id], [...col, a]);
        }
      }
      pen += adv;
    }
  }

  const pairs = EV.pairs.map(({ t, i }) => {
    const f = camFrame(t + 1.35);
    // on the line of travel (and a little above the bright band), so the pair holds its place on screen
    const C = add(add(f.pos, scale(f.path, 6.6)), scale(f.up, 1.25 + (rnd() - 0.5) * 0.2));
    const half = 2.0 + rnd() * 0.4;
    const Ap = add(add(C, scale(f.right, -half)), scale(f.up, (rnd() - 0.5) * 0.5));
    const Bp = add(add(add(C, scale(f.right, half)), scale(f.up, (rnd() - 0.5) * 0.5)), scale(f.fwd, 0.8));
    const mid = scale(add(Ap, Bp), 0.5);
    return {
      t, A: Ap, B: Bp,
      q: { arc: makeArc(Ap, add(mid, scale(f.up, 0.65)), Bp), ids: named.pairs[i * 2].ids },
      a: { arc: makeArc(Ap, add(mid, scale(f.up, -0.55)), Bp), ids: named.pairs[i * 2 + 1].ids },
    };
  });
  const bonds = EV.bonds.map((t, i) => {
    const f = camFrame(t);
    const ids = named.bonds[i].ids;
    const C = add(add(f.pos, scale(f.fwd, 7.0)), scale(f.up, (rnd() - 0.5) * 0.8 + (i % 2 ? 0.45 : -0.45)));
    const half = Math.max(2.8, wOf(ids, 0.42) * 0.62);
    const Ap = add(C, scale(f.right, -half)), Bp = add(add(C, scale(f.right, half)), scale(f.fwd, 1.2));
    return { t, A: Ap, B: Bp, arc: makeArc(Ap, add(scale(add(Ap, Bp), 0.5), scale(f.up, 0.8 * (i % 2 ? 1 : -1))), Bp), ids };
  });

  function buildThreads(t, camPos) {
    threads.clear();
    const light = (P, I) => threads.push([...P, 1], [1, 0, 0, -1], [1.0, 0.9, 0.78, I], [0.07, 0.07, 0, 0]);
    const kick = (lt, t0) => (lt > t0 ? Math.exp(-(lt - t0) * 4) : 0);
    for (const pr of pairs) {
      const lt = t - pr.t;
      if (lt < -2.5 || lt > 7) continue;
      // fade as we come too close, so nothing smears across the lens
      const on = smoothstep(-2.5, -1.2, lt) * smoothstep(3.0, 4.2, len(sub(scale(add(pr.A, pr.B), 0.5), camPos)));
      const [q0, q1] = EV.pair_q, [a0, a1] = EV.pair_a;
      light(pr.A, on * (2.5 + 5 * (kick(lt, q0) + kick(lt, a1))));
      light(pr.B, on * (2.5 + 5 * (kick(lt, a0) + kick(lt, q1))));
      // question: emerges from A, settles centred on the upper arc
      if (lt > q0) {
        const p = easeOutCubic((lt - q0) / (q1 - q0));
        lineOnArc(pr.q.arc, pr.q.ids, 0.34, lerp(-wOf(pr.q.ids, 0.34) * 0.5, pr.q.arc.L / 2, p), WARM, on * lerp(1.6, 1.0, smoothstep(q1, q1 + 1.5, lt)));
      }
      // answer: emerges from B, settles centred on the lower arc
      if (lt > a0) {
        const p = easeOutCubic((lt - a0) / (a1 - a0));
        lineOnArc(pr.a.arc, pr.a.ids, 0.34, lerp(pr.a.arc.L + wOf(pr.a.ids, 0.34) * 0.5, pr.a.arc.L / 2, p), WARM, on * lerp(1.6, 1.0, smoothstep(a1, a1 + 1.5, lt)));
      }
    }
    for (const b of bonds) {
      const lt = t - b.t;
      if (lt < -3 || lt > 3) continue;
      const on = smoothstep(-3, -1.4, lt) * smoothstep(3.6, 5.6, len(sub(scale(add(b.A, b.B), 0.5), camPos)));
      light(b.A, on * 2.0); light(b.B, on * 2.0);
      lineOnArc(b.arc, b.ids, 0.42, b.arc.L / 2, CLS, on * 1.35);
    }
    threads.upload();
  }

  // ---------------------------------------------------------------- hero lines riding orbits: the ancient marks + credits
  const hero = new HeroLines(gl, A, 6000);
  const place = (ids, t, lateral, height, size, color, extra = {}, D = 6.5) => {
    const f = camFrame(t);
    const w = wOf(ids, size);
    const p = add(add(add(f.pos, scale(f.fwd, D)), scale(f.right, lateral - w / 2)), scale(f.up, height));
    return hero.add(ids, p, galT(t), size, color, extra);
  };
  const [c1, c2, c3] = EV.credits;
  const credits = [
    place(named.credits[0].ids, c1, 1.6, -1.2, 0.24, [1.0, 0.92, 0.8, 0.9], { credit: [c1 - 1.6, c1 + 0.5] }, 7.0),
    place(named.credits[1].ids, c2, 0.0, 1.0, 0.26, [1.0, 0.85, 0.65, 0.9], { credit: [c2 - 1.6, c2 + 0.5] }, 7.0),
    place(named.credits[2].ids, c3, -1.4, 1.5, 0.28, [1.0, 0.75, 0.5, 0.9], { credit: [c3 - 0.6, c3 + 0.6] }, 7.0),
  ];
  // the first marks, one at a time, each with its name and age
  const anc = [[-1.1, 0.35], [1.1, -0.1], [-0.8, 0.4], [0.2, 0.15], [0.9, 0.0]];
  EV.ancient.forEach((t, i) => {
    const [lat, h] = anc[i];
    const size = 0.78;
    const win = { credit: [t - 0.6, t + 0.25] };   // each mark lives only in its own moment, so they never pile up
    place(named.ancient4[i].ids, t, lat, h, i === 3 ? 0.92 : size, i === 3 ? [1.0, 0.8, 0.55, 2.0] : [1.0, 0.47, 0.15, 2.3], win, 9);
    place(named.ancient_caps[i * 2].ids, t, lat, h - size * 0.62, 0.17, [1.0, 0.9, 0.8, 1.0], win, 9);
    place(named.ancient_caps[i * 2 + 1].ids, t, lat, h - size * 0.62 - 0.26, 0.11, [1.0, 0.85, 0.72, 0.8], win, 9);
  });
  hero.upload();

  // ---------------------------------------------------------------- render
  const focusTargets = [...pairs.map((p) => ({ t: p.t + 1.35, P: scale(add(p.A, p.B), 0.5) })), ...bonds.map((b) => ({ t: b.t, P: scale(add(b.A, b.B), 0.5) }))];
  function focusAt(t, pos) {
    let best = 7.5;
    for (const o of focusTargets) if (Math.abs(t - o.t) < 1.6) best = Math.max(2.5, len(sub(o.P, pos)));
    return best;
  }
  function render(c, tl, t) {
    const f = camAt(t);
    const rise = smoothstep(84, 92, t);
    const core = smoothstep(EV.dashes[1][0], EV.dashes[1][0] + 2, t) * (1 - rise);
    const focus = t < 84 ? focusAt(t, f.pos) : lerp(7.5, len(f.pos), smoothstep(84, 90, t));
    const cam = c.cam({ pos: f.pos, target: f.target, up: UP, fov: lerp(42, 36, rise), focus, coc: lerp(lerp(0.009, 0.006, core), 0.0006, smoothstep(84, 86.5, t)),
      cocMax: lerp(0.016, 0.05, rise), nearFade: [0.6, 2.5], far: 1e5 });
    for (const cr of hero.lines) {
      if (!cr.credit) continue;
      const a = smoothstep(cr.credit[0], cr.credit[0] + 0.6, t) * (1 - smoothstep(cr.credit[1], cr.credit[1] + 0.8, t));
      hero.setIntensity(cr, credits.includes(cr) ? 0.12 + 1.6 * a : a);
    }
    hero.upload();
    buildThreads(t, f.pos);
    const T = galT(t);
    c.scene();
    // the galaxy is the backdrop: near-field glyphs fade so only the threads read
    const mid = smoothstep(EV.dashes[0][0], EV.dashes[0][0] + 2, t) * (1 - core);
    galaxy.draw(cam, { T, up: UP, intensity: lerp(lerp(lerp(0.35, 0.22, mid), 0.025, core), 1.0, rise), hazeIntensity: lerp(0.03, 1.0, rise),
      dimNear: [2, lerp(26, 40, core), lerp(lerp(0.12, 0.06, core), 1, rise)] });
    threads.draw(cam, { uUp: UP, uIntensity: 1 - smoothstep(84.3, 86, t) });
    hero.draw(cam, { uTime: T, uUp: UP, uIntensity: 1 - smoothstep(84.5, 87, t) });
  }

  const grade = (t) => {
    const deep = smoothstep(70, 80, t) * (1 - smoothstep(84, 90, t));
    const exposure = track([[50, 1.0], [62.9, 0.9], [64.9, 0.7], [74.6, 0.65], [76.6, 0.6], [84, 0.55], [87, 0.7], [92, 1.0]], t);
    return { bloom: 0.05, streak: 0.07, streakThreshold: 0.9, grain: 0.028, vignette: 0.45, sat: 1.1 + deep * 0.1, wb: [1, 1 - deep * 0.06, 1 - deep * 0.15], exposure };
  };
  ctx.poses.readEnd = camAt(EV.read_end);
  const shot = (id, start, end, mb, extra = {}) => ({ id, start, end, mb, render, post: (tl, t) => grade(t), ...extra });
  return [shot('S05', 50, d1[0], 3, { cardY: 0.88 }), shot('S06', d1[0], d2[0], 4), shot('S07', d2[0], 84, 3), shot('S08', 84, EV.read_end, 3, { cardY: 0.86 })];
}
