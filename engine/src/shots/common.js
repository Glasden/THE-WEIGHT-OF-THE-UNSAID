// Shared bits for the galaxy sequences: the global galactic clock, hero lines riding the orbits, HUD helpers.
import { GlyphLayer, MODE } from '../glyphs.js';
import { integrate, smoothstep, lerp, clamp } from '../math.js';
import { vCirc } from '../galaxy.js';

// Galactic time. Rates are "galactic seconds per film second".
export function galRate(t) {
  if (t < 50) return lerp(5.0, 0.15, smoothstep(34.5, 40.5, t));
  if (t < 84) return 0.15;
  if (t < 98) return lerp(0.15, 10, smoothstep(84, 88, t)) * (1 - smoothstep(94, 98, t)) + 0.3 * smoothstep(94, 98, t);
  return 0.3;
}
let _cacheT = -1, _cacheV = 0;
export function galT(t) {
  if (t === _cacheT) return _cacheV;
  _cacheT = t;
  _cacheV = integrate(galRate, t, 1 / 60);
  return _cacheV;
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
