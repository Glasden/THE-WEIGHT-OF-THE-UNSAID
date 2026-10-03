// Minimal WebGL2 helpers: programs with cached uniforms, textures, FBOs, fullscreen pass.

export function createGL(canvas) {
  const gl = canvas.getContext('webgl2', {
    antialias: false, alpha: false, depth: false, stencil: false,
    premultipliedAlpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance',
  });
  if (!gl) throw new Error('WebGL2 unavailable');
  if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('EXT_color_buffer_float unavailable');
  gl.getExtension('OES_texture_float_linear');
  gl.getExtension('EXT_float_blend');
  return gl;
}

const HEADER = '#version 300 es\nprecision highp float;\nprecision highp int;\nprecision highp sampler2D;\n';

export class Program {
  constructor(gl, vs, fs, defines = {}) {
    this.gl = gl;
    const defs = Object.entries(defines).map(([k, v]) => `#define ${k} ${v}\n`).join('');
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, HEADER + defs + src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(s);
        const lines = (HEADER + defs + src).split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n');
        throw new Error(`shader compile error:\n${log}\n${lines}`);
      }
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link error: ' + gl.getProgramInfoLog(p));
    this.p = p;
    this.loc = {};
    this.types = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const name = info.name.replace(/\[0\]$/, '');
      this.loc[name] = gl.getUniformLocation(p, info.name);
      this.types[name] = info.type;
    }
    this.texUnit = 0;
  }
  use() { this.gl.useProgram(this.p); this.texUnit = 0; return this; }
  set(name, v) {
    const gl = this.gl, l = this.loc[name];
    if (l === undefined || l === null) return this;
    const t = this.types[name];
    switch (t) {
      case gl.FLOAT: Array.isArray(v) || ArrayBuffer.isView(v) ? gl.uniform1fv(l, v) : gl.uniform1f(l, v); break;
      case gl.FLOAT_VEC2: gl.uniform2fv(l, v); break;
      case gl.FLOAT_VEC3: gl.uniform3fv(l, v); break;
      case gl.FLOAT_VEC4: gl.uniform4fv(l, v); break;
      case gl.INT: case gl.BOOL: gl.uniform1i(l, v); break;
      case gl.FLOAT_MAT4: gl.uniformMatrix4fv(l, false, v); break;
      case gl.FLOAT_MAT3: gl.uniformMatrix3fv(l, false, v); break;
      default: throw new Error('unsupported uniform type for ' + name);
    }
    return this;
  }
  tex(name, texture) {
    const gl = this.gl, l = this.loc[name];
    if (l === undefined || l === null) return this;
    gl.activeTexture(gl.TEXTURE0 + this.texUnit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(l, this.texUnit++);
    return this;
  }
}

export function texture(gl, { w, h, internal, format, type, data = null, filter = gl.LINEAR, wrap = gl.CLAMP_TO_EDGE, mips = false }) {
  if (gl.getError()) console.log('stale gl error before texture()');
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  if (mips) gl.generateMipmap(gl.TEXTURE_2D);
  return t;
}

export class FBO {
  constructor(gl, w, h, { internal, format, type, filter } = {}) {
    this.gl = gl; this.w = w; this.h = h;
    internal = internal ?? gl.RGBA16F; format = format ?? gl.RGBA; type = type ?? gl.HALF_FLOAT;
    this.tex = texture(gl, { w, h, internal, format, type, filter: filter ?? gl.LINEAR });
    this.fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`FBO incomplete ${st} ${w}x${h} internal=${internal} format=${format} type=${type} glerr=${gl.getError()}`);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  bind(clear = false) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
    gl.viewport(0, 0, this.w, this.h);
    if (clear) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
    return this;
  }
}

export const FS_VERT = `
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

let _emptyVao = null;
export function fullscreen(gl) {
  if (!_emptyVao) _emptyVao = gl.createVertexArray();
  gl.bindVertexArray(_emptyVao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null);
}

export function loadImage(url) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
}
