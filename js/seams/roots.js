// 09 Roots
//
// The tree in the hero's photograph settles into the page: as the seam
// comes up the screen, roots grow down out of the hero's edge into the
// white page, in the colours of the bark and earth they leave, thick where
// they leave it and tapering to hairlines, wandering, turning back down,
// and branching as they go, some setting off later than others. Nearing
// the words below, they sense them and each turns towards the nearest
// letter, the way roots find water, slowing down and fanning out, until
// its tip touches it. And they drink: a touched letter's ink is drawn off
// from the top down, leaving it pale, and climbs the root as a dark bead,
// up to the tree. Fine hairs sprout along their tips, and last, faint
// threads bridge each root system to the next, like the fungal network
// that joins trees underground. They grow only while the page scrolls, for
// as long as any of them is on the screen; scroll back and the ink runs
// back down into the letters and the roots draw back up into the hero,
// until the edge is bare again.
//
// They reach the first line of words below but never cross into it: they
// stop at the tops of its capitals.

export const letters = true; // index.js splits the introduction into letters for the roots to touch

const STEP = 2; // px between the points of a root
const TOP = 2; // px the box reaches up into the hero, so the roots start inside it and no sliver of page shows above them
const LAG = 24; // how far behind a root's tip, in its growth, its hairs sprout
const NETWORK = 0.3; // the share of the growth, at its end, the threads between root systems take
const DRAIN = 1.2; // s a touched letter takes to be drunk
const CLIMB = 0.2; // the share of the growth the ink takes to climb from a letter to the tree

export default function roots(seam) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  seam.el.append(canvas);
  const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();

  // Every piece of every root, hair and thread: where it starts and ends,
  // how thick, when in the growth it appears, and whose colour it takes.
  let segments = [];
  let colours = []; // each root system's colour and its hairs', then each thread's
  let glyphs = []; // the letters the roots reach for (see measure())
  let sips = []; // each tip that touches a letter: the letter, when, and its way up to the tree
  let drinks = new Map(); // each touched letter: when it's first touched, and its drain
  let longest = 1;
  let built = '';
  let width = 0;
  let depth = 0; // px the box reaches below the edge: down to the lowest letter's capitals
  let dpr = 1;

  // The letters the roots reach for: each on the first line of the
  // introduction's label and of its text (split by index.js), where it is
  // along the page (left, right, centre) and where its capital's top is
  // (top), in the canvas; and, for drinking, how far down its box its
  // capital starts (cap) and how tall it is (height). Measured from where
  // the page lays the lines out rather than where they are now: the
  // introduction's lines wait below their masks until they're revealed.
  const measure = () => {
    const laid = (el) => (el ? el.offsetTop + laid(el.offsetParent) : 0);
    const left = seam.el.getBoundingClientRect().left;
    const top = laid(seam.el);
    const range = document.createRange();
    const found = [];
    seam.next.querySelectorAll('.next__label, .next__text').forEach((el) => {
      const { fontWeight, fontSize, fontFamily } = getComputedStyle(el);
      ctx.font = `${fontWeight} ${fontSize} ${fontFamily}`;
      const h = ctx.measureText('H');
      let first = null;
      for (const char of el.querySelectorAll('.next__char')) {
        const box = char.getBoundingClientRect();
        first ??= box;
        if (Math.abs(box.top - first.top) > first.height / 2) break;
        const parent = char.parentElement;
        range.selectNodeContents(char);
        const text = range.getBoundingClientRect();
        const cap = text.top - box.top + h.fontBoundingBoxAscent - h.actualBoundingBoxAscent;
        found.push({
          el: char,
          left: box.left - left,
          right: box.right - left,
          centre: (box.left + box.right) / 2 - left,
          top: laid(parent) + box.top - parent.getBoundingClientRect().top + cap - top,
          cap,
          height: h.actualBoundingBoxAscent,
        });
      }
    });
    return found;
  };

  // The letter nearest to x, along the page (by its centre).
  const nearest = (x) => {
    let best = null;
    for (const glyph of glyphs) {
      if (!best || Math.abs(glyph.centre - x) < Math.abs(best.centre - x)) best = glyph;
    }
    return best;
  };

  // How far down anything may go at x: to the highest letter near it (or,
  // away from all of them, the highest of them all).
  const floor = (x) => {
    if (!glyphs.length) return TOP + depth - 6;
    const close = glyphs.filter((glyph) => x > glyph.left - 40 && x < glyph.right + 40);
    return Math.min(...(close.length ? close : glyphs).map((glyph) => glyph.top));
  };

  // One root: it heads downwards, wandering, pulled back down whenever it
  // strays and never turning back up, branching now and then into thinner
  // roots of its own, until it has grown its length or reached the words.
  // From halfway down it senses them and is drawn towards the nearest
  // letter, the more the nearer it gets, and it grows slower and branches
  // more, so the roots fan out above them; landing on a letter, its tip
  // touches it and drinks (sips), remembering its way back up to the tree
  // (trail). Hairs (in the root's colour, paler: `root + 1`) sprout along
  // its thin end, a little after its tip has passed, angled forwards.
  const grow = (root, x, y, angle, thickness, length, start, trail) => {
    let turn = 0;
    let time = start; // when in the growth this point appears
    let hair = 0; // px to the next hair
    for (let s = 0; s < length; s += STEP) {
      const glyph = nearest(x);
      // 0 down to halfway, 1 at the bottom
      const near = gsap.utils.clamp(0, 1, (y / (TOP + depth) - 0.5) * 2);
      const toward = glyph ? Math.atan2(glyph.top - y, glyph.centre - x) : Math.PI / 2;
      const aim = Math.PI / 2 + (toward - Math.PI / 2) * near;
      turn += gsap.utils.random(-0.06, 0.06);
      turn *= 0.9;
      angle = gsap.utils.clamp(
        Math.PI / 2 - 1.1,
        Math.PI / 2 + 1.1,
        angle + turn + (aim - angle) * 0.05,
      );
      const nx = x + Math.cos(angle) * STEP;
      const ny = y + Math.sin(angle) * STEP;
      const w = thickness * (1 - s / length) + 0.5;
      if (ny > floor(nx)) {
        const under = glyphs.find((each) => nx >= each.left && nx <= each.right);
        if (under) {
          segments.push({ x, y, nx, ny: under.top, w, at: time, root });
          trail.push([nx, under.top]);
          sips.push({ glyph: under, at: time, trail });
        }
        return;
      }
      if (nx < -20 || nx > width + 20) return;
      segments.push({ x, y, nx, ny, w, at: time, root });
      trail.push([nx, ny]);
      if (w > 1 - 0.35 * near && Math.random() < 0.025 + 0.02 * near) {
        const side = gsap.utils.random([-1, 1]);
        grow(
          root,
          nx,
          ny,
          angle + side * gsap.utils.random(0.4, 1.1 + 0.4 * near),
          w * 0.6,
          (length - s) * gsap.utils.random(0.3, 0.7),
          time,
          trail.slice(),
        );
      }
      hair -= STEP;
      if (w < 1.2 && hair <= 0) {
        hair = gsap.utils.random(2, 5);
        const out = angle + gsap.utils.random([-1, 1]) * gsap.utils.random(0.5, 1);
        const size = gsap.utils.random(1.5, 3.5);
        const hx = nx + Math.cos(out) * size;
        segments.push({
          x: nx,
          y: ny,
          nx: hx,
          ny: Math.min(ny + Math.sin(out) * size, floor(hx)),
          w: 0.3,
          at: time + LAG,
          root: root + 1,
        });
      }
      time += STEP * (1 + 2 * near);
      x = nx;
      y = ny;
    }
  };

  // Where two root systems come closest: up to two pairs of points, one on
  // each system's lower half (from a sample of each), at least 20px apart.
  const closest = (a, b) => {
    const sample = (root) =>
      gsap.utils
        .shuffle(
          segments.filter(
            (segment) =>
              segment.root === root && segment.ny > depth * 0.4 && segment.ny < depth * 0.9,
          ),
        )
        .slice(0, 80);
    const left = sample(a);
    const right = sample(b);
    const pairs = [];
    for (const from of left) {
      for (const to of right) {
        pairs.push({ from, to, span: Math.hypot(to.nx - from.nx, to.ny - from.ny) });
      }
    }
    pairs.sort((p, q) => p.span - q.span);
    const chosen = [];
    for (const pair of pairs) {
      if (chosen.length === 2) break;
      const apart = (c) => Math.hypot(c.from.nx - pair.from.nx, c.from.ny - pair.from.ny) > 20;
      if (chosen.every(apart)) chosen.push(pair);
    }
    return chosen;
  };

  // Each touched letter, drunk from the top down over DRAIN seconds once
  // the first root touches it, and filled again when the roots draw back:
  // a paused tween of how far down its ink has gone, played or reversed as
  // the seam passes the touch (like Crumble's squares). After that, it
  // keeps being drunk as the roots grow on: paler and paler (--dry) until
  // they've scrolled off, darker again as they draw back.
  const pour = () => {
    drinks.forEach(({ tween, glyph }) => {
      tween.kill();
      glyph.el.classList.remove('next__char--drunk');
      glyph.el.style.removeProperty('--level');
      glyph.el.style.removeProperty('--dry');
    });
    drinks = new Map();
    sips.forEach(({ glyph, at }) => {
      if (drinks.has(glyph) && drinks.get(glyph).at <= at) return;
      drinks.get(glyph)?.tween.kill();
      const state = { level: 0 };
      const tween = gsap.to(state, {
        level: 1,
        duration: DRAIN,
        ease: 'power1.inOut',
        paused: true,
        onUpdate: () => {
          glyph.el.classList.toggle('next__char--drunk', state.level > 0);
          glyph.el.style.setProperty('--level', `${glyph.cap + state.level * glyph.height}px`);
        },
      });
      drinks.set(glyph, { glyph, at, tween, drunk: false });
    });
  };

  // Set up again when the width or the room changes (not when a phone's
  // address bar shows and hides, so that doesn't regrow them), and when
  // the introduction is split again.
  const build = (again = false) => {
    const room = Math.round(seam.room.down());
    const key = [seam.el.clientWidth, room].join();
    if (key === built && !again) return;
    built = key;
    width = seam.el.clientWidth;
    seam.el.style.setProperty('--above', `${TOP}px`);
    glyphs = measure();
    depth = glyphs.length ? Math.max(...glyphs.map((glyph) => glyph.top)) - TOP : room;
    seam.el.style.setProperty('--below', `${depth}px`);
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round((TOP + depth) * dpr);

    // A root every 50 to 120px along the edge, some setting off later;
    // finer on a small screen. Each takes the colour of the photograph's
    // bottom where it leaves it (seam.photo), a little deeper, so it reads
    // on the white page.
    segments = [];
    colours = [];
    sips = [];
    const systems = []; // each root system: its colour index and its colour in the photograph
    const scale = gsap.utils.clamp(0.6, 1, width / 1200);
    const hero = seam.hero.offsetHeight;
    const cols = Math.ceil(width / 8);
    const colour = seam.photo.colours(hero - 16, 16, cols, 1);
    for (let x = gsap.utils.random(0, 60); x < width; x += gsap.utils.random(50, 120)) {
      const [r, g, b] = colour(Math.min(cols - 1, Math.floor(x / 8)), 0);
      const root = colours.length;
      systems.push({ root, tone: [r, g, b] });
      colours.push(`rgb(${r * 0.75}, ${g * 0.75}, ${b * 0.75})`, `rgba(${r}, ${g}, ${b}, 0.4)`);
      const delay = gsap.utils.random(0, depth * 0.8);
      grow(
        root,
        x,
        0,
        Math.PI / 2 + gsap.utils.random(-0.4, 0.4),
        gsap.utils.random(2, 4.2) * scale,
        depth * gsap.utils.random(0.8, 1.4),
        delay,
        [[x, 0]],
      );
    }

    // The network, last: where each root system comes closest to the next,
    // a thread or two bridges them, wavering, in their two colours mixed and
    // pale, each spun from one end to the other over the growth's last share
    // (NETWORK), starting as the roots finish, while they're all still on
    // the screen. Systems that never come close stay apart.
    const roots = segments.reduce((most, { at }) => Math.max(most, at), 0);
    longest = roots / (1 - NETWORK);
    for (let i = 0; i < systems.length - 1; i++) {
      const [r, g, b] = systems[i].tone.map((c, j) => (c + systems[i + 1].tone[j]) / 2);
      for (const { from, to, span } of closest(systems[i].root, systems[i + 1].root)) {
        if (span > 140) continue;
        colours.push(`rgba(${r}, ${g}, ${b}, 0.6)`);
        const thread = colours.length - 1;
        const begins = roots * gsap.utils.random(0.9, 1);
        const sag = gsap.utils.random(2, 8);
        const phase = gsap.utils.random(0, 10);
        const pieces = Math.max(2, Math.ceil(span / 2));
        let x = from.nx;
        let y = from.ny;
        for (let k = 1; k <= pieces; k++) {
          const u = k / pieces;
          const nx = from.nx + (to.nx - from.nx) * u;
          const wave =
            Math.sin(u * Math.PI) * sag +
            (Math.sin(u * 9 + phase) + 0.5 * Math.sin(u * 23 + phase * 2)) * 1.5;
          const ny = Math.min(from.ny + (to.ny - from.ny) * u + wave, floor(nx) - 1);
          const at = begins + (longest - begins) * u;
          segments.push({ x, y, nx, ny, w: 0.3, at, root: thread });
          x = nx;
          y = ny;
        }
      }
    }

    // Drawn root system by root system (then thread by thread), thickest
    // first, in a few weights, so a whole weight of one root is one path.
    segments.sort((a, b) => a.root - b.root || b.w - a.w);
    pour();
    draw(true);
  };

  // As far along as the roots have grown: nothing with the seam at the
  // bottom of the screen, all of it as the last of them scrolls off the
  // top, so they keep reaching for as long as any of them is in view. The
  // letters touched so far are drunk (straight away when the roots are
  // being laid out), and the ink each tip has drunk climbs its root as a
  // bead, as far as the growth since the touch has taken it.
  const draw = (instantly = false) => {
    const grown = gsap.utils.clamp(0, 1, seam.travel / (innerHeight + TOP + depth)) * longest;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    let weight = -1;
    let current = -1;
    for (const { x, y, nx, ny, w, at, root } of segments) {
      if (at > grown) continue;
      const rounded = Math.round(w * 2) / 2;
      if (rounded !== weight || root !== current) {
        if (weight > 0) ctx.stroke();
        weight = rounded;
        current = root;
        ctx.lineWidth = weight;
        ctx.strokeStyle = colours[root];
        ctx.beginPath();
      }
      ctx.moveTo(x, y);
      ctx.lineTo(nx, ny);
    }
    if (weight > 0) ctx.stroke();

    drinks.forEach((drink) => {
      const dry =
        Math.round(gsap.utils.clamp(0, 1, (grown - drink.at) / (longest - drink.at)) * 100) / 100;
      if (dry !== drink.dry) {
        drink.dry = dry;
        drink.glyph.el.style.setProperty('--dry', dry);
      }
      const drunk = grown >= drink.at;
      if (drunk === drink.drunk) return;
      drink.drunk = drunk;
      if (instantly) drink.tween.progress(drunk ? 1 : 0);
      else if (drunk) drink.tween.play();
      else drink.tween.reverse();
    });

    // The bead: a drop swelling the root, round at its head and tapering
    // behind it, so it reads even on the darkest roots.
    ctx.strokeStyle = ink;
    for (const { at, trail } of sips) {
      const climbed = (grown - at) / (CLIMB * longest);
      if (climbed <= 0 || climbed >= 1) continue;
      const head = Math.round((1 - climbed) * (trail.length - 1));
      const tail = Math.min(trail.length - 1, head + 7);
      for (let i = head; i < tail; i++) {
        ctx.lineWidth = 3.4 - (2.4 * (i - head)) / (tail - head);
        ctx.beginPath();
        ctx.moveTo(...trail[i]);
        ctx.lineTo(...trail[i + 1]);
        ctx.stroke();
      }
    }
  };

  build();
  addEventListener('resize', () => build());
  seam.onSplit(() => build(true));
  seam.onChange(() => draw());
}
