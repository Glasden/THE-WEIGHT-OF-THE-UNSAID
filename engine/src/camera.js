import { perspective, lookAt, sub, norm, cross, rotate } from './math.js';

// coc / cocMax are fractions of image height so previews at any resolution match the master.
export function makeCamera(o, W, H) {
  const { pos, target, up = [0, 1, 0], fov = 35, roll = 0, focus = 10, coc = 0.0, cocMax = 0.05, minBlur = 0.9,
    near = 0.02, far = 2e5, nearFade = [0, 0] } = o;
  const fwd = norm(sub(target, pos));
  const upR = roll ? rotate(up, fwd, roll) : up;
  const view = lookAt(pos, target, upR);
  const proj = perspective(fov, W / H, near, far);
  const right = norm(cross(fwd, upR));
  const camUp = cross(right, fwd);
  return {
    pos, target, fwd, right, up: camUp, view, proj, fov, W, H,
    focalPx: H / 2 / Math.tan((fov * Math.PI) / 360),
    focus, coc: coc * H, cocMax: cocMax * H, minBlur: minBlur * Math.sqrt(H / 1608), near, nearFade,
  };
}

// Project a world point to pixel coords (origin top-left). Returns null if behind camera.
export function project(cam, p) {
  const v = cam.view, pr = cam.proj;
  const x = v[0] * p[0] + v[4] * p[1] + v[8] * p[2] + v[12];
  const y = v[1] * p[0] + v[5] * p[1] + v[9] * p[2] + v[13];
  const z = v[2] * p[0] + v[6] * p[1] + v[10] * p[2] + v[14];
  if (z > -cam.near) return null;
  const cx = (pr[0] * x) / -z, cy = (pr[5] * y) / -z;
  return [(cx * 0.5 + 0.5) * cam.W, (0.5 - cy * 0.5) * cam.H, -z];
}
