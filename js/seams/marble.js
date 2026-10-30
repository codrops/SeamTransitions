// 06 Marble
//
// The photograph and the page meet like colours floated for marbling. As
// the seam comes up the screen, they're laid along the edge in thin
// alternating bands, and drawn through as a marbler does by hand with a
// stylus: wide strokes pull the bands up and down into tongues, closer
// here and wider there, deeper or shallower, and fine strokes across them
// feather the tongues into chevrons, the photograph's own colours streaked
// along with them. It's strongest at the edge and fades out above and
// below. While the page scrolls the strokes keep moving, so the pattern
// flows; when it stops, it holds. Scroll back to the top and the edge is
// straight again.
//
// It stays in the empty space around the seam: the combing reaches no
// higher than just below the hero's last line of text, and no lower than
// just above the white page's first.

import Strip from '../gl/Strip.js';

export default function marble(seam) {
  const { room } = seam;

  const strip = new Strip(seam, {
    above: room.up,
    below: () => Math.min(room.down(), 200),
    dpr: 2,
    fragment: /* glsl */ `
      void main() {
        vec2 px = vPx;
        float d = px.y - uEdge; // below the edge, positive
        float below = uSize.y - uEdge;

        // How hard the comb has worked here: more as the seam comes up,
        // most at the edge, nothing at the box's top and bottom.
        float grown = smoothstep(0.0, 0.6, uProgress);
        float reach = smoothstep(-uEdge, 0.0, d) * (1.0 - smoothstep(0.0, below, d));
        float amount = grown * reach * reach;
        if (amount < 0.002) {
          outColor = vec4(0.0);
          return;
        }

        // Where this point's colour was combed from: a fine stroke across,
        // near the edge only (feathering), a wide one along (tongues up and
        // down), and noise. Drawn by hand with a stylus rather than a comb,
        // as ebru is: each stroke's spacing and depth wander, so no two
        // tongues match. Every stroke moves on as the seam travels.
        float t = uTravel / 160.0;
        vec2 q = px;
        float feather = 2.5 * noise(vec2(q.x / 80.0, q.y / 40.0)); // how far each fine stroke wanders
        q.x -= amount * (1.0 - smoothstep(30.0, 110.0, abs(d))) * 18.0 * sin(q.y / 6.0 - t * 1.3 + feather);
        float wander = 7.0 * noise(vec2(q.x / 150.0, 2.0 + t * 0.05)); // tongues closer here, wider there
        float swell = 0.3 + 1.4 * noise(vec2(q.x / 230.0, 1.0 + t * 0.05)); // and deeper or shallower
        q.y -= amount * 50.0 * swell * sin(q.x / 26.0 + wander + t);
        q += amount * 70.0 * (vec2(fbm(q / 170.0 + t * 0.1), fbm(q / 170.0 + 9.2 - t * 0.1)) - 0.5);

        // Before combing, the colours lie in bands along the edge, as
        // they're floated for marbling: the photograph, then stripes of it
        // and the page, the photograph's thinning out downwards, then the
        // page. The bands widen as the seam comes up.
        float s = (q.y - uEdge) / 16.0; // stripes down from the edge
        float bands = 4.0 * grown;
        float share = 0.5 - 0.5 * clamp(s / bands, -1.0, 1.0); // how much of each stripe is photograph
        float w = fwidth(s);
        float h = smoothstep(share + w, share - w, fract(s)) * step(abs(s), bands) + step(s, -bands);
        vec3 colour = mix(uPaper, photo(vec2(q.x, min(q.y, uEdge - 0.5))), h);

        // The box is painted outright where the comb has moved anything,
        // fading in from where it hasn't.
        outColor = vec4(colour, 1.0) * smoothstep(0.0, 0.02, amount);
      }`,
  });

  seam.onChange(() => strip.render());
  strip.render();
}
