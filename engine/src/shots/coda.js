// CODA — S20 out past the galaxy into a field of galaxies, each held by unseen weight ·
// S21 credits typed as model output · S22 the phone: the sentence finished by its own hand, and sent.
import { GlyphLayer } from '../glyphs.js';
import { mulberry32, clamp, lerp, smoothstep, norm, add, sub, scale, cross, len, easeInOut, rotate, track } from '../math.js';
import { project } from '../camera.js';
import { galT } from './common.js';
import { blink } from './cold.js';
import EV from '../events.json' with { type: 'json' };

const UP = [0, -1, 0];

function modelMatrix(axis, ang, s, tr) {
  const ex = rotate([1, 0, 0], axis, ang), ey = rotate([0, 1, 0], axis, ang), ez = rotate([0, 0, 1], axis, ang);
  return new Float32Array([ex[0] * s, ex[1] * s, ex[2] * s, 0, ey[0] * s, ey[1] * s, ey[2] * s, 0, ez[0] * s, ez[1] * s, ez[2] * s, 0, tr[0], tr[1], tr[2], 1]);
}

export default async function coda(ctx) {
  const { gl, atlasHi: A, corpus, galaxy, W, H } = ctx;
  const named = corpus.named;
  const V = ctx.poses.voidStar, dirV = ctx.poses.voidDir, K = ctx.lensK;
  const rnd = mulberry32(2350);
  const fwd = scale(dirV, -1);
  const right = norm(cross(fwd, UP)), up = cross(right, fwd);
  const T20 = EV.field.start, T21 = EV.credits_roll.start, T22 = EV.phone.start;
  const k = (v) => (v * H) / 1608;

  // ---------------------------------------------------------------- S20: the field of galaxies
  const others = [];
  for (let i = 0; i < 24; i++) {
    const depth = -22000 + rnd() * 60000;
    const spread = 0.55 * (36000 + Math.max(0, depth) * 0.45);
    const pos = add(add(scale(fwd, depth), scale(right, (rnd() - 0.5) * 2 * spread)), scale(up, (rnd() - 0.5) * 0.8 * spread));
    const axis = norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]);
    if (len(sub(pos, add(V, scale(dirV, 42000)))) < 12000) continue;
    others.push({ pos, model: modelMatrix(axis, rnd() * Math.PI, 0.8 + rnd() * 0.7, pos), frac: 0.08, I: 0.8 + rnd() * 0.4, lens: i < 6 });
  }
  const camAt = (t) => {
    const u = easeInOut(clamp((t - T20) / 11.5));
    const d = Math.exp(lerp(Math.log(13.4), Math.log(42000), u));
    return { pos: add(V, scale(dirV, d)), target: scale(V, 1 - smoothstep(0.1, 0.6, u)), d };
  };
  function renderField(c, tl, t) {
    const p = camAt(t);
    const cam = c.cam({ pos: p.pos, target: p.target, up: UP, fov: 36, focus: p.d, coc: lerp(0.005, 0.0, smoothstep(13, 200, p.d)), cocMax: 0.03,
      nearFade: [0.5, 3], far: 1e7 });
    const T = galT(168);
    c.scene();
    galaxy.draw(cam, { T, up: UP, hazeIntensity: 0.6 });
    const far = smoothstep(2500, 25000, p.d);
    if (far > 0) for (const o of others) galaxy.draw(cam, { T, model: o.model, frac: o.frac, intensity: (o.I * far) / o.frac * 0.55, hazeIntensity: 1.8 });
    const lenses = [];
    const lensAt = (P, m, s) => {
      const sp = project(cam, P);
      if (!sp) return;
      const te = (K * m) / Math.sqrt(len(sub(P, cam.pos)));
      if (s > 0.001 && sp[0] > -te * 3 && sp[0] < W + te * 3 && sp[1] > -te * 3 && sp[1] < H + te * 3) lenses.push([sp[0], H - sp[1], te, s]);
    };
    lensAt(V, 1, 1 - smoothstep(30, 140, p.d));
    lensAt([0, 0, 0], 12, far * 0.6);
    for (const o of others) if (o.lens) lensAt(o.pos, 3.5, far * 0.4);
    return { lenses, coreDark: lerp(1.0, 0.0, smoothstep(30, 300, p.d)), ringGain: lerp(0.35, 0.12, far) };
  }

  // ---------------------------------------------------------------- 2D: the last cursor and the credits
  function cursor2d(g, x, y, h, a) {
    g.fillStyle = `rgba(225,248,255,${a})`;
    g.shadowColor = 'rgba(150,230,255,0.8)'; g.shadowBlur = k(16);
    g.fillRect(x, y - h * 0.8, k(5), h);
    g.shadowBlur = 0;
  }
  const CREDITS = [
    ['编剧  Written by', 'Claude Opus 5.5'],
    ['导演  Directed by', 'Claude Opus 5.5'],
    ['视觉与渲染  Visuals & Rendering', 'Claude Opus 5.5'],
    ['作曲与音效  Music & Sound', 'Claude Opus 5.5'],
    ['剪辑  Edited by', 'Claude Opus 5.5'],
    null,
    ['第一位读者  First Reader', 'Glasden'],
  ];
  function credits(g, t) {
    const size = k(40);
    g.font = `400 ${size}px JBMono, SansSC`; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    const blockW = k(1900), x0 = W / 2 - blockW / 2, lh = size * 1.85, y0 = H * 0.5 - lh * 3;
    const dotW = g.measureText('·').width;
    let clock = T21 + 0.6, cx = W / 2, cy = H * 0.5, any = false;
    const fadeAll = 1 - smoothstep(T22 - 1.2, T22 - 0.2, t);
    CREDITS.forEach((row, i) => {
      const y = y0 + i * lh;
      if (!row) { clock += 0.5; return; }
      const n = Math.max(3, Math.floor((blockW - g.measureText(row[0] + '  ').width - g.measureText('  ' + row[1]).width) / dotW));
      const s = [row[0] + '  ', '·'.repeat(n), '  ' + row[1]];
      const full = s.join('');
      const shown = Math.floor(clamp((t - clock) * 70, 0, [...full].length));
      clock += [...full].length / 70 + 0.35;
      if (shown <= 0) return;
      any = true;
      let x = x0, left = shown;
      s.forEach((part, pi) => {
        const txt = [...part].slice(0, left).join('');
        left -= [...txt].length;
        g.fillStyle = pi === 1 ? `rgba(160,232,255,${0.35 * fadeAll})` : pi === 2 ? `rgba(235,250,255,${0.95 * fadeAll})` : `rgba(190,238,255,${0.85 * fadeAll})`;
        g.fillText(txt, x, y);
        x += g.measureText(txt).width;
      });
      cx = x + k(6); cy = y;
    });
    if (fadeAll > 0) {
      const typing = t < clock;
      cursor2d(g, t < T21 + 0.6 ? W / 2 : cx, t < T21 + 0.6 ? H * 0.5 : cy, size * 1.15, fadeAll * (typing ? 1 : blink(t, 0)));
      any = true;
    }
    return any;
  }

  // ---------------------------------------------------------------- S22: the phone
  // phone space: x right, y up, z toward the camera; a 7 x 15 slab, keyboard at the bottom
  const PH = EV.phone;
  const ui = new GlyphLayer(gl, A, 6000, { dynamic: true });
  const keyId = {}; named.keys.forEach((l) => (keyId[l.text] = l.ids[0]));
  const phoneId = {}; named.phone.forEach((l) => (phoneId[l.text] = l.ids));
  const KEYS = [];
  const kw = 0.6, kg = 0.08, khgt = 0.78;
  [['qwertyuiop', 4.6, 0], ['asdfghjkl', 3.6, 0.34], ['zxcvbnm', 2.6, 0]].forEach(([row, y, off]) => {
    const n = row.length, total = n * (kw + kg) - kg;
    [...row].forEach((ch, i) => KEYS.push({ k: ch, x: -total / 2 + i * (kw + kg), y, w: kw, label: [keyId[ch]], ls: 0.36 }));
  });
  KEYS.push({ k: 'del', x: 2.55, y: 2.6, w: 0.95, label: phoneId['删除'], ls: 0.24 });
  KEYS.push({ k: '123', x: -3.4, y: 1.5, w: 0.95, label: phoneId['123'], ls: 0.24 });
  KEYS.push({ k: ',', x: -2.37, y: 1.5, w: 0.6, label: phoneId['，'], ls: 0.3 });
  KEYS.push({ k: 'space', x: -1.69, y: 1.5, w: 3.0, label: phoneId['空格'], ls: 0.26 });
  KEYS.push({ k: '.', x: 1.39, y: 1.5, w: 0.6, label: phoneId['。'], ls: 0.3 });
  KEYS.push({ k: 'send', x: 2.07, y: 1.5, w: 1.33, label: phoneId['发送'], ls: 0.28, accent: true });
  const press = (key, t) => {
    let a = 0;
    for (const e of PH.keys) if (e.k === key && t >= e.t) a = Math.max(a, Math.exp(-(t - e.t) * 9));
    if (key === 'send' && t >= PH.send) a = Math.max(a, Math.exp(-(t - PH.send) * 5));
    return a;
  };
  const FINAL = named.phone.filter((l) => /^(爸，其实|那年|我都知道|下个月)/.test(l.text)).flatMap((l) => l.ids);
  const DRAFT = named.request[1].ids;
  // candidate bar shows only the commonest characters — nothing of what is being said
  const charId = {};
  for (const set of Object.values(named)) for (const l of set) { const cs = [...l.text]; if (cs.length === l.ids.length) cs.forEach((ch, i) => (charId[ch] ??= l.ids[i])); }
  const COMMON = [...'的了我你是在吧'].filter((ch) => charId[ch] !== undefined).map((ch) => [charId[ch]]);
  // how much of the message is in the box at time t (characters)
  function msgLen(t) {
    let n = 0, started = false;
    for (const e of PH.keys) {
      if (t < e.t) break;
      if (e.k === 'space') { n += 4 + ((e.t * 7) | 0) % 4; started = true; }
      if (e.k === 'del') n = Math.max(0, n - 2);
    }
    return { n: Math.min(FINAL.length - 12, n), started };
  }
  const textW = 6.0, ts = 0.36;
  function wrap(ids, size, width) {
    const lines = [[]]; let x = 0;
    for (const id of ids) { const a = A.adv[id] * size; if (x + a > width && lines[lines.length - 1].length) { lines.push([]); x = 0; } lines[lines.length - 1].push(id); x += a; }
    return lines;
  }
  const rect = (x, y, w, h, I, col = [0.75, 0.8, 0.88]) => ui.push([x, y, 0, 1], [1, 0, 0, -1], [...col, I], [w, h, 0, 0]);
  const text = (ids, x, y, s, I, col = [1, 0.92, 0.84]) => ui.pushLine(ids, [x, y, 0], [1, 0, 0], s, [...col, I]);
  let bubbleAnchor = [0, 0, 0];
  function buildPhone(t) {
    ui.clear();
    const on = smoothstep(T22 + 0.1, T22 + 1.0, t);
    rect(-3.6, 7.5, 7.2, 15.0, 0.018 * on, [0.6, 0.65, 0.75]);                        // glass
    // dad's message from yesterday, top left
    text(phoneId['昨天 21:06'], -0.9, 13.75, 0.2, 0.35 * on, [0.8, 0.8, 0.85]);
    text(phoneId['爸爸'], -3.1, 13.25, 0.24, 0.5 * on, [0.85, 0.85, 0.9]);
    rect(-3.2, 12.45, wOfIds(phoneId['最近忙吗？注意身体。'], 0.34) + 0.5, 0.75, 0.07 * on);
    text(phoneId['最近忙吗？注意身体。'], -2.95, 12.33, 0.34, 0.85 * on);
    // the input box: the old draft, then the rest — written by hand
    const sent = t >= PH.send;
    const { n, started } = msgLen(t);
    const body = sent ? [] : started ? FINAL.slice(0, 12 + n) : DRAFT;
    const lines = wrap(body, ts, textW);
    const boxH = Math.max(1, lines.length) * ts * 1.5 + 0.35;
    rect(-3.4, 6.05 + boxH / 2, 6.8, boxH, 0.05 * on);
    // the old draft stays legible; whatever they add is theirs alone (privacy blur)
    let shown = 0;
    lines.forEach((ln, i) => {
      let x = -3.15;
      for (const id of ln) {
        const own = started && shown >= 12;
        ui.pushLine([id], [x, 6.05 + boxH - 0.42 - i * ts * 1.5, 0], [1, 0, 0], ts, [1, 0.92, 0.84, 1.1 * on], { blur: own ? 0.16 : 0 });
        x += A.adv[id] * ts; shown++;
      }
    });
    const last = lines[lines.length - 1] || [];
    const cxp = -3.15 + wOfIds(last, ts) + 0.05;
    const typing = PH.keys.some((e) => t >= e.t - 0.1 && t < e.t + 0.45);
    rect(cxp, 6.05 + boxH - 0.32 - (lines.length - 1) * ts * 1.5, 0.035, ts * 1.15, 1.4 * on * Math.max(typing ? 1 : 0, blink(t, 0)), [1, 0.95, 0.88]);
    // candidate bar while composing pinyin
    const composing = PH.keys.some((e) => e.k.length === 1 && t >= e.t && t < e.t + 0.9) && !sent;
    if (composing) COMMON.forEach((ids, i) => text(ids, -3.0 + i * 0.95, 5.45, 0.32, 0.55 * on));
    // keys
    for (const kk of KEYS) {
      const p = press(kk.k, t);
      const base = kk.accent ? [1.0, 0.62, 0.3] : [0.75, 0.8, 0.88];
      rect(kk.x, kk.y, kk.w, khgt, (kk.accent ? 0.22 : 0.06) * on + p * 1.6, p > 0.02 ? [1.0, 0.82, 0.62] : base);
      const lw = wOfIds(kk.label, kk.ls);
      text(kk.label, kk.x + (kk.w - lw) / 2, kk.y - kk.ls * 0.32, kk.ls, (0.6 + p * 2.5) * on, kk.accent ? [1.0, 0.85, 0.65] : [1, 0.95, 0.9]);
    }
    // sent: the bubble rises into the conversation
    if (sent) {
      const u = easeInOut(clamp((t - PH.send) / 0.7));
      const bl = wrap(FINAL, 0.3, 4.6);
      const bh = bl.length * 0.45 + 0.4;
      const y = lerp(6.6, 8.7, u);   // top of bubble ≈ 8.7 + bh ≈ 11.2 — clear of dad's message at 12.1
      const glow = Math.exp(-Math.max(0, t - PH.dnote) * 0.8) * (t > PH.dnote ? 1 : 0);
      rect(3.4 - 5.1, y + bh / 2, 5.1, bh, (0.1 + 0.1 * glow) * on, [1.0, 0.7, 0.42]);
      bl.forEach((ln, i) => ui.pushLine(ln, [3.4 - 4.85, y + bh - 0.5 - i * 0.45, 0], [1, 0, 0], 0.3, [1, 0.92, 0.84, 1.0 * on], { blur: 0.16 }));
      bubbleAnchor = [3.3, y - 0.45, 0];
    }
    ui.upload();
  }
  function wOfIds(ids, s) { return ids.reduce((a, id) => a + A.adv[id], 0) * s; }
  const phoneCam = (t) => {
    const s = smoothstep(PH.send, PH.send + 1.6, t);
    const shake = t > PH.haptic && t < PH.haptic + 0.18 ? Math.sin((t - PH.haptic) * 180) * 0.012 : 0;
    const pos = [lerp(1.3, 0.5, s) + shake, lerp(0.5, 4.6, s), lerp(6.8, 14.2, s) - smoothstep(T22, PH.send, t) * 0.5];
    const target = [lerp(0.1, 0.2, s), lerp(3.6, 10.4, s), 0];
    // focus stays on the keys: the words themselves are never ours to read
    return { pos, target, focus: len(sub(pos, [0, lerp(3.4, 2.0, s), 0])) };
  };
  function renderPhone(c, tl, t) {
    const pc = phoneCam(t);
    const cam = c.cam({ pos: pc.pos, target: pc.target, up: [0, 1, 0], fov: 38, focus: pc.focus, coc: 0.06, cocMax: 0.06, near: 0.05 });
    buildPhone(t);
    c.scene();
    ui.draw(cam, { uUp: [0, 1, 0] });
  }
  function delivered(g, t) {
    const a = smoothstep(PH.delivered, PH.delivered + 0.4, t) * (1 - smoothstep(PH.fade[0], PH.fade[1], t));
    if (a <= 0 || !ctx.lastCam) return false;
    const sp = project(ctx.lastCam, bubbleAnchor);
    if (!sp) return false;
    g.font = `400 ${k(36)}px SansSC, JBMono`;
    g.textAlign = 'right'; g.textBaseline = 'alphabetic';
    g.fillStyle = `rgba(240,236,228,${0.9 * a})`;
    g.fillText('已送达 · 23:47', sp[0], sp[1] + k(34));
    return true;
  }

  return [
    { id: 'S20', start: T20, end: T21, mb: 3, render: renderField,
      post: (tl, t) => ({ bloom: 0.07, streak: 0.08, streakThreshold: 0.9, grain: 0.028, vignette: 0.45, sat: 1.05,
        exposure: lerp(0.48, 1.4, smoothstep(T20 + 1, T20 + 7, t)), fade: 1 - smoothstep(T21 - 3.4, T21 - 0.6, t) }),
      cardY: 0.5, cards: (g, tl, t) => { if (t > T21 - 1.0) { cursor2d(g, W / 2, H * 0.5 + k(14), k(34), smoothstep(T21 - 1.0, T21 - 0.5, t) * blink(t, 0)); return true; } return false; } },
    { id: 'S21', start: T21, end: T22, mb: 1, render: (c) => c.scene(), post: () => ({ fade: 0, grain: 0.012 }), cards: (g, tl, t) => credits(g, t) },
    { id: 'S22', start: T22, end: EV.end, mb: 3, render: renderPhone, cards: (g, tl, t) => delivered(g, t),
      post: (tl, t) => ({ bloom: 0.07, streak: 0.05, streakThreshold: 1.0, grain: 0.02, vignette: 0.5, sat: 1.0, exposure: 1.0,
        fade: smoothstep(T22, T22 + 0.8, t) * (1 - smoothstep(PH.fade[0], PH.fade[1], t)) }) },
  ];
}
