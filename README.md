# Seam Transitions

Ten ways to animate the seam between two sections of a page, the line where the hero above the fold meets the white page that scrolls up over it, all driven by scroll with [GSAP](https://gsap.com) and ScrollSmoother: ink bleeding, squares crumbling off, a liquid surface, the photograph set in type, a contour map, marbling, mist, cracks, roots and sediment. Each runs on its own photograph, chosen so the effect reads as something happening in it.

[Demo](https://tympanus.net/Demos/SeamTransitions/)

## Inspiration

The idea comes from two places that treat the edge between sections as something that moves: [Mosaic](https://mosaic.flabbergast.agency/) by Flabbergast, where the bottom of the dark hero breaks into square tiles as you scroll into the white section, and Jesper Landberg's [Designing in Paper as a Developer: Taking Paper Shaders off the Background](https://tympanus.net/codrops/?p=124140) on Codrops, where the sections are separated by torn edges drawn with a shader that widen as you scroll. The ten seams here are our own takes on that idea.

## Run it

There's no build step and nothing to install. Serve the folder with any static server (the scripts are ES modules, which don't load from `file://`):

```sh
npx serve .
# or
python3 -m http.server
```

Then open `index.html` (01) or `index2.html` to `index10.html` (02 to 10) and scroll down past the hero.

## The variations

| #   | Name   | What happens                                                                                                                                                       |
| --- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 01  | ink    | The photograph bleeds into the page like ink into wet paper, showing the rest of the picture that the page covers, in lobes and runs, the paper eating back up between them. It keeps reshaping as long as any of it is on screen, and feathers wider the faster the page moves. |
| 02  | crumble | The bottom of a tiled wall is built of squares of three sizes, small crumbs at the bottom and bigger blocks above. As the page scrolls they break off from the bottom up: each jumps loose with its piece of the picture, spins and falls down the page, fading out before the text, and the page shows through the hole. The section ends on a ragged edge. |
| 03  | surface | The page is the beach and the hero is the sea seen from above. Scrolling swells the beach up into the water under the pointer, and the swell runs out as waves that bounce off the sides of the screen and settle after the page stops. Scrolling back up draws the water down over the page, showing more of the sea. |
| 04  | typeset | The bottom of the photograph is set in type, in the page's own typeface: each character as dense as the photograph is dark there and filled with it, thinning out into the page. The type climbs as the seam comes up and scrambles while the page scrolls. |
| 05  | contour | The photograph gives way to a survey drawing of itself: contour lines that follow its tones, every fifth one heavier, flooding up from the edge like rising water, through its dark places first, and running on into the page. The contours flow while the page scrolls. |
| 06  | marble | The photograph and the page meet like colours floated for marbled paper: laid along the edge in thin alternating bands, then combed into tongues and feathered into chevrons, carrying the photograph's colours. The pattern flows while the page scrolls. |
| 07  | mist | The white page rises into a pale sky as cloud, starting as a faint haze and building slowly: a bank of fog along the edge, white where it meets the page, and three curling layers of wisps above it that climb higher as the seam comes up and drift up while the page scrolls. |
| 08  | craquelure | The bottom of the photograph dries and cracks like clay: the cracks open from the edge up, widen as the plates shrink, turn and curl, casting soft shadows on the page, until the plates nearest the page are gone. |
| 09  | roots | Roots grow down from an old oak's base into the page, in the colours of its bark and earth, thick where they leave it and tapering, wandering and branching, as the seam comes up. |
| 10  | sediment | The photograph wears away like an hourglass, in ragged arches that open along its edge each in its own time: grains of its own colours stream down the page and settle into uneven dunes above the text, in layers. Scroll back and the sand flies back up into the photograph. |

All of them are driven by the scroll, go back as you scroll back up, and stay in the empty space around the seam, clear of the text on either side.

## How it works

- **`js/index.js`** sets up smooth scrolling (ScrollSmoother), brings the studio's introduction in line by line as it scrolls into view (SplitText, masked lines, with ScrollTrigger), turns the latest work into a marquee the scroll moves right to left (a ScrollTrigger and a second set of photographs, its position wrapping round one set's width), fades out the frame's bottom row (the credits, and the sponsor on the live site) before the seam comes up to it, works out every frame, from where the smoothed page is, how far the seam has come up the screen and how fast the page moves, and loads the page's seam, named by `data-seam` on `<body>`, with a dynamic `import()`. When the visitor prefers reduced motion, or a seam can't run (no WebGL 2), the edge stays plain.
- **A seam** is a module in `js/seams/` that receives the shared `seam` object (its elements, `travel`, `progress`, `velocity`, `inView`, the `room` it may draw in, `onChange()`) and draws in the `.seam` box on the hero's bottom edge. Each paints only where it differs from the page underneath, so the photograph and the page stay ordinary HTML.
- **`js/gl/Strip.js`** is the WebGL canvas most seams draw on (Ink, Typeset, Contour, Marble, Mist, Craquelure): one fragment shader over the box, with the hero's photograph as a texture, sampled exactly as the page draws it (under the same veil that keeps the white type readable). Typeset's characters are drawn in JavaScript into a canvas the shader reads as a texture.
- **Crumble**, **Surface**, **Roots** and **Sediment** draw on a 2D canvas. Each of Crumble's squares and Sediment's grains falls on a paused GSAP timeline, its arc worked out by Physics2DPlugin, played when the seam passes it and reversed when it comes back. Surface runs a small wave simulation on GSAP's ticker, lively while the page moves and settling flat about half a second after it stops. Crumble's squares carry their piece of the photograph and Surface shows the sea carrying on under the page; Roots are grown once as branching lines, each coloured from the photograph where it leaves it, and drawn up to how far the seam has come.
- **Surface** follows the pointer through `gsap.quickTo()`, so the swell glides after it.

## Credits

- Photographs: generated for this demo.
- [Kode Mono](https://fonts.google.com/specimen/Kode+Mono) from Google Fonts.
- [GSAP](https://gsap.com) 3.15 with ScrollTrigger, ScrollSmoother, SplitText and Physics2DPlugin.

## License

[MIT](LICENSE)
