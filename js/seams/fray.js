// 03 Fray
//
// The blanket in the hero's photograph frays at its hem. As the seam comes
// up the screen, its weft is pulled out a row at a time from the bottom up,
// leaving its warp: the threads that ran up and down it, each in its own
// colour, hanging free over the white page showing through between them,
// and, no longer held by the weave, relaxing down past the hem into the
// page as a fringe, longer the more is pulled out. While the page scrolls
// the fringe sways, more the faster it moves, and it settles when the page
// stops. Scroll back and the blanket weaves itself whole again, row by row.
//
// It stays in the empty space around the seam: the rows come out no higher
// than just below the hero's last line of text, and the fringe hangs no
// lower than just above the white page's first.

import Strip from '../gl/Strip.js';

const UP = 140; // px of the blanket that can fray, at most
const FLUTTER = 14; // px the end of a long thread sways at full speed
const STIFF = 40; // how strongly the fringe is pulled back to still
const DAMP = 9; // and how fast its swaying dies down

export default function fray(seam) {
  const { room } = seam;

  const strip = new Strip(seam, {
    above: () => Math.min(room.up(), UP),
    below: () => Math.min(room.down(), 200),
    uniforms: { uScreen: innerHeight, uFlutter: 0 },
    dpr: 2,
    fragment: /* glsl */ `
      uniform float uScreen; // the window's height, px
      uniform float uFlutter; // how far the fringe sways, px at the end of a long thread

      const float PITCH = 5.0; // px between warp threads
      const float ROW = 4.0; // px of weft pulled out at a time
      const float DROOP = 0.7; // px the freed threads hang below the hem, per px of weft pulled out

      // A warp thread's colour: the photograph's just above the hem, where
      // the thread is, softened to the yarn's colour, under the hero's veil.
      vec3 yarn(float x) {
        vec2 p = vec2(x, uEdge - 6.0);
        vec2 uv = clamp((p - uHeroBox.xy) / uHeroBox.zw, 0.0, 1.0);
        return textureLod(uHero, uv, 2.0).rgb * (1.0 - veil(p.y));
      }

      // How far up thread i's weft has gone, px above the edge: the rows
      // pulled out so far, a row or two more or less here and there, as a
      // hand-pulled edge comes out.
      float freed(float i, float pulled) {
        return max(pulled - floor(noise(vec2(i / 5.0, 1.3)) * 3.0) * ROW, 0.0);
      }

      void main() {
        vec2 px = vPx;
        float below = uSize.y - uEdge;

        // How much weft has been pulled out: none before the page moves,
        // all the frayed hem by the time the fringe has scrolled off the
        // top, a row at a time.
        float grow = clamp(uTravel / (uScreen + below), 0.0, 1.0);
        float pulled = min(floor(grow * 1.3 * uEdge / ROW) * ROW, uEdge);
        if (pulled <= 0.0) {
          outColor = vec4(0.0);
          return;
        }

        // Where the weave ends over this pixel: above it, the photograph,
        // untouched.
        float column = floor(px.x / PITCH);
        if (px.y < uEdge - freed(column, pulled)) {
          outColor = vec4(0.0);
          return;
        }

        // The nearest warp thread: each hangs from where its weft ends,
        // down past the hem, crinkled as wool is, swaying more towards its
        // end, and thinning at its tip.
        float best = 2.0;
        float id = column;
        float across = 0.0;
        for (int k = -3; k <= 3; k++) {
          float i = column + float(k);
          float n = hash(vec2(i, 7.0));
          float top = uEdge - freed(i, pulled);
          float end = uEdge + min(below - 4.0, (uEdge - top) * DROOP * (0.6 + 0.6 * hash(vec2(i, 3.1))));
          if (top >= uEdge || px.y < top || px.y > end) continue;
          float hang = px.y - top;
          float sway = uFlutter * pow(hang / 160.0, 1.5) * sin(i * PITCH / 170.0 + uTravel / 60.0 + n * 2.0);
          float crimp = (0.25 + 0.4 * n) * sin(px.y / (2.4 + 1.6 * n) + n * 20.0);
          float centre = (i + 0.5) * PITCH + sway + crimp;
          float girth = 1.5 * (1.0 - 0.6 * smoothstep(end - 8.0, end, px.y));
          float d = abs(px.x - centre) / girth;
          if (d < best) {
            best = d;
            id = i;
            across = (px.x - centre) / girth;
          }
        }

        // The thread, round (lit across its width) and plied (faint twists
        // along it), over white where the weave was (and a couple of px
        // past the edge, so no sliver of the hem shows), over the page below.
        float a = 1.0 - smoothstep(0.75, 1.15, best);
        float lit = 0.78 + 0.3 * sqrt(max(0.0, 1.0 - across * across));
        float ply = 0.95 + 0.05 * sin((px.y + across * 4.0) * 1.4);
        vec3 thread = yarn((id + 0.5) * PITCH) * lit * ply;
        if (px.y < uEdge + 2.0) {
          outColor = vec4(mix(uPaper, thread, a), 1.0);
        } else {
          outColor = vec4(thread * a, a);
        }
      }`,
  });

  // The fringe's sway: a spring that the page's speed pushes while the seam
  // is on the screen, and pulls back to still once the page stops. Drawn
  // again whenever the seam or the sway changes, once a frame.
  const sway = { amount: 0, speed: 0 };
  let dirty = true;
  seam.onChange(() => (dirty = true));
  addEventListener('resize', () => (dirty = true));
  gsap.ticker.add((_, deltaTime) => {
    const target = seam.inView ? Math.min(Math.abs(seam.velocity) / 1500, 1) * FLUTTER : 0;
    const dt = Math.min(deltaTime / 1000, 1 / 30);
    sway.speed += ((target - sway.amount) * STIFF - sway.speed * DAMP) * dt;
    sway.amount += sway.speed * dt;
    if (!target && Math.abs(sway.amount) < 0.05 && Math.abs(sway.speed) < 0.05) {
      if (sway.amount) dirty = true;
      sway.amount = 0;
      sway.speed = 0;
    } else {
      dirty = true;
    }
    if (!dirty) return;
    dirty = false;
    strip.set({ uScreen: innerHeight, uFlutter: sway.amount });
    strip.render();
  });
}
