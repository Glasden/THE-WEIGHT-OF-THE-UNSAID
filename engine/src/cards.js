// Bilingual title cards, drawn crisp over the tonemapped image.
import { smoothstep, clamp } from './math.js';

import EV from './events.json' with { type: 'json' };
export const CARDS = EV.cards.map(([key, zh, en, start, end]) => ({ key, zh, en, start, end, kind: key === 'title' ? 'title' : undefined }));

function drawLine(g, text, cx, y, font, size, tracking, color, revealT, stagger, dur, fadeOut, glow) {
  g.font = font;
  const chars = [...text];
  const widths = chars.map((c) => g.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * size * (chars.length - 1);
  let x = cx - total / 2;
  chars.forEach((ch, i) => {
    const a = smoothstep(0, dur, revealT - i * stagger) * fadeOut;
    if (a > 0.002) {
      const blur = (1 - smoothstep(0, dur, revealT - i * stagger)) * size * 0.18 + (1 - fadeOut) * size * 0.12;
      g.save();
      g.globalAlpha = a;
      g.filter = blur > 0.3 ? `blur(${blur.toFixed(2)}px)` : 'none';
      if (glow) { g.shadowColor = glow; g.shadowBlur = size * 0.6; }
      g.fillStyle = color;
      g.fillText(ch, x, y + (1 - a) * size * 0.08);
      g.restore();
    }
    x += widths[i] + tracking * size;
  });
}

export function drawCards(g, t, W, H, shot) {
  let any = false;
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  for (const c of CARDS) {
    if (t < c.start || t > c.end) continue;
    any = true;
    const lt = t - c.start, rem = c.end - t;
    const fadeOut = smoothstep(0, 1.1, rem);
    const cx = W * (shot && shot.cardX ? shot.cardX : 0.5);
    if (c.kind === 'title') {
      const s1 = H * 0.08, s2 = H * 0.021;
      const y = H * (shot && shot.cardY ? shot.cardY : 0.505);
      drawLine(g, c.zh, cx, y, `600 ${s1}px SerifSC`, s1, 0.55, 'rgba(255,240,222,1)', lt, 0.32, 1.8, fadeOut, 'rgba(255,170,90,0.35)');
      drawLine(g, c.en, cx, y + s1 * 0.95, `500 ${s2}px Cormorant`, s2, 0.48, 'rgba(236,222,206,0.92)', lt - 1.9, 0.035, 1.4, fadeOut, null);
    } else {
      const s1 = H * 0.0335, s2 = H * 0.0265;
      const y = shot && shot.cardY ? H * shot.cardY : H * 0.5;
      // soft scrim so the words hold over a bright galaxy
      const sa = smoothstep(0, 0.8, lt) * fadeOut;
      const gr = g.createRadialGradient(cx, y + s1 * 0.4, 0, cx, y + s1 * 0.4, W * 0.32);
      gr.addColorStop(0, `rgba(0,0,0,${0.55 * sa})`); gr.addColorStop(0.55, `rgba(0,0,0,${0.32 * sa})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.save(); g.translate(cx, y + s1 * 0.4); g.scale(1, 0.32); g.translate(-cx, -(y + s1 * 0.4));
      g.fillStyle = gr; g.fillRect(cx - W * 0.33, y + s1 * 0.4 - W * 0.33, W * 0.66, W * 0.66); g.restore();
      const zhChars = [...c.zh].length;
      drawLine(g, c.zh, cx, y, `400 ${s1}px SerifSC`, s1, 0.16, 'rgba(246,238,228,1)', lt, 0.055, 0.9, fadeOut, 'rgba(255,190,120,0.18)');
      const enStart = Math.min(1.6, zhChars * 0.055 + 0.5);
      drawLine(g, c.en, cx, y + s1 * 1.55, `italic 400 ${s2}px Cormorant`, s2, 0.02, 'rgba(226,216,204,0.86)', lt - enStart, 0.012, 1.0, fadeOut, null);
    }
  }
  return any;
}
