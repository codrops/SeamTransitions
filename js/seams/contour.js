// 05 Contour
//
// The photograph is surveyed as the page comes up over it. From the edge
// up, it gives way to a contour map of itself, drawn on the white page in
// lines of its own colours deepened with ink, every fifth line heavier, as
// on a survey drawing. The map floods up into the photograph like rising
// water, through its dark places first, with a heavy line at the
// waterline; below the edge it runs on into the page and fades out. While
// the page scrolls the contours flow, each line sliding on towards the
// next; when it stops, they hold. Scroll back and the water drains away
// until the photograph is whole again.
//
// It stays in the empty space around the seam: the map reaches no higher
// than just below the hero's last line of text, and no lower than just
// above the white page's first.

import Strip from '../gl/Strip.js';

export default function contour(seam) {
  const { room } = seam;
  const ink = gsap.utils.splitColor(getComputedStyle(document.documentElement).getPropertyValue('--ink').trim());

  const strip = new Strip(seam, {
    above: room.up,
    below: () => Math.min(room.down(), 220),
    uniforms: { uInk: ink.map((c) => c / 255) },
    dpr: 2,
    fragment: /* glsl */ `
      uniform vec3 uInk; // the page's text colour

      const float LINES = 10.0; // contours across the photograph's range of tones
      const float FLOW = 240.0; // px the seam travels while each contour slides on to the next

      // The photograph's broad tones, from a small mipmap level, so the
      // contours follow its shapes rather than its grain.
      vec3 broad(vec2 px) {
        vec2 uv = clamp((px - uHeroBox.xy) / uHeroBox.zw, 0.0, 1.0);
        return textureLod(uHero, uv, 3.5).rgb;
      }

      void main() {
        vec2 px = vPx;
        float d = px.y - uEdge; // below the edge, positive
        float below = uSize.y - uEdge; // the room below it
        vec3 colour = broad(px);
        float tone = dot(colour, vec3(0.299, 0.587, 0.114));
        colour *= 1.0 - veil(px.y); // drawn under the hero's veil, as the page draws it

        // Where the map is. Above the edge: wherever the water has risen
        // to, up from the edge and into the dark places first. Below it:
        // down to a ragged depth that grows with it.
        float level = uProgress * 1.4 - 0.25;
        float shore = -d / uEdge + 0.35 * (tone - 0.5) + 0.1 * (fbm(px / 120.0) - 0.5);
        float depth = uProgress * 1.6 * below * (0.7 + 0.6 * fbm(vec2(px.x / 140.0, 3.0)));

        // The ground the contours are drawn on: the photograph's tones,
        // roughened a little so the lines wander like real ones. Below the
        // edge, where the photograph runs out, its last tones carry on with
        // more and more hills and hollows of noise.
        float fade = clamp(d / below, 0.0, 1.0);
        float ground = tone + (fbm(px / 200.0 + 4.0) - 0.5) * fade + (fbm(px / 70.0) - 0.5) * 0.12;

        // The contours, every 1/LINES of the ground's range, flowing on as
        // the seam travels; every fifth heavier. Measured in px (fwidth), so
        // the lines keep one weight however steep the ground; measured
        // before any pixel leaves, as fwidth needs its neighbours.
        float g = ground * LINES + uTravel / FLOW;
        float dist = abs(fract(g + 0.5) - 0.5) / fwidth(g);
        float waterline = (level - shore) / fwidth(shore);
        if (d < 0.0 ? shore >= level : d >= depth) {
          outColor = vec4(0.0);
          return;
        }
        float weight = mod(floor(g + 0.5), 5.0) == 0.0 ? 1.1 : 0.45;
        float line = 1.0 - smoothstep(weight - 0.5, weight + 0.5, dist);

        // The waterline, heaviest.
        if (d < 0.0) line = max(line, 1.0 - smoothstep(1.2, 2.2, waterline));

        // Lines in the photograph's colour deepened with ink, thinning out
        // into the page towards wherever the map ends, so it never ends in
        // a line, on white (over the page, its own white).
        float thin = clamp(d / min(below, depth), 0.0, 1.0);
        line *= 1.0 - thin * thin;
        outColor = vec4(mix(uPaper, mix(colour, uInk, 0.5), line), 1.0);
      }`,
  });

  seam.onChange(() => strip.render());
  strip.render();
}
