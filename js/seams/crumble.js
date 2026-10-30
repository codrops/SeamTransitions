// 02 Crumble
//
// The bottom of the hero's photograph (a tiled façade) is made of squares
// of three sizes: small crumbs along the very edge, bigger blocks above
// them. As the page scrolls up over it they break off one by one, from the
// bottom up: each jumps loose with its piece of the picture, spins and
// falls down the white page, fading out before it reaches any text, and
// the page shows through the hole it leaves. Most of the top blocks hold,
// so the hero ends on a ragged edge. Only
// scrolling breaks squares off: when the page stops, the ones in the air
// finish their fall and no more go. Scroll back and they fly back up into
// their holes, the last to fall first, until the edge is whole again.
//
// It stays in the empty space around the seam: the squares go no higher
// than just below the hero's last line of text, and are gone before the
// white page's first text, both measured from the page.

gsap.registerPlugin(Physics2DPlugin);

const GRAVITY = 1200; // px/s²

export default function crumble(seam) {
  const { room } = seam;
  const paper = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  seam.el.append(canvas);

  let squares = [];
  let edge = 0; // where the hero ends, px from the canvas's top
  let dpr = 1;
  let dirty = true;
  let built = '';

  const build = () => {
    const width = seam.el.clientWidth;
    const below = Math.round(room.down());
    // The smallest square, and a block of four by four of them; the edge is
    // two rows of blocks deep.
    const unit = Math.min(
      Math.round(gsap.utils.clamp(10, 18, width / 80)),
      Math.floor(room.up() / 8),
    );
    const block = unit * 4;
    const key = [width, below, unit].join();
    if (key === built) return;
    built = key;

    squares.forEach((square) => square.tl?.kill());
    edge = block * 2;
    seam.el.style.setProperty('--above', `${edge}px`);
    seam.el.style.setProperty('--below', `${below}px`);
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round((edge + below) * dpr);

    // Where each square's piece of the photograph is in the image, and how
    // dark the veil over it is, so it falls as the page drew it.
    const box = seam.photo.box();
    const hero = seam.hero.offsetHeight;
    const toImage = seam.img.naturalWidth / box.width;
    const piece = (left, top, size) => ({
      sx: (left - box.x) * toImage,
      sy: (hero - edge + top - box.y) * toImage,
      sw: size * toImage,
      veil: seam.veil.at((hero - edge + top + size / 2) / hero),
    });

    // Each block may break into four squares, and each of those into four
    // crumbs, more often the nearer it is to the edge.
    squares = [];
    const lay = (left, top, size) => {
      const low = (top + size) / edge; // how near its bottom is to the edge, 0 to 1
      if (size > unit && Math.random() < low - (size < block ? 0.55 : 0.3)) {
        const half = size / 2;
        [0, half].forEach((dy) => [0, half].forEach((dx) => lay(left + dx, top + dy, half)));
      } else {
        squares.push({
          left,
          top,
          size,
          ...piece(left, top, size),
          x: 0,
          y: 0,
          rotation: 0,
          opacity: 1,
        });
      }
    };
    for (let top = 0; top < edge; top += block) {
      for (let left = 0; left < width; left += block) lay(left, top, block);
    }

    // Which squares fall, and in what order: most of those on the edge,
    // fewer and fewer higher up, roughly from the bottom up. They're spread
    // evenly over the scroll, from just after the page starts to move until
    // the box's bottom nears the top of the screen, so squares keep breaking
    // off for as long as any of it is in view.
    const falling = squares
      .map((square) => ({ square, depth: (square.top + square.size / 2) / edge }))
      .filter(({ depth }) => Math.random() < depth ** 2)
      .map(({ square, depth }) => ({ square, order: -depth + gsap.utils.random(-0.12, 0.12) }))
      .sort((a, b) => a.order - b.order)
      .map(({ square }) => square);

    falling.forEach((square, i) => {
      square.at = (innerHeight + below) * (0.04 + (0.9 * i) / Math.max(1, falling.length - 1));
      square.out = false;

      // The fall itself: knocked loose with a little upward kick, then
      // gravity (Physics2DPlugin works out the arc from the tween's time,
      // so it plays backwards just as well). Small crumbs jump higher and
      // spin faster than blocks. It falls no lower than the room allows,
      // fading out on the way.
      const k = unit / square.size; // 1 for a crumb, ¼ for a block
      const velocity = gsap.utils.random(0.8, 1.2) * (90 + 150 * k);
      const angle = -90 + gsap.utils.random(-30, 30);
      const rise = velocity * Math.sin((angle * Math.PI) / 180);
      const centre = square.top + square.size / 2;
      const drop = (edge + below - centre - square.size * 0.71) * gsap.utils.random(0.6, 1);
      const duration = (-rise + Math.sqrt(rise * rise + 2 * GRAVITY * drop)) / GRAVITY;
      const spin = gsap.utils.random([-1, 1]) * gsap.utils.random(40, 120) * (0.5 + k);

      square.tl = gsap
        .timeline({ paused: true, onUpdate: () => (dirty = true) })
        .to(square, { physics2D: { velocity, angle, gravity: GRAVITY }, duration, ease: 'none' }, 0)
        .to(square, { rotation: spin, duration, ease: 'power1.in' }, 0)
        .to(square, { opacity: 0, duration: duration * 0.5, ease: 'power1.in' }, duration * 0.5);
    });

    update(false);
  };

  // Break off the squares the seam has passed, and put back the ones it
  // has gone back over: played as it happens, or straight to where they
  // belong when the squares are being laid out.
  const update = (animate = true) => {
    squares.forEach((square) => {
      if (!square.tl) return;
      const out = seam.travel > square.at;
      if (out === square.out) return;
      square.out = out;
      if (!animate) square.tl.progress(out ? 1 : 0);
      else if (out) square.tl.timeScale(1).play();
      else square.tl.timeScale(2).reverse();
    });
    dirty = true;
  };

  // Only the difference from the page is drawn: white holes where squares
  // have gone, and the squares in the air. The holes are snapped to the
  // canvas's pixels so neighbours meet exactly, and along the edge they
  // reach a couple of px into the page, so no sliver of the hero shows
  // under them.
  const draw = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = paper;
    squares.forEach(({ tl, left, top, size }) => {
      if (!tl?.time()) return;
      const x = Math.round(left * dpr);
      const y = Math.round(top * dpr);
      const bottom = top + size >= edge ? edge + 2 : top + size;
      ctx.fillRect(x, y, Math.round((left + size) * dpr) - x, Math.round(bottom * dpr) - y);
    });
    ctx.fillStyle = '#000';
    squares.forEach(({ tl, left, top, size, sx, sy, sw, veil, x, y, rotation, opacity }) => {
      if (!tl?.time() || !opacity) return;
      ctx.setTransform(dpr, 0, 0, dpr, (left + size / 2 + x) * dpr, (top + size / 2 + y) * dpr);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.globalAlpha = opacity;
      ctx.drawImage(seam.img, sx, sy, sw, sw, -size / 2, -size / 2, size, size);
      ctx.globalAlpha = opacity * veil;
      ctx.fillRect(-size / 2, -size / 2, size, size);
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
