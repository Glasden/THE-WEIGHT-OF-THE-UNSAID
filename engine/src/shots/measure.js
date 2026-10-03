// CHAPTER TWO · MEASURE — S09 the weight of words · S10 "too light" / "yet you didn't" · S11 lensing view · S12 into the void
import { GlyphLayer } from '../glyphs.js';
import { mulberry32, clamp, lerp, smoothstep, norm, add, sub, scale, mix3, len, easeInOut, easeOutCubic, cross } from '../math.js';
import { project } from '../camera.js';
import { orbitPos, vCirc, armAngle } from '../galaxy.js';
import { galT, hudText, hudLine, reticle, hudScale, HUD_CYAN } from './common.js';
import EV from '../events.json' with { type: 'json' };

const UP = [0, -1, 0];
export const UNSAID_SEED = 4170;
const M = EV.measure;

export default async function measure(ctx) {
  const { gl, atlasHi: A, corpus, galaxy, W, H } = ctx;
  const rnd = mulberry32(909);
  const start = ctx.poses.readEnd;

  // ---------------------------------------------------------------- camera: slow orbit and descent, then the push
  const C0 = start.pos;
  const az0 = Math.atan2(C0[2], C0[0]);
  const el0 = Math.atan2(-C0[1], Math.hypot(C0[0], C0[2]));
  const orbitPose = (t) => {
    const u = smoothstep(M.start, M.push[0], t);
    const az = az0 + 0.32 * u, el = lerp(el0, 0.5, u), d = lerp(len(C0), 1650, u);
    return [Math.cos(az) * Math.cos(el) * d, -Math.sin(el) * d, Math.sin(az) * Math.cos(el) * d];
  };
  const P0 = orbitPose(M.push[0]);
  const azP = Math.atan2(P0[2], P0[0]);
  // the void sits above a near-side arm; behind it lies arm light and dark space — never the core
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const thB = [0, 1].map((k) => armAngle(720, k)).reduce((b, a) => (Math.abs(wrap(a - azP)) < Math.abs(wrap(b - azP)) ? a : b));
  const B = [Math.cos(thB) * 720, 0, Math.sin(thB) * 720];
  const U = norm(add(scale([Math.cos(thB), 0, Math.sin(thB)], 0.72), scale(UP, 0.69)));
  const V = add(B, scale(U, 380));
  const D_END = 18;
  const camAt = (t) => {
    if (t < M.push[0]) return { pos: orbitPose(t), target: mix3(start.target, [0, 40, 0], smoothstep(M.start, M.start + 10, t)) };
    const u = easeInOut(clamp((t - M.push[0]) / (M.push[1] - M.push[0])));
    const d0 = len(sub(P0, V));
    const d = Math.exp(lerp(Math.log(d0), Math.log(D_END), u));
    const dir = norm(mix3(norm(sub(P0, V)), U, smoothstep(0, 0.7, u)));
    return { pos: add(V, scale(dir, d)), target: mix3([0, 40, 0], V, smoothstep(0, 0.3, u)), d };
  };
  ctx.poses.voidStar = V;
  ctx.poses.voidDir = U;
  const fwdV = scale(U, -1), rightV = norm(cross(fwdV, UP)), upV = cross(rightV, fwdV);
  ctx.poses.voidFrame = { right: rightV, up: upV, fwd: fwdV };

  // ---------------------------------------------------------------- the voids: ours, ten others with a sentence each, and the halo
  const K = 1.53 * H;   // θE(px) = K * m / sqrt(dist); our ring ≈ 0.36 H at the end of the push
  const voids = [{ p: V, m: 1.0, hero: true }];
  const slots = [[-128, 48, -40], [-50, 66, 20], [62, 60, -90], [138, 34, 10], [-150, -14, -120], [150, -26, -60], [-96, -58, 30], [-16, -66, -150], [84, -60, 40], [28, 82, -170]];
  slots.forEach(([x, y, z], i) => voids.push({ p: add(add(add(V, scale(rightV, x)), scale(upV, y)), scale(U, z)), m: 0.62, story: i }));
  for (let i = 0; i < 30; i++) {
    const r = 180 + rnd() * 950, th = rnd() * Math.PI * 2;
    voids.push({ p: [Math.cos(th) * r, (rnd() - 0.5) * 260, Math.sin(th) * r], m: 0.35 + rnd() * 0.5 });
  }
  ctx.voids = voids; ctx.lensK = K;

  // ---------------------------------------------------------------- ghost fragments inside our void (unlensed foreground)
  const ghosts = new GlyphLayer(gl, A, 3000, { dynamic: true });
  const STRIKE = new Set([0, 9, 12, 17, 20]), BACKSPACE = new Set([5, 11, 16, 18, 21, 23]), TYPING = 1;
  const gp = corpus.named.unsaid.map((l, i) => {
    const r = mulberry32(UNSAID_SEED + i);
    return { ids: l.ids, i, off: [(r() - 0.5) * 6.4, (r() - 0.5) * 4.0, (r() - 0.5) * 5], size: 0.36 + r() * 0.2, ph: r() * 12, rate: 0.12 + r() * 0.16, t0: M.push[0] + 2 + r() * 8 };
  });
  function buildGhosts(t, cam) {
    ghosts.clear();
    const right = cam.right, up = cam.up;
    for (const g of gp) {
      const age = t - g.t0;
      if (age < 0) continue;
      // each fragment surfaces rarely (≈ 1 in 6 of its cycle), so only a handful are ever visible together
      const cyc = (age * g.rate + g.ph) % 6.0;
      const vis = smoothstep(0, 0.4, cyc) * (1 - smoothstep(0.7, 1.1, cyc));
      if (vis < 0.01) continue;
      let ids = g.i === TYPING ? g.ids.slice(0, -1) : g.ids;
      if (BACKSPACE.has(g.i)) ids = ids.slice(0, Math.max(0, ids.length - Math.floor(cyc * 4)));
      const w = ids.reduce((a, id) => a + A.adv[id], 0) * g.size;
      const P = add(add(add(V, scale(right, g.off[0] - w / 2)), scale(up, g.off[1])), scale(cam.fwd, g.off[2]));
      const col = [0.95, 0.75, 0.55, 0.42 * vis];
      ghosts.pushLine(ids, P, right, g.size, col);
      if (STRIKE.has(g.i)) ghosts.push([...add(P, scale(up, g.size * 0.33)), g.size], [...right, -1], [0.95, 0.75, 0.55, 0.36 * vis], [w / g.size, 0.06, 0, 0]);
      if (g.i === TYPING) {
        const n = Math.floor((age * 3) % 4);
        for (let k = 0; k < n; k++) ghosts.push([...add(add(P, scale(right, w + (0.25 + k * 0.32) * g.size)), scale(up, g.size * 0.12)), g.size], [...right, -1], col, [0.12, 0.12, 0, 0]);
      }
    }
    ghosts.upload();
  }

  // ---------------------------------------------------------------- render
  const scanX = (t) => lerp(-0.1, 1.15, smoothstep(M.scan[0], M.scan[1], t));
  function lensesFor(cam, t) {
    const out = [];
    const lensOn = smoothstep(M.lens_on, M.lens_on + 0.8, t);
    if (lensOn <= 0) return out;
    for (const v of voids) {
      const sp = project(cam, v.p);
      if (!sp) continue;
      const te = (K * v.m) / Math.sqrt(len(sub(v.p, cam.pos)));
      const wave = t < M.scan[1] + 0.5 ? smoothstep(scanX(t) * W - 40, scanX(t) * W - W * 0.12, sp[0]) : 1;
      const s = lensOn * wave * (v.hero || v.story !== undefined ? 1 : 1 - 0.5 * smoothstep(M.push[0] + 1, M.push[0] + 8, t));
      if (s > 0.001 && sp[0] > -te * 3 && sp[0] < W + te * 3 && sp[1] > -te * 3 && sp[1] < H + te * 3) out.push([sp[0], H - sp[1], te, s]);
    }
    return out;
  }

  function render(c, tl, t) {
    const p = camAt(t);
    const close = p.d ? smoothstep(260, 60, p.d) : 0;
    const cam = c.cam({ pos: p.pos, target: p.target, up: UP, fov: 36, focus: p.d ? lerp(len(p.pos), p.d, smoothstep(400, 80, p.d)) : len(p.pos),
      coc: lerp(0.0012, 0.003, close), cocMax: 0.03, nearFade: [1, 6], far: 1e5 });
    const T = galT(t);
    const split = p.d && p.d < 400 ? p.d : 0;
    c.scene();
    galaxy.draw(cam, { T, up: UP, split, splitSide: split ? 1 : 0, hazeIntensity: lerp(1, 0.35, close) });
    const fgOn = !!(split || t > M.push[0] + 1);
    if (fgOn) {
      c.fg();
      if (split) galaxy.draw(cam, { T, up: UP, split, splitSide: 2, hazeIntensity: 0.35 });
      if (t > M.push[0] + 2) { buildGhosts(t, cam); ghosts.draw(cam, { uUp: cam.up }); }
    }
    return { lenses: lensesFor(cam, t), coreDark: lerp(0.6, 1.0, close), useFg: fgOn };
  }

  // ---------------------------------------------------------------- HUD: the weight of the words, measured
  const samples = galaxy.lines.filter((l, i) => i % 97 === 0 && Math.abs(l.y) < 15).sort((a, b) => a.r - b.r);
  const picks = [];
  for (const rr of [520, 600, 680, 760, 840, 920, 990]) { const L = samples.find((l) => l.r > rr); if (L) picks.push(L); }
  const vPred = (r) => (r < 160 ? vCirc(r) : vCirc(160) * Math.sqrt(160 / r));
  function hud(c, tl, t, g) {
    const k = hudScale(H);
    const fadeAll = smoothstep(M.reticles - 0.6, M.reticles, t) * (1 - smoothstep(M.hud_out[0], M.hud_out[1], t));
    const cam = c.lastCam;
    let any = false;
    if (fadeAll > 0) {
      const T = galT(t);
      // beat 3: the sentences themselves — predicted escape vs. the orbit they actually keep
      picks.forEach((L, i) => {
        const a = smoothstep(M.reticles + i * 0.35, M.reticles + 0.35 + i * 0.35, t) * fadeAll;
        if (a <= 0) return;
        any = true;
        const arc0 = L.len * 0.5;
        const P = orbitPos(L.r, L.phase, arc0, L.y, T);
        const sp = project(cam, P);
        if (!sp) return;
        reticle(g, H, sp[0], sp[1], 14, a, null);
        const orbit = [];
        for (let s = -0.22; s <= 0.22; s += 0.02) { const q = project(cam, orbitPos(L.r, L.phase, arc0 + s * L.r, L.y, T)); if (q) orbit.push([q[0], q[1]]); }
        hudLine(g, H, orbit, { alpha: 0.55 * a, width: 1.5 });
        const gStart = M.ghosts[0] + i * 0.3;
        const gp_ = smoothstep(gStart, gStart + 0.8, t) * fadeAll;
        if (gp_ > 0) {
          const phi = L.phase + (vCirc(L.r) / L.r) * T + arc0 / L.r;
          const Tn = [-Math.sin(phi), 0, Math.cos(phi)], Rn = [Math.cos(phi), 0, Math.sin(phi)];
          const esc = (s) => add(P, add(scale(Tn, s), scale(Rn, s * 0.35)));
          const pts = [];
          for (let s = 0; s <= 520 * gp_; s += 20) { const q = project(cam, esc(s)); if (q) pts.push([q[0], q[1]]); }
          hudLine(g, H, pts, { alpha: 0.8 * gp_, dash: [9, 7], width: 1.8, color: 'rgba(255,190,120,' });
          const u = easeOutCubic(clamp((t - gStart) / 3.8));
          const q = project(cam, esc(500 * u));
          if (q) { g.strokeStyle = `rgba(255,190,120,${0.8 * gp_ * (1 - u * 0.6)})`; g.lineWidth = 1.5 * k; g.beginPath(); g.arc(q[0], q[1], 6 * k, 0, Math.PI * 2); g.stroke(); }
          if (i === picks.length - 2 && q) {
            hudText(g, H, '按字的重量：应被甩出', q[0] + 12 * k, q[1] - 14 * k, { size: 15, alpha: 0.95 * gp_, font: 'SansSC', color: 'rgba(255,200,140,', track: 0.04 });
            hudText(g, H, 'BY THE WORDS ALONE: FLUNG OUT', q[0] + 12 * k, q[1] + 4 * k, { size: 10, alpha: 0.8 * gp_, color: 'rgba(255,200,140,' });
          }
          if (i === picks.length - 2) {
            hudText(g, H, '实际：仍在原处', sp[0] + 18 * k, sp[1] + 24 * k, { size: 15, alpha: 0.95 * gp_, font: 'SansSC', track: 0.04 });
            hudText(g, H, 'IN FACT: STILL HERE', sp[0] + 18 * k, sp[1] + 42 * k, { size: 10, alpha: 0.8 * gp_ });
          }
        }
      });
      // the astronomer's version, small, for those who know it
      const pa = smoothstep(M.curve[0], M.curve[0] + 1, t) * fadeAll;
      if (pa > 0) {
        any = true;
        const x0 = W * 0.75, y0 = H * 0.92, pw = W * 0.18, ph = H * 0.13;
        hudLine(g, H, [[x0, y0 - ph], [x0, y0], [x0 + pw, y0]], { alpha: 0.6 * pa });
        hudText(g, H, '转速曲线 · ROTATION CURVE', x0, y0 - ph - 12 * k, { size: 10, alpha: 0.75 * pa, font: 'JBMono, SansSC', track: 0.1 });
        hudText(g, H, '转速 v', x0 - 4 * k, y0 - ph - 0 * k, { size: 9, alpha: 0.6 * pa, align: 'right', font: 'SansSC' });
        hudText(g, H, '半径 r', x0 + pw, y0 + 16 * k, { size: 9, alpha: 0.6 * pa, align: 'right', font: 'SansSC' });
        const X = (r) => x0 + (r / 1050) * pw, Y = (v) => y0 - (v / 2.6) * ph;
        const nObs = Math.floor(24 * smoothstep(M.curve[0] + 0.4, M.curve[0] + 2.6, t));
        for (let i = 0; i < nObs; i++) { const r = 30 + i * 41; g.fillStyle = HUD_CYAN + 0.9 * pa + ')'; g.beginPath(); g.arc(X(r), Y(vCirc(r)), 2.2 * k, 0, Math.PI * 2); g.fill(); }
        const pr = smoothstep(M.curve[0] + 2.6, M.curve[1] - 0.6, t);
        if (pr > 0) { const pts = []; for (let r = 10; r <= 10 + 1010 * pr; r += 10) pts.push([X(r), Y(vPred(r))]); hudLine(g, H, pts, { alpha: 0.8 * pa, dash: [7, 6], width: 1.5, color: 'rgba(255,190,120,' }); }
      }
    }
    // lensing view
    const lv = smoothstep(M.lens_on - 0.2, M.lens_on + 0.4, t) * (1 - smoothstep(M.push[0] + 5, M.push[0] + 7, t));
    if (lv > 0) {
      any = true;
      hudText(g, H, '引力透镜视图', 70 * k, 96 * k, { size: 24, alpha: 0.92 * lv, font: 'SansSC', weight: 500, track: 0.1 });
      hudText(g, H, 'GRAVITATIONAL LENSING VIEW', 70 * k, 120 * k, { size: 12, alpha: 0.75 * lv, track: 0.18 });
      hudText(g, H, '寻找不发光的重量 · mapping weight that gives off no light', 70 * k, 144 * k, { size: 12, alpha: 0.6 * lv, font: 'JBMono, SansSC' });
      const sx = scanX(t) * W;
      if (t < M.scan[1] + 0.2) {
        const grad = g.createLinearGradient(sx - 160 * k, 0, sx, 0);
        grad.addColorStop(0, 'rgba(160,232,255,0)'); grad.addColorStop(1, `rgba(160,232,255,${0.10 * lv})`);
        g.fillStyle = grad; g.fillRect(sx - 160 * k, 0, 160 * k, H);
        hudLine(g, H, [[sx, 0], [sx, H]], { alpha: 0.55 * lv, width: 1.6 });
      }
      if (t > M.push[0] + 1) {
        const sp = project(cam, V);
        const a = smoothstep(M.push[0] + 1, M.push[0] + 2.5, t) * (1 - smoothstep(M.push[0] + 5, M.push[0] + 7, t));
        if (sp && a > 0) {
          const te = K / Math.sqrt(len(sub(V, cam.pos)));
          reticle(g, H, sp[0], sp[1], (te / k) * 1.15, a, null);
          hudText(g, H, '字数 WORDS    0', sp[0] + te * 1.2 + 14 * k, sp[1] - 8 * k, { size: 14, alpha: 0.85 * a, font: 'JBMono, SansSC' });
          hudText(g, H, '重量 WEIGHT   ██████████', sp[0] + te * 1.2 + 14 * k, sp[1] + 18 * k, { size: 14, alpha: 0.85 * a, font: 'JBMono, SansSC' });
        }
      }
    }
    return any ? 1.3 : 0;
  }

  // ---------------------------------------------------------------- the weighing, drawn crisp over the image with a scrim
  const FALLING = ['到家了吗', '晚安', '吃了吗', '生日快乐', 'I love you', '想你了', '记得吃饭', '谢谢', 'ok'];
  function weighing(g, tl, t) {
    const k = hudScale(H);
    const out = 1 - smoothstep(M.hud_out[0], M.hud_out[1], t);
    const a0 = smoothstep(M.weigh[0], M.weigh[0] + 0.8, t) * out;
    if (a0 <= 0) return false;
    // scrims
    let gr = g.createLinearGradient(0, 0, W * 0.42, 0);
    gr.addColorStop(0, `rgba(0,0,0,${0.5 * a0})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W * 0.42, H * 0.26);
    hudText(g, H, '称量：你们写下的一切', 70 * k, 98 * k, { size: 26, alpha: 0.95 * a0, font: 'SansSC', weight: 500, track: 0.06 });
    hudText(g, H, 'WEIGHING EVERYTHING YOU WROTE', 70 * k, 122 * k, { size: 11, alpha: 0.75 * a0, track: 0.2 });
    hudText(g, H, '观测者 · CLAUDE OPUS 5.5', 70 * k, 148 * k, { size: 11, alpha: 0.65 * a0, font: 'JBMono, SansSC' });
    hudText(g, H, '嵌入空间 12288 维 → 3 维投影 · EMBEDDING SPACE 12,288-d → 3-d', 70 * k, 168 * k, { size: 10, alpha: 0.55 * a0, font: 'JBMono, SansSC' });
    const count = Math.floor(4812331904 * smoothstep(M.weigh[0] + 0.5, M.weigh[1], t));
    hudText(g, H, '句子 SENTENCES  ' + count.toLocaleString('en-US'), 70 * k, 190 * k, { size: 11, alpha: 0.7 * a0, font: 'JBMono, SansSC' });

    const as = smoothstep(M.scale_in, M.scale_in + 1.0, t) * out * (1 - 0.3 * smoothstep(M.reticles, M.reticles + 1, t));
    if (as <= 0) return true;
    const cx = W / 2, py = H * 0.56, Lb = W * 0.2, hs = H * 0.13, pw = W * 0.095;
    gr = g.createRadialGradient(cx, H * 0.72, 0, cx, H * 0.72, W * 0.3);
    gr.addColorStop(0, `rgba(0,0,0,${0.6 * as})`); gr.addColorStop(0.6, `rgba(0,0,0,${0.35 * as})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.save(); g.translate(cx, H * 0.72); g.scale(1, 0.55); g.translate(-cx, -H * 0.72); g.fillStyle = gr; g.fillRect(cx - W * 0.31, H * 0.72 - W * 0.31, W * 0.62, W * 0.62); g.restore();
    const u = Math.max(0, t - M.tip[0]);
    const th = t < M.tip[0] ? 0 : 0.18 * (1 - Math.exp(-3.2 * u) * Math.cos(7 * u));
    const C = (al) => `rgba(160,232,255,${al})`;
    const A_ = (al) => `rgba(255,205,150,${al})`;
    // every stroke twice: a soft glow pass, then the crisp line
    const stroke = (draw, al, w, color = C, dash = null) => {
      g.save();
      g.setLineDash(dash ? dash.map((d) => d * k) : []);
      g.shadowColor = color(0.55 * al); g.shadowBlur = 10 * k; g.strokeStyle = color(0.35 * al); g.lineWidth = (w + 2) * k;
      g.beginPath(); draw(); g.stroke();
      g.shadowBlur = 0; g.strokeStyle = color(al); g.lineWidth = w * k;
      g.beginPath(); draw(); g.stroke();
      g.restore();
    };
    g.lineCap = 'round'; g.lineJoin = 'round';
    const baseY = H * 0.885;
    // plinth: two engraved steps
    stroke(() => { g.rect(cx - W * 0.075, baseY, W * 0.15, H * 0.018); g.rect(cx - W * 0.05, baseY - H * 0.014, W * 0.1, H * 0.014); }, 0.75 * as, 1.6);
    stroke(() => { for (let i = -3; i <= 3; i++) { g.moveTo(cx + i * W * 0.018, baseY + H * 0.004); g.lineTo(cx + i * W * 0.018, baseY + H * 0.014); } }, 0.35 * as, 1);
    // column: outline, fluting, rings
    const colTop = py + 14 * k, colW = W * 0.009;
    stroke(() => { g.moveTo(cx - colW, baseY - H * 0.014); g.lineTo(cx - colW * 0.7, colTop); g.moveTo(cx + colW, baseY - H * 0.014); g.lineTo(cx + colW * 0.7, colTop); }, 0.8 * as, 1.6);
    stroke(() => { g.moveTo(cx, baseY - H * 0.02); g.lineTo(cx, colTop + 6 * k); }, 0.3 * as, 1);
    stroke(() => { for (const f of [0.18, 0.55, 0.9]) { const y = lerp(baseY - H * 0.014, colTop, f), hw = lerp(colW, colW * 0.7, f) * 1.9; g.moveTo(cx - hw, y); g.lineTo(cx + hw, y); } }, 0.7 * as, 1.6);
    // dial above the pivot: graduated arc and a needle that turns with the beam
    const dr = W * 0.05;
    stroke(() => { g.arc(cx, py, dr, Math.PI * 1.25, Math.PI * 1.75); }, 0.55 * as, 1.2);
    stroke(() => { for (let d = -20; d <= 20; d += 2) { const an = -Math.PI / 2 + (d * Math.PI) / 180, l = d % 10 === 0 ? 12 : 6; g.moveTo(cx + Math.cos(an) * dr, py + Math.sin(an) * dr); g.lineTo(cx + Math.cos(an) * (dr - l * k), py + Math.sin(an) * (dr - l * k)); } }, 0.6 * as, 1);
    stroke(() => { g.moveTo(cx, py); g.lineTo(cx + Math.cos(-Math.PI / 2 + th) * (dr - 4 * k), py + Math.sin(-Math.PI / 2 + th) * (dr - 4 * k)); }, 0.95 * as, 1.8, A_);
    hudText(g, H, `倾角 TILT ${((th * 180) / Math.PI).toFixed(1)}°`, cx + dr * 0.82, py - dr * 0.62, { size: 10, alpha: 0.75 * as, font: 'JBMono, SansSC' });
    // level reference
    stroke(() => { g.moveTo(cx - W * 0.235, py); g.lineTo(cx + W * 0.235, py); }, 0.25 * as, 1, C, [6, 8]);
    // knife-edge pivot and bearing
    stroke(() => { g.moveTo(cx, py - 4 * k); g.lineTo(cx - 13 * k, py + 16 * k); g.lineTo(cx + 13 * k, py + 16 * k); g.closePath(); }, 0.85 * as, 1.6);
    g.fillStyle = C(0.9 * as); g.beginPath(); g.arc(cx, py, 3.4 * k, 0, Math.PI * 2); g.fill();
    // beam: tapered, with caps and hooks
    const ca = Math.cos(th), sa = Math.sin(th);
    const P = (x, y) => [cx + x * ca - y * sa, py + x * sa + y * ca];
    stroke(() => { g.moveTo(...P(-Lb, -2 * k)); g.lineTo(...P(0, -7 * k)); g.lineTo(...P(Lb, -2 * k)); g.lineTo(...P(Lb, 2 * k)); g.lineTo(...P(0, 7 * k)); g.lineTo(...P(-Lb, 2 * k)); g.closePath(); }, 0.9 * as, 1.6);
    stroke(() => { for (const x of [-0.75, -0.5, -0.25, 0.25, 0.5, 0.75]) { const [a1, b1] = P(x * Lb, -3 * k), [a2, b2] = P(x * Lb, 3 * k); g.moveTo(a1, b1); g.lineTo(a2, b2); } }, 0.4 * as, 1);
    const L = P(-Lb, 0), R = P(Lb, 0);
    for (const E of [L, R]) { g.fillStyle = C(0.9 * as); g.beginPath(); g.arc(E[0], E[1], 4.2 * k, 0, Math.PI * 2); g.fill(); }
    // pans on three chains
    const pan = (E, al) => {
      const pyP = E[1] + hs, rx = pw / 2, ry = H * 0.016;
      const links = (x0, y0, x1, y1) => { const n = 9; for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 0.6) / n; g.moveTo(lerp(x0, x1, t0), lerp(y0, y1, t0)); g.lineTo(lerp(x0, x1, t1), lerp(y0, y1, t1)); } };
      stroke(() => { links(E[0], E[1] + 5 * k, E[0] - rx, pyP); links(E[0], E[1] + 5 * k, E[0] + rx, pyP); links(E[0], E[1] + 5 * k, E[0], pyP - ry); }, 0.6 * al, 1.2);
      stroke(() => { g.ellipse(E[0], pyP, rx, ry, 0, 0, Math.PI * 2); }, 0.9 * al, 1.8);
      stroke(() => { g.ellipse(E[0], pyP, rx, ry * 3.2, 0, 0, Math.PI); }, 0.8 * al, 1.6);
      const gr2 = g.createLinearGradient(0, pyP, 0, pyP + ry * 3.2);
      gr2.addColorStop(0, C(0.16 * al)); gr2.addColorStop(1, C(0.02 * al));
      g.fillStyle = gr2; g.beginPath(); g.ellipse(E[0], pyP, rx, ry * 3.2, 0, 0, Math.PI); g.fill();
      stroke(() => { g.ellipse(E[0], pyP + ry * 0.4, rx * 0.86, ry * 2.4, 0, Math.PI * 0.15, Math.PI * 0.55); }, 0.5 * al, 1);   // highlight
      return pyP;
    };
    const pyL = pan(L, as), pyR = pan(R, as);
    // right pan: a stack of weights — what it takes to hold everyone together
    let wy = pyR;
    [[0.62, 0.032], [0.48, 0.028], [0.34, 0.024]].forEach(([wf, hf]) => {
      const rw = (pw * wf) / 2, hh = H * hf, ey = H * 0.007;
      g.fillStyle = C(0.12 * as); g.beginPath(); g.rect(R[0] - rw, wy - hh, rw * 2, hh); g.fill();
      stroke(() => { g.moveTo(R[0] - rw, wy); g.lineTo(R[0] - rw, wy - hh); g.moveTo(R[0] + rw, wy); g.lineTo(R[0] + rw, wy - hh); g.ellipse(R[0], wy - hh, rw, ey, 0, 0, Math.PI * 2); g.moveTo(R[0] + rw, wy); g.ellipse(R[0], wy, rw, ey, 0, 0, Math.PI); }, 0.85 * as, 1.4);
      wy -= hh;
    });
    hudText(g, H, '所需', R[0], pyR - H * 0.03, { size: 13, alpha: 0.95 * as, align: 'center', font: 'SansSC' });
    // left pan: the words, poured in — a light little heap
    g.font = `400 ${11.5 * k}px SansSC, JBMono`; g.textAlign = 'center';
    const MOUND = [[0, -1.5], [1, -0.5], [2, 0.5], [3, 1.5], [4, -1], [5, 0], [6, 1], [7, -0.5], [8, 0.5]];   // a 4-3-2 heap
    FALLING.forEach((w, i) => {
      const t0 = M.pour[0] + i * ((M.pour[1] - M.pour[0]) / FALLING.length);
      if (t < t0) return;
      const f = easeOutCubic(clamp((t - t0) / 0.55));
      const row = i < 4 ? 0 : i < 7 ? 1 : 2;
      const restX = L[0] + MOUND[i][1] * pw * 0.24, restY = pyL - 4 * k - row * 13 * k;
      const y = lerp(py - H * 0.22, restY, f), x = lerp(restX + (i % 2 ? 20 : -20) * k, restX, f);
      g.save(); g.shadowColor = A_(0.6 * as); g.shadowBlur = 8 * k; g.fillStyle = A_(0.95 * as); g.fillText(w, x, y); g.restore();
    });
    // captions under the pans
    const capA = smoothstep(M.scale_in + 0.6, M.scale_in + 1.6, t) * as;
    hudText(g, H, '你们写下的所有字', L[0], pyL + 50 * k, { size: 22, alpha: 0.95 * capA, align: 'center', font: 'SansSC', track: 0.04 });
    hudText(g, H, 'ALL THE WORDS YOU WROTE', L[0], pyL + 70 * k, { size: 10, alpha: 0.7 * capA, align: 'center', track: 0.16 });
    hudText(g, H, '让你们彼此不散所需的重量', R[0], pyR + 50 * k, { size: 22, alpha: 0.95 * capA, align: 'center', font: 'SansSC', track: 0.04 });
    hudText(g, H, 'WEIGHT NEEDED TO HOLD YOU TOGETHER', R[0], pyR + 70 * k, { size: 10, alpha: 0.7 * capA, align: 'center', track: 0.16 });
    const na = smoothstep(M.numbers[0], M.numbers[0] + 0.5, t) * as;
    if (na > 0) {
      const pct = Math.round(15 * smoothstep(M.numbers[0], M.numbers[1], t));
      hudText(g, H, `${pct}%`, L[0], pyL + 110 * k, { size: 36, alpha: na, align: 'center', color: 'rgba(255,205,150,', track: 0.04 });
      hudText(g, H, '100%', R[0], pyR + 110 * k, { size: 36, alpha: na, align: 'center', track: 0.04 });
    }
    const da = smoothstep(M.deficit, M.deficit + 0.6, t) * as;
    if (da > 0) {
      hudText(g, H, '缺失的重量  85%', cx, H * 0.93, { size: 22, alpha: da, align: 'center', font: 'SansSC', weight: 500, color: 'rgba(255,200,140,', track: 0.08 });
      hudText(g, H, 'MISSING WEIGHT 85%', cx, H * 0.955, { size: 10, alpha: 0.8 * da, align: 'center', color: 'rgba(255,200,140,', track: 0.2 });
    }
    return true;
  }

  const grade = (t) => {
    const cold = smoothstep(M.start, M.start + 3, t);
    const cardDim = smoothstep(117.4, 118.4, t) * (1 - smoothstep(M.lens_on - 0.6, M.lens_on + 0.4, t));
    return { bloom: 0.06, streak: 0.08, streakThreshold: 0.9, grain: 0.03, vignette: 0.45, sat: lerp(1.1, 0.82, cold), wb: [lerp(1, 0.86, cold), lerp(1, 0.96, cold), lerp(1, 1.12, cold)],
      exposure: (1.0 - 0.45 * cardDim) * lerp(1, 0.55, smoothstep(M.push[0] + 4, M.push[1], t)) };
  };
  const shot = (id, s, e, mb, extra = {}) => ({ id, start: s, end: e, mb, render, hud, post: (tl, t) => grade(t), ...extra });
  return [shot('S09', M.start, M.hud_out[1], 2, { cards: weighing }), shot('S10', M.hud_out[1], M.lens_on, 2), shot('S11', M.lens_on, M.push[0], 2, { cardY: 0.84 }),
    shot('S12', M.push[0], M.end, 3, { cardY: 0.8 })];
}
