import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--disable-gpu-sandbox'],
});
const page = await browser.newPage();
const info = await page.evaluate(() => {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2');
  if (!gl) return 'no webgl2';
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    floatRT: !!gl.getExtension('EXT_color_buffer_float'),
  };
});
console.log(JSON.stringify(info));
await browser.close();
