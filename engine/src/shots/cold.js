// COLD OPEN — S01 cursor · S02 the model predicts its own name · S03 the dive · S04 river → galaxy
import { GlyphLayer } from '../glyphs.js';
import { mulberry32, clamp, lerp, smoothstep, easeInOut, easeOutCubic, track, integrate, norm, add, scale, mix3 } from '../math.js';

export const CYAN = [0.6, 0.88, 1.0];
export const HOT = [0.88, 0.97, 1.0];
export const AMBER = [1.0, 0.56, 0.22];

const S = 0.85;       // em of the name line (world units)
const SC = 0.34;      // candidate em
const S2 = 0.3;      // second line em
const WORD = 0.3;     // word gap (em)
const Y0 = 0.2;
const ROW0 = Y0 - 1.1, ROWP = 0.56;
const TOK_T0 = [8.6, 11.9, 15.0];
const LOCK = 2.2, FLY = 0.4;
const SUB_T0 = 18.5, SUB_DT = 0.1;
const CURSOR_ON = 3.0;
const DIVE_T0 = 22, RIVER_T0 = 34, END = 50;

// cursor blink: on for the first half of every second (the film's metronome)
export const blink = (t, t0 = 0) => { const f = (((t - t0) % 1) + 1) % 1; return smoothstep(0, 0.035, f) * (1 - smoothstep(0.5, 0.535, f)); };

export default async function cold(ctx) {
  const { gl, atlas, atlasHi: A, corpus, galaxy, H, W } = ctx;
  const named = corpus.named;
  const rnd = mulberry32(55);
  const NORM = 1608 / H;   // thresholds are expressed in 4K-master pixels

  // ---------------------------------------------------------------- glyph ids & layout
  let k = 0;
  const candIds = corpus.opening.map((o) => o.cands.map(() => named.opening[k++].ids));
  const candP = corpus.opening.map((o) => o.cands.map((c) => c[1]));
  const subIds = named.opening[k].ids;
  const digit = {};
  [...'0123456789.%'].forEach((ch, i) => (digit[ch] = named.digits[0].ids[i]));
  const diveIds = named.dive[0].ids;
  const wOf = (ids) => ids.reduce((a, id) => a + A.adv[id], 0);
  const tokW = candIds.map((c) => wOf(c[0]));
  const W1 = tokW.reduce((a, b) => a + b, 0) * S + WORD * S * (tokW.length - 1);
  const X0 = -W1 / 2;
  const tokX = [];
  { let x = X0; for (const w of tokW) { tokX.push(x); x += w * S + WORD * S; } }
  const lineEnd = tokX[2] + tokW[2] * S;
  const Y2 = Y0 - 1.1;
  const subX = []; { let x = X0; for (const id of subIds) { subX.push(x); x += A.adv[id] * S2; } }
  const subEnd = X0 + wOf(subIds) * S2;

  // the "." in "5.5"
  const dotIdx = 1;
  const dotId = candIds[2][0][dotIdx];
  const dotPen = tokX[2] + A.adv[candIds[2][0][0]] * S;
  const dotInk = A.ink(dotId);
  const Dc = [dotPen + dotInk.cx * S, Y0 + dotInk.cy * S];

  const ui = new GlyphLayer(gl, A, 6000, { dynamic: true });
  const dive = new GlyphLayer(gl, A, 80000, { dynamic: true });

  // far background: a few out-of-focus amber words, hinting at the vastness behind
  const bokeh = new GlyphLayer(gl, atlas, 900);
  for (let i = 0; i < 64; i++) {
    const lay = corpus.layers[['classical', 'print', 'digital'][i % 3]];
    const ids = lay[Math.floor(rnd() * lay.length)];
    const z = -70 - rnd() * 200;
    const p = [(rnd() - 0.5) * 2.4 * -z * 0.6, (rnd() - 0.5) * -z * 0.55, z];
    bokeh.pushLine(ids.slice(0, 1), p, [1, 0, 0], 0.7 + rnd() * 0.8, [...AMBER, 0.5 + rnd() * 0.9]);
  }
  bokeh.upload();

  // ---------------------------------------------------------------- dive structure (level-0 world units, doubles)
  const pool = [];
  for (const set of ['candidates', 'classic_hero', 'digital_hero', 'credits', 'unsaid', 'request'])
    for (const l of named[set]) for (const id of l.ids) if (A.meta.entries[id][2] > 0 && A.adv[id] > 0.45) pool.push(id);
  const pick = () => pool[Math.floor(rnd() * pool.length)];
  const e1 = S / 160, e2 = e1 / 60, e3 = e2 / 60;
  const fill = (parentId, pen, em, childEm) =>
    A.inkPoints(parentId, (childEm / em) * 1.15, rnd).map(([x, y]) => ({
      id: pick(), em: childEm, x: pen[0] + x * em - childEm * 0.5, y: pen[1] + y * em - childEm * 0.35, z: (rnd() - 0.5) * childEm * 0.8, seed: rnd(),
    }));
  const center = (g) => { const ink = A.ink(g.id); return [g.x + ink.cx * g.em, g.y + ink.cy * g.em]; };
  const nearest = (arr, p, n) => arr.map((g, i) => [Math.hypot(g.x + 0.45 * g.em - p[0], g.y + 0.35 * g.em - p[1]), i])
    .sort((a, b) => a[0] - b[0]).slice(0, n).map((x) => arr[x[1]]);
  const L1 = fill(dotId, [dotPen, Y0], S, e1);
  const G1 = nearest(L1, Dc, 1)[0];
  G1.id = diveIds[0];
  const L2 = [];
  for (const p of nearest(L1, center(G1), 7)) { p.kids = fill(p.id, [p.x, p.y], e1, e2); L2.push(...p.kids); }
  const G2 = nearest(G1.kids, center(G1), 1)[0];
  G2.id = diveIds[1];
  for (const p of nearest(L2, center(G2), 7)) p.kids = fill(p.id, [p.x, p.y], e2, e3);
  const G3 = nearest(G2.kids, center(G2), 1)[0];
  G3.id = diveIds[2];
  const C1 = center(G1), C2 = center(G2), C3 = center(G3);
  // drifting text-dust around each level: parallax and bokeh while we fall through the scales
  const dust = [];
  [[Dc, S * 0.3, e1], [C1, e1 * 1.3, e2], [C2, e2 * 1.3, e3]].forEach(([c, box, em], lv) => {
    for (let i = 0; i < 1400; i++)
      dust.push({ id: pick(), em: em * (0.6 + rnd() * 1.0), lv, x: c[0] + (rnd() - 0.5) * 2 * box, y: c[1] + (rnd() - 0.5) * 2 * box * 0.6,
        z: (rnd() - 0.35) * box * 1.6, seed: rnd() });
  });

  // ---------------------------------------------------------------- shared camera for S01–S03
  const coldCam = (t) => {
    const D = track([[0, 22], [8, 19.5], [DIVE_T0, 17]], t);
    const cx = track([[0, X0 + 4.9], [8, X0 + 3.8], [17.8, 0.55], [DIVE_T0, 0.1]], t);
    const cy = track([[0, 0.1], [12, -0.1], [DIVE_T0, -0.3]], t);
    return { pos: [cx, cy, D], target: [cx, cy, 0], fov: 30, focus: D, coc: 0.03, cocMax: 0.07 };
  };

  // ---------------------------------------------------------------- interface (S01–S02)
  function cursorState(t) {
    let x = X0 - 0.03, y = Y0, h = 1.15 * S, solid = 0;
    for (let i = 0; i < 3; i++) {
      const t0 = TOK_T0[i];
      if (t >= t0 + LOCK) {
        const u = easeOutCubic((t - t0 - LOCK - FLY * 0.5) / 0.35);
        const target = i < 2 ? tokX[i + 1] - WORD * S * 0.5 : lineEnd + 0.05;
        x = lerp(tokX[i] - 0.03, target, u);
        solid = Math.max(solid, 1 - smoothstep(0, 0.6, t - t0 - LOCK - FLY));
      } else if (t >= t0) { solid = Math.max(solid, smoothstep(0, 0.2, t - t0)); x = tokX[i] - 0.05; }
    }
    if (t >= SUB_T0 - 0.35) {
      const j = clamp(Math.floor((t - SUB_T0) / SUB_DT) + 1, 0, subIds.length);
      x = j <= 0 ? X0 - 0.03 : j >= subIds.length ? subEnd + 0.04 : subX[j] - 0.015;
      y = Y2; h = 1.15 * S2;
      solid = t < SUB_T0 + subIds.length * SUB_DT + 0.2 ? 1 : 0;
    }
    const on = smoothstep(CURSOR_ON, CURSOR_ON + 0.25, t);
    return { x, y, h, a: on * Math.max(solid, blink(t, CURSOR_ON)) };
  }

  function probs(i, tau) {
    const p0 = candP[i];
    const u = clamp((tau - 0.45) / (LOCK - 0.45));
    const r = mulberry32(1000 * i + Math.floor(tau * 12));
    const lg = p0.map((p, j) => Math.log(p) + (r() - 0.5) * 1.6 * (1 - u) + (j === 0 ? u * u * 3.4 : 0));
    const mx = Math.max(...lg);
    const ex = lg.map((l) => Math.exp(l - mx));
    const sum = ex.reduce((a, b) => a + b, 0);
    return ex.map((x) => x / sum);
  }

  function pushNumber(layer, v, P, size, col) {
    let x = P[0];
    for (const ch of v.toFixed(2)) { layer.push([x, P[1], P[2], size], [1, 0, 0, digit[ch]], col); x += A.adv[digit[ch]] * size; }
  }

  function buildUI(t) {
    ui.clear();
    for (let i = 0; i < 3; i++) {
      const tau = t - TOK_T0[i];
      if (tau < 0) continue;
      const lockT = tau - LOCK;
      if (lockT >= 0) {
        // the winner rises into the line
        const u = easeOutCubic(lockT / FLY);
        const size = lerp(SC, S, u);
        const flash = Math.exp(-Math.max(0, lockT - FLY * 0.6) * 3.5) * smoothstep(0, FLY, lockT);
        const settle = smoothstep(FLY, FLY + 1.2, lockT);
        ui.pushLine(candIds[i][0], [tokX[i], lerp(ROW0, Y0, u), 0], [1, 0, 0], size, [...mix3(HOT, CYAN, settle * 0.25), 1.4 + flash * 5.0 - settle * 0.2]);
      }
      if (tau > LOCK + 1.4) continue;
      const pr = probs(i, tau);
      const maxW = Math.max(...candIds[i].map(wOf)) * SC;
      const xBar = tokX[i] + maxW + 0.35;
      candIds[i].forEach((ids, r) => {
        if (r === 0 && lockT >= 0) return;
        const fan = smoothstep(0.06 * r, 0.06 * r + 0.35, tau);
        const y = ROW0 - r * ROWP;
        const scatter = r > 0 ? smoothstep(0, 1.1, lockT) : 0;
        const p = pr[r];
        const intensity = (0.55 + 1.6 * p) * fan * (1 - scatter);
        if (intensity <= 0.002) return;
        const col = [...CYAN, intensity];
        if (scatter > 0) {
          // rejected: each glyph drifts off and out of focus
          let pen = 0;
          const rr = mulberry32(77 + i * 10 + r);
          const s2 = scatter * scatter;
          for (const id of ids) {
            ui.push([tokX[i] + pen * SC + (rr() - 0.5) * 1.6 * s2, y + (rr() - 0.4) * 1.0 * s2, (2 + rr() * 5) * s2, SC], [1, 0, 0, id], col);
            pen += A.adv[id];
          }
        } else ui.pushLine(ids, [tokX[i], y, 0], [1, 0, 0], SC, col);
        const barA = fan * (1 - smoothstep(0, 0.5, lockT));
        if (barA > 0.002) {
          ui.push([xBar, y + 0.09, 0, 1], [1, 0, 0, -1], [...CYAN, (0.3 + 1.0 * p) * barA], [Math.max(0.006, 2.4 * p), 0.05, 0, 0]);
          ui.push([xBar, y + 0.09, 0, 1], [1, 0, 0, -1], [...CYAN, 0.1 * barA], [2.4, 0.008, 0, 0]);
          pushNumber(ui, p, [xBar + 2.6, y, 0], SC * 0.72, [...CYAN, (0.4 + 0.6 * p) * barA]);
        }
      });
    }
    subIds.forEach((id, j) => {
      const tc = SUB_T0 + j * SUB_DT;
      if (t < tc) return;
      const flash = Math.exp(-(t - tc) * 5);
      ui.push([subX[j], Y2, 0, S2], [1, 0, 0, id], [...mix3(CYAN, HOT, flash), (0.9 + flash * 2) * smoothstep(tc, tc + 0.06, t)]);
    });
    const c = cursorState(t);
    if (c.a > 0.001) ui.push([c.x, c.y + c.h * 0.32, 0, 1], [1, 0, 0, -1], [...HOT, 2.4 * c.a], [0.06 * (c.h / 1.15), c.h, 0, 0]);
    ui.upload();
  }

  const S01_02 = (id, start, end) => ({
    id, start, end, mb: 1,
    render(c, tl, t) {
      const cam = c.cam(coldCam(t));
      buildUI(t);
      c.scene();
      bokeh.draw(cam, { uIntensity: smoothstep(2.0, 10, t) * 0.8 });
      ui.draw(cam);
    },
    post: () => ({ bloom: 0.07, streak: 0.25, streakThreshold: 0.45, grain: 0.03, vignette: 0.45 }),
  });

  // ---------------------------------------------------------------- S03 dive
  const c22 = coldCam(DIVE_T0);
  const camD = c22.pos[2], camC = [c22.pos[0], c22.pos[1]];
  const tanH = Math.tan((15 * Math.PI) / 180);
  const fpx = H / 2 / tanH;
  const pxOf = (em, Z) => ((em * Z * fpx) / camD) * NORM;
  const LNZ_END = 13.0, DIVE_LEN = 11.0;
  const zr = (u) => smoothstep(0.0, 0.2, u) * (1 - smoothstep(0.8, 1.0, u));
  const zNorm = integrate(zr, 1, 1 / 2000);
  const lnZ = (tl) => (LNZ_END * integrate(zr, clamp(tl / DIVE_LEN), 1 / 2000)) / zNorm;
  const lsm = (a, b, x) => smoothstep(Math.log(a), Math.log(b), Math.log(Math.max(x, 1e-9)));
  const amber = (g) => { const v = 0.8 + 0.35 * g.seed; return [AMBER[0], AMBER[1] * v, AMBER[2] * v]; };

  // the river the dive pours into: lanes of text across the whole frame
  const hh = camD * tanH, hw = hh * (W / H);
  const lanes = [];
  { const r2 = mulberry32(909);
    const lines = [...named.digital_hero, ...named.classic_hero, ...named.candidates, ...named.classic_extra].map((l) => l.ids);
    // lanes lie on a plane tilted away from us: the river recedes toward a horizon
    for (let li = 0; li < 30; li++) {
      const y = -hh * 1.15 + (li + 0.5) * ((hh * 2.0) / 22) + (r2() - 0.5) * 0.1;
      const z = -(y + hh * 1.15) * 2.2 + (r2() - 0.5) * 1.5;
      const span = ((camD - z) * tanH * (W / H)) * 2.8;
      const em = 0.3 + r2() * 0.14;
      const glyphs = [];
      let x = 0;
      while (x < span) {
        for (const id of lines[Math.floor(r2() * lines.length)]) { if (A.meta.entries[id][2] > 0) glyphs.push([x, id]); x += A.adv[id] * em; }
        x += em * (1.5 + r2() * 3);
      }
      lanes.push({ y, z, em, glyphs, span: x, speed: 0.7 + r2() * 0.8, phase: r2() * x, bright: 0.6 + r2() * 0.7, hwL: (camD - z) * tanH * (W / H) * 1.3 });
    }
  }

  function buildDive(tl) {
    const Z = Math.exp(lnZ(tl));
    const dotPx = pxOf(dotInk.r * 2 * S, Z);
    const w1 = lsm(40, 700, dotPx), w2 = lsm(40, 700, pxOf(e1, Z)), w3 = lsm(40, 700, pxOf(e2, Z));
    const F = [Dc[0] + (C1[0] - Dc[0]) * w1 + (C2[0] - C1[0]) * w2 + (C3[0] - C2[0]) * w3,
               Dc[1] + (C1[1] - Dc[1]) * w1 + (C2[1] - C1[1]) * w2 + (C3[1] - C2[1]) * w3];
    const wc = easeInOut(tl / 1.6);
    const Cz = [lerp(camC[0], F[0], wc), lerp(camC[1], F[1], wc)];
    const lim = [hw * 1.3, hh * 1.3];
    const riverIn = smoothstep(8.6, 10.0, tl);
    dive.clear();
    const put = (g, alpha, col) => {
      if (alpha < 0.003) return;
      const s = g.em * Z;
      const x = (g.x - Cz[0]) * Z, y = (g.y - Cz[1]) * Z, z = g.z * Z;
      if (z > camD * 0.9) return;
      const f = camD / Math.max(camD - z, 1e-3);   // perspective spread for cull
      if (Math.abs(x * f) > lim[0] + s * f * 2 || Math.abs(y * f) > lim[1] + s * f * 2) return;
      dive.push([x, y, z, s], [1, 0, 0, g.id], [...col, alpha]);
    };
    // level 0: the name line, scaled
    const dotA = 1 - lsm(60, 220, dotPx);
    const uiPut = (ids, pen, size, col, skipDot) => {
      let x = pen[0];
      ids.forEach((id, j) => {
        if (A.meta.entries[id][2] > 0 && !(skipDot && j === dotIdx)) put({ x, y: pen[1], z: 0, em: size, id }, col[3], col.slice(0, 3));
        x += A.adv[id] * size;
      });
    };
    for (let i = 0; i < 3; i++) uiPut(candIds[i][0], [tokX[i], Y0], S, [...mix3(HOT, CYAN, 0.25), 1.2], i === 2);
    put({ x: dotPen, y: Y0, z: 0, em: S, id: dotId }, 1.2 * dotA, mix3(HOT, CYAN, 0.25));
    uiPut(subIds, [X0, Y2], S2, [...CYAN, 0.9], false);
    // levels 1..3 — each glyph's strokes resolve into smaller glyphs as it grows
    const l1A = lsm(60, 220, dotPx), l2A = lsm(200, 600, pxOf(e1, Z)), l3A = lsm(200, 600, pxOf(e2, Z));
    const fadeL3 = 1 - riverIn;
    for (const g of L1) {
      put(g, 0.85 * l1A * (g.kids ? 1 - l2A : 1), amber(g));
      if (g.kids && l2A > 0) for (const c2 of g.kids) {
        put(c2, 0.85 * l2A * (c2.kids ? 1 - l3A : 1), amber(c2));
        if (c2.kids && l3A > 0) for (const c3 of c2.kids) put(c3, 0.85 * l3A * fadeL3, amber(c3));
      }
    }
    for (const d of dust) {
      const px = pxOf(d.em, Z);
      const a = lsm(3, 14, px) * (1 - lsm(1200, 4000, px)) * 0.4;
      put(d, a, amber(d));
    }
    // the river
    if (riverIn > 0) {
      const flow = Math.pow(Math.max(0, tl - 8.6), 2.0) * 1.6;
      for (const L of lanes) {
        for (const [gx, id] of L.glyphs) {
          let x = (((gx + L.phase + flow * L.speed) % L.span) + L.span) % L.span - L.span / 2;
          if (Math.abs(x) > L.hwL) continue;
          dive.push([x, L.y, L.z, L.em], [1, 0, 0, id], [...amber({ seed: (gx * 7.3) % 1 }), riverIn * 0.9 * L.bright]);
        }
      }
    }
    dive.upload();
  }

  const S03 = {
    id: 'S03', start: DIVE_T0, end: RIVER_T0, mb: 10, cardY: 0.84,
    render(c, tl) {
      const cam = c.cam({ pos: [0, 0, camD], target: [0, 0, 0], fov: 30, focus: camD, coc: lerp(0.014, 0.03, smoothstep(8.6, 10, tl)), cocMax: 0.06, nearFade: [camD * 0.12, camD * 0.45] });
      buildDive(tl);
      c.scene();
      bokeh.draw(cam, { uIntensity: 0.8 * (1 - smoothstep(0, 2.5, tl)) });
      dive.draw(cam);
    },
    post: (tl) => ({ bloom: 0.07 + smoothstep(9, 12, tl) * 0.04, streak: 0.22 + smoothstep(9, 12, tl) * 0.25, streakThreshold: 0.5, grain: 0.03, vignette: 0.45 }),
  };

  // ---------------------------------------------------------------- S04 river → galaxy
  const pickLine = galaxy.lines.find((l) => l.era === 3 && l.r > 770 && l.r < 790 && Math.abs(l.y) < 1.2) || galaxy.lines[0];
  const R0 = pickLine.r, YL = pickLine.y;
  const rate = (u) => lerp(5.0, 0.15, smoothstep(0.5, 6.5, u));          // galactic time warp
  const Tg = (tl) => integrate(rate, tl, 1 / 120);
  const radAt = (ph) => [Math.cos(ph), 0, Math.sin(ph)];
  const tanAt = (ph) => [-Math.sin(ph), 0, Math.cos(ph)];
  const ph = pickLine.phase + 0.004;
  const anchor = add(scale(radAt(ph), R0 - 2.6), [0, YL + 0.9, 0]);
  const alpha = (38 * Math.PI) / 180;
  const fwd0 = norm(add(scale(tanAt(ph), Math.cos(alpha)), scale(radAt(ph), Math.sin(alpha))));
  const RIVER_LEN = 13.0;
  function riverCam(tl) {
    const lp = easeInOut(clamp((tl - 1.0) / (RIVER_LEN - 1.0)));
    const d = Math.exp(lerp(Math.log(9), Math.log(1550), lp));
    const target = mix3(add(anchor, scale(fwd0, 9)), [0, 210, 0], smoothstep(0.12, 0.8, lp));
    const uStart = norm(add(scale(fwd0, -1), [0, 0.12, 0]));
    const uEnd = norm(add(scale(radAt(ph - 0.35), Math.cos(0.42)), [0, Math.sin(0.42), 0]));
    const u = norm(mix3(uStart, uEnd, smoothstep(0.05, 0.95, lp)));
    const pos = add(target, scale(u, d));
    return { pos: [pos[0], pos[1] + Math.sin(tl * 0.7) * 0.15 * (1 - lp), pos[2]], target, d, lp };
  }

  const S04 = {
    id: 'S04', start: RIVER_T0, end: END, mb: 4, cardY: 0.3,
    render(c, tl) {
      const rc = riverCam(tl);
      const cam = c.cam({ pos: rc.pos, target: rc.target, fov: lerp(40, 36, rc.lp), focus: lerp(11, rc.d, smoothstep(0, 0.4, rc.lp)),
        coc: lerp(0.022, 0.0015, smoothstep(0, 0.5, rc.lp)), cocMax: 0.05, nearFade: [0.8, 3.0], far: 1e5 });
      c.scene();
      galaxy.draw(cam, { T: Tg(tl), intensity: lerp(0.38, 1.0, smoothstep(0.1, 0.5, rc.lp)), hazeIntensity: smoothstep(0.15, 0.6, rc.lp) });
    },
    post: () => ({ bloom: 0.08, streak: 0.18, streakThreshold: 0.8, grain: 0.028, vignette: 0.4, sat: 1.12 }),
  };

  return [S01_02('S01', 0, 8), S01_02('S02', 8, DIVE_T0), S03, S04];
}
