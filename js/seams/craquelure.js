// 08 Craquelure
//
// The bottom of the photograph dries out and cracks, like clay in the sun
// or the varnish on an old painting. As the seam comes up the screen, the
// cracks open from the edge upwards, splitting the photograph into plates;
// they widen as each plate dries and shrinks, turns a little and curls at
// its rim, casting a soft shadow on the white page showing through, until
// the plates nearest the page have shrunk away to nothing. Scroll back and
// the plates grow together again until the photograph is whole.
//
// It stays in the empty space around the seam: the cracks reach no higher
// than just below the hero's last line of text.

import Strip from '../gl/Strip.js';

const CELL = 25; // a plate's size, px; the cracks and their wander scale with it

export default function craquelure(seam) {
  const strip = new Strip(seam, {
    above: seam.room.up,
    below: () => 2, // the page's own white, so no sliver of the edge shows under the cracks
    dpr: 2,
    fragment: /* glsl */ `
      const float CELL = ${CELL.toFixed(1)};

      vec2 jitter(vec2 c) {
        return 0.1 + 0.8 * vec2(hash(c), hash(c + 17.3));
      }

      // The plate a point is on (in cell units): its centre, an id, and how
      // far the point is from the plate's nearest border.
      void plate(vec2 p, out vec2 centre, out float id, out float border) {
        vec2 n = floor(p);
        vec2 f = fract(p);
        vec2 mg, mr;
        float md = 8.0;
        for (int j = -1; j <= 1; j++)
          for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(i, j);
            vec2 r = g + jitter(n + g) - f;
            float d = dot(r, r);
            if (d < md) {
              md = d;
              mr = r;
              mg = g;
            }
          }
        border = 8.0;
        for (int j = -2; j <= 2; j++)
          for (int i = -2; i <= 2; i++) {
            vec2 g = mg + vec2(i, j);
            vec2 r = g + jitter(n + g) - f;
            if (dot(mr - r, mr - r) > 0.00001) border = min(border, dot(0.5 * (mr + r), normalize(r - mr)));
          }
        centre = n + mg + jitter(n + mg);
        id = hash(n + mg);
      }

      void main() {
        vec2 px = vPx;
        // The plates are found a little off where the point really is, so
        // the cracks between them wander instead of running straight.
        vec2 wander = (vec2(fbm(px / (0.83 * CELL)), fbm(px / (0.83 * CELL) + 7.7)) - 0.5) * 0.35 * CELL;
        vec2 centre;
        float id, border;
        plate((px + wander) / CELL, centre, id, border);
        centre *= CELL;
        border *= CELL;

        // How dry this plate is: the ones nearer the edge first, each a
        // little sooner or later than its neighbours, more as the seam
        // comes up; none at all before the page moves.
        float h = (uEdge - centre.y) / uEdge;
        float dry = clamp(uProgress * 1.7 - max(h, 0.0) * 1.3 + (id - 0.5) * 0.3 * min(uProgress * 10.0, 1.0), 0.0, 1.0);
        if (dry <= 0.0) {
          outColor = vec4(0.0);
          return;
        }

        // The crack around it widens until the plate is gone; the plate
        // shrinks and turns about its centre as it dries.
        float crack = dry * dry * 0.52 * CELL;
        float turn = (id - 0.5) * 0.5 * dry;
        mat2 r = mat2(cos(turn), sin(turn), -sin(turn), cos(turn));
        vec2 q = centre + r * (px + wander - centre) / (1.0 - 0.3 * dry) - wander;

        // The plate: the photograph (or the page, past the edge), lighter
        // at its curled rim. The crack: the page, shadowed close to the
        // plates.
        float on = smoothstep(crack - 0.75, crack + 0.75, border);
        vec3 face = q.y < uEdge ? photo(q) : uPaper;
        face = mix(face, uPaper, 0.18 * smoothstep(crack + 5.0, crack, border) * dry);
        vec3 gap = uPaper * (1.0 - 0.12 * smoothstep(crack - 6.0, crack, border));
        outColor = vec4(mix(gap, face, on), 1.0);
      }`,
  });

  seam.onChange(() => strip.render());
  strip.render();
}
