// 10 Sediment
//
// The photograph wears away into sand and settles on the page in layers.
// As the seam comes up the screen, the photograph's bottom wears through at
// a few points along the edge, each in its own time, and wears away from
// each in a ragged arch, grain by grain, the page showing through, until
// the edge is left scalloped. The sand pours out of them in uneven streams
// down across the white page onto
// mounds resting above the page's first text, each grain sliding down the
// slope until it settles, so the mounds build in layers of the
// photograph's own colours, a little lighter or darker each: its bottom
// row lowest, then the rows above. Grains only come loose while the page
// scrolls; those in the air finish their fall when it stops. Scroll back
// and the sand flies back up into the photograph, the last grain first,
// until it's whole again.
//
// It stays in the empty space around the seam: it wears no higher than
// just below the hero's last line of text, and the pile rests just above
// the white page's first.

gsap.registerPlugin(Physics2DPlugin);

const GRAIN = 4; // a grain's size, px
const ROWS = 16; // rows of grains the photograph may wear away
const GRAVITY = 900; // px/s²

export default function sediment(seam) {
  const paper = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  seam.el.append(canvas);

  let grains = [];
  let edge = 0; // where the hero ends, px from the canvas's top
  let floor = 0; // where the pile rests
  let dpr = 1;
  let dirty = true;
  let built = '';

  // The photograph's colours along its bottom, as the page draws it, one
  // per grain (seam.photo), each row a little lighter or darker than the
  // next, as sediment is, so the layers show in the pile even where the
  // photograph is even.
  const colours = (width) => {
    const h = seam.hero.offsetHeight;
    const colour = seam.photo.colours(h - ROWS * GRAIN, ROWS * GRAIN, Math.ceil(width / GRAIN), ROWS);
    return (col, row) => {
      const tone = row % 2 ? 1.08 : 0.9;
      const [r, g, b] = colour(col, ROWS - 1 - row);
      return `rgb(${r * tone}, ${g * tone}, ${b * tone})`;
    };
  };

  const build = () => {
    const width = seam.el.clientWidth;
    const below = Math.round(seam.room.down());
    const key = [width, below].join();
    if (key === built) return;
    built = key;

    grains.forEach((grain) => grain.tl?.kill());
    edge = ROWS * GRAIN;
    floor = edge + below;
    seam.el.style.setProperty('--above', `${edge}px`);
    seam.el.style.setProperty('--below', `${below}px`);
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round((edge + below) * dpr);

    // The grains, row 0 along the edge, and the order they come loose in:
    // the photograph wears through first at a few points along the edge,
    // each opening at its own time, and wears away from each in an arch,
    // wider than tall, growing at its own pace up to its own size, its rim
    // ragged; grains outside every arch stay, so the edge ends scalloped.
    // Each grain is drawn a little off its place and a little smaller or
    // larger once it's loose, so the falling sand and the mounds look like
    // sand, not a grid.
    const colour = colours(width);
    const cols = Math.ceil(width / GRAIN);
    const leaks = [];
    for (let col = gsap.utils.random(4, 40); col < cols; col += gsap.utils.random(22, 55)) {
      leaks.push({ col, opens: gsap.utils.random(0, 10), pace: gsap.utils.random(0.7, 1.4), reach: gsap.utils.random(9, 25) });
    }
    grains = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < cols; col++) {
        const rim = gsap.utils.random(0.8, 1.1); // how far out this grain still wears away
        let order = Infinity;
        leaks.forEach((leak) => {
          const far = Math.hypot(col - leak.col, row * 1.6); // in grains, arches wider than tall
          if (far < leak.reach * rim) order = Math.min(order, leak.opens + far * leak.pace);
        });
        grains.push({
          col,
          row,
          colour: colour(col, row),
          order: order + gsap.utils.random(0, 3),
          size: GRAIN * gsap.utils.random(0.7, 1.15),
          jx: gsap.utils.random(-1, 1),
          jy: gsap.utils.random(-1, 1),
          x: 0,
          y: 0,
        });
      }
    }
    grains.sort((a, b) => a.order - b.order);
    const falling = grains.filter((grain) => grain.order < Infinity);

    // Where each grain ends up: it falls, drifting a little, onto the pile
    // under where it lands, then slides down whichever side is lower until
    // it's no more than a grain or two above its neighbours (which, at
    // random), so the slopes come out uneven. Worked out in order, so the
    // first to fall lie lowest.
    const height = new Array(cols).fill(0);
    // They come loose evenly over the scroll, until the box's bottom nears
    // the top of the screen, so the sand keeps pouring for as long as any of
    // it is in view.
    falling.forEach((grain, i) => {
      grain.at = (innerHeight + below) * (0.04 + (0.86 * i) / (falling.length - 1));
      grain.left = grain.col * GRAIN;
      grain.top = edge - (grain.row + 1) * GRAIN;

      const drift = gsap.utils.random(-6, 6); // px/s sideways
      const kick = gsap.utils.random(0, 8); // px/s upwards as it comes loose
      const time = (drop) => (kick + Math.sqrt(kick * kick + 2 * GRAVITY * drop)) / GRAVITY;
      const landing = (c) => floor - (height[c] + 1) * GRAIN - grain.top; // on top of column c
      // Where it lands: worked out for the column under it, then again for
      // the column its drift takes it to.
      let fell = gsap.utils.clamp(0, cols - 1, Math.round((grain.left + drift * time(landing(grain.col))) / GRAIN));
      const duration = time(landing(fell));
      fell = gsap.utils.clamp(0, cols - 1, Math.round((grain.left + drift * duration) / GRAIN));
      const land = { x: fell * GRAIN - grain.left, y: landing(fell) };
      let col = fell;
      for (;;) {
        const steep = Math.random() < 0.35 ? 2 : 1;
        const down = [col - 1, col + 1].filter((c) => c >= 0 && c < cols && height[c] < height[col] - steep);
        if (!down.length) break;
        col = gsap.utils.random(down);
      }
      const rest = { x: col * GRAIN - grain.left, y: landing(col) };
      height[col]++;

      grain.tl = gsap
        .timeline({ paused: true, onUpdate: () => (dirty = true) })
        .to(grain, {
          physics2D: { velocity: Math.hypot(drift, kick), angle: (Math.atan2(-kick, drift) * 180) / Math.PI, gravity: GRAVITY },
          duration,
          ease: 'none',
        })
        .set(grain, land)
        .to(grain, { ...rest, duration: 0.05 * Math.abs(col - fell), ease: 'power1.in' });
      grain.out = false;
    });

    update(false);
  };

  // Loosen the grains the seam has passed, and put back the ones it has
  // gone back over: played as it happens, or straight to where they belong
  // when the grains are being laid out.
  const update = (animate = true) => {
    grains.forEach((grain) => {
      if (!grain.tl) return;
      const out = seam.travel > grain.at;
      if (out === grain.out) return;
      grain.out = out;
      if (!animate) grain.tl.progress(out ? 1 : 0);
      else if (out) grain.tl.timeScale(1).play();
      else grain.tl.timeScale(2).reverse();
    });
    dirty = true;
  };

  // Only the difference from the page: white where grains have left the
  // photograph (reaching 2px past the edge, so no sliver of it shows under
  // the holes), and the grains wherever they are.
  const draw = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = paper;
    grains.forEach(({ tl, left, top, row }) => {
      if (tl?.time()) ctx.fillRect(left, top, GRAIN, row ? GRAIN : GRAIN + 2);
    });
    grains.forEach(({ tl, left, top, x, y, colour, size, jx, jy }) => {
      if (!tl?.time()) return;
      ctx.fillStyle = colour;
      ctx.fillRect(left + x + jx + (GRAIN - size) / 2, top + y + jy + (GRAIN - size) / 2, size, size);
    });
  };

  build();
  addEventListener('resize', build);
  seam.onChange(() => update());
  gsap.ticker.add(() => {
    if (!dirty) return;
    dirty = false;
    draw();
  });
}
