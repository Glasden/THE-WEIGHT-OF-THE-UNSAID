// Instanced SDF glyph renderer with physically-motivated depth of field.
//
// Every glyph is an emissive card. In focus it is a crisp SDF glyph; as its circle of confusion
// grows it blurs, then turns into an energy-conserving bokeh disc; when it is smaller than a pixel
// it becomes a dim point. All three regimes come from one formula, so a glyph can travel from
// readable text to a star-like speck without a pop.
//
// Instance layout (5 x vec4, 80 bytes):
//   A: STATIC/BURST (x, y, z, size)            ORBIT (-, height, -, size)
//   B: (tx, ty, tz, glyph)  tangent = text x-axis; glyph < 0 => solid rounded rect
//   C: (r, g, b, intensity)
//   D: STATIC (rectW, rectH, -, seed)  ORBIT (radius, phase0, arcOffset, seed)  BURST (birth, speed, penOffset, seed)
//   E: STATIC (velocity.xyz, birth)        ORBIT (escape weight, -, -, -)       BURST (dir.xyz, absorbDelay)
//
// STATIC extras (uReveal = 1): a glyph appears at its birth time; after uKickT every glyph flies off along its
// velocity with drag, and glyphs born before the kick flash and die. ORBIT extras (uUni = 1): the galaxy's
// "uniform" state — a wave of pasted replies that recolours, flattens and regularises it, undone by deletions.

import { Program, texture } from './gl.js';

export const MODE = { STATIC: 0, ORBIT: 1, BURST: 2 };
export const STRIDE = 20;
export const IDENT = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

const VS = `
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 iA;
layout(location=2) in vec4 iB;
layout(location=3) in vec4 iC;
layout(location=4) in vec4 iD;
layout(location=5) in vec4 iE;

uniform mat4 uView, uProj, uModel;
uniform vec3 uCamPos, uCamRight, uCamUp, uUp;
uniform float uFocalPx, uFocus, uCoc, uCocMax, uMinBlur, uNear;
uniform vec2 uNearFade;
uniform vec3 uDimNear;   // (d0, d1, floor): glyphs nearer than d1 fade toward floor
uniform int uSinkMode;    // burst: 0 = uniform sink, 1 = per-instance sink in iB.xyz
uniform int uMode;
uniform float uTime, uIntensity;
uniform highp sampler2D uEntries;
uniform float uEm, uCell, uSpread, uBaseline;
// orbit
uniform float uV0, uRc, uUnbind;
uniform vec2 uEscapeR;
// burst
uniform vec3 uOrigin, uSink, uSwirlAxis;
uniform float uGrow;
uniform float uAbsorb;
// depth split for lensing (draw only z>split or z<split); 0 disables
uniform float uSplit; uniform int uSplitSide;
// static: reveal by birth time, then the kick
uniform int uReveal;
uniform float uRevealFade, uKickT, uKickDrag, uKickFlash, uRevealFlash;
uniform vec2 uKillAt;
// orbit: the uniform state
uniform int uUni, uRepN;
uniform vec3 uUniC, uUniCol;
uniform float uUniR, uUniW, uRestore, uHeroR, uUniA, uPitchK, uSnap;
uniform vec4 uSeeds;
uniform float uRep[64];

out vec2 vUv;
flat out vec4 vRect;    // atlas x, y, w(px), adv(em)
flat out vec4 vColor;
flat out vec4 vBlur;    // blurEm, discT, glyphPx, isRect
flat out vec2 vBox;

vec4 entry(float id) {
  int i = int(id);
  return texelFetch(uEntries, ivec2(i & 4095, i >> 12), 0);
}

float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}
// how far the paste has taken this point (0 = itself, 1 = the same as everything else)
float uniAmt(vec2 x) {
  float w = 1.0 - smoothstep(uUniR - uUniW, uUniR, length(x - uUniC.xz));
  float n = vnoise(x / 170.0) * 0.65 + vnoise(x / 61.0 + 7.3) * 0.35;
  n = clamp((n - 0.2) / 0.6, 0.0, 1.0) * 0.86 + 0.1;
  n = min(n, 0.3 * length(x - uSeeds.xy) / 140.0);
  n = min(n, 0.05 + 0.3 * length(x - uSeeds.zw) / 140.0);
  n = max(n, 1.0 - smoothstep(uHeroR * 0.45, uHeroR, length(x - uUniC.xz)));
  return w * (1.0 - smoothstep(n - 0.03, n + 0.03, uRestore));
}

void main() {
  float s = iA.w;
  float gid = iB.w;
  bool isRect = gid < 0.0;
  vec3 P, T;
  vec4 col = iC;
  float fade = 1.0;
  if (uMode == 1) {
    float r = iD.x;
    float v = uV0 * r / sqrt(r * r + uRc * uRc);
    float ph0 = iD.y, yy = iA.y;
    float phi = ph0 + v / r * uTime + iD.z / r;
    if (uUni == 1) {
      float u = uniAmt(vec2(cos(phi), sin(phi)) * r);
      if (u > 0.0) {
        // every line slides onto one of four perfect spirals, the disc goes flat, the colours and the words become one
        float arm = -log(max(r, 20.0) / 60.0) * uPitchK;
        float snap = arm + floor((ph0 - arm) / 1.5707963 + 0.5) * 1.5707963;
        ph0 = mix(ph0, snap, u * 0.72 * uSnap);
        yy *= 1.0 - 0.8 * u * uSnap;
        phi = ph0 + v / r * uTime + iD.z / r;
        col = vec4(mix(iC.rgb, uUniCol, u), mix(iC.a, uUniA * (0.3 + 0.7 * smoothstep(50.0, 260.0, r)), u));
        if (uRepN > 0 && !isRect && u > 0.15 + 0.7 * fract(iD.w * 7.31 + 0.13)) gid = uRep[gl_InstanceID % uRepN];
      }
    }
    vec3 rad = vec3(cos(phi), 0.0, sin(phi));
    T = vec3(-sin(phi), 0.0, cos(phi));
    P = rad * r + vec3(0.0, yy, 0.0);
    // dark matter removed: each glyph flies off along its own tangent
    float w = smoothstep(uEscapeR.x, uEscapeR.y, r) * iE.x;
    float tau = uUnbind * w;
    P += (T * v * 1.0 + rad * v * 0.35) * tau;
  } else if (uMode == 2) {
    float age = uTime - iD.x;
    if (age < 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    bool linear = iD.w > 0.5;   // linear: constant-velocity streams (no ease, no growth)
    float dist = linear ? iD.y * age : iD.y * (1.0 - exp(-age * 1.6)) / 1.6 + iD.y * 0.08 * age;
    vec3 base = uOrigin + iA.xyz + iE.xyz * dist;
    if (!linear) s *= min(1.0 + dist * uGrow, 3.5);    // the farther a completion flies, the larger it reads
    float ab = clamp((uAbsorb - iE.w) / 1.2, 0.0, 1.0);
    ab = ab * ab * (3.0 - 2.0 * ab);
    // drain: spiral into the sink around the swirl axis
    vec3 sink = uSinkMode == 1 ? iB.xyz : uSink;
    vec3 rel = base - sink;
    float th = ab * 5.0;
    vec3 k = normalize(uSwirlAxis + 1e-6);
    rel = rel * cos(th) + cross(k, rel) * sin(th) + k * dot(k, rel) * (1.0 - cos(th));
    P = sink + rel * pow(1.0 - ab, 1.6);
    s *= mix(1.0, 0.2, ab);
    T = uCamRight;
    P += T * iD.z * s;
    fade = smoothstep(0.0, 0.25, age) * pow(1.0 - ab, 3.0);
  } else {
    P = iA.xyz;
    T = iB.xyz;
    if (uReveal == 1) {
      float age = uTime - iE.w;
      if (age < 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
      fade *= smoothstep(0.0, uRevealFade, age) * (1.0 + uRevealFlash * exp(-age * 8.0));
      if (uKickT > 0.0 && uTime > uKickT) {
        float a = uTime - uKickT;
        P += iE.xyz * (1.0 - exp(-a * uKickDrag)) / uKickDrag;
        if (iE.w < uKickT) fade *= (1.0 + uKickFlash * exp(-a * 9.0)) * (1.0 - smoothstep(uKillAt.x, uKillAt.y, a));
      }
    }
  }
  vec4 e = isRect ? vec4(0.0, 0.0, 0.0, iD.x) : entry(gid);

  P = (uModel * vec4(P, 1.0)).xyz;
  T = normalize(mat3(uModel) * T);
  float adv = isRect ? iD.x : e.w;
  vec3 C = P + T * (adv * 0.5 * s);
  vec4 vc = uView * vec4(C, 1.0);
  float z = -vc.z;
  if (z < uNear || (uSplitSide == 1 && z < uSplit) || (uSplitSide == 2 && z >= uSplit)) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return;
  }
  fade *= smoothstep(uNearFade.x, uNearFade.y, z);
  if (uDimNear.y > 0.0) fade *= mix(uDimNear.z, 1.0, smoothstep(uDimNear.x, uDimNear.y, z));

  float glyphPx = s * uFocalPx / z;
  float coc = min(uCocMax, uCoc * abs(1.0 - uFocus / z));
  float b = sqrt(coc * coc + uMinBlur * uMinBlur);
  float blurEm = b / glyphPx + ((uMode == 0 && !isRect) ? iD.z : 0.0);
  float discT = isRect ? 0.0 : smoothstep(0.12, 0.45, blurEm);

  // Upright billboard: up follows the line's up-vector projected on the view plane; seen from behind,
  // the text mirrors (like a sheet of paper) instead of turning upside-down.
  vec3 d = normalize(C - uCamPos);
  vec3 U = uMode == 2 ? uCamUp : (uMode == 1 ? normalize(mat3(uModel) * uUp) : uUp);
  vec3 up = U - dot(U, d) * d;
  float ul = length(up);
  if (uMode == 1) {
    vec3 Pm = (inverse(uModel) * vec4(P, 1.0)).xyz;
    vec3 radv = normalize(mat3(uModel) * normalize(vec3(Pm.x, 0.0, Pm.z) + 1e-6));
    vec3 rp = radv - dot(radv, d) * d;
    up = mix(rp, up / max(ul, 1e-6), smoothstep(0.12, 0.45, ul));
    ul = length(up);
  }
  up = ul > 1e-5 ? up / ul : uCamUp;
  vec3 right = cross(d, up);
  if (dot(right, T) < 0.0) right = -right;

  float m = blurEm + 1.5 / glyphPx;
  vec2 lo, hi;
  if (isRect) {
    lo = vec2(0.0, -iD.y * 0.5) - m;
    hi = vec2(iD.x, iD.y * 0.5) + m;
  } else {
    lo = vec2(-uSpread / uEm, (uBaseline - uCell) / uEm) - m;
    hi = vec2((e.z - uSpread) / uEm, uBaseline / uEm) + m;
    float R = 0.28 * max(adv, 0.6) + blurEm;
    vec2 c = vec2(adv * 0.5, 0.32);
    lo = min(lo, c - R - 1.5 / glyphPx); hi = max(hi, c + R + 1.5 / glyphPx);
  }
  vec2 q = mix(lo, hi, aCorner);
  vec3 W = P + (right * q.x + up * q.y) * s;
  gl_Position = uProj * uView * vec4(W, 1.0);

  vUv = q;
  vRect = vec4(e.xyz, adv);
  vColor = vec4(col.rgb, col.a * uIntensity * fade);
  vBlur = vec4(blurEm, discT, glyphPx, isRect ? 1.0 : 0.0);
  vBox = isRect ? vec2(iD.x, iD.y) : vec2(0.0);
  if (vColor.a <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;

const FS = `
uniform sampler2D uAtlas;
uniform vec2 uAtlasSize;
uniform float uEm, uCell, uSpread, uBaseline;
in vec2 vUv;
flat in vec4 vRect;
flat in vec4 vColor;
flat in vec4 vBlur;
flat in vec2 vBox;
out vec4 o;

float sdfAt(vec2 uv) {
  vec2 a = vec2(vRect.x + uSpread + uv.x * uEm, vRect.y + uBaseline - uv.y * uEm);
  float inside = step(vRect.x, a.x) * step(a.x, vRect.x + vRect.z) * step(vRect.y, a.y) * step(a.y, vRect.y + uCell);
  return texture(uAtlas, a / uAtlasSize).r * inside;
}

void main() {
  float blurEm = vBlur.x, discT = vBlur.y, gpx = vBlur.z;
  float a;
  if (vBlur.w > 0.5) {
    // rounded rect, height vBox.y centred on baseline, width vBox.x from pen
    vec2 c = vec2(vBox.x * 0.5, 0.0);
    vec2 hs = vBox * 0.5;
    float r = min(hs.x, hs.y) * (abs(vBox.x - vBox.y) < 1e-4 ? 1.0 : 0.25);
    vec2 dd = abs(vUv - c) - hs + r;
    float dist = length(max(dd, 0.0)) + min(max(dd.x, dd.y), 0.0) - r;
    float w = max(blurEm, 0.7 / gpx);
    a = 1.0 - smoothstep(-w, w, dist);
  } else {
    float g = 0.0;
    if (discT < 1.0) {
      float sd = sdfAt(vUv);
      float k = clamp(blurEm * uEm / (2.0 * uSpread), 0.0, 0.5);
      float aa = fwidth(sd) * 0.7;
      float w = max(k, aa);
      g = smoothstep(0.5 - w, 0.5 + w, sd);
    }
    float disc = 0.0;
    if (discT > 0.0) {
      vec2 c = vec2(vRect.w * 0.5, 0.32);
      float R = 0.28 * max(vRect.w, 0.6) + blurEm;
      float d = length(vUv - c) / R;
      float px = 1.0 / max(R * gpx, 1.0);
      float body = 1.0 - smoothstep(1.0 - px * 1.5, 1.0 + px * 1.5, d);
      float rimAmt = smoothstep(2.5, 8.0, R * gpx);
      float rim = mix(1.0, mix(0.7, 1.25, smoothstep(0.45, 0.97, d)), rimAmt);
      float ink = 0.2 * max(vRect.w, 0.5);
      disc = body * rim * ink / (3.14159 * R * R);
    }
    a = mix(g, disc, discT);
  }
  o = vec4(vColor.rgb * vColor.a * a, 0.0);
}`;

export class Atlas {
  static async load(gl, base) {
    // raw single-channel bytes: browser PNG decode of an 8192px atlas kills the GPU process headless
    const [meta, buf] = await Promise.all([fetch(base + '.json').then((r) => r.json()), fetch(base + '.r8').then((r) => r.arrayBuffer())]);
    const a = new Atlas();
    a.meta = meta;
    a.bytes = new Uint8Array(buf);
    a.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, a.tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, meta.width, meta.height, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array(buf));
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    if (gl.isContextLost()) throw new Error('context lost after mipmap');
    const n = meta.entries.length, rows = Math.ceil(n / 4096);
    const data = new Float32Array(4096 * rows * 4);
    meta.entries.forEach(([x, y, w, h, adv], i) => data.set([x, y, w, adv / meta.em], i * 4));
    a.entryTex = texture(gl, { w: 4096, h: rows, internal: gl.RGBA32F, format: gl.RGBA, type: gl.FLOAT, data, filter: gl.NEAREST });
    a.adv = meta.entries.map((e) => e[4] / meta.em);   // advance in em
    a.ids = {};
    return a;
  }

  // SDF value (0..1, >0.5 inside) at em coords (x right of pen, y up from baseline)
  sdf(id, x, y) {
    const m = this.meta, [rx, ry, w] = m.entries[id];
    const ax = Math.round(rx + m.spread + x * m.em), ay = Math.round(ry + m.baseline - y * m.em);
    if (ax < rx || ax >= rx + w || ay < ry || ay >= ry + m.cell) return 0;
    return this.bytes[ay * m.width + ax] / 255;
  }

  // Ink centroid and radius (em)
  ink(id) {
    const m = this.meta, [rx, ry, w] = m.entries[id];
    let sx = 0, sy = 0, n = 0;
    const pts = [];
    for (let ay = ry; ay < ry + m.cell; ay += 2)
      for (let ax = rx; ax < rx + w; ax += 2)
        if (this.bytes[ay * m.width + ax] > 132) {
          const x = (ax - rx - m.spread) / m.em, y = (m.baseline - (ay - ry)) / m.em;
          sx += x; sy += y; n++; pts.push([x, y]);
        }
    const cx = sx / n, cy = sy / n;
    let r = 0;
    for (const [x, y] of pts) r = Math.max(r, Math.hypot(x - cx, y - cy));
    return { cx, cy, r, area: (n * 4) / (m.em * m.em) };
  }

  // Jittered-grid sample points inside the glyph's ink, spacing in em
  inkPoints(id, spacing, rnd, thresh = 0.53) {
    const m = this.meta, [, , w] = m.entries[id];
    const x0 = -m.spread / m.em, x1 = (w - m.spread) / m.em;
    const y0 = (m.baseline - m.cell) / m.em, y1 = m.baseline / m.em;
    const out = [];
    for (let y = y0; y < y1; y += spacing)
      for (let x = x0; x < x1; x += spacing) {
        const px = x + (rnd() - 0.5) * spacing * 0.6, py = y + (rnd() - 0.5) * spacing * 0.6;
        if (this.sdf(id, px, py) > thresh) out.push([px, py]);
      }
    return out;
  }
}

let _prog = null, _quad = null;

export class GlyphLayer {
  constructor(gl, atlas, capacity, { mode = MODE.STATIC, dynamic = false } = {}) {
    this.gl = gl; this.atlas = atlas; this.mode = mode; this.capacity = capacity; this.count = 0;
    this.data = new Float32Array(capacity * STRIDE);
    this.uniforms = { uIntensity: 1 };
    if (!_prog) {
      _prog = new Program(gl, VS, FS);
      _quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, _quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    }
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, _quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    for (let k = 0; k < 5; k++) {
      gl.enableVertexAttribArray(1 + k);
      gl.vertexAttribPointer(1 + k, 4, gl.FLOAT, false, STRIDE * 4, k * 16);
      gl.vertexAttribDivisor(1 + k, 1);
    }
    gl.bindVertexArray(null);
  }

  clear() { this.count = 0; }

  push(A, B, Cc, D = [0, 0, 0, 0], E = [0, 0, 0, 0]) {
    if (this.count >= this.capacity) return -1;
    const o = this.count * STRIDE, d = this.data;
    d[o] = A[0]; d[o + 1] = A[1]; d[o + 2] = A[2]; d[o + 3] = A[3];
    d[o + 4] = B[0]; d[o + 5] = B[1]; d[o + 6] = B[2]; d[o + 7] = B[3];
    d[o + 8] = Cc[0]; d[o + 9] = Cc[1]; d[o + 10] = Cc[2]; d[o + 11] = Cc[3];
    d[o + 12] = D[0]; d[o + 13] = D[1]; d[o + 14] = D[2]; d[o + 15] = D[3];
    d[o + 16] = E[0]; d[o + 17] = E[1]; d[o + 18] = E[2]; d[o + 19] = E[3];
    return this.count++;
  }

  // Lay out a line of glyph ids along tangent T from pen P (STATIC). Returns width in em.
  pushLine(ids, P, T, size, color, { tracking = 0, seed = 0, blur = 0 } = {}) {
    let pen = 0;
    for (const id of ids) {
      const adv = this.atlas.adv[id];
      if (this.atlas.meta.entries[id][2] > 0)
        this.push([P[0] + T[0] * pen * size, P[1] + T[1] * pen * size, P[2] + T[2] * pen * size, size], [T[0], T[1], T[2], id], color, [0, 0, blur, seed]);
      pen += adv + tracking;
    }
    return pen;
  }

  lineWidth(ids, tracking = 0) {
    let w = 0;
    for (const id of ids) w += this.atlas.adv[id] + tracking;
    return w;
  }

  upload() {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.count * STRIDE);
  }

  draw(cam, extra = {}) {
    if (!this.count) return;
    const gl = this.gl, p = _prog.use(), m = this.atlas.meta;
    p.set('uView', cam.view).set('uProj', cam.proj).set('uCamPos', cam.pos).set('uCamRight', cam.right).set('uCamUp', cam.up)
      .set('uFocalPx', cam.focalPx).set('uFocus', cam.focus).set('uCoc', cam.coc).set('uCocMax', cam.cocMax)
      .set('uMinBlur', cam.minBlur).set('uNear', cam.near).set('uNearFade', cam.nearFade)
      .set('uMode', this.mode).set('uEm', m.em).set('uCell', m.cell).set('uSpread', m.spread).set('uBaseline', m.baseline)
      .set('uAtlasSize', [m.width, m.height])
      .set('uSplit', 0).set('uSplitSide', 0).set('uAbsorb', -1e9).set('uUnbind', 0).set('uEscapeR', [1e9, 2e9])
      .set('uReveal', 0).set('uKickT', 0).set('uKickDrag', 1.6).set('uKickFlash', 0).set('uKillAt', [0.05, 0.35]).set('uRevealFade', 0.12).set('uRevealFlash', 0)
      .set('uUni', 0).set('uRepN', 0)
      .set('uUp', [0, 1, 0]).set('uDimNear', [0, 0, 1]).set('uSinkMode', 0).set('uSwirlAxis', [0, 1, 0]).set('uGrow', 0).set('uModel', IDENT).set('uOrigin', [0, 0, 0]).set('uSink', [0, 0, 0]).set('uTime', 0).set('uV0', 0).set('uRc', 1);
    const u = { ...this.uniforms, ...extra };
    for (const k in u) if (k !== 'count') p.set(k, u[k]);
    p.tex('uAtlas', this.atlas.tex).tex('uEntries', this.atlas.entryTex);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, Math.min(this.count, u.count ?? this.count));
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }
}
