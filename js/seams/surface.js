// 03 Surface
//
// The white page's top edge is the shore and the hero's photograph is the
// sea. Scrolling pushes the beach up into the water under the pointer
// (wherever it last touched on a touch screen), higher the faster the page
// moves, and the swell runs out to both sides as waves, which bounce back
// off the sides of the screen. Moving the pointer while scrolling drags
// the swell along. When the page stops, the surface settles flat within
// about half a second. Scrolling back up draws the water down over the
// page instead, showing more of the sea, which carries on under it.
//
// The waves stay in the empty space around the seam: never higher than
// just below the hero's last line of text, never lower than just above the
// white page's first text.

const SPACING = 18; // px between the points the surface is worked out at
const SPEED = 420; // how fast waves run along it, px/s
const DAMPING = 1.1; // how fast they die down while the page moves, per s
const SETTLE = 2.5; // how strongly the surface pulls back flat while the page moves
const CALM = 40; // how strongly once the page stops: it's flat again in about half a second
const GRIP = 60; // how strongly the push holds the surface under the pointer
const REACH = 0.1; // how wide the push is, as a share of the width
const FULL = 1500; // around this speed, px/s, the push nears its highest

export default function surface(seam) {
  const paper = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  seam.el.append(canvas);

  let width = 0;
  let edge = 0; // where the hero ends, px from the canvas's top (also the most the surface may rise or fall)
  let dpr = 1;
  let height = new Float32Array(0); // how far the surface is above the edge at each point, px
  let speed = new Float32Array(0);
  let still = true;

  // Set up again only when the width or the room changes, so a phone's
  // address bar showing and hiding doesn't flatten the waves.
  const resize = () => {
    const room = Math.round(Math.min(seam.room.up(), seam.room.down(), 140));
    if (seam.el.clientWidth === width && room === edge) return;
    width = seam.el.clientWidth;
    edge = room;
    seam.el.style.setProperty('--above', `${edge}px`);
    seam.el.style.setProperty('--below', `${edge}px`);
    seam.photo.bleed(edge); // the sea carries on under the page, for the water to show where it draws down
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(edge * 2 * dpr);
    height = new Float32Array(Math.ceil(width / SPACING) + 1);
    speed = new Float32Array(height.length);
    still = true;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
  resize();
  addEventListener('resize', resize);

  // Where the push is, as a share of the width: it follows the pointer,
  // eased, so a quick flick of the mouse drags the swell rather than
  // teleporting it.
  const pointer = { x: 0.5 };
  const follow = gsap.quickTo(pointer, 'x', { duration: 0.5, ease: 'power3' });
  const aim = (event) => follow(event.clientX / innerWidth);
  addEventListener('pointermove', aim);
  addEventListener('pointerdown', aim);

  // One step of the surface: each point is pulled level with its
  // neighbours (that's what sends waves along), back towards flat, slowed
  // by damping, and held near `lift` under the pointer. The ends mirror
  // their neighbours, so waves bounce off the sides of the screen. Once
  // the page stops, the pull back to flat is much stronger, and the
  // damping just enough that it gets there without wobbling, so the edge
  // doesn't keep moving on its own.
  const step = (dt, lift) => {
    const n = height.length;
    const settle = lift ? SETTLE : CALM;
    const damping = lift ? DAMPING : 2 * Math.sqrt(CALM);
    const k = (SPEED * SPEED) / (SPACING * SPACING);
    const centre = pointer.x * (n - 1);
    const reach = REACH * n;
    for (let i = 0; i < n; i++) {
      const left = height[i > 0 ? i - 1 : 1];
      const right = height[i < n - 1 ? i + 1 : n - 2];
      const grip = GRIP * Math.exp(-(((i - centre) / reach) ** 2));
      const force =
        k * (left + right - 2 * height[i]) -
        settle * height[i] -
        damping * speed[i] +
        grip * (lift - height[i]);
      speed[i] += force * dt;
    }
    for (let i = 0; i < n; i++) height[i] += speed[i] * dt;
  };

  // Only the difference from the page is drawn: white where the surface
  // has risen above the edge, the photograph (under its veil, as the page
  // draws it) where it has dropped below it. Each reaches 2px past the edge
  // (painting what the page has there), so no sliver of the page's edge
  // shows where they meet it.
  const draw = () => {
    const hero = seam.hero.offsetHeight;
    const box = seam.photo.box();
    const top = edge - hero; // the hero's top, in the canvas
    const bottom = edge * 2;
    const curve = () => {
      ctx.moveTo(0, edge - height[0]);
      for (let i = 1; i < height.length - 1; i++) {
        const x = i * SPACING;
        ctx.quadraticCurveTo(
          x,
          edge - height[i],
          x + SPACING / 2,
          edge - (height[i] + height[i + 1]) / 2,
        );
      }
      ctx.lineTo(width, edge - height[height.length - 1]);
    };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, edge + 2);
    ctx.clip();
    ctx.beginPath();
    curve();
    ctx.lineTo(width, bottom);
    ctx.lineTo(0, bottom);
    ctx.fillStyle = paper;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, edge - 2, width, edge + 2);
    ctx.clip();
    ctx.beginPath();
    curve();
    ctx.lineTo(width, 0);
    ctx.lineTo(0, 0);
    ctx.clip();
    ctx.drawImage(seam.img, box.x, top + box.y, box.width, box.height);
    ctx.fillStyle = seam.veil.gradient(ctx, top, hero);
    ctx.fillRect(0, edge - 2, width, edge + 2);
    ctx.restore();
  };

  // The surface runs on time, not scroll, so the waves carry on after the
  // page stops. The push follows the page's speed while the seam is on the
  // screen. Once everything has settled, it stops working until the page
  // moves again.
  gsap.ticker.add((_, deltaTime) => {
    const lift = seam.inView ? Math.tanh(seam.velocity / FULL) * edge * 0.8 : 0;
    if (still && !lift) return;
    still = false;

    const dt = Math.min(deltaTime / 1000, 1 / 30);
    const steps = Math.ceil(dt * 240);
    for (let i = 0; i < steps; i++) step(dt / steps, lift);

    // Kept within the room, eased so it never hits the limit outright.
    let most = 0;
    for (let i = 0; i < height.length; i++) {
      height[i] = edge * Math.tanh(height[i] / edge);
      most = Math.max(most, Math.abs(height[i]), Math.abs(speed[i]) / 10);
    }
    if (!lift && most < 0.3) {
      height.fill(0);
      speed.fill(0);
      still = true;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    draw();
  });
}
