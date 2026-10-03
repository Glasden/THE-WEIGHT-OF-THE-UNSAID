// The phone: one chat between "我" and 爸, drawn as glyphs in phone space.
// Phone space: x right, y up, z toward the viewer; the screen spans x -3.6..3.6, y 0..15, centre (0, 7.5, 0).
// Everything is rebuilt from a plain state object each sub-frame, so any shot can pose it.
import { GlyphLayer } from './glyphs.js';
import { clamp, lerp, smoothstep, add, sub, scale, dot, norm, cross } from './math.js';
import { WARM, CYAN, blink } from './shots/common.js';

const DAD_BUBBLE = [0.75, 0.8, 0.88], ME_BUBBLE = [1.0, 0.7, 0.42], GLOSS = [0.95, 0.9, 0.84], DIM = [0.82, 0.82, 0.86];
const TS = 0.34, TLH = 0.49, BW = 4.5, GS = 0.19, GLH = 0.29, DS = 0.19, GAP = 0.3;
const VIEW_TOP = 13.35;
const IN_TS = 0.36, IN_W = 6.0;

export class Phone {
  constructor(gl, A, tx, meta, capacity = 12000) {
    this.A = A; this.tx = tx;
    this.ui = new GlyphLayer(gl, A, capacity, { dynamic: true });
    this.keyId = {};
    for (const ch of 'qwertyuiopasdfghjklzxcvbnm') this.keyId[ch] = tx.ids('keys', ch)[0];
    this.items = this.layout(meta.chat.map((c) => ({ ...c })));
    this.contentH = this.items.length ? this.items[this.items.length - 1].y + this.items[this.items.length - 1].h : 0;
    const P = (s) => tx.ids('phone', s);
    this.ui_ = { name: P('爸爸'), typing: P('对方正在输入…'), paste: P('粘贴'), delivered: P('已送达 · 23:47'), send: P('发送'), del: P('删除'),
      space: P('空格'), n123: P('123'), q: P('？'), dot: P('。') };
    this.commons = P('的了我你是在吧好').map((id) => [id]);
    // ids of closing punctuation, from whatever lines happen to contain them
    this.closing = new Set();
    for (const set of ['chat', 'phone', 'answers', 'others', 'tokens']) for (const l of tx.lines(set)) [...l.text].forEach((ch, i) => { if ([...l.text].length === l.ids.length && '，。？！、：；…'.includes(ch)) this.closing.add(l.ids[i]); });
    this.KEYS = [];
    const kw = 0.6, kg = 0.08;
    [['qwertyuiop', 4.6, 0], ['asdfghjkl', 3.6, 0.34], ['zxcvbnm', 2.6, 0]].forEach(([row, y]) => {
      const n = row.length, total = n * (kw + kg) - kg;
      [...row].forEach((ch, i) => this.KEYS.push({ k: ch, x: -total / 2 + i * (kw + kg), y, w: kw, label: [this.keyId[ch]], ls: 0.36 }));
    });
    this.KEYS.push({ k: 'del', x: 2.55, y: 2.6, w: 0.95, label: this.ui_.del, ls: 0.24 });
    this.KEYS.push({ k: '123', x: -3.4, y: 1.5, w: 0.95, label: this.ui_.n123, ls: 0.24 });
    this.KEYS.push({ k: '？', x: -2.37, y: 1.5, w: 0.6, label: this.ui_.q, ls: 0.3 });
    this.KEYS.push({ k: 'space', x: -1.69, y: 1.5, w: 3.0, label: this.ui_.space, ls: 0.26 });
    this.KEYS.push({ k: '。', x: 1.39, y: 1.5, w: 0.6, label: this.ui_.dot, ls: 0.3 });
    this.KEYS.push({ k: 'send', x: 2.07, y: 1.5, w: 1.33, label: this.ui_.send, ls: 0.28, accent: true });
  }

  w(ids, s) { return ids.reduce((a, id) => a + this.A.adv[id], 0) * s; }
  wrap(ids, s, width, text = null) {
    // prefer a break right after a sentence end when the line must wrap anyway
    if (text && [...text].length === ids.length && this.w(ids, s) > width) {
      const chars = [...text];
      for (let i = chars.length - 2; i > 0; i--) {
        if ('。？！'.includes(chars[i]) && this.w(ids.slice(0, i + 1), s) <= width + s * 0.6 && this.w(ids.slice(i + 1), s) <= width) return [ids.slice(0, i + 1), ids.slice(i + 1)];
      }
    }
    const closing = this.closing;
    const lines = [[]]; let x = 0;
    for (const id of ids) {
      const a = this.A.adv[id] * s;
      // closing punctuation hangs on the line it ends instead of starting the next
      if (x + a > width && lines[lines.length - 1].length && !closing.has(id)) { lines.push([]); x = 0; }
      lines[lines.length - 1].push(id); x += a;
    }
    return lines;
  }
  // words-aware wrap for the Latin subtitles
  wrapWords(ids, s, width) {
    const sp = ids.map((id) => this.A.meta.entries[id][2] === 0);
    const lines = [[]]; let x = 0, i = 0;
    while (i < ids.length) {
      let j = i; while (j < ids.length && !sp[j]) j++;
      const word = ids.slice(i, j + 1);
      const ww = this.w(word.filter((_, k) => i + k < j), s);
      if (x + ww > width && lines[lines.length - 1].length) { lines.push([]); x = 0; }
      lines[lines.length - 1].push(...word); x += this.w(word, s);
      i = j + 1;
    }
    return lines.map((l) => (l.length && this.A.meta.entries[l[l.length - 1]][2] === 0 ? l.slice(0, -1) : l));
  }

  // content space: y grows downward from the top of the oldest item
  layout(items, y0 = 0) {
    let y = y0;
    for (const it of items) {
      if (it.k === 'date') {
        it.ids = this.tx.has('chat', it.text) ? this.tx.ids('chat', it.text) : this.tx.ids('phone', it.text);
        it.h = 0.75; it.y = y; y += it.h; continue;
      }
      it.ids = it.ids || (this.tx.has('chat', it.text) ? this.tx.ids('chat', it.text) : this.tx.ids('phone', it.text));
      it.lines = this.wrap(it.ids, TS, BW, it.text);
      it.bw = Math.max(...it.lines.map((l) => this.w(l, TS))) + 0.5;
      it.bh = it.lines.length * TLH + 0.3;
      it.g = it.gloss ? this.wrapWords(this.tx.ids('gloss', it.gloss), GS, 5.2) : [];
      it.h = it.bh + (it.g.length ? it.g.length * GLH + 0.1 : 0) + GAP;
      it.y = y; y += it.h;
    }
    return items;
  }

  // offset (content y at the view's top) that brings an item near the top of the view; 'bottom' shows the end
  offsetFor(key, viewH, extraH = 0) {
    const bottom = Math.max(0, this.contentH + extraH - viewH + 0.3);
    if (key === 'bottom') return bottom;
    const it = this.items.find((i) => i.k === 'date' && i.text === key);
    if (!it) throw new Error('no chat item ' + key);
    return clamp(it.y - 0.35, 0, bottom);
  }
  viewH(keyboard) { return VIEW_TOP - this.inputTop(keyboard) - 0.35; }
  // where a chat bubble's first line of words starts (phone units) at a given scroll, input box empty
  textPos(text, scroll, keyboard = 0) {
    const vb = this.inputTop(keyboard) + 0.35, viewH = VIEW_TOP - vb;
    const off = scroll === 'bottom' ? this.offsetFor('bottom', viewH) : scroll;
    const itm = this.items.find((i) => i.k !== 'date' && i.text === text);
    if (!itm) throw new Error('no bubble ' + text);
    const top = VIEW_TOP - (itm.y - off);
    const bx = itm.k === 'me' ? 3.3 - itm.bw : -3.3;
    return [bx + 0.25, top - 0.15 - TS * 0.86];
  }
  inputBottom(keyboard) { return lerp(0.55, 5.85, keyboard); }
  inputTop(keyboard, lines = 1) { return this.inputBottom(keyboard) + Math.max(1, lines) * 0.54 + 0.35; }

  rect(x, y, w, h, I, col) { this.ui.push([x, y, 0, 1], [1, 0, 0, -1], [...col, I], [w, h, 0, 0]); }
  line(ids, x, y, s, col, I, blur = 0) {
    if (I <= 0.002) return;
    let pen = x;
    for (const id of ids) {
      if (this.A.meta.entries[id][2] > 0) this.ui.push([pen, y, 0, s], [1, 0, 0, id], [...col, I], [0, 0, blur, 0]);
      pen += this.A.adv[id] * s;
    }
  }

  // st: { t, scroll ('bottom' | content offset), speed, keyboard 0..1, extra: [items appended, each with .at],
  //       glossA, input: { segs: [{ids, col, I}], marked: 'pinyin', cursor 0..1|true, impression: {ids, a}, gloss: {ids, a} },
  //       typing 0..1, menu 0..1, press: {x, y, a}, keys: [{t, k}], sendGlow 0..1, delivered 0..1, I }
  build(st) {
    const ui = this.ui, t = st.t, I = st.I ?? 1;
    ui.clear();
    const kb = st.keyboard ?? 0;
    this.rect(-3.6, 7.5, 7.2, 15.0, 0.016 * I, [0.6, 0.65, 0.75]);
    // header: the name, or the other side typing
    const ty = st.typing ?? 0;
    const nw = this.w(this.ui_.name, 0.3), tw = this.w(this.ui_.typing, 0.27);
    this.line(this.ui_.name, -nw / 2, 14.05, 0.3, DIM, 0.75 * I * (1 - ty));
    this.line(this.ui_.typing, -tw / 2, 14.08, 0.27, DIM, 0.75 * I * ty);
    this.rect(-3.6, 13.62, 7.2, 0.012, 0.25 * I, DIM);

    // ---- input box
    const inp = st.input || { segs: [] };
    const all = [];
    for (const sg of inp.segs || []) for (const id of sg.ids) all.push({ id, col: sg.col || WARM, I: sg.I ?? 1.1 });
    const marked = (inp.marked || '').split('').map((ch) => ({ id: this.keyId[ch], col: [0.9, 0.9, 0.95], I: 0.75, marked: true }));
    const flat = [...all, ...marked];
    const lines = this.wrap(flat.map((g) => g.id), IN_TS, IN_W);
    const nl = Math.max(1, lines.length);
    const ib = this.inputBottom(kb), boxH = nl * 0.54 + 0.35, it = ib + boxH;
    this.rect(-3.4, ib + boxH / 2, 6.8, boxH, 0.05 * I, [0.75, 0.8, 0.88]);
    let k = 0, cx = -3.15, cy = it - 0.42;
    lines.forEach((ln, li) => {
      let x = -3.15;
      const y = it - 0.42 - li * 0.54;
      for (const id of ln) {
        const g = flat[k++];
        const a = this.A.adv[id] * IN_TS;
        if (this.A.meta.entries[id][2] > 0) ui.push([x, y, 0, IN_TS], [1, 0, 0, id], [...g.col, g.I * I], [0, 0, 0, 0]);
        if (g.marked) this.rect(x, y - 0.09, a, 0.02, 0.5 * I, [0.9, 0.9, 0.95]);
        x += a;
      }
      cx = x; cy = y;
    });
    if (inp.impression && inp.impression.a > 0.002) this.line(inp.impression.ids, -3.15, it - 0.42, IN_TS, WARM, 0.22 * inp.impression.a * I, 0.06);
    const cur = inp.cursor === true ? 1 : (inp.cursor ?? 0);
    if (cur > 0.001) this.rect(cx + 0.04, cy + IN_TS * 0.33, 0.035, IN_TS * 1.15, 1.4 * cur * I, [1, 0.95, 0.88]);
    if (inp.gloss && inp.gloss.a > 0.002) {
      const gl = this.wrapWords(inp.gloss.ids, GS, 6.4);
      gl.forEach((l, i) => this.line(l, -3.15, ib - 0.32 - i * GLH, GS, GLOSS, 0.85 * inp.gloss.a * I));
    }
    this.cursorAt = [cx + 0.05, cy + IN_TS * 0.33, 0];
    this.inputTopY = it;

    // ---- chat
    const extra = st.extra ? this.layout(st.extra.map((e) => ({ ...e })), this.contentH) : [];
    const extraH = extra.length ? extra[extra.length - 1].y + extra[extra.length - 1].h - this.contentH : 0;
    const vb = it + 0.35, vt = VIEW_TOP, viewH = vt - vb;
    const off = st.scroll === 'bottom' || st.scroll === undefined ? this.offsetFor('bottom', viewH, extraH) : st.scroll;
    const blur = clamp(Math.abs(st.speed || 0) * 0.012, 0, 0.5);
    const gA = (st.glossA ?? 1) * (1 - smoothstep(2, 8, Math.abs(st.speed || 0)));
    const edge = (y) => smoothstep(vb - 0.05, vb + 0.55, y) * (1 - smoothstep(vt - 0.55, vt + 0.05, y));
    this.anchors = {};
    for (const itm of [...this.items, ...extra]) {
      const rise = itm.at !== undefined ? smoothstep(itm.at, itm.at + 0.35, t) : 1;
      if (rise <= 0) continue;
      const top = vt - (itm.y - off) - (1 - rise) * 0.6;
      if (top < vb - 3 || top - itm.h > vt + 1) continue;
      const fa = I * rise * (itm.alpha ?? 1);
      if (itm.k === 'date') {
        const dw = this.w(itm.ids, DS);
        const y = top - 0.45;
        this.line(itm.ids, -dw / 2, y, DS, DIM, 0.45 * fa * edge(y), blur);
        continue;
      }
      const me = itm.k === 'me';
      const bx = me ? 3.3 - itm.bw : -3.3;
      const bcy = top - itm.bh / 2;
      const e = edge(bcy);
      if (e <= 0.002) continue;
      this.rect(bx, bcy, itm.bw, itm.bh, (me ? 0.1 : 0.07) * fa * e, me ? ME_BUBBLE : DAD_BUBBLE);
      // one line can be kept while everything else fades: the bridge into and out of the galaxy
      const kept = st.keep && st.keep.text === itm.text;
      const ti = kept ? (itm.I ?? 1.05) * st.keep.I : (itm.I ?? 1.05) * fa * e;
      itm.lines.forEach((l, i) => this.line(l, bx + 0.25, top - 0.15 - TS * 0.86 - i * TLH, TS, WARM, ti, blur));
      const ga = gA * (itm.at !== undefined ? smoothstep(itm.at + 0.5, itm.at + 1.1, t) : 1);
      itm.g.forEach((l, i) => {
        const y = top - itm.bh - 0.24 - i * GLH;
        const x = me ? 3.3 - this.w(l, GS) : -3.3;
        this.line(l, x, y, GS, GLOSS, 0.7 * fa * ga * edge(y), blur);
      });
      this.anchors[itm.text] = { x: me ? 3.3 : -3.3, y: top - itm.bh - (itm.g.length ? itm.g.length * GLH + 0.12 : 0), tx: bx + 0.25, ty: top - 0.15 - TS * 0.86,
        w: this.w(itm.lines[0], TS) };
    }
    // delivered
    const dl = st.delivered ?? 0;
    const myLast = extra.filter((e) => e.k === 'me').pop();
    if (dl > 0.002 && myLast && this.anchors[myLast.text]) {
      const an = this.anchors[myLast.text], w = this.w(this.ui_.delivered, 0.18);
      this.line(this.ui_.delivered, an.x - w, an.y - 0.3, 0.18, DIM, 0.6 * dl * I);
    }

    // ---- paste menu and the finger's press
    if ((st.menu ?? 0) > 0.002) {
      const m = st.menu;
      this.rect(-3.25, it + 0.62, 1.35, 0.62, 0.16 * m * I, [0.85, 0.88, 0.95]);
      const pw = this.w(this.ui_.paste, 0.3);
      this.line(this.ui_.paste, -3.25 + (1.35 - pw) / 2, it + 0.52, 0.3, [1, 1, 1], 0.9 * m * I);
    }
    if (st.press && st.press.a > 0.002) {
      const r = st.press.r ?? 0.55;
      this.rect(st.press.x - r, st.press.y, r * 2, r * 2, 0.05 * st.press.a * I, [1, 0.95, 0.9]);
    }

    // ---- keyboard
    if (kb > 0.002) {
      const dy = -(1 - kb) * 6.5;
      const press = (key) => {
        let a = 0;
        for (const e of st.keys || []) if (e.k === key && t >= e.t) a = Math.max(a, Math.exp(-(t - e.t) * 9));
        if (key === 'send' && st.sendAt !== undefined && t >= st.sendAt) a = Math.max(a, Math.exp(-(t - st.sendAt) * 5));
        return a;
      };
      for (const kk of this.KEYS) {
        const p = press(kk.k);
        const glow = kk.accent ? (st.sendGlow ?? 0) : 0;
        const base = kk.accent ? [1.0, 0.62, 0.3] : [0.75, 0.8, 0.88];
        this.rect(kk.x, kk.y + dy, kk.w, 0.78, ((kk.accent ? 0.12 + 0.22 * glow : 0.06) + p * 1.6) * kb * I, p > 0.02 ? [1.0, 0.82, 0.62] : base);
        const lw = this.w(kk.label, kk.ls);
        this.line(kk.label, kk.x + (kk.w - lw) / 2, kk.y + dy - kk.ls * 0.32, kk.ls, kk.accent ? [1.0, 0.85, 0.65] : [1, 0.95, 0.9], (0.55 + glow * 0.5 + p * 2.5) * kb * I);
      }
      // candidates while composing
      if (inp.marked && inp.candidate) {
        const c0 = inp.candidate;
        this.line(c0, -3.0, 5.45 + dy, 0.32, WARM, 1.0 * kb * I);
        let x = -3.0 + this.w(c0, 0.32) + 0.5;
        for (const ids of this.commons.slice(0, 6)) { this.line(ids, x, 5.45 + dy, 0.32, WARM, 0.45 * kb * I); x += 0.8; }
      }
    }
    ui.upload();
  }

  draw(cam, extra = {}) { this.ui.draw(cam, { uUp: [0, 1, 0], ...extra }); }
}

// A phone set into world space: origin = screen centre, basis r (phone x), u (phone y), n (toward the viewer), scale s.
export function placement(P, n, up, s) {
  const nn = norm(n);
  const r = norm(cross(up, nn));
  const u = cross(nn, r);
  const toWorld = (p) => add(P, scale(add(add(scale(r, p[0]), scale(u, p[1] - 7.5)), scale(nn, p[2])), s));
  const toPhone = (w) => { const d = scale(sub(w, P), 1 / s); return [dot(d, r), dot(d, u) + 7.5, dot(d, nn)]; };
  const dirToPhone = (v) => [dot(v, r), dot(v, u), dot(v, nn)];
  const dirToWorld = (v) => add(add(scale(r, v[0]), scale(u, v[1])), scale(nn, v[2]));
  // a world camera, re-expressed in phone space (keeps the phone's tiny details numerically exact)
  const cam = (o) => ({ ...o, pos: toPhone(o.pos), target: toPhone(o.target), up: norm(dirToPhone(o.up || [0, 1, 0])),
    focus: (o.focus ?? 10) / s, near: (o.near ?? 0.02) / s, far: (o.far ?? 2e5) / s, nearFade: o.nearFade ? o.nearFade.map((x) => x / s) : [0, 0] });
  // and back: a phone-space camera as a world camera
  const camW = (o) => ({ ...o, pos: toWorld(o.pos), target: toWorld(o.target), up: norm(dirToWorld(o.up || [0, 1, 0])),
    focus: (o.focus ?? 10) * s, near: (o.near ?? 0.02) * s, far: o.far ?? 2e5, nearFade: o.nearFade ? o.nearFade.map((x) => x * s) : [0, 0] });
  return { P, r, u, n: nn, s, toWorld, toPhone, cam, camW };
}

// Phone-space chat scroll from keyframes [[t, key, 'fast'?], ...] (keys are date labels or 'bottom').
export function scrollTrack(phone, keys, viewH) {
  const offs = keys.map(([t, key, mode]) => [t, phone.offsetFor(key === '21:06' ? 'bottom' : key, viewH), mode]);
  const ease = (u, fast) => (fast ? (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2) : u * u * (3 - 2 * u));
  const at = (t) => {
    if (t <= offs[0][0]) return offs[0][1];
    for (let i = 0; i < offs.length - 1; i++) {
      const [t0, a] = offs[i], [t1, b, mode] = offs[i + 1];
      if (t <= t1) return lerp(a, b, ease((t - t0) / (t1 - t0), mode === 'fast'));
    }
    return offs[offs.length - 1][1];
  };
  return { at, speed: (t) => (at(t + 0.02) - at(t - 0.02)) / 0.04 };
}
