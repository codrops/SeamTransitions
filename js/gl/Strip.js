// A WebGL 2 canvas filling the seam box: `above` px up into the hero and
// `below` px down into the white page. It runs one fragment shader over the
// whole box, and the shader paints only where the seam it draws differs
// from the page under the canvas (`paint()` in glsl.js does it for most:
// white where the seam cuts up into the photograph, the photograph where it
// reaches down into the white page). Everywhere else it's see-through.
//
// Every shader gets, in CSS px with y going down from the canvas's top:
//   uSize      the canvas's size
//   uEdge      where the hero ends (= above)
//   uTravel    how far the hero's edge has come up from the bottom of the screen
//   uProgress  the same as 0 to 1 (0 at the bottom of the screen, 1 at the top)
//   uVelocity  the page's speed, px/s, positive going down
//   uHero, uHeroBox   the hero's photograph and where it's drawn
//   uVeil, uHeroSpan  the veil over it (seam.veil) and where the hero is, top and height
//   uPaper     the white page's colour
// plus any `uniforms` the seam passes (numbers, or arrays of 2–4), and any
// `textures` (functions returning an image or a canvas, uploaded again on
// every resize). With `bleed`, the photograph carries on below the hero's
// edge, under the white page, cropped by the hero, so what the seam draws
// below the edge is the rest of the picture rather than its last row.

import { header } from './glsl.js';

const vertex = `#version 300 es
uniform vec2 uSize;
out vec2 vPx;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); // one triangle over the canvas
  vPx = vec2(p.x, 1.0 - p.y) * uSize;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export default class Strip {
  constructor(seam, { above, below, fragment, uniforms = {}, textures = {}, bleed = false, dpr = 1.5 }) {
    this.seam = seam;
    this.bleed = bleed;
    this.above = above; // functions, so they follow the window's size
    this.below = below;
    this.textures = textures;
    this.maxDpr = dpr;
    const paper = gsap.utils.splitColor(getComputedStyle(document.documentElement).getPropertyValue('--paper').trim()).map((c) => c / 255);
    this.uniforms = { uTravel: 0, uProgress: 0, uVelocity: 0, uPaper: paper, ...uniforms };

    this.canvas = document.createElement('canvas');
    const gl = (this.gl = this.canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: false }));
    if (!gl) throw new Error('WebGL 2 is not available');
    seam.el.append(this.canvas);

    this.program = this.compile(vertex, header + fragment);
    gl.useProgram(this.program);
    this.locations = {};

    // The hero's photograph.
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, seam.img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(this.program, 'uHero'), 0);

    // The seam's own textures, on the units after it.
    Object.keys(textures).forEach((name, i) => {
      gl.activeTexture(gl.TEXTURE1 + i);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(gl.getUniformLocation(this.program, name), i + 1);
    });

    gl.disable(gl.DEPTH_TEST);
    this.resize();
    addEventListener('resize', () => {
      this.resize();
      this.render();
    });
  }

  compile(vs, fs) {
    const gl = this.gl;
    const shader = (type, source) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, vs));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    return program;
  }

  // The box's size, and where the photograph is drawn in it (seam.photo),
  // from the hero's top, which is (hero height − above) over the canvas's
  // top.
  resize() {
    const above = Math.round(this.above());
    const below = Math.round(this.below());
    this.seam.el.style.setProperty('--above', `${above}px`);
    this.seam.el.style.setProperty('--below', `${below}px`);
    const width = this.seam.el.clientWidth;
    const height = above + below;
    const dpr = Math.min(this.maxDpr, devicePixelRatio || 1);
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.size = [width, height];

    if (this.bleed) this.seam.photo.bleed(below);
    const hero = this.seam.hero.offsetHeight;
    const box = this.seam.photo.box();
    this.uniforms.uHeroBox = [box.x, box.y - (hero - above), box.width, box.height];
    this.uniforms.uHeroSpan = [above - hero, hero];
    this.uniforms.uVeil = [...this.seam.veil];
    this.uniforms.uSize = this.size;
    this.uniforms.uEdge = above;

    const gl = this.gl;
    Object.values(this.textures).forEach((source, i) => {
      gl.activeTexture(gl.TEXTURE1 + i);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source());
    });
  }

  set(values) {
    Object.assign(this.uniforms, values);
  }

  render() {
    const gl = this.gl;
    this.uniforms.uTravel = this.seam.travel;
    this.uniforms.uProgress = this.seam.progress;
    this.uniforms.uVelocity = this.seam.velocity;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    for (const [name, value] of Object.entries(this.uniforms)) {
      const at = (this.locations[name] ??= gl.getUniformLocation(this.program, name));
      if (at === null) continue;
      if (typeof value === 'number') gl.uniform1f(at, value);
      else gl[`uniform${value.length}fv`](at, value);
    }
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
