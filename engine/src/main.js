import { createGL } from './gl.js';
import { Atlas } from './glyphs.js';
import { Post } from './post.js';
import { makeCamera } from './camera.js';
import { Galaxy } from './galaxy.js';
import { buildShots, FPS, SHUTTER } from './timeline.js';
import { drawCards } from './cards.js';

const q = new URLSearchParams(location.search);
const W = +(q.get('w') || 3840), H = +(q.get('h') || 1608);
const OUT10 = q.get('out10') !== '0';
const QUALITY = +(q.get('quality') || 1);
const SUB = q.get('sub') ? +q.get('sub') : 0;

async function loadFonts() {
  const specs = ['400 40px SerifSC', '600 40px SerifSC', '300 40px SansSC', '400 40px SansSC', '400 40px Cormorant',
    'italic 400 40px Cormorant', '500 40px Cormorant', '400 40px JBMono'];
  await Promise.all(specs.map((s) => document.fonts.load(s, '未言之重 Aa 0')));
}

async function init() {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const gl = createGL(canvas);
  canvas.addEventListener('webglcontextlost', (e) => console.log('CONTEXT LOST EVENT', e.statusMessage || ''));
  console.log('gl created lost=', gl.isContextLost(), gl.getParameter(gl.VERSION));
  const [atlas, atlasHi, corpus] = await Promise.all([
    Atlas.load(gl, '/assets/build/atlas'), Atlas.load(gl, '/assets/build/atlas_hi'),
    fetch('/assets/build/corpus.json').then((r) => r.json()), q.get('nofonts') ? 0 : loadFonts(),
  ]);
  const post = new Post(gl, W, H, { out10: OUT10 });
  const galaxy = new Galaxy(gl, atlas, corpus, { quality: QUALITY });
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const hudCanvas = mk(), cardCanvas = mk();
  const ctx = {
    gl, W, H, post, atlas, atlasHi, corpus, galaxy, FPS, poses: {},
    cam(o) { this.lastCam = makeCamera(o, W, H); return this.lastCam; },
    scene() { post.scene.bind(true); },
    fg() { post.fg.bind(true); },
  };
  const shots = await buildShots(ctx);
  const duration = shots[shots.length - 1].end;

  async function renderFrame(f) {
    const t = f / FPS;
    const shot = shots.find((s) => t >= s.start && t < s.end) || shots[shots.length - 1];
    // motion-blur sub-frames scale with resolution so strobing stays sub-pixel (preview 804p = 1x)
    // final masters always integrate several sub-frames: temporal supersampling also tames sub-pixel shimmer
    const K = SUB || Math.min(32, Math.max(H >= 1600 ? 6 : 1, Math.ceil((shot.mb || 1) * Math.max(1, H / 804) * (shot.mb > 1 ? 1.5 : 1))));
    const tl = t - shot.start;
    post.beginAccum();
    for (let k = 0; k < K; k++) {
      let tk = t + (K > 1 ? ((k + 0.5) / K - 0.5) * SHUTTER / FPS : 0);
      tk = Math.min(Math.max(tk, shot.start), shot.end - 1e-4);
      const r = shot.render(ctx, tk - shot.start, tk) || {};
      post.accumulate(1 / K, r.lenses || [], r.coreDark || 0, !!r.useFg, r.ringGain ?? 0.35);
    }
    if (shot.hud) {
      const g = hudCanvas.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, W, H);
      const gain = shot.hud(ctx, tl, t, g);
      if (gain) post.addHud(hudCanvas, gain);
    }
    const cg = cardCanvas.getContext('2d');
    cg.setTransform(1, 0, 0, 1, 0, 0);
    cg.clearRect(0, 0, W, H);
    let cardsOn = drawCards(cg, t, W, H, shot);
    if (shot.cards) cardsOn = shot.cards(cg, tl, t) || cardsOn;
    post.finish({ ...(shot.post ? shot.post(tl, t) : {}), frame: f }, cardsOn ? cardCanvas : null);
  }

  const inflight = [];
  window.film = {
    W, H, FPS, duration, frames: Math.round(duration * FPS), out10: OUT10,
    shots: shots.map((s) => ({ id: s.id, start: s.start, end: s.end })),
    // Pipelined: the next frame renders while the previous one is still uploading.
    async renderAndSend(f, url) {
      const t0 = performance.now();
      await renderFrame(f);
      const copy = post.read().slice();
      const t1 = performance.now();
      inflight.push(fetch(url, { method: 'POST', body: copy }));
      while (inflight.length > 2) await inflight.shift();
      return { render: t1 - t0, send: performance.now() - t1 };
    },
    async flush() { while (inflight.length) await inflight.shift(); },
    // The whole frame loop runs in-page: one CDP call for the entire range.
    async renderList(list, base) {
      const T0 = performance.now();
      let rs = 0;
      const send = async (px, i) => {
        inflight.push(fetch(`${base}&i=${i}`, { method: 'POST', body: px }));
        while (inflight.length > 2) await inflight.shift();
      };
      for (let i = 0; i < list.length; i++) {
        const t0 = performance.now();
        await renderFrame(list[i]);
        post.readStart(i % 2);
        rs += performance.now() - t0;
        if (i > 0) await send(await post.readFinish((i - 1) % 2), i - 1);
        if (i === list.length - 1) await send(await post.readFinish(i % 2), i);
        if (i % 24 === 23 || i === list.length - 1) {
          const el = (performance.now() - T0) / 1000;
          console.log(`frame ${list[i]}  ${i + 1}/${list.length}  avg render ${(rs / (i + 1)).toFixed(0)}ms  ${(el / (i + 1)).toFixed(2)}s/frame  elapsed ${el.toFixed(0)}s  eta ${((el / (i + 1)) * (list.length - i - 1)).toFixed(0)}s`);
        }
      }
      while (inflight.length) await inflight.shift();
    },
  };
  window.filmReady = true;
}

init().catch((e) => { console.error('INIT FAILED', e.stack || e); window.filmError = String(e.stack || e); });
