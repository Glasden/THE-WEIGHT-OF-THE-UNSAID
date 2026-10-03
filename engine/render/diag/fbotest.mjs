import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
const page = await browser.newPage();
page.on('console', (m) => console.log('[page]', m.text()));
console.log(await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 1920; c.height = 804;
  const gl = c.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  gl.getExtension('EXT_color_buffer_float');
  const out = {};
  const up = (name, w, h, internal, format, type, bytes, mips) => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, new Uint8Array(w * h * bytes));
    if (mips) gl.generateMipmap(gl.TEXTURE_2D);
    gl.finish();
    out[name] = gl.isContextLost() ? 'LOST' : 'ok ' + gl.getError();
  };
  up('r8_2048', 2048, 2048, gl.R8, gl.RED, gl.UNSIGNED_BYTE, 1, true);
  up('r8_8192x2048', 8192, 2048, gl.R8, gl.RED, gl.UNSIGNED_BYTE, 1, false);
  up('r8_8192x4096', 8192, 4096, gl.R8, gl.RED, gl.UNSIGNED_BYTE, 1, false);
  up('r8_8192x4096_mip', 8192, 4096, gl.R8, gl.RED, gl.UNSIGNED_BYTE, 1, true);
  return JSON.stringify(out);
}));
await browser.close();
