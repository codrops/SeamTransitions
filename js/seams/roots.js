// 09 Roots
//
// The tree in the hero's photograph settles into the page: as the seam
// comes up the screen, roots grow down out of the hero's edge into the
// white page, in the colours of the bark and earth they leave, thick where
// they leave it and tapering to hairlines, wandering, turning back down,
// and branching as they go, some setting off later than others. They
// grow only while the page scrolls, until the edge reaches the top of the
// screen; scroll back and they draw back up into the hero until the edge
// is bare again.
//
// They stay in the empty space under the seam: none reaches lower than
// just above the white page's first text.

const STEP = 3; // px between the points of a root
const TOP = 2; // px the box reaches up into the hero, so the roots start inside it and no sliver of page shows above them

export default function roots(seam) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  seam.el.append(canvas);

  let segments = []; // every piece of every root: where it starts and ends, how thick, how far along its root system it is, and which root system
  let colours = []; // each root system's colour
  let longest = 1;
  let width = 0;
  let depth = 0;
  let dpr = 1;

  // One root: it heads downwards, wandering, pulled back down whenever it
  // strays and never turning back up, branching now and then into thinner
  // roots of its own, until it has grown its length or reached the bottom
  // of the room.
  const grow = (root, x, y, angle, thickness, length, start) => {
    let turn = 0;
    for (let s = 0; s < length; s += STEP) {
      turn += gsap.utils.random(-0.06, 0.06);
      turn *= 0.9;
      angle = gsap.utils.clamp(Math.PI / 2 - 1.1, Math.PI / 2 + 1.1, angle + turn + (Math.PI / 2 - angle) * 0.05);
      const nx = x + Math.cos(angle) * STEP;
      const ny = y + Math.sin(angle) * STEP;
      if (ny > TOP + depth - 6 || nx < -20 || nx > width + 20) return;
      const w = thickness * (1 - s / length) + 0.5;
      segments.push({ x, y, nx, ny, w, at: start + s, root });
      if (w > 1 && Math.random() < 0.025) {
        const side = gsap.utils.random([-1, 1]);
        grow(root, nx, ny, angle + side * gsap.utils.random(0.4, 1.1), w * 0.6, (length - s) * gsap.utils.random(0.3, 0.7), start + s);
      }
      x = nx;
      y = ny;
    }
  };

  // Set up again only when the width or the room changes, so a phone's
  // address bar showing and hiding doesn't regrow them.
  const build = () => {
    const room = Math.round(seam.room.down());
    if (seam.el.clientWidth === width && room === depth) return;
    width = seam.el.clientWidth;
    depth = room;
    seam.el.style.setProperty('--above', `${TOP}px`);
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
    const scale = gsap.utils.clamp(0.6, 1, width / 1200);
    const hero = seam.hero.offsetHeight;
    const cols = Math.ceil(width / 8);
    const colour = seam.photo.colours(hero - 16, 16, cols, 1);
    for (let x = gsap.utils.random(0, 60); x < width; x += gsap.utils.random(50, 120)) {
      const [r, g, b] = colour(Math.min(cols - 1, Math.floor(x / 8)), 0);
      colours.push(`rgb(${r * 0.75}, ${g * 0.75}, ${b * 0.75})`);
      const delay = gsap.utils.random(0, depth * 0.8);
      grow(colours.length - 1, x, 0, Math.PI / 2 + gsap.utils.random(-0.4, 0.4), gsap.utils.random(2.5, 5.5) * scale, depth * gsap.utils.random(0.6, 1.4), delay);
    }
    longest = Math.max(...segments.map((segment) => segment.at));

    // Drawn root system by root system, thickest first, in a few weights,
    // so a whole weight of one root is one path.
    segments.sort((a, b) => a.root - b.root || b.w - a.w);
    draw();
  };

  // As far along as the roots have grown: nothing with the seam at the
  // bottom of the screen, all of it by the time the edge reaches the top.
  const draw = () => {
    const grown = gsap.utils.clamp(0, 1, seam.travel / innerHeight) * longest;
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
  };

  build();
  addEventListener('resize', build);
  seam.onChange(draw);
}
