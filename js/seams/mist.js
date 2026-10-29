// 07 Mist
//
// The white page rises into the hero's sky as cloud. As the seam comes up
// the screen, the edge softens into a bank of mist, white where it meets
// the page, and wisps of it climb into the sky in three layers, the
// nearer ones larger and faster, the farther ones finer, curling as they
// go. It starts as a faint haze and builds slowly: the higher the seam,
// the higher and thicker the mist. It drifts up only while the page
// scrolls; when it stops, the mist hangs where it is. Scroll back to the
// top and it clears, leaving the plain edge.
//
// It stays in the empty space around the seam: the mist thins out to
// nothing before the hero's last line of text.

import Strip from '../gl/Strip.js';

export default function mist(seam) {
  const strip = new Strip(seam, {
    above: seam.room.up,
    below: () => 2, // the page's own white, so no sliver of the edge shows under the mist
    dpr: 2, // the canvas's pixels on the page's, so that white doesn't blur up into the hero
    fragment: /* glsl */ `
      void main() {
        // Before the page moves, the plain edge.
        if (uProgress <= 0.0) {
          outColor = vec4(0.0);
          return;
        }
        vec2 px = vPx;
        float h = (uEdge - px.y) / uEdge; // up from the edge, 0 to 1

        // How far the mist has come: from a faint haze along the edge as
        // the page starts to move to its full height most of the way up,
        // slowly at first.
        float rise = smoothstep(0.0, 0.85, uProgress);

        // Three layers of fog, each a noise field folded into itself so
        // it curls, rising (and drifting a little sideways) as the seam
        // travels, the nearer layers larger and faster. Each reaches
        // higher as the mist rises, and is thickest at the edge.
        float clear = 1.0;
        for (int i = 0; i < 3; i++) {
          float layer = float(i);
          float size = 260.0 - layer * 70.0;
          vec2 q = (px + vec2(0.15, 0.6) * uTravel * (1.0 - layer * 0.3)) / size + layer * 13.1;
          vec2 fold = vec2(fbm(q), fbm(q + vec2(5.2, 1.3)));
          float wisp = fbm(q + 1.6 * fold);
          float reach = rise * 1.4 - 0.25 - h * (1.1 + layer * 0.35);
          float fog = smoothstep(0.0, 0.45, wisp + reach - 0.3) * (1.0 - layer * 0.25);
          clear *= 1.0 - fog;
        }

        // Thinning out to nothing at the box's top, and nothing at all
        // before the seam has moved.
        float wisps = (1.0 - clear) * smoothstep(1.0, 0.7, h) * smoothstep(0.0, 0.04, uProgress);

        // Under the wisps, a bank of fog lying along the edge, solid white
        // where it meets the page and thinning upwards, its height
        // wandering, so mist and page are one with no line between them.
        // It grows with the mist, from nothing.
        float bank = (20.0 + 70.0 * fbm(vec2(px.x / 180.0 + uTravel / 900.0, 2.0))) * sqrt(rise);
        float ground = 1.0 - smoothstep(0.0, max(bank, 0.001), uEdge - px.y);
        float a = 1.0 - (1.0 - wisps) * (1.0 - ground);
        if (px.y >= uEdge) a = 1.0; // below the edge, the page's own white
        outColor = vec4(uPaper * a, a);
      }`,
  });

  seam.onChange(() => strip.render());
  strip.render();
}
