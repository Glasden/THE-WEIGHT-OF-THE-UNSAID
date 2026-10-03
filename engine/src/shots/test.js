// Look-dev stills. ?test=<name> ; each test is a 1-second shot.
export default function (ctx, name) {
  const g = ctx.galaxy;
  const tests = {
    gal: (tl) => {
      const cam = ctx.cam({ pos: [0, 1050, 1500], target: [0, -40, 0], fov: 38, focus: 1800, coc: 0.0 });
      ctx.scene(); g.draw(cam, { T: 0 });
    },
    edge: (tl) => {
      const cam = ctx.cam({ pos: [0, 140, 2100], target: [0, 0, 0], fov: 34, focus: 2100, coc: 0.0 });
      ctx.scene(); g.draw(cam, { T: 0 });
    },
    fly: (tl) => {
      const L = g.lines.find((l) => l.era === 3 && l.r > 800 && l.r < 820 && Math.abs(l.y) < 3);
      const a = L.phase;
      const p = [Math.cos(a) * (L.r + 6), L.y + 1.5, Math.sin(a) * (L.r + 6)];
      const tgt = [Math.cos(a + 0.012) * L.r, L.y, Math.sin(a + 0.012) * L.r];
      const cam = ctx.cam({ pos: p, target: tgt, fov: 40, focus: 7, coc: 0.012, nearFade: [0.3, 1.0] });
      ctx.scene(); g.draw(cam, { T: 0 });
    },
    core: (tl) => {
      const cam = ctx.cam({ pos: [60, 25, 160], target: [0, 0, 0], fov: 45, focus: 120, coc: 0.006, nearFade: [1, 4] });
      ctx.scene(); g.draw(cam, { T: 0 });
    },
  };
  return [{ id: 'TEST-' + name, start: 0, end: 1, render: (c, tl) => tests[name](tl), post: () => ({ bloom: 0.06, streak: 0.12, sat: 1.15, exposure: 0.9 }) }];
}
