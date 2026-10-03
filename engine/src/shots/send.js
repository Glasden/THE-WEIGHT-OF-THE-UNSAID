// CHAPTER THREE · SEND — S21 in their own words · S22 sent · S23 the wait · S24 在。 ·
// S25 out from the phone until 在。 is one light in the galaxy, bending the light around it; the line · S26 credits.
import { GlyphLayer } from '../glyphs.js';
import { mulberry32, clamp, lerp, smoothstep, mix3, add, sub, scale, norm, len, easeInOut } from '../math.js';
import { project } from '../camera.js';
import { Phone } from '../phone.js';
import { WARM, Texts, blink } from './common.js';
import { heroPlacement } from './paste.js';
import EV from '../events.json' with { type: 'json' };

const S = EV.send, CR = EV.credits_roll;
const UPG = [0, -1, 0];

export default async function send(ctx) {
  const { gl, atlasHi: A, corpus, galaxy, W, H } = ctx;
  const tx = new Texts(corpus.named), meta = corpus.v4;
  const k = (v) => (v * H) / 1608;
  const { pl, hero, nrm, tang, ang } = heroPlacement();   // the phone's place in the galaxy, as in the paste chapter
  const slerp = (a, b, u) => norm(add(scale(a, 1 - u), scale(b, u)));
  const phone = new Phone(gl, A, tx, meta);

  // characters of what gets typed, by character
  const charId = {};
  for (const s of [meta.final[0], meta.draft_later]) { const ids = tx.ids('phone', s); [...s].forEach((ch, i) => (charId[ch] = ids[i])); }
  const idsOf = (s) => [...s].map((ch) => charId[ch]);
  const startIds = idsOf('爸，');
  const events = [...S.commits.map((c) => ({ t: c.t, add: c.text })), ...S.dels.map((t) => ({ t, del: 1 }))].sort((a, b) => a.t - b.t);
  function typed(t) {
    let ids = startIds.slice(), lastT = S.start;
    for (const e of events) {
      if (e.t > t) break;
      if (e.add) ids = ids.concat(idsOf(e.add)); else ids = ids.slice(0, Math.max(2, ids.length - 1));
      lastT = e.t;
    }
    const marked = S.keys.filter((e) => e.t > lastT && e.t <= t && /^[a-z]$/.test(e.k)).map((e) => e.k).join('');
    const next = S.commits.find((c) => c.t > t);
    return { ids, marked, candidate: marked && next ? idsOf(next.text) : null };
  }

  function state(t) {
    const sent = t >= S.send;
    const st = { t, scroll: 'bottom', keyboard: 1 - smoothstep(S.send + 1.4, S.send + 2.2, t), keys: S.keys, sendAt: S.send, I: 1, input: { segs: [] }, extra: [] };
    if (!sent) {
      const ty = typed(t);
      const busy = S.keys.some((e) => t >= e.t - 0.1 && t < e.t + 0.45);
      st.input = { segs: [{ ids: ty.ids, col: WARM }], marked: ty.marked, candidate: ty.candidate, cursor: Math.max(busy ? 1 : 0, blink(t, 0)),
        gloss: { ids: tx.ids('gloss', meta.final[1]), a: smoothstep(S.gloss, S.gloss + 0.6, t) } };
      st.sendGlow = smoothstep(S.gloss, S.gloss + 0.8, t);
    } else {
      st.input = { segs: [], cursor: blink(t, 0) * 0.8 };
      st.extra.push({ k: 'me', text: meta.final[0], gloss: meta.final[1], at: S.send });
      st.delivered = smoothstep(S.delivered, S.delivered + 0.4, t);
    }
    // his side: typing… (twice), then the answer
    const typing = S.typing.reduce((a, [a0, a1]) => Math.max(a, smoothstep(a0, a0 + 0.25, t) * (1 - smoothstep(a1 - 0.2, a1, t))), 0);
    if (typing > 0.003 && t < S.reply) st.extra.push({ k: 'dad', text: '对方正在输入…', at: S.typing[0][0] - 0.35, I: 0.55 * typing, alpha: typing });
    if (t >= S.reply) {
      st.extra.push({ k: 'date', text: '23:48', at: S.reply });
      st.extra.push({ k: 'dad', text: meta.reply[0], gloss: meta.reply[1], at: S.reply, I: 1.1 });
    }
    st.typing = 0;
    // leaving: everything fades but his answer
    if (t > S.out[0]) { st.I = 1 - smoothstep(S.out[0], S.out[0] + 1.6, t); st.keep = { text: meta.reply[0], I: 1.15 }; st.keyboard = 0; }
    return st;
  }

  // phone-space camera: the keys while writing; then back a little to hold the conversation
  function cam(t) {
    const u = smoothstep(S.send + 0.6, S.send + 3.0, t);
    const w = smoothstep(S.wait, S.reply, t);
    const side = smoothstep(S.wait - 0.5, S.wait + 1.5, t) * (1 - smoothstep(S.typing[0][0] - 1.6, S.typing[0][0] + 0.2, t));
    const sx = 4.2 * side;
    // when he answers, lean in a little toward his side
    const r = smoothstep(S.reply - 0.2, S.reply + 3.8, t);
    const pos = [lerp(lerp(0.9, 0.35, u) + sx, -0.6, r), lerp(lerp(2.9, lerp(4.4, 4.7, w), u), 3.6, r), lerp(lerp(8.6, lerp(11.6, 12.6, w), u), 9.6, r)];
    const target = [lerp(lerp(0, -0.2, u) + sx, -1.0, r), lerp(lerp(5.2, lerp(4.9, 5.3, w), u), 4.1, r), 0];
    return { pos, target, up: [0, 1, 0], fov: 34, focus: lerp(lerp(8.4, 12.2, u), 9.4, r), coc: lerp(0.018, 0.012, u), cocMax: 0.04, near: 0.05 };
  }

  function render(c, tl, t) {
    const pc = cam(t);
    const wc = pl.camW(pc);
    c.scene();
    // behind the phone: the galaxy, warm again, far out of focus
    galaxy.draw(c.cam({ ...wc, far: 1e6 }), { T: 330, up: UPG, intensity: 0.22, hazeIntensity: 0.0, dimNear: [0.2, 4, 0.1] });
    phone.build(state(t));
    phone.draw(c.cam(pc));
  }

  // ---------------------------------------------------------------- S25: one word, and its weight
  // where 在。 sits in the world: read from the phone as it is laid out when we start to leave
  phone.build(state(S.out[0]));
  const an = phone.anchors[meta.reply[0]];
  const zai = pl.toWorld([an.tx + an.w * 0.45, an.ty + 0.12, 0]);
  const W0 = pl.camW(cam(S.out[0]));
  const radial = norm([Math.cos(ang), 0, Math.sin(ang)]);
  function outCam(t) {
    const u = clamp((t - S.out[0]) / (S.out[1] - S.out[0])), e = easeInOut(u);
    const d0 = len(sub(W0.pos, zai));
    const d = Math.exp(lerp(Math.log(d0), Math.log(2400), e));
    const far = smoothstep(Math.log(250), Math.log(2400), Math.log(d));
    // up and outward: behind the word lies the bright inner disc, so there is light for it to bend
    const axis = norm(add(nrm, scale(radial, 0.9)));
    const dir = slerp(norm(sub(W0.pos, zai)), axis, smoothstep(0, 0.35, u));
    const pos = add(mix3(zai, [0, 0, 0], far * 0.55), scale(dir, d));
    const target = mix3(mix3(W0.target, zai, smoothstep(0, 0.3, u)), [0, 0, 0], far * 0.55);
    return { pos, target, up: slerp(W0.up, tang, smoothstep(0, 0.35, u)), fov: lerp(34, 38, far), focus: d, coc: lerp(0.012, 0.0012, smoothstep(0, 0.4, u)),
      cocMax: 0.04, near: Math.min(0.02, d * 0.1), far: 1e6, d };
  }
  const glow = new GlyphLayer(gl, A, 8, { dynamic: true });
  function renderOut(c, tl, t) {
    const oc = outCam(t);
    const camW = c.cam(oc);
    c.scene();
    const far = smoothstep(Math.log(5), Math.log(600), Math.log(oc.d));
    galaxy.draw(camW, { T: 330, up: UPG, intensity: lerp(0.22, 1.0, far), hazeIntensity: far, dimNear: [Math.max(0.4, oc.d * 0.3), Math.max(8, oc.d * 1.2), far] });
    phone.build(state(t));
    phone.draw(c.cam(pl.cam(oc)));
    // the word becomes a light, drawn unbent in front of what it bends
    c.fg();
    const la = smoothstep(Math.log(0.25), Math.log(2.5), Math.log(oc.d));
    glow.clear();
    if (la > 0.003) glow.push([...zai, 1], [1, 0, 0, -1], [1.0, 0.86, 0.66, 3.2 * la], [0.0045 * oc.d, 0.0045 * oc.d, 0, 0]);
    glow.upload();
    glow.draw(camW, { uUp: camW.up });
    const sp = project(camW, zai);
    const s = smoothstep(S.lens[0], S.lens[1], t);
    const lenses = sp && s > 0.001 ? [[sp[0], H - sp[1], 0.095 * H, s]] : [];
    return { lenses, coreDark: 0, useFg: true, ringGain: 0.45 };
  }

  // ---------------------------------------------------------------- credits (from v3): typed as model output
  const CREDITS = [
    ['编剧  Written by', 'Claude Opus 5.5'],
    ['导演  Directed by', 'Claude Opus 5.5'],
    ['视觉与渲染  Visuals & Rendering', 'Claude Opus 5.5'],
    ['作曲与音效  Music & Sound', 'Claude Opus 5.5'],
    ['剪辑  Edited by', 'Claude Opus 5.5'],
    null,
    ['第一位读者  First Reader', 'Glasden'],
  ];
  function cursor2d(g, x, y, h, a) {
    g.fillStyle = `rgba(225,248,255,${a})`;
    g.shadowColor = 'rgba(150,230,255,0.8)'; g.shadowBlur = k(16);
    g.fillRect(x, y - h * 0.8, k(5), h);
    g.shadowBlur = 0;
  }
  function credits(g, t) {
    const T21 = CR.start + 0.6, size = k(40), CPS = 120;
    g.font = `400 ${size}px JBMono, SansSC`; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    const blockW = k(1900), x0 = W / 2 - blockW / 2, lh = size * 1.85, y0 = H * 0.5 - lh * 3;
    const dotW = g.measureText('·').width;
    let clock = T21 + 0.6, cx = W / 2, cy = H * 0.5;
    const fadeAll = 1 - smoothstep(CR.end - 2.2, CR.end - 0.6, t);
    CREDITS.forEach((row, i) => {
      const y = y0 + i * lh;
      if (!row) { clock += 0.5; return; }
      const n = Math.max(3, Math.floor((blockW - g.measureText(row[0] + '  ').width - g.measureText('  ' + row[1]).width) / dotW));
      const s = [row[0] + '  ', '·'.repeat(n), '  ' + row[1]];
      const full = s.join('');
      const shown = Math.floor(clamp((t - clock) * CPS, 0, [...full].length));
      clock += [...full].length / CPS + 0.2;
      if (shown <= 0) return;
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
    if (fadeAll > 0 && t > CR.start + 0.4) cursor2d(g, t < T21 + 0.6 ? W / 2 : cx, t < T21 + 0.6 ? H * 0.5 : cy, size * 1.15, fadeAll * (t < clock ? 1 : blink(t, 0)));
    return true;
  }

  const grade = (t) => ({ bloom: 0.07, streak: 0.05, streakThreshold: 1.0, grain: 0.02, vignette: 0.5, sat: 1.0, exposure: 1.0,
    fade: smoothstep(S.start - 0.2, S.start + 0.6, t) * (1 - smoothstep(S.fade[0], S.fade[1], t)) });
  const shot = (id, s, e, mb, extra = {}) => ({ id, start: s, end: e, mb, render, post: (tl, t) => grade(t), ...extra });
  return [
    shot('S21', S.start, S.send, 3),
    shot('S22', S.send, S.wait, 3),
    shot('S23', S.wait, S.typing[0][0] - 0.5, 2, { cardY: 0.5, cardX: 0.7 }),
    shot('S24', S.typing[0][0] - 0.5, S.out[0], 2),
    { id: 'S25', start: S.out[0], end: S.end, mb: 12, render: renderOut, cardY: 0.16,
      post: (tl, t) => ({ bloom: 0.08, streak: 0.06, streakThreshold: 0.9, grain: 0.022, vignette: 0.45, sat: 1.05, exposure: 1.0, fade: 1 - smoothstep(S.fade[0], S.fade[1], t) }) },
    { id: 'S26', start: CR.start, end: CR.end, mb: 1, render: (c) => c.scene(), post: () => ({ fade: 0, grain: 0.012 }), cards: (g, tl, t) => credits(g, t) },
  ];
}
