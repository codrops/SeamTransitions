// What every seam shader starts with: the shared uniforms (see Strip.js),
// noise, the hero's photograph, and paint().

export const header = /* glsl */ `#version 300 es
precision highp float;

uniform vec2 uSize;
uniform float uEdge;
uniform float uTravel;
uniform float uProgress;
uniform float uVelocity;
uniform sampler2D uHero;
uniform vec4 uHeroBox;
uniform vec4 uVeil;
uniform vec2 uHeroSpan;
uniform vec3 uPaper;

in vec2 vPx; // this pixel, in CSS px from the canvas's top-left, y down
out vec4 outColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Smooth value noise, 0 to 1.
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

// Layered noise, 0 to 1, finer detail at each octave.
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return v / 0.97;
}

// How dark the veil over the photograph is at a height in the canvas, as
// the page's CSS lays it: from uVeil.x at the hero's top to uVeil.y at
// uVeil.z of the way down, then to uVeil.w at its bottom, and that below.
float veil(float y) {
  float t = clamp((y - uHeroSpan.x) / uHeroSpan.y, 0.0, 1.0);
  return t < uVeil.z ? mix(uVeil.x, uVeil.y, t / uVeil.z) : mix(uVeil.y, uVeil.w, (t - uVeil.z) / (1.0 - uVeil.z));
}

// The hero's photograph at a point, as the page draws it (cover, under its
// veil). Below the photograph's own bottom it repeats its last row, so
// whatever reaches down out of the hero carries its colours.
vec3 photo(vec2 px) {
  vec2 uv = clamp((px - uHeroBox.xy) / uHeroBox.zw, 0.0, 1.0);
  return texture(uHero, uv).rgb * (1.0 - veil(px.y));
}

// The seam's colour at a pixel, from how much of it belongs to the
// photograph (h, 0 to 1). The page under the canvas is the hero above
// uEdge and white below it, so only the difference is painted: white where
// the seam cuts up into the hero, the photograph (dark) where it reaches
// down into the page. Premultiplied alpha.
//
// Right at the edge, the canvas's pixels and the page's edge don't line up
// (the canvas is scaled, and the page moves by fractions of a pixel), so
// within a pixel of it the seam is painted outright.
vec4 paint(vec2 px, float h, vec3 dark) {
  float page = step(px.y, uEdge);
  float a = abs(h - page);
  float near = 1.0 - step(1.0, abs(px.y - uEdge));
  return mix(vec4(mix(dark, uPaper, page) * a, a), vec4(mix(uPaper, dark, h), 1.0), near);
}
`;
