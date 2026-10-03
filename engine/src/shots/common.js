// Shared bits for the galaxy sequences: the global galactic clock, hero lines riding the orbits, HUD helpers.
import { GlyphLayer, MODE } from '../glyphs.js';
import { integrate, smoothstep, lerp, clamp } from '../math.js';
import { vCirc } from '../galaxy.js';

export const CYAN = [0.6, 0.88, 1.0];
export const HOT = [0.88, 0.97, 1.0];
export const AMBER = [1.0, 0.56, 0.22];
export const WARM = [1.0, 0.92, 0.84];
export const CYAN_P = [0.36, 0.76, 1.0];      // the AI's words on a phone: deeper, so they stay cyan at reading brightness

// cursor blink: on for the first half of every second (the film's metronome)
export const blink = (t, t0 = 0) => { const f = (((t - t0) % 1) + 1) % 1; return smoothstep(0, 0.035, f) * (1 - smoothstep(0.5, 0.535, f)); };

// Galactic time for a stretch of film: integrate rate(t) from t0, starting at T0. Cached per t.
export function clock(rate, t0, T0 = 0, step = 1 / 60) {
  let ct = NaN, cv = 0;
  return (t) => {
    if (t === ct) return cv;
    ct = t;
    cv = T0 + integrate((u) => rate(t0 + u), t - t0, step);
    return cv;
  };
}

// Named lines by their text: tx.ids('chat', '到了吗')
export class Texts {
  constructor(named) {
    this.m = {};
    for (const [set, lines] of Object.entries(named)) {
      this.m[set] = {};
      for (const l of lines) this.m[set][l.text] ??= l.ids;
    }
  }
  ids(set, text) {
    const r = this.m[set] && this.m[set][text];
    if (!r) throw new Error(`no named line ${set}: ${text}`);
    return r;
  }
  has(set, text) { return !!(this.m[set] && this.m[set][text]); }
  lines(set) { return Object.entries(this.m[set] || {}).map(([text, ids]) => ({ text, ids })); }
}

// Hero lines: hi-res glyphs riding the orbits so they stay put inside the moving galaxy.
export class HeroLines {
  constructor(gl, atlasHi, capacity = 4000) {
    this.layer = new GlyphLayer(gl, atlasHi, capacity, { mode: MODE.ORBIT });
    this.A = atlasHi;
    this.lines = [];
  }
  // place line so that at galactic time T its first glyph sits at world point p (galactic plane coords)
  add(ids, p, T, size, color, opts = {}) {
    const r = Math.hypot(p[0], p[2]);
    const v = vCirc(r);
    const phase0 = Math.atan2(p[2], p[0]) - (v / r) * T;
    let pen = 0;
    const start = this.layer.count;
    const width = ids.reduce((a, id) => a + this.A.adv[id], 0) * size;
    pen = opts.center ? -width / 2 : 0;
    for (const id of ids) {
      if (this.A.meta.entries[id][2] > 0) this.layer.push([0, p[1], 0, size], [0, 0, 0, id], color, [r, phase0, pen, 0], [1, 0, 0, 0]);
      pen += this.A.adv[id] * size;
    }
    const rec = { start, end: this.layer.count, r, phase0, y: p[1], color, ...opts };
    this.lines.push(rec);
    return rec;
  }
  setIntensity(rec, a) {
    const d = this.layer.data;
    for (let i = rec.start; i < rec.end; i++) d[i * 20 + 11] = rec.color[3] * a;
  }
  upload() { this.layer.upload(); }
  draw(cam, u) { this.layer.draw(cam, { uV0: 2.0, uRc: 60, ...u }); }
}

// ---------------------------------------------------------------- HUD (2D canvas, 4K-relative units)
export const HUD_CYAN = 'rgba(160,232,255,';
export function hudScale(H) { return (H / 1608) * 1.6; }

export function hudText(g, H, text, x, y, { size = 17, alpha = 0.85, align = 'left', font = 'JBMono', weight = 400, color = HUD_CYAN, track = 0.08 } = {}) {
  const k = hudScale(H);
  g.font = `${weight} ${size * k}px ${font}`;
  g.textAlign = align;
  g.textBaseline = 'alphabetic';
  g.fillStyle = color + alpha + ')';
  if ('letterSpacing' in g) g.letterSpacing = `${track * size * k}px`;
  g.fillText(text, x, y);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
}

export function hudLine(g, H, pts, { alpha = 0.6, width = 1.6, dash = null, color = HUD_CYAN } = {}) {
  const k = hudScale(H);
  g.strokeStyle = color + alpha + ')';
  g.lineWidth = width * k;
  g.setLineDash(dash ? dash.map((d) => d * k) : []);
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();
  g.setLineDash([]);
}

export function reticle(g, H, x, y, r, a, label) {
  const k = hudScale(H);
  const s = r * k, c = s * 0.45;
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]])
    hudLine(g, H, [[x + sx * s, y + sy * (s - c)], [x + sx * s, y + sy * s], [x + sx * (s - c), y + sy * s]], { alpha: 0.75 * a, width: 1.4 });
  if (label) hudText(g, H, label, x + s + 8 * k, y - s * 0.6, { size: 13, alpha: 0.7 * a });
}

export const ease01 = (t, a, b) => clamp((t - a) / (b - a));
