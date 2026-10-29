# AGENTS.md

Notes for coding agents working on this repo. Read [README.md](README.md) first for what the demo is.

## Setup

- There is no build step, no package.json and nothing to install. Plain HTML, CSS and ES modules.
- Serve the root with any static server (`npx serve .` or `python3 -m http.server`). ES modules don't load from `file://`.
- GSAP 3.15 and its plugins (ScrollTrigger, ScrollSmoother, SplitText, Physics2DPlugin) are vendored in `js/` and loaded as classic scripts before the module, so they're globals. Don't import them. Physics2DPlugin is loaded only on `index2.html` and `index10.html` and registered in `crumble.js` and `sediment.js`, the seams that use it.
- There are no automated tests. Check a change in a browser: scroll the seam up past the top of the screen and back, slowly and fast, and look at the console. Most seams react to speed, so also flick the wheel and stop.

## Map

| Path                       | What it is                                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `index.html`, `index2.html` … `index10.html` | One page per variation (01 is `index.html`). Same markup; they differ in `data-seam`, the nav and the hero photograph (`img/hero-<seam>.jpg`), chosen so the seam reads as something happening in it. 02 and 10 load Physics2DPlugin. |
| `js/index.js`              | Smooth scrolling, the introduction's line-by-line reveal (SplitText), the latest work's marquee (clones the six `li`s and adds `.projects--marquee`; reduced motion keeps the still grid), the seam's travel, progress, speed and room, the registry of seams by name (each loaded with `import()` only on its page). |
| `js/seams/*.js`            | One seam per file.                                                                                          |
| `js/gl/Strip.js`           | The WebGL 2 canvas the shader seams draw on: sizing, the hero photograph as a texture, uniforms.            |
| `js/gl/glsl.js`            | GLSL every shader starts with: the shared uniforms, noise, `photo()` and `paint()`.                         |
| `css/base.css`             | All styles: the frame (over the hero, scrolling away with it), the studio page and the seam box.            |
| `img/`                     | Each page's hero (`hero-<seam>.jpg`, 1376×768, light daylight photographs) and the six projects (`project-1…6.jpg`, 896×1200, shown 4:5), shared by every page. All generated for the demo. |
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
}
```

- **At progress 0 a seam must draw nothing at all** (return transparent): the seam sits at the bottom of the screen as the page opens, and even a softened edge shows as a line there. Check it by comparing the hero's bottom rows with the canvas shown and hidden.
- **A seam never draws over text.** Size its box from `seam.room`: up to 32px short of the hero's last line (`.hero__note`), down to 32px short of the white page's first text (`.next__intro`).
- A seam may throw when it can't run (`Strip` throws without WebGL 2); `js/index.js` catches it and the edge stays plain. No seam loads for reduced motion.
- **Every seam is scroll-driven, and is still soon after the page stops.** Most redraw from `onChange` only. Crumble's falling squares, Sediment's grains and Surface's waves run on time after the page stops, then settle within about a second; Surface also follows the pointer. Anything that should keep moving until the seam is off the screen follows `travel` (`uTravel`), not `progress`, which stops at 1 while the box below the edge is still in view.
- **Where a seam meets the page's own edge, paint 2px past it** (in the page's colour on that side): the canvas and the page are composited separately and can be a device pixel apart mid-scroll, which shows as a hairline. Crumble's holes, Surface's fills, the opaque white of Typeset, Contour, Marble and Craquelure, Sediment's bottom row of holes, and the 2px of white below the edge that Mist paints do this; Roots start 2px inside the hero; for Ink, `paint()` paints a band along the edge outright.

## Shader seams (`Strip`: Ink, Typeset, Contour, Marble, Mist, Craquelure)

- **`new Strip(seam, { above, below, fragment, uniforms, textures, bleed, dpr })`.** `above` and `below` are functions returning px, read again on every resize; `Strip` sets them as `--above` and `--below` on `seam.el`, which size the box. `uniforms` are the seam's own (numbers, or arrays of 2–4), changed with `strip.set()` before `strip.render()`. `textures` maps sampler names to functions returning an image or canvas, uploaded again on every resize (Typeset's characters). `bleed` makes the photograph's box reach below the hero by `below` (`--bleed` on the hero, cropped by it), so the picture continues under the page and `photo()` below the edge is the rest of it (Ink). `dpr` caps the canvas's pixel ratio (1.5 by default; seams with fine type or lines use 2).
- **Space.** CSS px, y down from the canvas's top. `uEdge` is where the hero ends. `photo(px)` samples the hero's photograph exactly as the page draws it: cover, under the hero's veil, repeating its last row below it (or, with `bleed`, carrying on into the rest of the picture). The veil is a dark gradient over the photograph so the white type reads; its numbers are CSS custom properties on `.hero` (`--veil-top`, `--veil-mid`, `--veil-stop`, `--veil-bottom`), which `index.js` reads into `seam.veil` and `Strip` passes as `uVeil`. Change them only in the CSS. Don't filter `.hero__img` or lay anything else over it without doing the same in `photo()`, or the seams won't match it.
- **Paint only the difference.** When the photograph itself doesn't move, work out `h`, how much of each pixel belongs to the photograph, and return `paint(px, h, photo(px))`: it paints white over the hero where the seam cuts up, the photograph over the page where it reaches down, and nothing elsewhere. Within a pixel of the edge it paints outright, because the scaled canvas and the moving page never line up exactly. Seams that move or replace the photograph (Typeset, Contour, Marble, Craquelure) paint where they've reached outright, and nothing at all at progress 0.
- **GLSL ES 3.00** (WebGL 2): `fwidth`, `tanh` and `gl_VertexID` are available.

## Crumble (2D canvas)

- It sets `--above` and `--below` itself and draws only the difference too: white (`--paper`) holes where squares have gone, and the squares in the air, each its own piece of the photograph (`drawImage` from `seam.photo.box()`) darkened by the veil at its height.
- Holes are snapped to the canvas's pixels so neighbours meet exactly, and along the edge they reach 2px into the page, so no line of the section shows under them. Keep the canvas at the device's pixel ratio (up to 2): a scaled canvas blurs that edge.
- Each falling square has a paused timeline (Physics2DPlugin arc, spin, fade): `play()` when `travel` passes its `at`, `timeScale(2).reverse()` when it comes back. Physics2DPlugin works the arc out from the tween's time, so it reverses exactly.
- The squares are laid out again only when the width or the room changes, so a phone's address bar showing and hiding doesn't reshuffle them.

## Surface (2D canvas)

- Below the edge it shows the photograph carrying on under the page (`seam.photo.bleed`), drawn with `drawImage` under `seam.veil.gradient`, so the water drawn down over the page is the rest of the sea.
- A row of points every `SPACING` px, each pulled level with its neighbours (the wave), back towards flat, damped, and held near a lift under the pointer that follows `seam.velocity` while `seam.inView`. Stepped at 240 Hz on GSAP's ticker; it stops working, and clears the canvas, once everything is flat.
- The constants at the top of `surface.js` set the feel: `SPEED` (wave speed), `DAMPING` and `SETTLE` (while the page moves), `CALM` (how fast it flattens once the page stops; the damping then is critical, `2√CALM`, so it doesn't wobble), `GRIP`, `REACH` (width of the push) and `FULL` (the speed that nears full height).

## Typeset and Contour

- Typeset draws its characters (`CHARACTERS`, lightest to densest, in Kode Mono) into a canvas used as the `uType` texture, one cell per character, and sizes its rows from `seam.room`. The fonts are loaded before any seam starts.
- Contour's field is the photograph's tone from a blurred mipmap level (`textureLod`, level 3.5), roughened with noise; below the edge the last tones carry on with growing noise. Lines are measured in px with `fwidth`, so they keep one weight, before any pixel returns early (derivatives next to a pixel that has returned are undefined, and show as a dashed line along the map's end); below the edge they thin out to nothing towards wherever the map currently ends, so it never ends in a line; `LINES` and `FLOW` in the shader set their spacing and how fast they flow with `uTravel`.

## Marble, Mist, Craquelure, Roots, Sediment

- Marble works backwards: for each pixel it undoes a fine comb across, a wide comb along and a noise warp to find where its colour came from, then reads the floated bands (photograph, alternating stripes, page) there. The combs' phases follow `uTravel`.
- Mist is three layers of folded noise (`fbm` of `fbm`), alpha-blended white over the hero, each reaching higher as the mist rises (`rise`, eased from `uProgress` so it builds slowly from a faint haze) and drifting up with `uTravel`, over a bank of fog that's solid white at the edge and thins upwards. The bank is what keeps a line from showing where the mist meets the page: keep it whenever the wisps change.
- Craquelure finds each pixel's plate with Voronoi (nearest point, then the exact distance to the plate's border), sampled at a noise-shifted position so the cracks wander. Each plate's dryness, from its centre's height and `uProgress`, sets the crack width, the plate's shrink and turn. The plate size is `CELL` at the top of `craquelure.js`; the crack width and the cracks' wander scale with it.
- Roots are grown in JS once per width and room, each root system coloured from the photograph's bottom where it starts (`seam.photo.colours`), a little deeper (a random walk pulled downwards, branching, `STEP` px apart), sorted by thickness and drawn as one path per weight, up to `travel / innerHeight` of their length.
- Sediment is Crumble's machinery with grains: the photograph's bottom `ROWS` rows cut into `GRAIN`-px grains, each coloured from the photograph (drawn the way the page draws it, alternate rows a touch lighter or darker so layers show). They come loose in arches around a few leak points, each with its own opening time, pace and reach (distance measured 1.6× vertically, so arches are wider than tall; a random rim, so they're ragged); grains outside every arch never fall, so the edge ends scalloped. Loose grains are drawn slightly jittered and resized, so they read as sand, and slopes settle at one or two grains' steepness at random. Where each lands is worked out once, in order: it falls (Physics2DPlugin) onto the mound under it, then slides down to where it's no more than a grain or two above its neighbours, so the first to fall lie lowest. The pile rests on the floor of `seam.room.down()`.

## Adding a variation

1. Write `js/seams/<name>.js`, then add `<name>: () => import('./seams/<name>.js')` to `seams` in `js/index.js`. Don't import seams statically.
2. Copy a page to `index<N>.html` and change `data-seam`, the `demo-<N>` body class, the `Demo <N>` title (also in `og:title` and `twitter:title`), the canonical and `og:url` addresses, the hero photograph and its alt text, and the meta description and keywords (below).
3. Add the link to the `.frame__demos` nav on **every** page, and widen its `grid-template-columns` in `css/base.css`. The current page's entry is a `<span class="frame__demo frame__demo--current">`, not a link.
4. Add a row to the README's table.

## Meta

- Each page's meta description says what its own seam does on screen, then what it's built with (about 160 characters), and is repeated in `og:description` and `twitter:description`; its keywords name the seam's own effect, then the shared ones. Rewrite them whenever a seam changes.
- The canonical and `og:url` addresses are where the demo lives (`https://tympanus.net/Demos/SeamTransitions/`, plus `index<N>.html` from 02 on). The analytics and sponsor scripts stay commented out in the repo; they're switched on on the live server.

## Style

- Two-space indentation, single quotes, semicolons, trailing commas. Follow what's in the file.
- Every seam opens with a comment saying what it looks like, in plain words, including what scrolling back does. Other comments say why, not what.
- No dependencies and no build tooling unless asked.

## Ask before changing

- The pages' `<title>` pattern, the `frame__title` heading and the tags. They're kept the same on every page.
- The GitHub link, the photographs and the credits (the frame's "Inspired by" line and the README's Inspiration and Credits). There's no article.
- The frame's bottom row: the credits on the left, and on the right the slot Codrops' sponsor script fills on the live site (`#cdawrap`, grid area `sponsor`). Keep that slot free. The row sits where the seams work, so `index.js` fades it out (`--foot`) over the first 40px of scroll and then hides it (`.frame--clear`).
