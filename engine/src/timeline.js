// Master timeline. Each sequence module returns shots: { id, start, end, mb, render(ctx, tl, t), hud?, post? }
export const FPS = 24;
export const SHUTTER = 0.5;   // 180°

export async function buildShots(ctx) {
  const q = new URLSearchParams(location.search);
  if (q.get('test')) return (await import('./shots/test.js')).default(ctx, q.get('test'));
  const mods = await Promise.all([import('./shots/cold.js'), import('./shots/read.js'), import('./shots/measure.js'), import('./shots/complete.js'), import('./shots/coda.js')]);
  const shots = [];
  for (const m of mods) shots.push(...(await m.default(ctx)));
  shots.sort((a, b) => a.start - b.start);
  return shots;
}
