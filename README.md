# Seam Transitions

Several ways to animate the seam between two sections of a page, the line where the hero above the fold meets the white page that scrolls up over it, all driven by scroll with [GSAP](https://gsap.com) and ScrollSmoother: ink bleeding, tiles crumbling off, a blanket fraying, the photograph set in type, a contour map, marbling, mist, kintsugi cracks, roots, sediment and wood shavings.

[Demo](https://tympanus.net/Demos/SeamTransitions/)

## Inspiration

The idea comes from two places that treat the edge between sections as something that moves: [Mosaic](https://mosaic.flabbergast.agency/) by Flabbergast, where the bottom of the dark hero breaks into square tiles as you scroll into the white section, and Jesper Landberg's [demo](https://tympanus.net/Demos/PaperDrops/) for his Codrops article [Designing in Paper as a Developer: Taking Paper Shaders off the Background](https://tympanus.net/codrops/?p=124140), where the sections are separated by torn edges drawn with a shader that widen as you scroll. The seams here are our own takes on that idea.

## Run it

There's no build step and nothing to install. Serve the folder with any static server (the scripts are ES modules, which don't load from `file://`):

```sh
npx serve .
# or
python3 -m http.server
```

Then open `index.html` (01) or `index2.html` to `index11.html` (02 to 11) and scroll down past the hero.

## Credits

- Photographs: generated for this demo.
- Walt Whitman, "Song of the Open Road", from _Leaves of Grass_ (1891–92 edition), in the public domain, via [Project Gutenberg](https://www.gutenberg.org/ebooks/1322).
- [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) and, for Typeset's type, [Kode Mono](https://fonts.google.com/specimen/Kode+Mono), from Google Fonts.
- [GSAP](https://gsap.com) 3.15 with ScrollTrigger, ScrollSmoother, SplitText and Physics2DPlugin.

## License

[MIT](LICENSE)
