// The galaxy of everything humans wrote. Lines of text orbit the core; their era is their radius.
//   r < 130   ancient scripts (cuneiform, hieroglyphs, Linear B...)  deep orange
//   130–420   classics (诗经, 楚辞, 唐诗, Virgil, Dante, KJV)        amber
//   420–720   print (Shakespeare, Melville, 古文观止 ...)            gold
//   > 720     digital (messages, code, searches)                     warm white

import { GlyphLayer, MODE, IDENT } from './glyphs.js';
import { Program } from './gl.js';
import { mulberry32, gauss, clamp, smoothstep, lerp } from './math.js';

export const GAL = {
  R: 1000, V0: 2.0, RC: 60,
  pitch: (13 * Math.PI) / 180,
  arms: [0, Math.PI, Math.PI * 0.5, Math.PI * 1.5],
  armWeight: [1, 1, 0.45, 0.45],
};

const ERA = [
  { name: 'ancient', r: [0, 165], size: 2.0, color: [1.0, 0.34, 0.09] },
  { name: 'classical', r: [165, 420], size: 1.05, color: [1.0, 0.5, 0.18] },
  { name: 'print', r: [420, 720], size: 0.85, color: [1.0, 0.65, 0.33] },
  { name: 'digital', r: [720, 1080], size: 0.65, color: [1.0, 0.77, 0.5] },
];

export function eraOf(r, jitter = 0) {
  const x = r + jitter;
  return x < 165 ? 0 : x < 420 ? 1 : x < 720 ? 2 : 3;
}

export function vCirc(r) { return (GAL.V0 * r) / Math.sqrt(r * r + GAL.RC * GAL.RC); }

// World position of a point riding the orbit (matches the vertex shader).
export function orbitPos(r, phase0, arc, y, T, unbind = 0, escW = 1, escR = [1e9, 2e9]) {
  const v = vCirc(r);
  const phi = phase0 + (v / r) * T + arc / r;
  const c = Math.cos(phi), s = Math.sin(phi);
  const P = [c * r, y, s * r];
  const tau = unbind * smoothstep(escR[0], escR[1], r) * escW;
  P[0] += (-s * v + c * v * 0.35) * tau;
  P[2] += (c * v + s * v * 0.35) * tau;
  return P;
}

export function armAngle(r, k) { return GAL.arms[k] - Math.log(Math.max(r, 20) / 60) / Math.tan(GAL.pitch); }

export class Galaxy {
  constructor(gl, atlas, corpus, { quality = 1, seed = 7 } = {}) {
    const rnd = mulberry32(seed);
    const layers = ['ancient', 'classical', 'print', 'digital'].map((n) => corpus.layers[n]);
    const nLines = Math.round(90000 * quality);
    this.layer = new GlyphLayer(gl, atlas, Math.round(nLines * 15), { mode: MODE.ORBIT });
    this.lines = [];   // line records for camera/HUD queries
    const L = this.layer;
    const armW = GAL.armWeight, armSum = armW.reduce((a, b) => a + b, 0);
    let made = 0;
    while (made < nLines) {
      // streams: a run of lines riding the same orbit, nose to tail — rivers up close, arms from afar
      let r;
      const u = rnd();
      if (u < 0.07) r = Math.abs(gauss(rnd)) * 70 + 8;                // bulge
      else r = 40 - 300 * Math.log(1 - rnd() * 0.97);                 // exponential disc
      if (r > 1080) continue;
      let theta;
      const inArm = rnd() < 0.86 && r > 90;
      let armK = -1;
      if (inArm) {
        let k = 0, pick = rnd() * armSum;
        while (pick > armW[k]) pick -= armW[k++];
        armK = k;
        const spread = 0.06 + 14 / r;
        theta = armAngle(r, k) + gauss(rnd) * spread;
      } else theta = rnd() * Math.PI * 2;
      const era = eraOf(r, gauss(rnd) * 25);
      const E = ERA[era];
      const pool = layers[era];
      // knots: dense bright clusters strung along the arms
      const knot = inArm && r > 180 && rnd() < 0.05;
      const streamLen = knot ? 14 + Math.floor(rnd() * 30) : r < 130 ? 1 + Math.floor(rnd() * 3) : 1 + Math.floor(rnd() * rnd() * 7);
      const ySig = 3 + 55 * Math.exp(-r / 90);
      const y0 = gauss(rnd) * ySig * (knot ? 0.4 : 1);
      const bright = (Math.pow(rnd(), 3) * 2.0 + 0.45) * (knot ? 2.2 : 1) * (inArm ? 1 : 0.55) * (0.4 + 0.6 * smoothstep(50, 220, r));
      let phase = theta;
      for (let j = 0; j < streamLen && made < nLines; j++, made++) {
        const ids = pool[Math.floor(rnd() * pool.length)];
        const size = E.size * (0.8 + rnd() * 0.45);
        const rr = knot ? r + gauss(rnd) * 6 : r + gauss(rnd) * 0.35 * size;
        const yy = knot ? y0 + gauss(rnd) * 3 : y0 + gauss(rnd) * 0.5 * size;
        const tint = 0.85 + rnd() * 0.3;
        const col = [E.color[0], E.color[1] * tint, E.color[2] * tint, bright * (0.6 + rnd() * 0.6)];
        const esc = 0.7 + rnd() * 0.6;
        const seedv = rnd();
        let pen = 0;
        for (const id of ids) {
          const adv = atlas.adv[id];
          if (atlas.meta.entries[id][2] > 0)
            L.push([0, yy, 0, size], [0, 0, 0, id], col, [rr, phase, pen * size, seedv], [esc, 0, 0, 0]);
          pen += adv;
        }
        this.lines.push({ r: rr, phase, y: yy, size, len: pen * size, era });
        phase = knot ? theta + gauss(rnd) * 9 / r : phase + (pen * size + size * (1.5 + rnd() * 3)) / rr;
      }
    }
    L.upload();
    L.uniforms = { uV0: GAL.V0, uRc: GAL.RC, uIntensity: 1 };
    this.haze = new Haze(gl, rnd);
  }

  draw(cam, { T = 0, unbind = 0, escR = [1e9, 2e9], intensity = 1, hazeIntensity = 1, split = 0, splitSide = 0, model = IDENT, up = [0, 1, 0], frac = 1, dimNear = [0, 0, 1] } = {}) {
    if (hazeIntensity > 0) this.haze.draw(cam, { T, unbind, escR, intensity: hazeIntensity * intensity, split, splitSide, model });
    this.layer.draw(cam, { uTime: T, uUnbind: unbind, uEscapeR: escR, uIntensity: intensity, uSplit: split, uSplitSide: splitSide,
      uModel: model, uUp: up, uDimNear: dimNear, count: Math.round(this.layer.count * frac) });
  }
}

// Soft emissive gas tracing the arms; gives the galaxy its glow from afar.
const HAZE_VS = `
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 iA;   // radius, phase, height, size
layout(location=2) in vec4 iB;   // r g b intensity
uniform mat4 uView, uProj, uModel;
uniform vec3 uCamPos;
uniform float uTime, uV0, uRc, uUnbind, uIntensity, uSplit;
uniform vec2 uEscapeR;
uniform int uSplitSide;
out vec2 vQ; flat out vec4 vC;
void main() {
  float r = iA.x;
  float v = uV0 * r / sqrt(r * r + uRc * uRc);
  float phi = iA.y + v / r * uTime;
  vec3 rad = vec3(cos(phi), 0.0, sin(phi));
  vec3 T = vec3(-sin(phi), 0.0, cos(phi));
  vec3 P = rad * r + vec3(0.0, iA.z, 0.0);
  P += (T * v + rad * v * 0.35) * uUnbind * smoothstep(uEscapeR.x, uEscapeR.y, r);
  vec4 vc = uView * uModel * vec4(P, 1.0);
  float z = -vc.z;
  float near = smoothstep(iA.w * 0.6, iA.w * 2.5, z);
  if (z < 0.1 || near <= 0.0 || (uSplitSide == 1 && z < uSplit) || (uSplitSide == 2 && z >= uSplit)) { gl_Position = vec4(2.0); return; }
  vec2 q = aCorner * 2.0 - 1.0;
  vc.xy += q * iA.w;
  gl_Position = uProj * vc;
  vQ = q;
  vC = vec4(iB.rgb, iB.a * uIntensity * near);
}`;
const HAZE_FS = `
in vec2 vQ; flat in vec4 vC; out vec4 o;
void main() {
  float d = dot(vQ, vQ);
  float g = exp(-d * 4.0) * (1.0 - smoothstep(0.8, 1.0, d));
  o = vec4(vC.rgb * vC.a * g, 0.0);
}`;

class Haze {
  constructor(gl, rnd) {
    this.gl = gl;
    const n = 9000, data = new Float32Array(n * 8);
    for (let i = 0; i < n; i++) {
      let r, th, y, size, I;
      if (i < 600) { r = Math.abs(gauss(rnd)) * 90; th = rnd() * 6.283; y = gauss(rnd) * 30; size = 60 + rnd() * 90; I = 0.0035; }
      else {
        r = 60 - 320 * Math.log(1 - rnd() * 0.96);
        if (r > 1100) r = 1100 * rnd();
        const k = rnd() < 0.8 ? (rnd() < 0.5 ? 0 : 1) : rnd() < 0.5 ? 2 : 3;
        th = armAngle(r, k) + gauss(rnd) * (0.1 + 12 / r);
        y = gauss(rnd) * (5 + 40 * Math.exp(-r / 100));
        size = 25 + rnd() * 70;
        I = 0.006 * (0.4 + rnd());
      }
      const era = eraOf(r);
      const c = ERA[era].color;
      data.set([r, th, y, size, c[0], c[1] * 0.95, c[2] * 0.9, I], i * 8);
    }
    this.n = n;
    this.prog = new Program(gl, HAZE_VS, HAZE_FS);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const q = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, q);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    for (let k = 0; k < 2; k++) {
      gl.enableVertexAttribArray(1 + k);
      gl.vertexAttribPointer(1 + k, 4, gl.FLOAT, false, 32, k * 16);
      gl.vertexAttribDivisor(1 + k, 1);
    }
    gl.bindVertexArray(null);
  }
  draw(cam, { T, unbind, escR, intensity, split, splitSide, model }) {
    const gl = this.gl;
    this.prog.use().set('uModel', model).set('uView', cam.view).set('uProj', cam.proj).set('uCamPos', cam.pos).set('uTime', T)
      .set('uV0', GAL.V0).set('uRc', GAL.RC).set('uUnbind', unbind).set('uEscapeR', escR).set('uIntensity', intensity)
      .set('uSplit', split).set('uSplitSide', splitSide);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.n);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }
}
