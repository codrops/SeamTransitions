// Seam Transitions
//
// Every page is the home page of a studio whose work the page's seam acts
// out: a hero above the fold (a photograph in daylight), a white page under
// it. Ink is Canopy, bringing forest back to cleared hills; Crumble,
// Vidrado, restoring Lisbon's tiles; Typeset, Stacks, a library set in a
// Whitman poem; Contour, Socalco, terraces that follow the hill; Marble,
// Ebru, a marbling atelier; Mist, Bruma, catching water from fog;
// Craquelure, Mend 金, a kintsugi studio; Roots, Soak, letting rain soak in
// where trees can drink it; Sediment, Baldio, a village keeping its hill
// from a mine; Fray, Manta, a blanket mill; Shavings, Grain, a furniture
// workshop. Where the hero and the page meet is the seam, and each page
// animates it differently as the white page scrolls up over the hero.
// <body data-seam="…"> names the page's seam; this file sets up smooth
// scrolling, brings the studio's introduction in line by line, turns its
// latest work into a marquee, works out where the seam is and how fast the
// page moves through it, and loads that one seam.

gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText); // ScrollSmoother runs on ScrollTrigger

// Each page loads only its own seam.
const seams = {
  ink: () => import('./seams/ink.js'),
  crumble: () => import('./seams/crumble.js'),
  fray: () => import('./seams/fray.js'),
  typeset: () => import('./seams/typeset.js'),
  contour: () => import('./seams/contour.js'),
  marble: () => import('./seams/marble.js'),
  mist: () => import('./seams/mist.js'),
  craquelure: () => import('./seams/craquelure.js'),
  roots: () => import('./seams/roots.js'),
  sediment: () => import('./seams/sediment.js'),
  shavings: () => import('./seams/shavings.js'),
};

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const MARGIN = 32; // px a seam keeps clear of the text either side

// What every seam reads: its elements, how far the hero's edge has come up
// from the bottom of the screen (`travel`, px, carrying on past the top;
// `progress`, 0 at the bottom of the screen to 1 at the top), how fast the
// page is moving (`velocity`, px/s, positive going down), and whether any
// of the seam is on the screen (`inView`). `onChange` runs whenever they
// change while it is. `room` measures the empty space a seam may draw in,
// px either side of the edge: up to just below the hero's last line, down
// to just above the white page's first text. `veil` is the darkening laid
// over the hero's photograph so its type reads, as CSS sets it: how dark at
// the top, at the middle stop, where that stop is (0 to 1 down the hero),
// and at the bottom; `veil.at(t)` is how dark it is at t. A seam that draws
// the photograph darkens it the same, so it matches the page. `photo`
// helps a seam draw the hero's photograph itself (see below). A seam whose
// module exports `letters` gets the studio's introduction split into
// letters as well as lines (`.next__char`), and `onSplit` runs whenever
// it's split again, as its width changes.
const seam = {
  el: document.querySelector('.seam'),
  hero: document.querySelector('.hero'),
  img: document.querySelector('.hero__img'),
  next: document.querySelector('.next'),
  travel: 0,
  progress: 0,
  velocity: 0,
  inView: false,
  veil: Object.assign([0, 0, 0.5, 0], {
    at(t) {
      const [top, mid, stop, bottom] = this;
      const u = gsap.utils.clamp(0, 1, t);
      return u < stop ? gsap.utils.interpolate(top, mid, u / stop) : gsap.utils.interpolate(mid, bottom, (u - stop) / (1 - stop));
    },
    // As a 2D canvas gradient, for the hero `height` px tall with its top at
    // `top` in the canvas (below the hero it stays as at its bottom).
    gradient(ctx, top, height) {
      const [first, mid, stop, last] = this;
      const gradient = ctx.createLinearGradient(0, top, 0, top + height);
      gradient.addColorStop(0, `rgba(0, 0, 0, ${first})`);
      gradient.addColorStop(stop, `rgba(0, 0, 0, ${mid})`);
      gradient.addColorStop(1, `rgba(0, 0, 0, ${last})`);
      return gradient;
    },
    read() {
      const style = getComputedStyle(seam.hero);
      ['--veil-top', '--veil-mid', '--veil-stop', '--veil-bottom'].forEach((name, i) => {
        const value = parseFloat(style.getPropertyValue(name));
        if (!Number.isNaN(value)) this[i] = value;
      });
    },
  }),
  photo: {
    // Where the page draws the photograph, px from the hero's top-left: as
    // its <img> does (object-fit: cover, centred in its box, which reaches
    // below the hero by --bleed).
    box() {
      const { offsetWidth: w, offsetHeight: h, naturalWidth: iw, naturalHeight: ih } = seam.img;
      const scale = Math.max(w / iw, h / ih);
      return { x: (w - iw * scale) / 2, y: (h - ih * scale) / 2, width: iw * scale, height: ih * scale };
    },
    // Carries the picture on px below the hero's edge, under the page,
    // cropped by the hero, so a seam can show the rest of it there.
    bleed(px) {
      seam.hero.style.setProperty('--bleed', `${px}px`);
    },
    // Its colours over a band of the hero, `top` and `height` in px from the
    // hero's top, averaged into cols × rows and under the veil:
    // (col, row) → [r, g, b], row 0 the band's top.
    colours(top, height, cols, rows) {
      const box = this.box();
      const hero = seam.hero.offsetHeight;
      const { naturalWidth: iw, naturalHeight: ih } = seam.img;
      const band = document.createElement('canvas');
      band.width = cols;
      band.height = rows;
      const ctx = band.getContext('2d', { willReadFrequently: true });
      const sx = (0 - box.x) * (iw / box.width);
      const sy = (top - box.y) * (ih / box.height);
      ctx.drawImage(seam.img, sx, sy, seam.hero.offsetWidth * (iw / box.width), height * (ih / box.height), 0, 0, cols, rows);
      const data = ctx.getImageData(0, 0, cols, rows).data;
      return (col, row) => {
        const i = (row * cols + col) * 4;
        const keep = 1 - seam.veil.at((top + ((row + 0.5) * height) / rows) / hero);
        return [data[i] * keep, data[i + 1] * keep, data[i + 2] * keep];
      };
    },
  },
  room: {
    up: () => {
      const texts = [...seam.hero.querySelector('.hero__content').children];
      const last = Math.max(...texts.map((text) => text.offsetTop + text.offsetHeight));
      return Math.max(0, seam.hero.offsetHeight - last - MARGIN);
    },
    down: () => Math.max(0, seam.next.querySelector('.next__intro').offsetTop - MARGIN),
  },
  listeners: [],
  onChange(fn) {
    this.listeners.push(fn);
  },
  splits: [],
  onSplit(fn) {
    this.splits.push(fn);
  },
};

const start = async () => {
  // Smooth scrolling. Off for reduced motion.
  ScrollSmoother.create({
    wrapper: '#smooth-wrapper',
    content: '#smooth-content',
    smooth: reduced ? 0 : 1,
  });

  // The hero's real height (100vh), so the seam box sits on its edge, and
  // its veil.
  let hero = 0;
  seam.veil.read();
  const measure = () => {
    hero = seam.hero.offsetHeight;
    document.documentElement.style.setProperty('--hero', `${hero}px`);
  };
  measure();
  addEventListener('resize', measure);

  // Every frame, from where the smoothed page actually is: how far the
  // seam has come, and the page's speed (it eases back to 0 as the page
  // settles), smoothed a little more so a single frame's jolt doesn't
  // count. The seam hears about it for as long as any of its box is on the
  // screen, so it keeps moving until it has scrolled right out of view.
  const content = document.querySelector('#smooth-content');
  const last = { travel: NaN, velocity: 0, y: -gsap.getProperty(content, 'y'), time: gsap.ticker.time };
  gsap.ticker.add((time) => {
    const y = -gsap.getProperty(content, 'y');
    const speed = (y - last.y) / Math.max(time - last.time, 1 / 120);
    last.y = y;
    last.time = time;
    seam.velocity += (speed - seam.velocity) * 0.3;
    if (Math.abs(seam.velocity) < 2) seam.velocity = 0;
    seam.travel = y + innerHeight - hero;
    seam.progress = gsap.utils.clamp(0, 1, seam.travel / innerHeight);

    const top = seam.el.offsetTop - y;
    seam.inView = top < innerHeight && top + seam.el.offsetHeight > 0;
    if (!seam.inView || (seam.travel === last.travel && seam.velocity === last.velocity)) return;
    last.travel = seam.travel;
    last.velocity = seam.velocity;
    seam.listeners.forEach((fn) => fn(seam));
  });

  // With reduced motion, the introduction is simply there, the latest work
  // is a still row, and the seam stays a plain edge.
  if (reduced) return;

  // The page's seam, loaded first: it may want the introduction's letters.
  const name = document.body.dataset.seam;
  let module = null;
  try {
    module = await seams[name]();
  } catch (error) {
    console.warn(`The ${name} seam couldn't load: ${error.message}`);
  }

  // The cue to scroll fades out over the first few px of scroll, before
  // the seam comes up to it.
  gsap.to('.hero__scroll', {
    autoAlpha: 0,
    ease: 'none',
    scrollTrigger: { trigger: seam.hero, start: 'top top', end: '+=30', scrub: true },
  });

  // The studio's introduction comes in line by line the first time it
  // scrolls into view, each line rising out of its own mask, and then
  // stays. `autoSplit` cuts it into lines again when the width changes
  // where they break, and rebuilds the animation `onSplit` returns: none
  // once it has come in, so a resize doesn't play it again. For a seam
  // that asks, it (and its label) is split into letters too, and the seam
  // hears about every new split.
  const letters = Boolean(module?.letters);
  if (letters) SplitText.create('.next__label', { type: 'chars', charsClass: 'next__char' });
  let revealed = false;
  SplitText.create('.next__text', {
    type: letters ? 'lines, chars' : 'lines',
    charsClass: 'next__char',
    mask: 'lines',
    autoSplit: true,
    onSplit: (self) => {
      seam.splits.forEach((fn) => fn());
      if (revealed) return;
      return gsap.from(self.lines, {
        yPercent: 100,
        duration: 1.1,
        ease: 'power4.out',
        stagger: 0.12,
        scrollTrigger: {
          trigger: self.elements[0],
          start: 'top 85%',
          once: true,
          onEnter: () => (revealed = true),
        },
      });
    },
  });

  // The latest work becomes a marquee the scroll moves right to left. A
  // second set of the photographs follows the first (hidden from screen
  // readers), and the row's position wraps round one set's width, so it
  // never runs out. It starts where the plain row would be, and drifts
  // slowly: a third of a set's width while it crosses the screen.
  const projects = document.querySelector('.projects');
  const works = [...projects.children];
  works.forEach((work) => {
    const copy = work.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    copy.querySelector('img').alt = '';
    projects.append(copy);
  });
  projects.classList.add('projects--marquee');
  const setX = gsap.quickSetter(projects, 'x', 'px');
  let loop = 0; // one set's width, with its gap
  const DRIFT = 0.33; // sets' widths it moves while crossing the screen
  ScrollTrigger.create({
    trigger: projects,
    start: 'top bottom',
    end: 'bottom top',
    onRefresh: (self) => {
      loop = projects.children[works.length].offsetLeft - works[0].offsetLeft;
      setX(gsap.utils.wrap(-loop, 0, -self.progress * loop * DRIFT));
    },
    onUpdate: (self) => setX(gsap.utils.wrap(-loop, 0, -self.progress * loop * DRIFT)),
  });

  // A seam that can't run (no WebGL 2, say) leaves the plain edge. Fonts
  // it draws in (`fonts`), which the page itself may not show, are loaded
  // first.
  try {
    await Promise.all((module?.fonts ?? []).map((font) => document.fonts.load(font)));
    module?.default(seam);
  } catch (error) {
    console.warn(`The ${name} seam couldn't start: ${error.message}`);
  }
};

// Open the page once its fonts and photographs are in and its seam has
// started, so nothing moves into place in view: some seams change the
// hero's layout as they start (Ink makes the photograph's box taller, to
// carry the picture on under the page). If anything fails, the page opens
// anyway.
const ready = [document.fonts.ready, ...[...document.images].map((img) => img.decode().catch(() => {}))];
Promise.all(ready)
  .then(start)
  .finally(() => document.body.classList.remove('loading'));
