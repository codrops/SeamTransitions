# AGENTS.md

Notes for coding agents working on this repo. Read [README.md](README.md) first for what the demo is.

## Setup

- There is no build step, no package.json and nothing to install. Plain HTML, CSS and ES modules.
- Serve the root with any static server (`npx serve .` or `python3 -m http.server`). ES modules don't load from `file://`.
- GSAP 3.15 and its plugins (ScrollTrigger, ScrollSmoother, SplitText, Physics2DPlugin) are vendored in `js/` and loaded as classic scripts before the module, so they're globals. Don't import them. Physics2DPlugin is loaded only on `index2.html`, `index10.html` and `index11.html` and registered in `crumble.js`, `sediment.js` and `shavings.js`, the seams that use it.
- There are no automated tests. Check a change in a browser: scroll the seam up past the top of the screen and back, slowly and fast, and look at the console. Most seams react to speed, so also flick the wheel and stop.

## Map

| Path                       | What it is                                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `index.html`, `index2.html` … `index11.html` | One page per variation (01 is `index.html`). Same markup; they differ in `data-seam`, the nav, the hero photograph (`img/hero-<seam>.jpg`) and the studio. Each is the home page of a studio whose work its seam acts out, with its own copy and project photographs: 01 Canopy (forest regrowing), 02 Vidrado (Lisbon tile restoration), 03 Manta (a blanket mill), 04 Stacks (a library, its photograph set in a Whitman poem), 05 Socalco (Douro terraces that follow the contours), 06 Ebru (a marbling atelier), 07 Bruma (water caught from fog), 08 Mend 金 (kintsugi; the character is set in Zen Kaku Gothic New, loaded for it alone on that page, sized and raised to sit with the capitals), 09 Soak (streets that let rain soak in where trees drink it), 10 Baldio (a village campaign to keep its common hill from a lithium mine; every name in it is fictional), 11 Grain (a furniture workshop). 02, 10 and 11 load Physics2DPlugin. |
| `js/index.js`              | Smooth scrolling, the introduction's line-by-line reveal (SplitText), the latest work's marquee (clones the six `li`s and adds `.projects--marquee`; reduced motion keeps the still grid), the seam's travel, progress, speed and room, the registry of seams by name (each loaded with `import()` only on its page). |
| `js/seams/*.js`            | One seam per file.                                                                                          |
| `js/gl/Strip.js`           | The WebGL 2 canvas the shader seams draw on: sizing, the hero photograph as a texture, uniforms.            |
| `js/gl/glsl.js`            | GLSL every shader starts with: the shared uniforms, noise, `photo()` and `paint()`.                         |
| `css/base.css`             | All styles: the frame (over the hero, scrolling away with it), the studio page and the seam box.            |
| `img/`                     | Each page's hero (`hero-<seam>.jpg`, 1376×768, light daylight photographs) and each studio's six projects (`<studio>-1…6.jpg`, 896×1200, shown 4:5: `canopy`, `vidrado`, `manta`, `stacks`, `socalco`, `ebru`, `bruma`, `mend`, `soak`, `baldio`, `grain`). All generated for the demo. |
| `og-image.jpg`             | The social preview (1200×630) every page's Open Graph and Twitter tags point to: 01 Ink mid-scroll.          |

## The seam contract

```js
export default function name(seam) {
  // seam.el        the .seam box straddling the hero's bottom edge (empty, pointer-events: none)
  // seam.hero, seam.img, seam.next   the hero, its photograph, the white page
  // seam.photo     box(), bleed(px), colours(top, height, cols, rows): for seams that draw the photograph themselves
  // seam.veil      the darkening over the photograph (see below); veil.at(t), veil.gradient(ctx, top, height)
  // seam.travel    how far the hero's edge has come up from the bottom of the screen, px (carries on past the top)
  // seam.progress  the same, 0 with the seam at the bottom of the screen to 1 at the top
  // seam.velocity  the page's smoothed speed, px/s, positive going down
  // seam.inView    whether any of the seam's box is on the screen
  // seam.room.up(), seam.room.down()   the empty space either side of the edge, px (see below)
  // seam.onChange(fn)  called when they change while any of the seam's box is on the screen
  // seam.onSplit(fn)   called when the introduction is split again (its width changed), for seams that use its letters
}
```

A seam module may also `export const letters = true`: `index.js` loads it first and then splits the introduction (and its label) into letters as well as lines (`.next__char`). Only Roots does, so the other pages keep the plain line split. It may also `export const fonts`, fonts it draws in that the page doesn't show (as `document.fonts.load()` strings): `index.js` loads them before starting it. Only Typeset does (Kode Mono), and only its page links that font.

- **At progress 0 a seam must draw nothing at all** (return transparent): the seam sits at the bottom of the screen as the page opens, and even a softened edge shows as a line there. Check it by comparing the hero's bottom rows with the canvas shown and hidden.
- **A seam never draws over text.** Size its box from `seam.room`: up to 32px short of the hero's lowest text (the name, or the note under it on phones), down to 32px short of the white page's first text (`.next__intro`). The one exception is Roots, which reaches down to the first line's capitals and touches them by design, draining the letters it touches (see below).
- A seam may throw when it can't run (`Strip` throws without WebGL 2); `js/index.js` catches it and the edge stays plain. No seam loads for reduced motion.
- The page opens (`index.js` removes `.loading`) only once the seam has started, so a seam may change the hero's layout as it starts (`bleed` makes the photograph's box taller) without anything moving in view. Do that work when the seam starts, not later.
- **Every seam is scroll-driven, and is still soon after the page stops.** Most redraw from `onChange` only. Crumble's falling squares, Sediment's grains, Shavings' coils and Fray's swaying fringe run on time after the page stops, then settle within about a second. Anything that should keep moving until the seam is off the screen follows `travel` (`uTravel`), not `progress`, which stops at 1 while the box below the edge is still in view.
- **Where a seam meets the page's own edge, paint 2px past it** (in the page's colour on that side): the canvas and the page are composited separately and can be a device pixel apart mid-scroll, which shows as a hairline. Crumble's and Shavings' holes, Fray's white over the frayed hem, the opaque white of Typeset, Contour, Marble and Craquelure, Sediment's bottom row of holes, and the 2px of white below the edge that Mist paints do this; Roots start 2px inside the hero; for Ink, `paint()` paints a band along the edge outright.

## Shader seams (`Strip`: Ink, Fray, Typeset, Contour, Marble, Mist, Craquelure)

- **`new Strip(seam, { above, below, fragment, uniforms, textures, bleed, dpr })`.** `above` and `below` are functions returning px, read again on every resize; `Strip` sets them as `--above` and `--below` on `seam.el`, which size the box. `uniforms` are the seam's own (numbers, or arrays of 2–4), changed with `strip.set()` before `strip.render()`. `textures` maps sampler names to functions returning an image or canvas, uploaded again on every resize (Typeset's characters). `bleed` makes the photograph's box reach below the hero by `below` (`--bleed` on the hero, cropped by it), so the picture continues under the page and `photo()` below the edge is the rest of it (Ink). `dpr` caps the canvas's pixel ratio (1.5 by default; seams with fine type or lines use 2).
- **Space.** CSS px, y down from the canvas's top. `uEdge` is where the hero ends. `photo(px)` samples the hero's photograph exactly as the page draws it: cover, under the hero's veil, repeating its last row below it (or, with `bleed`, carrying on into the rest of the picture). The veil is a dark gradient over the photograph so the white type reads; its numbers are CSS custom properties on `.hero` (`--veil-top`, `--veil-mid`, `--veil-stop`, `--veil-bottom`), which `index.js` reads into `seam.veil` and `Strip` passes as `uVeil`. Change them only in the CSS. Don't filter `.hero__img` or lay anything else over it without doing the same in `photo()`, or the seams won't match it.
- **Paint only the difference.** When the photograph itself doesn't move, work out `h`, how much of each pixel belongs to the photograph, and return `paint(px, h, photo(px))`: it paints white over the hero where the seam cuts up, the photograph over the page where it reaches down, and nothing elsewhere. Within a pixel of the edge it paints outright, because the scaled canvas and the moving page never line up exactly. Seams that move or replace the photograph (Typeset, Contour, Marble, Craquelure) paint where they've reached outright, and nothing at all at progress 0.
- **GLSL ES 3.00** (WebGL 2): `fwidth`, `tanh` and `gl_VertexID` are available.

## Crumble (2D canvas)

- It sets `--above` and `--below` itself and draws only the difference too: white (`--paper`) holes where squares have gone, and the squares in the air, each its own piece of the photograph (`drawImage` from `seam.photo.box()`) darkened by the veil at its height.
- Holes are snapped to the canvas's pixels so neighbours meet exactly, and along the edge they reach 2px into the page, so no line of the section shows under them. Keep the canvas at the device's pixel ratio (up to 2): a scaled canvas blurs that edge.
- Each falling square has a paused timeline (Physics2DPlugin arc, spin, fade): `play()` when `travel` passes its `at`, `timeScale(2).reverse()` when it comes back. The `at`s are spread over `innerHeight + below`, the scroll until the box's bottom leaves the top of the screen, so squares keep breaking off while any of it is in view (Sediment's grains likewise). Physics2DPlugin works the arc out from the tween's time, so it reverses exactly.
- The squares are laid out again only when the width or the room changes, so a phone's address bar showing and hiding doesn't reshuffle them.

## Fray (shader) and Shavings (2D canvas)

- Fray draws warp threads every `PITCH` px. How much weft is pulled out comes from `travel / (innerHeight + below)` (`uScreen` is the window's height), a `ROW` at a time, a row or two more or less per thread (`freed()`), up to `UP` px of the hem. Each freed thread hangs from there down past the hem by `DROOP` of what's freed, crimped, tapering at its tip, coloured from the photograph just above the hem (`yarn()`, a blurred mip level under the veil). Over the frayed hem (and 2px past the edge) it paints white between the threads; below, only the threads. The pixel's thread is found among its seven nearest, since swaying threads cross their neighbours. The sway is a spring on GSAP's ticker (`FLUTTER`, `STIFF`, `DAMP`), pushed by the page's speed while `seam.inView`; it renders once a frame when the seam or the sway changes.
- Shavings cuts the photograph's bottom `ROWS` rows (`THICK` px each) into strokes of random lengths. Each has a paused timeline: `peel` (the curl grows from where it leaves the plank, its free end tightest, flattened by `SQUASH` so it reads as a coil lying on its side), then a Physics2DPlugin fall and spin onto a pile of 24px bins, landed by its furthest reach from its centre so it never leaves the box. It's drawn as `STEP`-px slices of the photograph turned along the curl, narrower where the ribbon turns edge-on and darker where it faces away. The `at`s are spread like Crumble's; holes are snapped to device pixels, the bottom row reaching 2px into the page.

## Typeset and Contour

- Typeset sets `POEM` (verse lines of Whitman's "Song of the Open Road", public domain; keep them exactly as printed) in capitals as one `TEXT`. `CHARACTERS` is every character it uses, drawn in Kode Mono (monospaced, so it sets in cells; declared in `fonts`) into the `uType` texture, one cell each; `uText` holds the poem, one texel per character (its place in `uType`, red channel, read with `texelFetch`). Each cell's reading index, `(uRows - 1 - row) * uCols + col`, picks its character, so the poem reads left to right and down from the top row, starting again when it runs out. The letters take the photograph's colour; while the page moves, some are swapped for random ones, picked again every 32px. Rows are sized from `seam.room`.
- Contour's field is the photograph's tone from a blurred mipmap level (`textureLod`, level 3.5), roughened with noise; below the edge the last tones carry on with growing noise. Lines are measured in px with `fwidth`, so they keep one weight, before any pixel returns early (derivatives next to a pixel that has returned are undefined, and show as a dashed line along the map's end); below the edge they thin out to nothing towards wherever the map currently ends, so it never ends in a line; `LINES` and `FLOW` in the shader set their spacing and how fast they flow with `uTravel`. It's coloured as a survey sheet: `BROWN` contours, `INDEX` for every fifth and the waterline. Spot heights are drawn on a 2D canvas over the map (`place()` picks a few points, their heights from the photograph's tone via `seam.photo.colours`; `mark()` shows each once the map has reached it, from the same `level` and `depth` the shader uses).

## Marble, Mist, Craquelure, Roots, Sediment

- Marble works backwards: for each pixel it undoes a fine comb across, a wide comb along and a noise warp to find where its colour came from, then reads the floated bands (photograph, alternating stripes, page) there. The combs' phases follow `uTravel`; their spacing and depth wander with smooth noise (`wander`, `swell`, `feather`), as strokes drawn by hand rather than a regular comb.
- Mist is three layers of folded noise (`fbm` of `fbm`), alpha-blended white over the hero, each reaching higher as the mist rises (`rise`, eased from `uProgress` so it builds slowly from a faint haze) and drifting up with `uTravel`, over a bank of fog that's solid white at the edge and thins upwards. The bank is what keeps a line from showing where the mist meets the page: keep it whenever the wisps change.
- Craquelure finds each pixel's plate with Voronoi (nearest point, then the exact distance to the plate's border), sampled at a noise-shifted position so the cracks wander. Each plate's dryness, from its centre's height and `uProgress`, sets the crack width, the plate's shrink and turn. The piece size is `CELL` at the top of `craquelure.js`; the crack width and the cracks' wander scale with it, up to `GAP`, the widest a crack opens (past it, pieces shrink and turn less, so big pieces hold together; small ones still shrink away to nothing). Each piece's broken edge (`border` near `crack`) is drawn as a gold line, only once its crack has opened.
- Roots are grown in JS once per width and room (and again when the introduction is split again), each root system coloured from the photograph's bottom where it starts (`seam.photo.colours`), a little deeper (a random walk pulled downwards, branching, `STEP` px apart; the branching and wandering chances are per point, so `STEP` also sets how branchy and wiggly they are). Unlike the other seams, Roots reaches the text: its box runs down to the capitals of the introduction's first line, measured per letter (`.next__char`) from where the page lays the lines out (`offsetTop`), since SplitText holds them below their masks until the reveal. From halfway down each root is drawn towards the nearest letter's centre, grows slower and branches more, and stops at the letters' tops (`floor()`); nothing is ever drawn into them. A tip that lands on a letter records a sip: the letter, when in the growth, and its trail of points back up to the tree. Each touched letter has a paused tween (`DRAIN` s, played or reversed as the seam passes its first touch) that sets `--level` and `.next__char--drunk` (CSS: a `background-clip: text` gradient from pale to ink); after that, `draw()` sets `--dry` from 0 to 1 over the rest of the growth, so the drained part keeps paling, from 45% of the ink to 12%, until the roots scroll off, and the drunk ink climbs each trail as a tapering drop over `CLIMB` of the growth. Hairs (the root's colour, paler, at `root + 1`) sprout along thin ends `LAG` behind the tip. Last, over the growth's final `NETWORK` share, a thread or two bridges each root system to its neighbour where they come closest. Each piece has an `at`, when in the growth it appears; they're sorted by colour and weight and drawn as one path per weight, up to `travel / (innerHeight + box height)` of the growth, so they keep growing until they've scrolled off the top.
- Sediment is Crumble's machinery with grains: the photograph's bottom `ROWS` rows cut into `GRAIN`-px grains, each coloured from the photograph (drawn the way the page draws it, alternate rows a touch lighter or darker so layers show). They come loose in arches around a few leak points, each with its own opening time, pace and reach (distance measured 1.6× vertically, so arches are wider than tall; a random rim, so they're ragged); grains outside every arch never fall, so the edge ends scalloped. Loose grains are drawn slightly jittered and resized, so they read as sand, and slopes settle at one or two grains' steepness at random. Where each lands is worked out once, in order: it falls (Physics2DPlugin) onto the mound under it, then slides down to where it's no more than a grain or two above its neighbours, so the first to fall lie lowest. The pile rests on the floor of `seam.room.down()`.

## Adding a variation

1. Write `js/seams/<name>.js`, then add `<name>: () => import('./seams/<name>.js')` to `seams` in `js/index.js`. Don't import seams statically.
2. Copy a page to `index<N>.html` and change `data-seam`, the `demo-<N>` body class, the `Demo <N>` title (also in `og:title` and `twitter:title`), the canonical and `og:url` addresses, the hero photograph and its alt text, and the meta description and keywords (below).
3. Add the link to the `.frame__demos` nav on **every** page, and widen its `grid-template-columns` in `css/base.css`. The current page's entry is a `<span class="frame__demo frame__demo--current">`, not a link.
4. Give the page its studio: the name and the line beside it in the hero, the introduction and label, six project photographs (`img/<studio>-1…6.jpg`) with captions and alt text, the footer's email and section name. Add it to the studio list in this file's map.

## Meta

- Each page's meta description says what its own seam does on screen, then what it's built with (about 160 characters), and is repeated in `og:description` and `twitter:description`; its keywords name the seam's own effect, then the shared ones. Rewrite them whenever a seam changes.
- The canonical and `og:url` addresses are where the demo lives (`https://tympanus.net/Demos/SeamTransitions/`, plus `index<N>.html` from 02 on). The analytics and sponsor scripts stay commented out in the repo; they're switched on on the live server.

## Style

- Two-space indentation, single quotes, semicolons, trailing commas. Follow what's in the file.
- Every seam opens with a comment saying what it looks like, in plain words, including what scrolling back does. Other comments say why, not what.
- No dependencies and no build tooling unless asked.

## Ask before changing

- The pages' `<title>` pattern, the `frame__title` heading and the tags. They're kept the same on every page.
- The GitHub link, the photographs and the credits (the "Inspired by" line in each page's footer and the README's Inspiration and Credits). There's no article.
- The frame's layout: the title, links and tags along the top, and on the right the slot Codrops' sponsor script fills on the live site (`#cdawrap`, grid area `sponsor`; keep it free); the variations under the title in a white box, so they can't be missed. The credits sit in the footer, in the middle (`.next__credits`), so nothing sits low in the hero, where the seams work. A small "Scroll" cue sits at the bottom of every hero, in the middle; `index.js` fades it out over the first 30px of scroll, before the seam reaches it.
