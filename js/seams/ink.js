// 01 Ink Bleed
//
// The photograph bleeds into the white page like ink into wet paper: as
// soon as the page starts to scroll up, a ragged, branching edge creeps
// down into it, in lobes and thin runs along the paper's fibres, and the
// paper eats back up into the photograph between them. The ink pools
// darker at its edge, as watercolour does. It keeps flowing for as long as
// any of it is on the screen, reshaping as the page moves, and draws back
// as you scroll back; the faster the page moves, the wider and softer it
// feathers.
//
// It stays in the empty space around the seam: never further down than
// just above the white page's first text, never further up than just
// below the hero's last line, both measured from the page.

import Strip from '../gl/Strip.js';

export default function ink(seam) {
  const { room } = seam;
  const strip = new Strip(seam, {
    above: room.up,
    below: room.down,
    bleed: true, // the ink shows the rest of the picture, under the page
    fragment: /* glsl */ `
      void main() {
        // Before the page moves, the plain edge.
        if (uProgress <= 0.0) {
          outColor = vec4(0.0);
          return;
        }
        vec2 px = vPx;
        float d = px.y - uEdge; // below the hero's edge, positive
        float down = uSize.y - uEdge; // the room below the edge, px
        float up = uEdge; // the room above it

        // A warped noise field for the lobes, a fine one for the frayed
        // edge, and a few thin runs along the paper's fibres. Together: how
        // far the ink gets at each point (g), from about -0.5 (the paper
        // eats up into the photograph) to 1.6. The field drifts as the seam
        // travels, so the ink keeps reshaping until it's off the screen.
        vec2 q = (px + uTravel * vec2(0.08, 0.47)) / 300.0;
        vec2 w = vec2(fbm(q), fbm(q + vec2(5.2, 1.3)));
        float lobes = fbm(q * 1.2 + 2.2 * w);
        float fray = fbm(px / 24.0 + 3.0 * w);
        float runs = pow(fbm(vec2(px.x / 26.0, (px.y - uTravel * 0.16) / 140.0)), 3.0);
        float g = (lobes - 0.42) * 2.8 + (fray - 0.5) * 0.35 + runs * 0.9;

        // How far it has spread: most of the way within the first third of
        // the scroll, further while the page moves fast. Eased (tanh) so it
        // nears its room but never runs out of it.
        float spread = smoothstep(0.0, 0.35, uProgress) + min(abs(uVelocity) / 3000.0, 0.35);
        float reach = g > 0.0 ? down * tanh(g * spread * 0.9) : -up * tanh(-g * spread * 0.5);

        // The ink's edge is feathered, the more the faster the page moves,
        // but sharp while the ink has barely started, so the hero's edge
        // isn't softened before anything has bled.
        float s = d - reach; // in the ink where negative
        float soft = max((0.8 + min(abs(uVelocity) * 0.004, 8.0)) * smoothstep(0.0, 0.03, uProgress), 0.001);
        float h = 1.0 - smoothstep(-soft, soft, s);

        float rim = 1.0 - smoothstep(0.0, 14.0, -s);
        // The ink is the photograph itself: below the edge, the rest of the
        // picture, which the page covers until the ink bleeds through it.
        vec3 dark = photo(px) * (1.0 - 0.45 * rim * step(0.0, d));
        outColor = paint(px, h, dark);
      }`,
  });

  seam.onChange(() => strip.render());
  strip.render();
}
