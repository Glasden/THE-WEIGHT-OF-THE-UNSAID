// Post chain: gravitational lensing -> motion-blur accumulation -> HUD -> bloom + anamorphic streak
// -> grade / tonemap / grain -> title cards -> 10-bit output.

import { Program, FBO, FS_VERT, fullscreen, texture } from './gl.js';

const MAX_LENS = 48;

const LENS_FS = `
uniform sampler2D uScene, uFg;
uniform vec4 uLens[${MAX_LENS}];   // xy center px, z einstein radius px, w strength
uniform int uLensCount;
uniform vec2 uRes;
uniform float uGain, uCoreDark, uUseFg, uRingGain;
in vec2 vUv; out vec4 o;
void main() {
  vec2 px = vUv * uRes;
  vec2 src = px;
  float dark = 1.0, ring = 0.0;
  for (int i = 0; i < ${MAX_LENS}; i++) {
    if (i >= uLensCount) break;
    vec4 L = uLens[i];
    vec2 d = px - L.xy;
    float r2 = max(dot(d, d), 1.0);
    float te = L.z * L.w;
    src -= d * (te * te) / r2;
    float r = sqrt(r2);
    dark *= mix(1.0, smoothstep(0.42 * L.z, 0.92 * L.z, r), uCoreDark * L.w);
    float x = (r - L.z) / (0.05 * L.z + 1.5);
    ring += exp(-x * x) * L.w;
  }
  vec2 suv = src / uRes;
  float inb = smoothstep(-0.02, 0.0, suv.x) * smoothstep(1.02, 1.0, suv.x) * smoothstep(-0.02, 0.0, suv.y) * smoothstep(1.02, 1.0, suv.y);
  vec3 c;
  if (uLensCount > 0) {
    vec2 dx = dFdx(suv), dy = dFdy(suv);
    c = (texture(uScene, suv + 0.375 * dx + 0.125 * dy).rgb + texture(uScene, suv - 0.375 * dx - 0.125 * dy).rgb
       + texture(uScene, suv + 0.125 * dx - 0.375 * dy).rgb + texture(uScene, suv - 0.125 * dx + 0.375 * dy).rgb) * 0.25;
  } else c = texture(uScene, suv).rgb;
  c *= inb * dark;
  // the ring catches the light it bends: brighten what is already there, plus a faint glow
  c *= 1.0 + ring * uRingGain * 2.0;
  c += vec3(1.0, 0.72, 0.42) * ring * uRingGain * 0.06;
  if (uUseFg > 0.5) c += texture(uFg, vUv).rgb;
  o = vec4(c * uGain, 1.0);
}`;

const ADD_FS = `
uniform sampler2D uTex; uniform float uGain; uniform int uPremul;
in vec2 vUv; out vec4 o;
void main() {
  vec4 t = texture(uTex, vec2(vUv.x, 1.0 - vUv.y));
  vec3 c = uPremul == 1 ? t.rgb : t.rgb * t.a;
  // canvas is sRGB: linearize so HUD sits in the same light as the world
  o = vec4(pow(c, vec3(2.2)) * uGain, 1.0);
}`;

const DOWN_FS = `
uniform sampler2D uTex; uniform vec2 uTexel; uniform int uKaris;
in vec2 vUv; out vec4 o;
vec3 s(vec2 off) { return texture(uTex, vUv + off * uTexel).rgb; }
float w(vec3 c) { return 1.0 / (1.0 + max(c.r, max(c.g, c.b))); }
void main() {
  vec3 a = s(vec2(-2, 2)), b = s(vec2(0, 2)), c = s(vec2(2, 2));
  vec3 d = s(vec2(-2, 0)), e = s(vec2(0, 0)), f = s(vec2(2, 0));
  vec3 g = s(vec2(-2, -2)), h = s(vec2(0, -2)), i = s(vec2(2, -2));
  vec3 j = s(vec2(-1, 1)), k = s(vec2(1, 1)), l = s(vec2(-1, -1)), m = s(vec2(1, -1));
  vec3 r;
  if (uKaris == 1) {
    vec3 g0 = (a + b + d + e) * 0.25, g1 = (b + c + e + f) * 0.25, g2 = (d + e + g + h) * 0.25, g3 = (e + f + h + i) * 0.25, g4 = (j + k + l + m) * 0.25;
    float w0 = w(g0), w1 = w(g1), w2 = w(g2), w3 = w(g3), w4 = w(g4);
    r = (g0 * w0 * 0.125 + g1 * w1 * 0.125 + g2 * w2 * 0.125 + g3 * w3 * 0.125 + g4 * w4 * 0.5) /
        (w0 * 0.125 + w1 * 0.125 + w2 * 0.125 + w3 * 0.125 + w4 * 0.5);
  } else {
    r = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  }
  o = vec4(r, 1.0);
}`;

const UP_FS = `
uniform sampler2D uTex; uniform vec2 uTexel; uniform float uRadius;
in vec2 vUv; out vec4 o;
void main() {
  vec2 t = uTexel * uRadius;
  vec3 r = texture(uTex, vUv).rgb * 4.0;
  r += (texture(uTex, vUv + vec2(-t.x, 0)).rgb + texture(uTex, vUv + vec2(t.x, 0)).rgb + texture(uTex, vUv + vec2(0, -t.y)).rgb + texture(uTex, vUv + vec2(0, t.y)).rgb) * 2.0;
  r += texture(uTex, vUv + vec2(-t.x, -t.y)).rgb + texture(uTex, vUv + vec2(t.x, -t.y)).rgb + texture(uTex, vUv + vec2(-t.x, t.y)).rgb + texture(uTex, vUv + vec2(t.x, t.y)).rgb;
  o = vec4(r / 16.0, 1.0);
}`;

const STREAK_FS = `
uniform sampler2D uTex; uniform vec2 uTexel; uniform float uStep, uThreshold;
in vec2 vUv; out vec4 o;
void main() {
  vec3 acc = vec3(0.0); float wsum = 0.0;
  for (int i = -12; i <= 12; i++) {
    float x = float(i);
    float w = exp(-x * x / 50.0);
    vec3 c = texture(uTex, vUv + vec2(x * uStep * uTexel.x, 0.0)).rgb;
    c = max(c - uThreshold, 0.0);
    acc += c * w; wsum += w;
  }
  o = vec4(acc / wsum, 1.0);
}`;

const COMPOSITE_FS = `
uniform sampler2D uAccum, uBloom, uStreak, uCards;
uniform vec2 uRes;
uniform float uBloomAmt, uStreakAmt, uExposure, uCA, uVignette, uGrain, uFade, uFrame, uCardsOn, uSat;
uniform vec3 uStreakTint, uWB, uLift, uGamma, uGainC;
uniform int uOut10;
in vec2 vUv; out vec4 o;

vec3 aces(vec3 x) {
  const mat3 I = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
  const mat3 O = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
  vec3 v = I * x;
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return clamp(O * (a / b), 0.0, 1.0);
}
float hash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }

void main() {
  vec2 uv = vUv;
  vec2 dc = uv - 0.5;
  vec3 c;
  c.r = texture(uAccum, uv - dc * uCA).r;
  c.g = texture(uAccum, uv).g;
  c.b = texture(uAccum, uv + dc * uCA).b;
  c += texture(uBloom, uv).rgb * uBloomAmt;
  c += texture(uStreak, uv).rgb * uStreakTint * uStreakAmt;
  c *= uExposure * uWB;
  c = aces(c);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat);
  c = pow(max(c * uGainC + uLift * (1.0 - c), 0.0), 1.0 / uGamma);
  float vig = 1.0 - uVignette * smoothstep(0.25, 0.95, length(dc * vec2(uRes.x / uRes.y, 1.0)) / 1.2);
  c *= vig * uFade;
  if (uCardsOn > 0.5) {
    vec4 k = texture(uCards, vec2(uv.x, 1.0 - uv.y));
    c = c * (1.0 - k.a) + k.rgb;
  }
  // film grain: luminance-weighted, temporally varying
  float n = hash(vec3(gl_FragCoord.xy, uFrame)) + hash(vec3(gl_FragCoord.yx * 1.37, uFrame + 17.0)) - 1.0;
  c += n * uGrain * 0.45 * (0.35 + 0.65 * sqrt(clamp(l, 0.0, 1.0)));
  c = pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
  float dith = (hash(vec3(gl_FragCoord.xy * 0.71, uFrame * 3.1)) - 0.5) / (uOut10 == 1 ? 1023.0 : 255.0);
  o = vec4(c + dith, 1.0);
}`;

export class Post {
  constructor(gl, W, H, { out10 = true } = {}) {
    this.gl = gl; this.W = W; this.H = H; this.out10 = out10;
    this.scene = new FBO(gl, W, H);
    this.fg = new FBO(gl, W, H);
    this.accum = new FBO(gl, W, H, { internal: gl.RGBA32F, type: gl.FLOAT });
    this.mips = [];
    let w = W, h = H;
    for (let i = 0; i < 7; i++) { w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); this.mips.push(new FBO(gl, w, h)); }
    this.streakA = new FBO(gl, W >> 2, H >> 3);
    this.streakB = new FBO(gl, W >> 2, H >> 3);
    this.out = new FBO(gl, W, H, out10 ? { internal: gl.RGB10_A2, format: gl.RGBA, type: gl.UNSIGNED_INT_2_10_10_10_REV, filter: gl.NEAREST }
                                     : { internal: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE, filter: gl.NEAREST });
    this.pLens = new Program(gl, FS_VERT, LENS_FS);
    this.pAdd = new Program(gl, FS_VERT, ADD_FS);
    this.pDown = new Program(gl, FS_VERT, DOWN_FS);
    this.pUp = new Program(gl, FS_VERT, UP_FS);
    this.pStreak = new Program(gl, FS_VERT, STREAK_FS);
    this.pComp = new Program(gl, FS_VERT, COMPOSITE_FS);
    this.black = texture(gl, { w: 1, h: 1, internal: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE, data: new Uint8Array(4) });
    this.hudTex = texture(gl, { w: 1, h: 1, internal: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE, data: new Uint8Array(4) });
    this.cardTex = texture(gl, { w: 1, h: 1, internal: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE, data: new Uint8Array(4) });
    this.pixels = new Uint8Array(W * H * 4);
  }

  beginAccum() { this.accum.bind(true); }

  // After the world for one sub-frame is drawn into scene (+fg), lens it and add into accum.
  accumulate(gain, lenses = [], coreDark = 0, useFg = false, ringGain = 0.35) {
    const gl = this.gl;
    this.accum.bind();
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    const flat = new Float32Array(MAX_LENS * 4);
    lenses.slice(0, MAX_LENS).forEach((L, i) => flat.set(L, i * 4));
    this.pLens.use().set('uRes', [this.W, this.H]).set('uGain', gain).set('uCoreDark', coreDark)
      .set('uLensCount', Math.min(MAX_LENS, lenses.length)).set('uLens', flat).set('uUseFg', useFg ? 1 : 0).set('uRingGain', ringGain)
      .tex('uScene', this.scene.tex).tex('uFg', this.fg.tex);
    fullscreen(gl);
    gl.disable(gl.BLEND);
  }

  uploadCanvas(tex, canvas) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }

  addHud(canvas, gain) {
    const gl = this.gl;
    this.uploadCanvas(this.hudTex, canvas);
    this.accum.bind();
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    this.pAdd.use().set('uGain', gain).set('uPremul', 1).tex('uTex', this.hudTex);
    fullscreen(gl);
    gl.disable(gl.BLEND);
  }

  finish(p, cardsCanvas) {
    const gl = this.gl;
    // bloom down
    let src = this.accum;
    this.mips.forEach((m, i) => {
      m.bind();
      this.pDown.use().set('uTexel', [1 / src.w, 1 / src.h]).set('uKaris', i === 0 ? 1 : 0).tex('uTex', src.tex);
      fullscreen(gl);
      src = m;
    });
    // streak from mip1 (quarter res)
    this.streakA.bind();
    this.pStreak.use().set('uTexel', [1 / this.mips[1].w, 1 / this.mips[1].h]).set('uStep', 1).set('uThreshold', p.streakThreshold ?? 0.6).tex('uTex', this.mips[1].tex);
    fullscreen(gl);
    let a = this.streakA, b = this.streakB;
    for (const st of [3, 9, 27]) {
      b.bind();
      this.pStreak.use().set('uTexel', [1 / a.w, 1 / a.h]).set('uStep', st).set('uThreshold', 0).tex('uTex', a.tex);
      fullscreen(gl);
      [a, b] = [b, a];
    }
    // bloom up (additive)
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = this.mips.length - 1; i > 0; i--) {
      const lo = this.mips[i], hi = this.mips[i - 1];
      hi.bind();
      this.pUp.use().set('uTexel', [1 / lo.w, 1 / lo.h]).set('uRadius', 1).tex('uTex', lo.tex);
      fullscreen(gl);
    }
    gl.disable(gl.BLEND);
    if (cardsCanvas) this.uploadCanvas(this.cardTex, cardsCanvas);
    this.out.bind();
    this.pComp.use().set('uRes', [this.W, this.H])
      .set('uBloomAmt', p.bloom ?? 0.08).set('uStreakAmt', p.streak ?? 0.15).set('uStreakTint', p.streakTint ?? [0.6, 0.8, 1.0])
      .set('uExposure', p.exposure ?? 1).set('uCA', p.ca ?? 0.0015).set('uVignette', p.vignette ?? 0.35)
      .set('uGrain', p.grain ?? 0.025).set('uFade', p.fade ?? 1).set('uFrame', p.frame ?? 0).set('uSat', p.sat ?? 1)
      .set('uWB', p.wb ?? [1, 1, 1]).set('uLift', p.lift ?? [0, 0, 0]).set('uGamma', p.gamma ?? [1, 1, 1]).set('uGainC', p.gain ?? [1, 1, 1])
      .set('uCardsOn', cardsCanvas ? 1 : 0).set('uOut10', this.out10 ? 1 : 0)
      .tex('uAccum', this.accum.tex).tex('uBloom', this.mips[0].tex).tex('uStreak', a.tex).tex('uCards', cardsCanvas ? this.cardTex : this.black);
    fullscreen(gl);
  }

  // Asynchronous readback: copy into a pixel-pack buffer behind a fence, collect it a frame later.
  readStart(slot) {
    const gl = this.gl;
    if (!this.pbo) {
      this.pbo = [gl.createBuffer(), gl.createBuffer()];
      this.fence = [null, null];
      for (const b of this.pbo) { gl.bindBuffer(gl.PIXEL_PACK_BUFFER, b); gl.bufferData(gl.PIXEL_PACK_BUFFER, this.W * this.H * 4, gl.STREAM_READ); }
    }
    this.out.bind();
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pbo[slot]);
    gl.readPixels(0, 0, this.W, this.H, gl.RGBA, this.out10 ? gl.UNSIGNED_INT_2_10_10_10_REV : gl.UNSIGNED_BYTE, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    this.fence[slot] = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
  }
  async readFinish(slot) {
    const gl = this.gl, s = this.fence[slot];
    const yieldNow = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = r; c.port2.postMessage(0); });
    for (;;) {
      const st = gl.clientWaitSync(s, 0, 0);
      if (st === gl.ALREADY_SIGNALED || st === gl.CONDITION_SATISFIED) break;
      await yieldNow();
    }
    gl.deleteSync(s);
    const dst = new Uint8Array(this.W * this.H * 4);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pbo[slot]);
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, dst);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    return dst;
  }

  read() {
    const gl = this.gl;
    this.out.bind();
    gl.readPixels(0, 0, this.W, this.H, gl.RGBA, this.out10 ? gl.UNSIGNED_INT_2_10_10_10_REV : gl.UNSIGNED_BYTE,
      this.out10 ? new Uint32Array(this.pixels.buffer) : this.pixels);
    return this.pixels;
  }
}
