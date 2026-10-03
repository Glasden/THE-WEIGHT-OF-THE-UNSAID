// CHAPTER TWO · PASTE — S16 the paste · S17 everyone (the galaxy goes uniform) · S18 the held breath ·
// S19 backspace · S20 mine too.
// The hero phone lies in the outer arm, screen up; the camera pulls straight out from it to the whole galaxy and back.
// Other people's phones sit along that line at growing scales, so each one passes by legibly in turn.
import { GlyphLayer } from '../glyphs.js';
import { mulberry32, clamp, lerp, smoothstep, norm, add, sub, scale, cross, len, mix3, easeInOut, rotate } from '../math.js';
import { Phone, placement } from '../phone.js';
import { CYAN_P as CYAN, WARM, Texts, clock, blink } from './common.js';
import EV from '../events.json' with { type: 'json' };

const P = EV.paste;
const UPG = [0, -1, 0];                        // galactic "up" (-Y), as in the other chapters
const HS = 0.02;                               // hero phone scale (world units per phone unit)
const D_NEAR = 9.0 * HS;                       // camera distance with the phone filling the frame
const D_FAR = 2600;

// where we are: an outer-arm point, the phone lying in the disc with its screen up
export function heroPlacement() {
  const ang = 2.1, RH = 880;
  const hero = [RH * Math.cos(ang), -9.0, RH * Math.sin(ang)];
  const nrm = UPG;
  const tang = norm([-Math.sin(ang), 0, Math.cos(ang)]);
  return { ang, hero, nrm, tang, pl: placement(hero, nrm, tang, HS) };
}

export default async function paste(ctx) {
  const { gl, atlasHi: A, corpus, galaxy } = ctx;
  const tx = new Texts(corpus.named), meta = corpus.v4;
  const rnd = mulberry32(1580);
  const wOf = (ids, s) => ids.reduce((a, id) => a + A.adv[id], 0) * s;

  const { ang, hero, nrm, tang, pl } = heroPlacement();
  const dad = add(add(hero, scale(pl.r, 1.8)), scale(tang, 0.12));  // across the screen from us: the thread reads left to right

  const phone = new Phone(gl, A, tx, meta);
  const pasteIds = corpus.named.answers[0].ids;                        // the first reply, exactly as it was written

  // ---------------------------------------------------------------- camera: log-distance from the phone, Hermite keys [t, lnD, slope]
  // out fast; linger among everyone else; then all the way out. Back in, the same road, quicker.
  const herm = (keys) => (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, v0, m0] = keys[i], [t1, v1, m1] = keys[i + 1];
      if (t <= t1) {
        const h = t1 - t0, u = (t - t0) / h, u2 = u * u, u3 = u2 * u;
        return (2 * u3 - 3 * u2 + 1) * v0 + (u3 - 2 * u2 + u) * h * m0 + (-2 * u3 + 3 * u2) * v1 + (u3 - u2) * h * m1;
      }
    }
    return keys[keys.length - 1][1];
  };
  const L = Math.log;
  const out = herm([[P.pull[0], L(D_NEAR), 0], [P.pull[0] + 1.4, L(1.2), 0.6], [P.pull[0] + 7.5, L(40), 0.6], [P.pull[1], L(D_FAR), 0]]);
  const back = herm([[P.push[0], L(D_FAR), 0], [P.push[0] + 3.2, L(40), -0.8], [P.push[0] + 7.2, L(1.2), -0.7], [P.push[1], L(D_NEAR), 0]]);
  const lnDist = (t) => (t < P.push[0] ? out(t) : back(t));
  const distAt = (t) => Math.exp(lnDist(t));
  // phone-space framing while close: keyboard, input box and dad's message
  const closeCam = (t, base) => {
    const x = t - base;
    return { pos: [0.6 + 0.2 * Math.sin(x * 0.25), 6.2, 9.0 - 0.6 * smoothstep(0, 10, x)], target: [-0.3, 7.6, 0], up: [0, 1, 0], fov: 32, focus: 9.0, coc: 0.02, cocMax: 0.04, near: 0.05 };
  };
  function worldCam(t) {
    const d = distAt(t);
    const far = smoothstep(Math.log(20), Math.log(D_FAR), Math.log(d));
    const farP = smoothstep(Math.log(250), Math.log(D_FAR), Math.log(d));
    // the axis tilts a little as we leave, so the final view is the whole galaxy, slightly from the side
    const axis = norm(add(scale(nrm, 1), scale(norm([Math.cos(ang), 0, Math.sin(ang)]), 0.35 * farP)));
    const close = pl.camW(closeCam(t, P.phone_in[0]));
    const near = smoothstep(Math.log(D_NEAR * 1.5), Math.log(D_NEAR * 8), Math.log(d));
    const pos = add(mix3(hero, [0, 0, 0], farP * 0.97), scale(mix3(norm(sub(close.pos, hero)), axis, near), d));
    const target = mix3(mix3(close.target, hero, near), [0, 0, 0], farP * 0.97);
    const up = norm(mix3(close.up, tang, near));
    return { pos, target, up, fov: lerp(32, 38, far), focus: d, coc: lerp(0.02, 0.0012, near), cocMax: 0.04, near: Math.min(0.02, d * 0.1), far: 1e6,
      nearFade: [d * 0.05, d * 0.2] };
  }
  const frame = (t) => {
    const w = worldCam(t), fwd = norm(sub(w.target, w.pos)), right = norm(cross(fwd, w.up));
    return { ...w, fwd, right, up: cross(right, fwd) };
  };
  // when, on the way back in, the camera is as far out as it was at time t on the way out
  const mirror = (t) => {
    const v = out(t);
    let lo = P.push[0], hi = P.push[1];
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (back(m) > v) lo = m; else hi = m; }
    return (lo + hi) / 2;
  };

  // ---------------------------------------------------------------- everyone else: what they received, and the reply they pasted under it
  // Each one is set in front of the camera at its moment, so it sweeps in from the edge, is readable, and shrinks away.
  const minis = new GlyphLayer(gl, A, 40000, { dynamic: true });
  const others = meta.others.map((o, i) => ({ ...o, ids: { name: tx.ids('others', o.name), msg: tx.ids('others', o.msg), reply: tx.ids('others', o.reply),
    gloss: tx.ids(i === 2 ? 'others' : 'gloss', i === 2 ? '我们能谈谈吗？' : o.gloss) } }));
  const fill = corpus.named.fill.map((l) => l.ids);
  const names = corpus.named.names.map((l) => l.ids);
  const pool = corpus.named.tree.map((l) => l.ids);
  const aspect = ctx.W / ctx.H;
  const setAt = (t, sx, sy, size) => {
    const c = frame(t);
    const dist = 0.55 * distAt(t);
    const hh = dist * Math.tan((c.fov * Math.PI) / 360), hw = hh * aspect;
    return { c: add(add(add(c.pos, scale(c.fwd, dist)), scale(c.right, sx * hw)), scale(c.up, sy * hh)), s: size * hh, right: c.right, up: c.up, t, tb: mirror(t) };
  };
  const minisDef = [];
  const spots = [[-0.62, 0.12], [0.18, -0.14], [-0.6, -0.16], [0.2, 0.14]];
  others.forEach((o, i) => minisDef.push({ ...setAt(P.others[i], spots[i][0], spots[i][1], 0.25), legible: o, win: [1.1, 0.4, 1.0, 1.7] }));
  for (let i = 0; i < 40; i++) {
    const t = P.pull[0] + 1.5 + rnd() * 7.5;
    const a = rnd() * Math.PI * 2, r = 0.45 + rnd() * 0.5;
    minisDef.push({ ...setAt(t, Math.cos(a) * r, Math.sin(a) * r * 0.85, 0.08 + rnd() * 0.06), name: names[i % names.length], msg: fill[(i * 7) % fill.length],
      reply: pool[(i * 5) % pool.length], win: [0.9, 0.3, 0.6, 1.4] });
  }
  function buildMinis(t) {
    minis.clear();
    const backIn = t >= P.push[0];
    for (const m of minisDef) {
      const tc = backIn ? m.tb : m.t, [a0, a1, b0, b1] = m.win;
      const vis = backIn ? smoothstep(tc - 0.8, tc - 0.3, t) * (1 - smoothstep(tc + 0.5, tc + 1.1, t)) : smoothstep(tc - a0, tc - a1, t) * (1 - smoothstep(tc + b0, tc + b1, t));
      // never let one fill the frame: too close, it only blurs past
      const cam_ = worldCam(t);
      const dist = Math.max(1e-4, len(sub(m.c, cam_.pos)));
      const app = (4.1 * m.s) / (2 * dist * Math.tan((cam_.fov * Math.PI) / 360));
      const v2 = vis * (1 - smoothstep(0.75, 1.15, app));
      if (v2 <= 0.003) continue;
      const put = (x, y, ids, size, col, I_) => {
        const I = I_ * (v2 / vis);
        if (I <= 0.003) return;
        let pen = 0;
        for (const id of ids) {
          if (A.meta.entries[id][2] > 0) minis.push([...add(add(m.c, scale(m.right, (x + pen) * m.s)), scale(m.up, y * m.s)), size * m.s], [...m.right, id], [...col, I]);
          pen += A.adv[id] * size;
        }
      };
      const o = m.legible;
      const nm = o ? o.ids.name : m.name, msg = o ? o.ids.msg : m.msg, rep = o ? o.ids.reply : m.reply;
      put(-3.3, 2.2, nm, 0.26, [0.82, 0.82, 0.86], 0.55 * vis);
      const mLines = msg.some((id) => A.meta.entries[id][2] === 0) ? phone.wrapWords(msg, 0.34, 6.4) : phone.wrap(msg, 0.34, 6.4);
      mLines.slice(0, 2).forEach((l, li) => put(-3.3, 1.3 + (mLines.length > 1 ? 0.5 - li * 0.5 : 0), l, 0.34, WARM, 1.0 * vis));
      if (o) put(-3.3, 0.75, o.ids.gloss, 0.2, [0.95, 0.9, 0.84], 0.7 * vis);
      if (!backIn) {
        const latin = rep.some((id) => A.meta.entries[id][2] === 0);
        const lines = latin ? phone.wrapWords(rep, 0.34, 6.0) : phone.wrap(rep, 0.34, 6.0);
        lines.forEach((l, li) => put(-3.3, -0.4 - li * 0.55, l, 0.34, CYAN, 0.95 * vis));
      } else {
        // gone: an empty line and a cursor, waiting for their own words
        minis.push([...add(add(m.c, scale(m.right, -3.28 * m.s)), scale(m.up, -0.3 * m.s)), m.s], [...m.right, -1], [1, 0.95, 0.88, 1.3 * vis * blink(t, 0)], [0.035, 0.4, 0, 0]);
      }
    }
    minis.upload();
  }

  // ---------------------------------------------------------------- the thread to dad: his words, again and again; ours, almost none
  const thread = new GlyphLayer(gl, A, 4000, { dynamic: true });
  const dadLines = ['最近忙吗？注意身体。', '到了说一声。', '到了没', '中秋快乐', '钓了条大的。', '你妈说你瘦了', '早点睡', '降温了，多穿点。'].map((s) => tx.ids('chat', s));
  const myLines = ['嗯'].map((s) => tx.ids('chat', s));
  function buildThread(t, uniAt) {
    thread.clear();
    const ld = lnDist(t);
    const vis = smoothstep(L(0.6), L(1.6), ld) * (1 - smoothstep(L(9), L(30), ld));
    if (vis > 0.003) {
      const TS_ = 0.045;
      const mid = add(scale(add(hero, dad), 0.5), scale(tang, 0.4));
      const bez = (u) => add(add(scale(hero, (1 - u) * (1 - u)), scale(mid, 2 * u * (1 - u))), scale(dad, u * u));
      const col = mix3(WARM, CYAN, uniAt(hero));
      // his messages slide along the arc toward us, one after another; each still reads left to right
      const arcL = 2.2;
      let s0 = -((t * 0.12) % 0.6), k = 0;
      while (s0 < arcL) {
        const ids = dadLines[k++ % dadLines.length];
        let sc = s0;
        for (const id of ids) {
          const u = sc / arcL;
          if (u > 0.04 && u < 0.97 && A.meta.entries[id][2] > 0) {
            const p = bez(u), dir = norm(sub(bez(Math.min(1, u + 0.01)), bez(u)));
            thread.push([...p, TS_], [...dir, id], [...col, 0.9 * vis * smoothstep(0.04, 0.12, u) * (1 - smoothstep(0.88, 0.97, u))]);
          }
          sc += A.adv[id] * TS_;
        }
        s0 = sc + 0.12;
      }
      // ours: one short word, below
      const lowMid = add(scale(add(hero, dad), 0.5), scale(tang, -0.28));
      thread.pushLine(myLines[0], lowMid, pl.r, TS_, [...col, 0.7 * vis]);
      const lightA = smoothstep(L(0.5), L(1.4), ld);
      for (const [P_, I] of [[hero, 3.0 * lightA], [dad, 2.4]]) thread.push([...P_, 1], [1, 0, 0, -1], [1.0, 0.9, 0.78, I * vis], [0.06, 0.06, 0, 0]);
    }
    thread.upload();
  }

  // ---------------------------------------------------------------- the uniform state: the wave of pastes, then the deletions
  const rep = new Float32Array(corpus.uniform);
  const seeds = (() => {
    // the first deletions: two points well away from us, on the near side of the disc
    const a1 = ang + 2.4, a2 = ang - 2.0;
    return [430 * Math.cos(a1), 430 * Math.sin(a1), 610 * Math.cos(a2), 610 * Math.sin(a2)];
  })();
  const waveR = (t) => lerp(0, 2600, Math.pow(smoothstep(P.wave[0], P.wave[1], t), 1.3));
  const restore = (t) => {
    if (t < P.first_del) return 0;
    if (t < P.restore[0]) return lerp(0.001, 0.07, smoothstep(P.first_del, P.restore[0], t));
    if (t < P.hold_del[0]) return lerp(0.07, 0.97, Math.pow(smoothstep(P.restore[0], P.restore[1], t), 1.4));
    return lerp(0.97, 1.05, smoothstep(P.hold_del[0], P.hold_del[1], t));
  };
  // lines slide onto the spirals only once we are far enough out to see the whole disc do it
  const uniOf = (t) => ({ C: hero, R: waveR(t), W: 180, restore: restore(t), seeds, heroR: 150, rep, snap: smoothstep(P.pull[1] - 0.5, P.pull[1] + 3.0, t) });
  // the same field, evaluated on the CPU for the minis and the thread (matches the shader closely enough)
  function uniAtFn(t) {
    const u = uniOf(t);
    return (p) => {
      const d = Math.hypot(p[0] - hero[0], p[2] - hero[2]);
      const w = 1 - smoothstep(u.R - u.W, u.R, d);
      let n = 0.5;
      n = Math.max(n, 1 - smoothstep(u.heroR * 0.45, u.heroR, d));
      return w * (1 - smoothstep(n - 0.03, n + 0.03, u.restore));
    };
  }

  // galactic time: slow, then frozen while everything is the same
  const T = clock((t) => 0.3 * (1 - smoothstep(P.wave[0], P.wave[0] + 4, t)) + 0.3 * smoothstep(P.restore[0], P.restore[1], t), P.start, 300);

  // ---------------------------------------------------------------- the hero phone's state
  function phoneState(t) {
    const st = { t, scroll: 'bottom', keyboard: 1, I: smoothstep(P.phone_in[0], P.phone_in[1], t), keys: [], input: { segs: [] } };
    const pressA = smoothstep(P.press, P.press + 0.25, t) * (1 - smoothstep(P.menu + 0.2, P.menu + 0.6, t));
    st.press = { x: -1.2, y: 6.5, a: pressA, r: lerp(0.2, 0.7, smoothstep(P.press, P.menu, t)) };
    st.menu = smoothstep(P.menu, P.menu + 0.2, t) * (1 - smoothstep(P.paste, P.paste + 0.15, t));
    if (t >= P.paste) {
      // deletion at the end: held backspace, faster and faster, down to 爸，
      let n = pasteIds.length;
      if (t > P.hold_del[0]) {
        const u = clamp((t - P.hold_del[0]) / (P.hold_del[1] - P.hold_del[0]));
        n = Math.max(2, Math.round(lerp(pasteIds.length, 2, Math.pow(u, 1.6))));
      }
      const warm = smoothstep(P.warm[0], P.warm[1], t);
      const flash = Math.exp(-(t - P.paste) * 5);
      st.input.segs = [{ ids: pasteIds.slice(0, Math.min(2, n)), col: mix3(mix3(CYAN, [0.9, 0.98, 1], flash), WARM, warm), I: 1.1 + flash },
        { ids: pasteIds.slice(2, n), col: mix3(CYAN, [0.9, 0.98, 1], flash), I: 1.1 + flash }];
      st.input.cursor = t > P.hold_del[1] ? blink(t, 0) : 1;
    } else st.input.cursor = blink(t, 0);
    st.sendGlow = t >= P.send_glow && t < P.hold_del[0] ? smoothstep(P.send_glow, P.send_glow + 0.5, t) * (0.75 + 0.25 * Math.sin((t - P.send_glow) * 2 * Math.PI * 0.5)) : 0;
    // every send key at once, held
    if (t >= P.hold[0] && t < P.hold[1] + 0.5) st.sendGlow = 1;
    return st;
  }

  // ---------------------------------------------------------------- render
  function render(c, tl, t) {
    const wc = worldCam(t);
    const cam = c.cam(wc);
    const uni = uniOf(t);
    const uniAt = uniAtFn(t);
    const d = distAt(t);
    c.scene();
    const far = smoothstep(Math.log(5), Math.log(400), Math.log(d));
    galaxy.draw(cam, { T: T(t), up: UPG, intensity: lerp(0.25, 1.0, far), hazeIntensity: lerp(0.0, 1.0, far), uni,
      dimNear: [Math.max(D_NEAR * 2, d * 0.3), Math.max(D_NEAR * 40, d * 1.2), lerp(0.0, 1, smoothstep(0.35, 1, far))] });
    // the minis and the thread exist between the near and the far views
    buildMinis(t);
    minis.draw(cam, { uUp: cam.up });
    buildThread(t, uniAt);
    thread.draw(cam, { uUp: cam.up });
    // our own phone, in its own space
    const near = 1 - smoothstep(Math.log(D_NEAR * 20), Math.log(D_NEAR * 120), Math.log(d));
    if (near > 0.002) {
      phone.build({ ...phoneState(t), I: phoneState(t).I * near });
      phone.draw(c.cam(pl.cam(wc)));
    }
  }

  const grade = (t) => {
    const d = distAt(t), far = smoothstep(Math.log(5), Math.log(400), Math.log(d));
    const hold = t >= P.hold[0] && t < P.hold[1] ? 1 : 0;
    return { bloom: lerp(0.06, 0.08, far), streak: 0.06, streakThreshold: 0.9, grain: 0.025, vignette: lerp(0.5, 0.42, far), sat: 1.05,
      exposure: lerp(1.0, 1.05, far), fade: smoothstep(P.phone_in[0], P.phone_in[1], t) };
  };
  const shot = (id, s, e, mb) => ({ id, start: s, end: e, mb, render, post: (tl, t) => grade(t) });
  ctx.poses.hero = { pl, phone };
  return [shot('S16', P.start, P.pull[0], 2), shot('S17', P.pull[0], P.hold[0], 10), shot('S18', P.hold[0], P.hold[1], 2),
    shot('S19', P.hold[1], P.push[0], 3), shot('S20', P.push[0], P.end, 10)];
}
