// WebGL 2 post-processing: the Canvas 2D frame is uploaded as a texture each frame and
// graded here: bloom, tension grade, chromatic aberration, glitch, vignette, grain, fade.

const VS = `#version 300 es
in vec2 p; out vec2 uv;
void main(){ uv = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }`;

const BRIGHT = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D src; uniform float thr;
void main(){
  vec3 c = texture(src, uv).rgb;
  float l = dot(c, vec3(.2126,.7152,.0722));
  float k = smoothstep(thr, thr + .25, l);
  o = vec4(c * k, 1.);
}`;

const BLUR = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D src; uniform vec2 dir;
void main(){
  vec3 c = texture(src, uv).rgb * .2270270270;
  c += texture(src, uv + dir*1.3846153846).rgb * .3162162162;
  c += texture(src, uv - dir*1.3846153846).rgb * .3162162162;
  c += texture(src, uv + dir*3.2307692308).rgb * .0702702703;
  c += texture(src, uv - dir*3.2307692308).rgb * .0702702703;
  o = vec4(c, 1.);
}`;

const COMP = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D src; uniform sampler2D bloom;
uniform vec2 res; uniform float frame, tension, glitch, bloomAmt, ca, vig, grain, gold, fade;
float h1(float n){ return fract(sin(n*127.1)*43758.5453); }
float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec2 st = uv;
  // glitch: horizontal block displacement
  if (glitch > 0.) {
    float row = floor(st.y * 36.);
    float r = h1(row + floor(frame) * 13.7);
    if (r < glitch * .55) st.x += (h1(row * 3.1 + frame) - .5) * .09 * glitch;
    float band = floor(st.y * 7.);
    if (h1(band + frame * 1.3) < glitch * .25) st.y += (h1(band + frame) - .5) * .02;
  }
  vec2 d = (st - .5);
  float cav = (ca + glitch * 7.) / res.x;
  vec3 c;
  c.r = texture(src, st + d * cav * 2.).r;
  c.g = texture(src, st).g;
  c.b = texture(src, st - d * cav * 2.).b;
  vec3 b = texture(bloom, st).rgb;
  c += b * bloomAmt;
  float l = dot(c, vec3(.2126,.7152,.0722));
  // tension grade: warm lift in the shadows (al2 #2F1B26)
  c += vec3(.184,.106,.149) * tension * .22 * (1. - smoothstep(0., .45, l));
  c = mix(c, c * vec3(1.02, .99, .97), tension * .5);
  // gold wash (the Turn)
  c = mix(c, c * vec3(1.12, 1.02, .78) + vec3(.06,.045,.0), gold);
  // vignette
  float v = smoothstep(.95, .25, length(d * vec2(1., .82)) * 1.15);
  c *= mix(1., v, vig);
  // grain
  float n = h2(uv * res + fract(frame * .6180339) * 100.) - .5;
  c += n * grain * (.35 + l);
  o = vec4(c * fade, 1.);
}`;

export class Post {
  constructor(canvas, w, h) {
    this.w = w; this.h = h;
    const gl = this.gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 unavailable');
    const mk = (fs) => {
      const p = gl.createProgram();
      for (const [t, s] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]]) {
        const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
        gl.attachShader(p, sh);
      }
      gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
      return { p, u };
    };
    this.bright = mk(BRIGHT); this.blur = mk(BLUR); this.comp = mk(COMP);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.src = this.tex(w, h);
    const hw = w >> 1, hh = h >> 1;
    this.hw = hw; this.hh = hh;
    this.a = this.fbo(hw, hh); this.b = this.fbo(hw, hh);
  }
  tex(w, h) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  fbo(w, h) {
    const gl = this.gl, t = this.tex(w, h), f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, f };
  }
  pass(prog, target, w, h, bind, uniforms) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.f : null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog.p);
    bind.forEach(([name, tex], i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(prog.u[name], i); });
    for (const k in uniforms) {
      const v = uniforms[k], loc = prog.u[k];
      if (loc == null) continue;
      Array.isArray(v) ? gl.uniform2f(loc, v[0], v[1]) : gl.uniform1f(loc, v);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  render(canvas2d, o) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, canvas2d);
    const { hw, hh } = this;
    this.pass(this.bright, this.a, hw, hh, [['src', this.src]], { thr: o.threshold ?? .74 });
    for (let i = 0; i < 3; i++) {
      const s = 1 + i;
      this.pass(this.blur, this.b, hw, hh, [['src', this.a.t]], { dir: [s / hw, 0] });
      this.pass(this.blur, this.a, hw, hh, [['src', this.b.t]], { dir: [0, s / hh] });
    }
    this.pass(this.comp, null, this.w, this.h, [['src', this.src], ['bloom', this.a.t]], {
      res: [this.w, this.h], frame: o.frame, tension: o.tension, glitch: o.glitch || 0,
      bloomAmt: o.bloom, ca: o.ca, vig: o.vig ?? .35, grain: o.grain ?? .025, gold: o.gold || 0, fade: o.fade ?? 1,
    });
  }
}
