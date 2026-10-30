// 08 Craquelure
//
// The bottom of the photograph breaks, like a glazed ceramic, along seams
// of gold, as a kintsugi repair would show them. As the seam comes up the
// screen, the cracks open from the edge upwards, splitting the photograph
// into pieces, each broken edge lined with gold; they widen as each piece
// shrinks a little, turns and curls at its rim, casting a soft shadow on
// the white page showing through, but only so far (GAP): the pieces hold
// together. (With small pieces, a small CELL, the cracks open until those
// nearest the page have shrunk away to nothing, like crazed varnish.)
// Scroll back and the pieces grow together again until the photograph is
// whole.
//
// It stays in the empty space around the seam: the cracks reach no higher
// than just below the hero's last line of text.

import Strip from '../gl/Strip.js';

const CELL = 140; // a piece's size, px; the cracks and their wander scale with it
const GAP = 14; // the widest a crack opens, px: bigger pieces stay together, held by their gold seams

export default function craquelure(seam) {
  const strip = new Strip(seam, {
    above: seam.room.up,
    below: () => 2, // the page's own white, so no sliver of the edge shows under the cracks
    dpr: 2,
    fragment: /* glsl */ `
      const float CELL = ${CELL.toFixed(1)};
      const float GAP = ${GAP.toFixed(1)};

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
        // (Small plates shrink away to nothing; big ones only as far as GAP
        // lets their cracks open, so they hold together.)
        float open = min(0.52 * CELL, GAP);
        float give = open / (0.52 * CELL);
        float crack = dry * dry * open;
        float turn = (id - 0.5) * 0.5 * dry * give;
        mat2 r = mat2(cos(turn), sin(turn), -sin(turn), cos(turn));
        vec2 q = centre + r * (px + wander - centre) / (1.0 - 0.3 * dry * give) - wander;

        // The plate: the photograph (the page, below the edge), lighter
        // at its curled rim. The crack: the page, shadowed close to the
        // plates. Along the plate's broken edge, a line of gold, paler and
        // deeper where the light catches it, once the crack has opened. All
        // of it on the photograph only: the gold and the shadows stop at its
        // edge.
        float on = smoothstep(crack - 0.75, crack + 0.75, border);
        vec3 face = px.y < uEdge ? photo(q) : uPaper; // a piece shows the photograph all the way to the edge
        face = mix(face, uPaper, 0.18 * smoothstep(crack + 5.0, crack, border) * dry);
        vec3 gap = uPaper * (1.0 - 0.12 * smoothstep(crack - 6.0, crack, border));
        float edge = (1.0 - smoothstep(1.0, 2.4, abs(border - crack))) * smoothstep(0.0, 0.08, dry);
        vec3 gold = mix(vec3(0.72, 0.55, 0.24), vec3(0.95, 0.82, 0.5), noise(q / 14.0));
        outColor = vec4(mix(mix(gap, face, on), gold, edge), 1.0);
        if (px.y >= uEdge) outColor = vec4(uPaper, 1.0); // below the edge, the page's own white, nothing on it
      }`,
  });

  seam.onChange(() => strip.render());
  strip.render();
}
