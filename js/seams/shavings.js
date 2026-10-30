// 11 Shavings
//
// The plank in the hero's photograph is planed as the page comes up over
// it. Along its bottom, a plane takes off long thin shavings, one stroke
// after another along the grain, the bottom row first, then the rows
// above: each is a strip of the picture that curls up into a spiral as it
// comes away, its inner turns in shadow, leaving the white page where it
// was, then drops, tumbling, onto a loose pile resting above the white
// page's first text. Shavings only come away while the page scrolls; those
// in the air finish their fall when it stops. Scroll back and they fly back
// up, uncurl and lie flat in the plank again.
//
// It stays in the empty space around the seam: the strokes reach no higher
// than just below the hero's last line of text, and the pile rests just
// above the white page's first.

gsap.registerPlugin(Physics2DPlugin);

const THICK = 7; // px, how wide a shaving is: one row of strokes
const ROWS = 6; // rows of strokes the plank is planed, at most
const STEP = 3; // px of a shaving drawn as one piece along its curl
const SQUASH = 0.55; // how flat a curl looks from above, lying on its side like a coil
const GRAVITY = 1200; // px/s²

export default function shavings(seam) {
  const { room } = seam;
  const paper = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  seam.el.append(canvas);

  let strokes = [];
  let edge = 0; // where the hero ends, px from the canvas's top
  let dpr = 1;
  let dirty = true;
  let built = '';

  // A shaving's curl, peeled so far: from where it leaves the plank (s = 0)
  // to its free end, the start of the stroke, which curls tightest, at the
  // spiral's heart, seen from above as a coil lying on its side (flattened
  // by SQUASH). Points STEP apart, each with the way the shaving turns there
  // (turn: flat along the plank at π) and the direction it runs on the
  // screen.
  const curl = (stroke, peeled) => {
    const points = [];
    let x = stroke.left + peeled;
    let y = stroke.top + THICK / 2;
    let turn = Math.PI; // heading back along the stroke, then curling down and round
    for (let s = 0; s <= peeled; s += STEP) {
      const dx = Math.cos(turn);
      const dy = Math.sin(turn) * SQUASH;
      points.push({ x, y, turn, angle: Math.atan2(dy, dx) });
      const radius = stroke.radius * Math.max(0.4, 1 - (0.6 * s) / stroke.length);
      turn -= STEP / radius;
      x += Math.cos(turn) * STEP;
      y += Math.sin(turn) * STEP * SQUASH;
    }
    return points;
  };

  const build = () => {
    const width = seam.el.clientWidth;
    const below = Math.round(room.down());
    const rows = Math.min(ROWS, Math.floor((room.up() - 4) / THICK));
    const key = [width, below, rows].join();
    if (key === built) return;
    built = key;

    strokes.forEach((stroke) => stroke.tl?.kill());
    edge = rows * THICK;
    seam.el.style.setProperty('--above', `${edge}px`);
    seam.el.style.setProperty('--below', `${below}px`);
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round((edge + below) * dpr);

    // Where each stroke's strip is in the photograph, and how dark the
    // veil over it is, so its shaving shows the picture as the page drew it.
    const box = seam.photo.box();
    const hero = seam.hero.offsetHeight;
    const toImage = seam.img.naturalWidth / box.width;

    // The strokes: rows of them along the plank, of random lengths, each
    // with its own curl. The bottom row comes away first, then the rows
    // above, roughly left to right, as the plane goes, spread over the
    // scroll until the box's bottom nears the top of the screen.
    strokes = [];
    for (let row = 0; row < rows; row++) {
      const top = edge - (row + 1) * THICK;
      for (let left = gsap.utils.random(-60, 0); left < width; ) {
        const length = Math.round(gsap.utils.random(120, 320));
        strokes.push({
          left,
          top,
          length,
          row,
          radius: gsap.utils.random(30, 48),
          sy: (hero - edge + top - box.y) * toImage,
          toImage,
          box,
          veil: seam.veil.at((hero - edge + top + THICK / 2) / hero),
          peel: 0,
          x: 0,
          y: 0,
          rotation: 0,
          order: row + left / width + gsap.utils.random(-0.15, 0.15),
        });
        left += length;
      }
    }
    strokes.sort((a, b) => a.order - b.order);

    // Where each lands: it falls, drifting a little, onto the pile under
    // it, worked out in order, so the first to fall lie lowest.
    const floor = edge + below - 4;
    const bins = new Array(Math.ceil(width / 24) + 1).fill(0);
    strokes.forEach((stroke, i) => {
      stroke.at = (innerHeight + below) * (0.04 + (0.86 * i) / Math.max(1, strokes.length - 1));
      stroke.out = false;

      const spiral = curl(stroke, stroke.length);
      const xs = spiral.map((p) => p.x);
      const ys = spiral.map((p) => p.y);
      const bounds = {
        left: Math.min(...xs),
        right: Math.max(...xs),
        top: Math.min(...ys),
        bottom: Math.max(...ys),
      };
      stroke.centre = { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 };
      // How far it reaches from its centre, however it lands turned
      const reach =
        Math.max(...spiral.map((p) => Math.hypot(p.x - stroke.centre.x, p.y - stroke.centre.y))) +
        THICK / 2;
      const drift = gsap.utils.random(-40, 40);
      const span = bins.slice(
        Math.max(0, Math.floor((bounds.left + drift) / 24)),
        Math.max(1, Math.ceil((bounds.right + drift) / 24)),
      );
      const pile = Math.min(Math.max(0, ...span), below * 0.45);
      const drop = Math.max(0, floor - pile - (stroke.centre.y + reach));
      for (
        let b = Math.floor((bounds.left + drift) / 24);
        b < Math.ceil((bounds.right + drift) / 24);
        b++
      ) {
        if (b >= 0 && b < bins.length) bins[b] = pile + (bounds.bottom - bounds.top) * 0.5;
      }
      const kick = gsap.utils.random(20, 60); // px/s upwards as it comes free
      const duration = (kick + Math.sqrt(kick * kick + 2 * GRAVITY * drop)) / GRAVITY;

      stroke.tl = gsap
        .timeline({ paused: true, onUpdate: () => (dirty = true) })
        .to(stroke, { peel: 1, duration: 0.4 + stroke.length / 700, ease: 'none' })
        .to(stroke, {
          physics2D: {
            velocity: Math.hypot(drift / duration, kick),
            angle: (Math.atan2(-kick, drift / duration) * 180) / Math.PI,
            gravity: GRAVITY,
          },
          duration,
          ease: 'none',
        })
        .to(stroke, { rotation: gsap.utils.random(-120, 120), duration, ease: 'power1.in' }, '<')
        .set(stroke, { x: drift, y: drop });
    });

    update(false);
  };

  // Plane the strokes the seam has passed, and put back the ones it has
  // gone back over: played as it happens, or straight to where they belong
  // when the strokes are being laid out.
  const update = (animate = true) => {
    strokes.forEach((stroke) => {
      if (!stroke.tl) return;
      const out = seam.travel > stroke.at;
      if (out === stroke.out) return;
      stroke.out = out;
      if (!animate) stroke.tl.progress(out ? 1 : 0);
      else if (out) stroke.tl.timeScale(1).play();
      else stroke.tl.timeScale(2).reverse();
    });
    dirty = true;
  };

  // Only the difference from the page: white where shavings have come
  // away (snapped to the canvas's pixels so neighbours meet, the bottom row
  // reaching 2px past the edge), and the shavings, each drawn piece by piece
  // along its curl, a slice of the photograph turned to the way the curl
  // runs there, darker where the curl turns its back to the light and under
  // the veil as the page drew it.
  const draw = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = paper;
    strokes.forEach(({ tl, left, top, length, peel, row }) => {
      if (!tl?.time()) return;
      const x = Math.round(left * dpr);
      const y = Math.round(top * dpr);
      const bottom = row === 0 ? edge + 2 : top + THICK;
      ctx.fillRect(
        x,
        y,
        Math.round((left + length * peel) * dpr) - x,
        Math.round(bottom * dpr) - y,
      );
    });
    ctx.fillStyle = '#000';
    strokes.forEach((stroke) => {
      const { tl, peel, length, left, sy, toImage, box, veil, x, y, rotation, centre } = stroke;
      if (!tl?.time()) return;
      const peeled = length * peel;
      const points = curl(stroke, peeled);
      for (let i = 0; i < points.length - 1; i++) {
        const { angle, turn } = points[i];
        const end = points[i + 1];
        const piece = Math.hypot(end.x - points[i].x, end.y - points[i].y);
        const wide = THICK * (0.45 + 0.55 * Math.abs(Math.cos(turn))); // narrower where it turns edge-on
        const u = left + peeled - (i + 1) * STEP; // where this piece was in the plank
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.translate(centre.x + x, centre.y + y);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(end.x - centre.x, end.y - centre.y);
        ctx.rotate(angle + Math.PI);
        ctx.globalAlpha = 1;
        ctx.drawImage(
          seam.img,
          (u - box.x) * toImage,
          sy,
          STEP * toImage,
          THICK * toImage,
          -0.4,
          -wide / 2,
          piece + 0.8,
          wide,
        );
        const light = 0.5 + 0.5 * (0.5 + 0.5 * Math.cos(turn - Math.PI));
        ctx.globalAlpha = 1 - (1 - veil) * light;
        ctx.fillRect(-0.4, -wide / 2, piece + 0.8, wide);
      }
    });
    ctx.globalAlpha = 1;
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
