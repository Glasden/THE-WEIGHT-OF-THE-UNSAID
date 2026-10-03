// Small vector / matrix / easing toolkit. Column-major mat4 (WebGL convention).

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invlerp = (a, b, x) => clamp((x - a) / (b - a));
export const smoothstep = (a, b, x) => { const t = invlerp(a, b, x); return t * t * (3 - 2 * t); };
export const smootherstep = (a, b, x) => { const t = invlerp(a, b, x); return t * t * t * (t * (t * 6 - 15) + 10); };
export const easeInOut = (t) => smootherstep(0, 1, t);
export const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInCubic = (t) => Math.pow(clamp(t), 3);
export const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t)));
export const easeInExpo = (t) => (t <= 0 ? 0 : Math.pow(2, 10 * clamp(t) - 10));
export const pulse = (t, a, b, fade) => smoothstep(a - fade, a, t) * (1 - smoothstep(b, b + fade, t));

export const v3 = (x = 0, y = 0, z = 0) => [x, y, z];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export function perspective(fovYdeg, aspect, near, far) {
  const f = 1 / Math.tan((fovYdeg * Math.PI) / 360), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}

export function lookAt(eye, target, up = [0, 1, 0]) {
  const z = norm(sub(eye, target));
  let x = cross(up, z);
  if (len(x) < 1e-6) x = cross([0, 0, 1], z);
  x = norm(x);
  const y = cross(z, x);
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
}

export function mul4(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}

export function transformPoint(m, p) {
  const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
  const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
  const z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14];
  const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  return [x / w, y / w, z / w, w];
}

// Rotate vector around axis (Rodrigues)
export function rotate(v, axis, ang) {
  const k = norm(axis), c = Math.cos(ang), s = Math.sin(ang);
  const kv = cross(k, v), kd = dot(k, v);
  return [0, 1, 2].map((i) => v[i] * c + kv[i] * s + k[i] * kd * (1 - c));
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(rnd) {
  let u = 0, v = 0;
  while (u === 0) u = rnd();
  v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Centripetal-ish Catmull-Rom through points (arrays), t in [0,1] across whole path.
export function catmull(points, t) {
  const n = points.length - 1;
  const f = clamp(t) * n;
  const i = Math.min(n - 1, Math.floor(f));
  const u = f - i;
  const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(n, i + 2)];
  const u2 = u * u, u3 = u2 * u;
  return p1.map((_, k) =>
    0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3));
}

// Keyframe track: [[t, value(number|array)], ...] with per-segment easing (default smooth)
export function track(keys, t, ease = easeInOut) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, a] = keys[i], [t1, b, e] = keys[i + 1];
    if (t <= t1) {
      const u = (e || ease)((t - t0) / (t1 - t0));
      return Array.isArray(a) ? a.map((x, k) => lerp(x, b[k], u)) : lerp(a, b, u);
    }
  }
  return keys[keys.length - 1][1];
}

// Numerically integrate rate(t) from 0..t (deterministic; used for time-warps)
export function integrate(rate, t, step = 1 / 240) {
  let s = 0;
  const n = Math.ceil(Math.abs(t) / step);
  const h = t / Math.max(1, n);
  for (let i = 0; i < n; i++) s += rate((i + 0.5) * h) * h;
  return s;
}
