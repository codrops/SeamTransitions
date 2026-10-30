// 05 Contour
//
// The photograph is surveyed as the page comes up over it. From the edge
// up, it gives way to a contour map of itself, drawn on the white page as
// on a survey sheet: brown contours, every fifth one heavier and darker,
// with spot heights marked here and there as the map reaches them. The
// map floods up into the photograph like rising water, through its dark
// places first, with a heavy line at the waterline; below the edge it runs
// on into the page and fades out. While
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

  const strip = new Strip(seam, {
    above: room.up,
    below: () => Math.min(room.down(), 220),
    dpr: 2,
    fragment: /* glsl */ `
      const vec3 BROWN = vec3(0.62, 0.43, 0.27); // a survey map's contours
      const vec3 INDEX = vec3(0.42, 0.27, 0.15); // every fifth one, and the waterline
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
        float tone = dot(broad(px), vec3(0.299, 0.587, 0.114));

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
        float index = mod(floor(g + 0.5), 5.0) == 0.0 ? 1.0 : 0.0;
        float weight = mix(0.45, 1.1, index);
        float line = 1.0 - smoothstep(weight - 0.5, weight + 0.5, dist);

        // The waterline, heaviest.
        float shoreline = d < 0.0 ? 1.0 - smoothstep(1.2, 2.2, waterline) : 0.0;
        index = max(index, shoreline);
        line = max(line, shoreline);

        // Survey colours: the contours in brown, every fifth one and the
        // waterline darker, thinning out into the page towards wherever the
        // map ends, so it never ends in a line, on white (over the page, its
        // own white).
        float thin = clamp(d / min(below, depth), 0.0, 1.0);
        line *= 1.0 - thin * thin;
        outColor = vec4(mix(uPaper, mix(BROWN, INDEX, index), line), 1.0);
      }`,
  });

  // Spot heights, as a survey sheet marks them: a dot and the height in
  // metres at a few points, in the map's brown, on a canvas over the map.
  // A height follows the photograph's tone where it stands (the brighter,
  // the higher, from 120 to 480 m; below the edge, its bottom row's, give or
  // take), and shows once the map has reached it, never before the page
  // moves.
  const marks = document.createElement('canvas');
  marks.style.cssText = 'position: absolute; inset: 0; width: 100%; height: 100%;';
  seam.el.append(marks);
  const pen = marks.getContext('2d');
  let spots = [];
  let dpr = 1;

  const place = () => {
    const width = seam.el.clientWidth;
    const height = seam.el.clientHeight;
    const above = Math.round(room.up());
    dpr = Math.min(2, devicePixelRatio || 1);
    marks.width = Math.round(width * dpr);
    marks.height = Math.round(height * dpr);
    const tones = seam.photo.colours(seam.hero.offsetHeight - above, above, 24, 8);
    const tone = (col, row) => tones(col, row).reduce((sum, c) => sum + c, 0) / 765;
    spots = [];
    for (let x = gsap.utils.random(60, 160); x < width - 60; x += gsap.utils.random(180, 300)) {
      const y = gsap.utils.random(
        above * 0.4,
        Math.min(height - 40, above + (height - above) * 0.6),
      );
      const col = Math.min(23, Math.floor((x / width) * 24));
      const light = y < above ? tone(col, Math.floor((y / above) * 8)) : tone(col, 7);
      const metres = 120 + 360 * light + (y < above ? 0 : gsap.utils.random(-20, 20));
      spots.push({ x, y, height: Math.round(gsap.utils.clamp(120, 480, metres)) });
    }
  };

  const mark = () => {
    const above = Math.round(room.up());
    const below = seam.el.clientHeight - above;
    const level = seam.progress * 1.4 - 0.25;
    pen.setTransform(1, 0, 0, 1, 0, 0);
    pen.clearRect(0, 0, marks.width, marks.height);
    pen.setTransform(dpr, 0, 0, dpr, 0, 0);
    pen.font = "500 10px 'Plus Jakarta Sans'";
    pen.textBaseline = 'middle';
    for (const { x, y, height } of spots) {
      // How far the map has come past the spot: up from the edge, its
      // waterline; down from it, its least depth (a little later than the
      // lines, never before them).
      const past =
        y < above
          ? (level - (above - y) / above - 0.05) / 0.08
          : (seam.progress * 1.6 * below * 0.7 - (y - above) - 8) / 20;
      const shown = gsap.utils.clamp(0, 1, past);
      if (!shown) continue;
      pen.globalAlpha = shown;
      pen.fillStyle = 'rgb(107, 69, 38)';
      pen.beginPath();
      pen.arc(x, y, 1.6, 0, Math.PI * 2);
      pen.fill();
      pen.fillText(String(height), x + 5, y);
    }
    pen.globalAlpha = 1;
  };

  const render = () => {
    strip.render();
    mark();
  };
  place();
  addEventListener('resize', () => (place(), mark()));
  seam.onChange(render);
  render();
}
