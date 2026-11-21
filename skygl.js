/* Real night sky in WebGL2.
 *
 * Draws an all-sky star map (NASA/GSFC Scientific Visualization Studio "Deep Star Maps 2020",
 * Gaia DR2: ESA/Gaia/DPAC) as seen from the ground: the equirectangular map in RA/Dec is
 * turned to the observer's horizon, then dimmed and reddened by the air, washed out by light
 * pollution, drained of colour the way night vision is, and made to twinkle.
 *
 * Map layout (from NASA): plate carrée, RA 0h at the centre, RA increasing to the left, north up.
 */
(() => {
  'use strict';

  const VS = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FS = `#version 300 es
precision highp float;
uniform sampler2D uSky;
uniform vec2 uRes;
uniform vec3 uF, uR, uU;
uniform float uFocal, uLat, uLst, uTime;
uniform float uExposure, uThresh, uStarBoost, uPollution, uHasTex, uDomeAz;
uniform vec3 uZen, uHor, uDome, uGround;
uniform vec3 uSunDir, uSunCol, uMoonDir, uMoonCol;   // glow around the Sun (twilight, day) and the Moon
out vec4 outColor;

const float PI = 3.14159265359;

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float airmass(float alt) {
  float a = max(alt, -0.0087);
  return 1.0 / (sin(a) + 0.50572 * pow(degrees(a) + 6.07995, -1.6364));
}
vec3 toSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec2 s = (gl_FragCoord.xy - 0.5 * uRes) / uFocal;
  vec3 d = normalize(uF + uR * s.x + uU * s.y);   // x east, y north, z up
  float alt = asin(clamp(d.z, -1.0, 1.0));
  float az = atan(d.x, d.y);
  float altd = degrees(alt);

  vec3 star = vec3(0.0);
  if (uHasTex > 0.5) {
    // horizon -> equator
    float sl = sin(uLat), cl = cos(uLat);
    float dec = asin(clamp(sl * d.z + cl * d.y, -1.0, 1.0));
    float ha = atan(-d.x, cl * d.z - sl * d.y);
    float ra = uLst - ha;
    vec2 uv = vec2(fract(0.5 - ra / (2.0 * PI)), 0.5 - dec / PI);

    // Gradients that don't jump at the map's wrap-around seam.
    float u2 = fract(uv.x + 0.5);
    vec2 gx = vec2(dFdx(uv.x), dFdx(uv.y)), gy = vec2(dFdy(uv.x), dFdy(uv.y));
    float gx2 = dFdx(u2), gy2 = dFdy(u2);
    if (abs(gx2) < abs(gx.x)) gx.x = gx2;
    if (abs(gy2) < abs(gy.x)) gy.x = gy2;

    vec3 base = textureGrad(uSky, uv, gx, gy).rgb;
    // Stars are points: when the map is shrunk they get averaged away. A sharper sample
    // brings back what stands out from the smooth Milky Way without brightening the Milky Way.
    vec3 sharp = textureGrad(uSky, uv, gx * 0.35, gy * 0.35).rgb;
    vec3 pts = max(sharp - base, 0.0);

    // Scintillation: every star flickers on its own, more so low in the sky.
    float am = airmass(alt);
    vec2 cell = floor(uv * vec2(2048.0, 1024.0));
    float amp = 0.1 + 0.35 * clamp((am - 1.0) / 5.0, 0.0, 1.0);
    float tw = 1.0 + amp * sin(uTime * (6.0 + 9.0 * hash(cell + 7.3)) + 6.2831 * hash(cell));
    star = base + pts * uStarBoost * tw;

    // Light pollution: the faint end sinks into the bright sky.
    star = max(star - uThresh, 0.0);

    // Night vision is colour-blind for faint light and shifts it toward blue.
    float L = dot(star, vec3(0.2126, 0.7152, 0.0722));
    float sat = smoothstep(0.02, 0.35, L);
    star = mix(L * vec3(0.84, 0.95, 1.14), star, 0.2 + 0.8 * sat);

    // Extinction: dimmer and redder through more air.
    star *= pow(vec3(10.0), -0.4 * vec3(0.13, 0.2, 0.34) * (am - 1.0));
    star *= uExposure;
  }

  // The sky itself
  float sa = max(sin(alt), 0.0);
  vec3 sky = mix(uHor, uZen, smoothstep(0.0, 0.55, sa));
  // Airglow: a faint green band about 10 degrees up, visible only from dark sites.
  sky += vec3(0.0005, 0.0014, 0.0007) * exp(-pow((altd - 11.0) / 9.0, 2.0)) * (1.0 - uPollution);
  // A town's light dome in one direction, plus general glow all round.
  float toward = 0.5 + 0.5 * cos(az - uDomeAz);
  sky += uDome * uPollution * exp(-max(altd, 0.0) / 13.0) * (0.3 + 0.7 * toward * toward);
  // Sunlight scattered in the air: a bright aureole round the Sun, and a glow along the horizon
  // on its side of the sky that fades up the sky and away from it.
  float cs = dot(d, uSunDir);
  float low = exp(-max(altd, 0.0) / 9.0);
  sky += uSunCol * (0.9 * exp((cs - 1.0) * 25.0) + 0.35 * pow(max(cs, 0.0), 5.0) + low * (0.25 + 0.75 * pow(0.5 + 0.5 * cs, 3.0)));
  // Moonlight: a halo round the Moon.
  float cm = dot(d, uMoonDir);
  sky += uMoonCol * (2.5 * exp((cm - 1.0) * 60.0) + 0.6 * pow(max(cm, 0.0), 6.0));

  vec3 col = alt < 0.0 ? uGround : sky + star;
  col = toSrgb(col);
  col += (hash(gl_FragCoord.xy + fract(uTime * 0.37) * 311.0) - 0.5) / 255.0;   // dither away banding
  outColor = vec4(col, 1.0);
}`;

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  }

  async function fetchMap(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return res.blob();
  }

  async function decode(url) {
    let blob;
    try {
      blob = await fetchMap(url);
    } catch {
      await new Promise(resolve => setTimeout(resolve, 750));
      blob = await fetchMap(url);
    }
    if (window.createImageBitmap) {
      try {
        return await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      } catch (e) { /* fall through to <img> */ }
    }
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    await img.decode();
    return img;
  }

  window.SkyGL = function (canvas) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, powerPreference: 'high-performance' });
    if (!gl) return null;
    let prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (e) {
      console.warn('Sky shader failed, using the generated sky.', e);
      return null;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const loc = {};
    for (const n of ['uSky', 'uRes', 'uF', 'uR', 'uU', 'uFocal', 'uLat', 'uLst', 'uTime', 'uExposure', 'uThresh',
      'uStarBoost', 'uPollution', 'uHasTex', 'uDomeAz', 'uZen', 'uHor', 'uDome', 'uGround',
      'uSunDir', 'uSunCol', 'uMoonDir', 'uMoonCol']) {
      loc[n] = gl.getUniformLocation(prog, n);
    }
    gl.uniform1i(loc.uSky, 0);

    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    let tex = null, texSize = 0;

    async function load(url) {
      const img = await decode(url);
      const t = gl.createTexture();
      const width = img.width;
      try {
        if (!t) throw new Error('Unable to allocate sky texture');
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        if (aniso) {
          gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT,
            Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
        }
        const error = gl.getError();
        if (error !== gl.NO_ERROR) throw new Error(`Sky texture upload failed (${error})`);
      } catch (error) {
        gl.deleteTexture(t);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        throw error;
      } finally {
        if (img.close) img.close();
      }
      if (tex) gl.deleteTexture(tex);
      tex = t; texSize = width;
    }

    function render(u) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(loc.uRes, canvas.width, canvas.height);
      gl.uniform3fv(loc.uF, u.F); gl.uniform3fv(loc.uR, u.R); gl.uniform3fv(loc.uU, u.U);
      gl.uniform1f(loc.uFocal, u.focal);
      gl.uniform1f(loc.uLat, u.lat);
      gl.uniform1f(loc.uLst, u.lst);
      gl.uniform1f(loc.uTime, u.time);
      gl.uniform1f(loc.uExposure, u.exposure);
      gl.uniform1f(loc.uThresh, u.thresh);
      gl.uniform1f(loc.uStarBoost, u.starBoost);
      gl.uniform1f(loc.uPollution, u.pollution);
      gl.uniform1f(loc.uHasTex, tex ? 1 : 0);
      gl.uniform1f(loc.uDomeAz, u.domeAz);
      gl.uniform3fv(loc.uZen, u.zen); gl.uniform3fv(loc.uHor, u.hor);
      gl.uniform3fv(loc.uDome, u.dome); gl.uniform3fv(loc.uGround, u.ground);
      gl.uniform3fv(loc.uSunDir, u.sunDir || [0, 0, -1]); gl.uniform3fv(loc.uSunCol, u.sunCol || [0, 0, 0]);
      gl.uniform3fv(loc.uMoonDir, u.moonDir || [0, 0, -1]); gl.uniform3fv(loc.uMoonCol, u.moonCol || [0, 0, 0]);
      if (tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    return {
      maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      load, render,
      get textureSize() { return texSize; },
    };
  };
})();
