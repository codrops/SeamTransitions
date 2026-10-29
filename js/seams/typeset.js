// 04 Typeset
//
// Where the photograph meets the page of text, it turns into type. As the
// seam comes up the screen, the photograph is set cell by cell in the
// page's own typeface, from a few rows down in the white page up into its
// bottom, the frontier scattered: each character is picked for how dark
// the photograph is there (dense where it's dark, sparse where it's light)
// and takes its colour, thinning out towards the page. While the page
// scrolls the characters scramble, more of them the faster it goes; when
// it stops they settle back into the picture. Scroll back to the top and
// the photograph is whole again.
//
// It stays in the empty space around the seam: the rows of type stop short
// of the hero's last line of text and of the white page's first.

import Strip from '../gl/Strip.js';

const CHARACTERS = ' .:-=+*#%@'; // lightest to densest
const BELOW = 4; // rows of type below the edge, at most

export default function typeset(seam) {
  const { room } = seam;

  // The characters, side by side in one texture, each in a cell the size
  // the page sets them at.
  const glyphs = document.createElement('canvas');
  const type = { size: 0, cell: [0, 0], rows: 0, below: 0 };
  const layout = () => {
    const size = Math.round(gsap.utils.clamp(10, 14, innerWidth / 100));
    const g = glyphs.getContext('2d');
    g.font = `${size}px 'Kode Mono'`;
    const cell = [g.measureText('M').width, Math.round(size * 1.3)];
    type.rows = Math.min(16, Math.floor(room.up() / cell[1]));
    type.below = Math.min(BELOW, Math.floor(room.down() / cell[1]));
    if (size === type.size) return;
    type.size = size;
    type.cell = cell;

    const scale = 2;
    const slot = Math.round(cell[0] * scale);
    glyphs.width = slot * CHARACTERS.length;
    glyphs.height = cell[1] * scale;
    g.font = `${size * scale}px 'Kode Mono'`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#fff';
    [...CHARACTERS].forEach((character, i) => g.fillText(character, (i + 0.5) * slot, glyphs.height / 2));
  };

  const strip = new Strip(seam, {
    above: () => (layout(), type.rows * type.cell[1]),
    below: () => type.below * type.cell[1],
    textures: { uType: () => glyphs },
    uniforms: {
      uGlyphs: CHARACTERS.length,
      uInk: gsap.utils.splitColor(getComputedStyle(document.documentElement).getPropertyValue('--ink').trim()).map((c) => c / 255),
    },
    dpr: 2,
    fragment: /* glsl */ `
      uniform vec2 uCell; // a character's cell, px
      uniform float uRows; // rows of type above the edge
      uniform float uBelow; // rows below it
      uniform float uGlyphs; // characters in uType
      uniform sampler2D uType;
      uniform vec3 uInk; // the page's text colour

      void main() {
        vec2 px = vPx;
        // Cells counted from the edge: row 0 is just above it, -1 just below.
        float col = floor(px.x / uCell.x);
        float row = floor((uEdge - px.y) / uCell.y);
        vec2 cell = vec2(col, row);
        vec2 inCell = vec2(fract(px.x / uCell.x), 1.0 - fract((uEdge - px.y) / uCell.y));
        vec3 under = photo(vec2((col + 0.5) * uCell.x, uEdge - (row + 0.5) * uCell.y));

        // How many rows, up from the lowest, are type: more as the seam
        // comes up, all of them by two thirds of the way, the frontier
        // breaking up into clumps a few rows either way.
        float depth = row + uBelow;
        float reach = uProgress * (uRows + uBelow) * 1.5 + (noise(cell * vec2(0.35, 0.6) + 3.0) - 0.5) * 8.0 * smoothstep(0.0, 0.05, uProgress);
        if (depth >= reach) {
          outColor = vec4(0.0);
          return;
        }

        // The character: as dense as the photograph is dark, give or take
        // one step so even areas don't set as one character over and over,
        // and thinning out towards the page, where more and more cells are
        // left blank. While the page moves, some are swapped for random
        // ones, picked again every few px it travels.
        float dark = smoothstep(0.1, 0.6, 1.0 - dot(under, vec3(0.299, 0.587, 0.114))); // stretched, so light photographs set dense type too
        float thin = clamp((depth + 1.0) / (uBelow + 3.0), 0.0, 1.0);
        float level = clamp(dark + (hash(cell + 9.1) - 0.5) / (uGlyphs - 1.0), 0.0, 1.0);
        float glyph = hash(cell + 4.3) < thin ? floor(level * (uGlyphs - 1.0) + 0.5) : 0.0;
        float beat = floor(uTravel / 5.0);
        if (hash(cell + beat * 0.37) < min(abs(uVelocity) / 2500.0, 0.8)) glyph = floor(hash(cell * 1.7 + beat) * uGlyphs);

        // Each character shows the photograph through it, deepened a
        // little towards the text's colour, on white (over the page, its
        // own white).
        float a = texture(uType, vec2((glyph + inCell.x) / uGlyphs, inCell.y)).a;
        outColor = vec4(mix(uPaper, mix(photo(px), uInk, 0.5), a), 1.0);
      }`,
  });

  const render = () => {
    strip.set({ uCell: type.cell, uRows: type.rows, uBelow: type.below });
    strip.render();
  };
  seam.onChange(render);
  addEventListener('resize', render);
  render();
}
