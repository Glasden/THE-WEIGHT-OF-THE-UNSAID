// Headless frame renderer: serves the app, drives N Chrome workers (GPU) in parallel, each rendering a
// contiguous chunk of frames, piping raw pixels to its own ffmpeg; video chunks are spliced losslessly.
// usage: node render.mjs --out E:/opus_film/out/x.mp4 [--from 0 --to 240 | --frames 1,5,9] [--w 1920 --h 804]
//        [--workers 3] [--test gal] [--quality 1] [--sub 4] [--out10 1] [--codec h264|nvenc|hevc10|prores|png] [--crf 14 --cq 19]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const LOCAL = !!process.env.LOCAL;
const puppeteer = (await import(LOCAL ? 'puppeteer-core' : 'puppeteer')).default;
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : '1']);
  return acc;
}, []));
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');   // app/
const BOX_FFMPEG = 'E:/opus_film/tools/ffmpeg/bin/ffmpeg.exe';   // the original render box; anywhere else ffmpeg comes from PATH
const FFMPEG = process.env.FFMPEG || (!LOCAL && fs.existsSync(BOX_FFMPEG) ? BOX_FFMPEG : 'ffmpeg');
const W = +(args.w || 3840), H = +(args.h || 1608);
const out10 = args.out10 !== '0';
const out = args.out;
const codec = args.codec || (out.endsWith('.png') ? 'png' : out.endsWith('.mov') ? 'prores' : 'h264');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.ttf': 'font/ttf', '.otf': 'font/otf', '.wasm': 'application/wasm' };

// ---------------------------------------------------------------- per-worker sinks (ordered writes into ffmpeg)
const sinks = [];
function makeSink(k, file, startNumber) {
  const inFmt = out10 ? 'x2bgr10le' : 'rgba';
  const a = ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', inFmt, '-s', `${W}x${H}`, '-r', '24', '-i', '-', '-vf', 'vflip'];
  if (codec === 'png') a.push('-start_number', String(startNumber), '-pix_fmt', out10 ? 'rgb48be' : 'rgb24', file);
  else if (codec === 'nvenc') a.push('-c:v', 'h264_nvenc', '-preset', 'p6', '-rc', 'vbr', '-cq', String(args.cq || 19), '-b:v', '0', '-pix_fmt', 'yuv420p', file);
  else if (codec === 'hevc10') a.push('-c:v', 'hevc_nvenc', '-preset', 'p7', '-rc', 'vbr', '-cq', String(args.cq || 14), '-b:v', '0', '-profile:v', 'main10', '-pix_fmt', 'p010le', '-tag:v', 'hvc1', file);
  else if (codec === 'prores') a.push('-c:v', 'prores_ks', '-profile:v', '3', '-vendor', 'apl0', '-pix_fmt', 'yuv422p10le', file);
  else a.push('-c:v', 'libx264', '-preset', args.preset || 'slow', '-crf', String(args.crf || 14), '-pix_fmt', 'yuv420p', file);
  const ff = spawn(FFMPEG, a, { stdio: ['pipe', 'inherit', 'inherit'] });
  const s = { ff, file, next: 0, parked: new Map(), writing: Promise.resolve(), done: new Promise((r) => ff.on('close', r)) };
  s.pump = () => (s.writing = s.writing.then(async () => {
    while (s.parked.has(s.next)) {
      const buf = s.parked.get(s.next); s.parked.delete(s.next); s.next++;
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    }
  }));
  sinks[k] = s;
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'POST' && u.pathname === '/frame') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      if (buf.length !== W * H * 4) { res.writeHead(400); res.end('bad size ' + buf.length); return; }
      const s = sinks[+u.searchParams.get('w')];
      s.parked.set(+u.searchParams.get('i'), buf);
      s.pump().then(() => { res.writeHead(200); res.end('ok'); });
    });
    return;
  }
  const f = path.join(ROOT, decodeURIComponent(u.pathname));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const flags = LOCAL ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox']
  : ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
     '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
const qs = new URLSearchParams({ w: W, h: H, out10: out10 ? 1 : 0, quality: args.quality || 1, ...(args.sub ? { sub: args.sub } : {}),
  ...(args.test ? { test: args.test } : {}), ...(args.only ? { only: args.only } : {}), ...(args.dbg ? { dbg: args.dbg } : {}) });

async function openWorker(k) {
  const browser = await puppeteer.launch({ headless: true, protocolTimeout: 0, dumpio: !!args.dumpio,
    ...(LOCAL ? { executablePath: process.env.CHROME } : {}), args: flags });
  const page = await browser.newPage();
  page.on('console', (m) => { const t = m.text(); if (!t.includes('GPU stall') && !t.includes('performance warning') && !t.includes('Permissions policy')) console.log(`[w${k}]`, t); });
  page.on('pageerror', (e) => console.log(`[w${k} pageerror]`, e.message));
  await page.goto(`http://127.0.0.1:${port}/engine/index.html?${qs}`);
  await page.waitForFunction('window.filmReady || window.filmError', { timeout: 0, polling: 200 });
  const err = await page.evaluate('window.filmError');
  if (err) throw new Error(err);
  return { browser, page };
}

// ---------------------------------------------------------------- plan
const probe = await openWorker(0);
const info = await probe.page.evaluate('({frames: film.frames})');
const from = +(args.from || 0), to = Math.min(+(args.to || info.frames), info.frames);
const list = args.frames ? args.frames.split(',').map(Number) : Array.from({ length: to - from }, (_, i) => from + i);
const NW = Math.max(1, Math.min(+(args.workers || (list.length >= 96 ? 3 : 1)), Math.ceil(list.length / 24)));
const chunks = [];
for (let k = 0; k < NW; k++) chunks.push(list.slice(Math.floor((k * list.length) / NW), Math.floor(((k + 1) * list.length) / NW)));
console.log(`frames ${list.length} (${list[0]}..${list[list.length - 1]}) of ${info.frames}, ${W}x${H}, ${codec}, out10=${out10}, workers=${NW}`);
fs.mkdirSync(path.dirname(out), { recursive: true });
const isVideo = codec !== 'png';
let startIdx = 0;
chunks.forEach((c, k) => {
  const file = isVideo && NW > 1 ? out.replace(/(\.\w+)$/, `.part${k}$1`) : out;
  makeSink(k, file, args.frames ? startIdx : c[0]);
  startIdx += c.length;
});

const workers = [probe];
for (let k = 1; k < NW; k++) workers.push(await openWorker(k));
const T0 = Date.now();
await Promise.all(workers.map(({ page }, k) =>
  page.evaluate((lst, base) => film.renderList(lst, base), chunks[k], `http://127.0.0.1:${port}/frame?w=${k}`)));
for (const s of sinks) { await s.pump(); s.ff.stdin.end(); await s.done; }
for (const { browser } of workers) await browser.close();
server.close();
if (isVideo && NW > 1) {
  const listFile = out + '.parts.txt';
  fs.writeFileSync(listFile, sinks.map((s) => `file '${s.file.replace(/\\/g, '/')}'`).join('\n'));
  await new Promise((r) => spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy',
    ...(out.endsWith('.mp4') ? ['-movflags', '+faststart'] : []), out], { stdio: 'inherit' }).on('close', r));
  for (const s of sinks) fs.unlinkSync(s.file);
  fs.unlinkSync(listFile);
}
console.log(`done ${out}  ${((Date.now() - T0) / 1000).toFixed(0)}s  ${((Date.now() - T0) / 1000 / list.length).toFixed(2)}s/frame`);

// ---------------------------------------------------------------- mux picture + sound right here on the render box
const run = (a) => new Promise((r) => spawn(FFMPEG, a, { stdio: 'inherit' }).on('close', r));
if (isVideo && args.audio) {
  // the score may still be synthesizing on this machine: wait until the file exists and stops growing
  let last = -1;
  for (;;) {
    const sz = fs.existsSync(args.audio) ? fs.statSync(args.audio).size : -1;
    if (sz > 0 && sz === last) break;
    last = sz;
    await new Promise((r) => setTimeout(r, 5000));
  }
  const off = (args.frames ? 0 : list[0]) / 24;
  const final = args.final || out.replace(/(\.\w+)$/, '_av$1');
  const pcm = final.endsWith('.mov');
  await run(['-y', '-loglevel', 'error', '-i', out, '-ss', off.toFixed(4), '-i', args.audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
    ...(pcm ? ['-c:a', 'pcm_s24le'] : ['-c:a', 'aac', '-b:a', '320k']), '-shortest', ...(final.endsWith('.mp4') ? ['-movflags', '+faststart'] : []), final]);
  console.log('muxed', final);
  if (args.proxy) {
    await run(['-y', '-loglevel', 'error', '-i', final, '-vf', 'scale=1920:-2:flags=lanczos', '-c:v', 'h264_nvenc', '-preset', 'p6', '-rc', 'vbr', '-cq', '19', '-b:v', '0',
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', args.proxy]);
    console.log('proxy', args.proxy);
  }
}
