// Master timeline. Each sequence module returns shots: { id, start, end, mb, render(ctx, tl, t), hud?, post?, cards?, cardY? }
// v4: open (S01–S08) · history (S09–S15) · paste (S16–S20) · send (S21–S25). Times come from events.json.
export const FPS = 24;
export const SHUTTER = 0.5;   // 180°

const MODULES = ['open', 'history', 'paste', 'send'];

export async function buildShots(ctx) {
  const q = new URLSearchParams(location.search);
  if (q.get('test')) return (await import('./shots/test.js')).default(ctx, q.get('test'));
  const only = q.get('only') ? q.get('only').split(',') : MODULES;
  const shots = [];
  for (const name of MODULES) {
    if (!only.includes(name)) continue;
    const m = await import(`./shots/${name}.js`);
    shots.push(...(await m.default(ctx)));
  }
  shots.sort((a, b) => a.start - b.start);
  return shots;
}
