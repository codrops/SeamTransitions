// 04 Typeset
//
// Where the photograph meets the page of text, it turns into type: Walt
// Whitman's "Song of the Open Road", set cell by cell in a monospaced
// typeface, in reading order. As the seam comes up the screen, the type
// climbs from a row down in the white page up into the photograph's
// bottom, the frontier scattered; each letter takes the photograph's
// colour where it stands, so the picture is made of the poem, thinning out
// towards the page. While the page scrolls the letters
// scramble, more of them the faster it goes; when it stops they settle
// back into the poem. Scroll back to the top and the photograph is whole
// again.
//
// It stays in the empty space around the seam: the rows of type stop short
// of the hero's last line of text and of the white page's first.

import Strip from '../gl/Strip.js';

// "Song of the Open Road", sections 1 and 3 and the start of 5, as printed
// in the 1891–92 Leaves of Grass (public domain), one verse line each.
const POEM = [
  'Afoot and light-hearted I take to the open road,',
  'Healthy, free, the world before me,',
  'The long brown path before me leading wherever I choose.',
  'Henceforth I ask not good-fortune, I myself am good-fortune,',
  'Henceforth I whimper no more, postpone no more, need nothing,',
  'Done with indoor complaints, libraries, querulous criticisms,',
  'Strong and content I travel the open road.',
  'The earth, that is sufficient,',
  'I do not want the constellations any nearer,',
  'I know they are very well where they are,',
  'I know they suffice for those who belong to them.',
  '(Still here I carry my old delicious burdens,',
  'I carry them, men and women, I carry them with me wherever I go,',
  'I swear it is impossible for me to get rid of them,',
  'I am fill’d with them, and I will fill them in return.)',
  'You air that serves me with breath to speak!',
  'You objects that call from diffusion my meanings and give them shape!',
  'You light that wraps me and all things in delicate equable showers!',
  'You paths worn in the irregular hollows by the roadsides!',
  'I believe you are latent with unseen existences, you are so dear to me.',
  'You flagg’d walks of the cities! you strong curbs at the edges!',
  'You ferries! you planks and posts of wharves! you timber-lined side! you distant ships!',
  'You rows of houses! you window-pierc’d facades! you roofs!',
  'You porches and entrances! you copings and iron guards!',
  'You windows whose transparent shells might expose so much!',
  'You doors and ascending steps! you arches!',
  'You gray stones of interminable pavements! you trodden crossings!',
  'From all that has touch’d you I believe you have imparted to yourselves, and now would impart the same secretly to me,',
  'From the living and the dead you have peopled your impassive surfaces, and the spirits thereof would be evident and amicable with me.',
  'From this hour I ordain myself loos’d of limits and imaginary lines,',
  'Going where I list, my own master total and absolute,',
  'Listening to others, considering well what they say,',
  'Pausing, searching, receiving, contemplating,',
  'Gently, but with undeniable will, divesting myself of the holds that would hold me.',
  'I inhale great draughts of space,',
  'The east and the west are mine, and the north and the south are mine.',
  'I am larger, better than I thought,',
  'I did not know I held so much goodness.',
];
// As the page sets it, in capitals, with a space before it starts again
const TEXT = `${POEM.join(' ')} `.toUpperCase().replaceAll('’', "'");
const CHARACTERS = [' ', ...new Set(TEXT.replaceAll(' ', ''))].join(''); // every one the poem uses, a space first
const BELOW = 1; // rows of type below the edge, at most

// The type is set in Kode Mono, monospaced so it fills its cells; index.js
// loads it before the seam starts, since the page itself doesn't show it.
export const fonts = ["1em 'Kode Mono'"];

export default function typeset(seam) {
  const { room } = seam;

  // The characters, side by side in one texture, each in a cell the size
  // the page sets them at; and the poem, one texel per character, its
  // character's place in that texture in the red channel.
  const glyphs = document.createElement('canvas');
  const text = document.createElement('canvas');
  text.width = TEXT.length;
  text.height = 1;
  const t = text.getContext('2d');
  const data = t.createImageData(TEXT.length, 1);
  [...TEXT].forEach((character, i) => {
    data.data[i * 4] = CHARACTERS.indexOf(character);
    data.data[i * 4 + 3] = 255;
  });
  t.putImageData(data, 0, 0);

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
    [...CHARACTERS].forEach((character, i) =>
      g.fillText(character, (i + 0.5) * slot, glyphs.height / 2),
    );
  };

  const strip = new Strip(seam, {
    above: () => (layout(), type.rows * type.cell[1]),
    below: () => type.below * type.cell[1],
    textures: { uType: () => glyphs, uText: () => text },
    uniforms: {
      uGlyphs: CHARACTERS.length,
      uLength: TEXT.length,
      uInk: gsap.utils
        .splitColor(getComputedStyle(document.documentElement).getPropertyValue('--ink').trim())
        .map((c) => c / 1255),
    },
    dpr: 2,
    fragment: /* glsl */ `
      uniform vec2 uCell; // a character's cell, px
      uniform float uRows; // rows of type above the edge
      uniform float uBelow; // rows below it
      uniform float uCols; // cells across
      uniform float uGlyphs; // characters in uType
      uniform sampler2D uType;
      uniform sampler2D uText; // the poem: each character's place in uType, in red
      uniform float uLength; // characters in the poem
      uniform vec3 uInk; // the page's text colour

      void main() {
        vec2 px = vPx;
        // Cells counted from the edge: row 0 is just above it, -1 just below.
        float col = floor(px.x / uCell.x);
        float row = floor((uEdge - px.y) / uCell.y);
        vec2 cell = vec2(col, row);
        vec2 inCell = vec2(fract(px.x / uCell.x), 1.0 - fract((uEdge - px.y) / uCell.y));

        // How many rows, up from the lowest, are type: more as the seam
        // comes up, all of them by two thirds of the way, the frontier
        // breaking up into clumps a few rows either way.
        float depth = row + uBelow;
        float reach = uProgress * (uRows + uBelow) * 1.5 + (noise(cell * vec2(0.35, 0.6) + 3.0) - 0.5) * 8.0 * smoothstep(0.0, 0.05, uProgress);
        if (depth >= reach) {
          outColor = vec4(0.0);
          return;
        }

        // The character: the poem's, in reading order, left to right and
        // down from the top row, starting again when it runs out. Towards
        // the page more and more cells are left blank, and while the page
        // moves some are swapped for random ones, more the faster it goes,
        // picked again every 32px it travels.
        float index = (uRows - 1.0 - row) * uCols + col;
        float glyph = floor(texelFetch(uText, ivec2(int(mod(index, uLength)), 0), 0).r * 255.0 + 0.5);
        float thin = clamp((depth + 1.0) / (uBelow + 3.0), 0.0, 1.0);
        float beat = floor(uTravel / 32.0);
        if (hash(cell + 4.3) >= thin) glyph = 0.0;
        if (hash(cell + beat * 0.37) < min(abs(uVelocity) / 4000.0, 0.6)) glyph = floor(hash(cell * 1.7 + beat) * uGlyphs);

        // Each character is the photograph's colour where it stands,
        // deepened a touch so the palest still read, on white (over the
        // page, its own white): dark where the picture is dark, faint where
        // it's light, so the picture shows through the poem.
        float a = texture(uType, vec2((glyph + inCell.x) / uGlyphs, inCell.y)).a;
        outColor = vec4(mix(uPaper, mix(photo(px), uInk, 0.15), a), 1.0);
      }`,
  });

  const render = () => {
    strip.set({
      uCell: type.cell,
      uRows: type.rows,
      uBelow: type.below,
      uCols: Math.ceil(seam.el.clientWidth / type.cell[0]),
    });
    strip.render();
  };
  seam.onChange(render);
  addEventListener('resize', render);
  render();
}
