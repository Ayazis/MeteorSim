/* Real night sky in Three.js.
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

  const VS = `
in vec3 position;
void main() { gl_Position = vec4(position, 1.0); }`;

  const auroraFragment = `
precision highp float;
uniform vec3 uF, uR, uU;
uniform vec2 uRes, uPassSize;
uniform float uFocal, uAuroraTime, uLat, uActivity;
uniform float uFoldDepth, uRayContrast, uCurtainHeight, uUpperRed, uPinkFringe, uPinkGlow, uPurpleGlow, uTealTint, uGreenHeight, uRedHeight, uPinkHeight, uPurpleHeight, uFringeHeight;
out vec4 outColor;

float noise1(float x) {
  float i = floor(x), f = fract(x);
  vec2 seed = fract(vec2(i, i + 1.0) * 0.1031);
  seed *= seed + 33.33;
  return mix(fract(seed.x * (seed.x + seed.x)), fract(seed.y * (seed.y + seed.y)), f*f*(3.0-2.0*f));
}

void main() {
  vec2 pixel = (gl_FragCoord.xy / uPassSize - 0.5) * uRes;
  vec3 ray = normalize(uF + uR * pixel.x / uFocal + uU * pixel.y / uFocal);
  ray.y *= uLat < 0.0 ? -1.0 : 1.0;
  float az = atan(ray.x, ray.y);
  float elevation = asin(clamp(ray.z, -1.0, 1.0));
  float t = uAuroraTime * 0.12;
  vec3 light = vec3(0.0);
  // Evaluate continuous ribbon profiles in angular space. Fixed altitude
  // slices can resolve into parallel stripes when viewed at a shallow angle.
  for (int i = 0; i < 3; ++i) {
    float layer = float(i);
    float x = az + 2.37*layer;
    float flow = x + 0.14*sin(1.8*x - t) + 0.08*sin(4.1*x + 0.73*t);
    float fold = noise1(4.2*flow - 0.48*t) - 0.5;
    float base = mix(0.12, 0.39, uActivity) + 0.095*layer - 0.095*az*az
               + uFoldDepth*(0.21*fold + 0.065*sin(2.9*x + t + 1.8*fold));
    float h = elevation - base;
    float filament = flow + (0.14 + 0.32*uTealTint)*h + 0.04*sin(2.0*x + t + 3.0*h);
    float rays = mix(0.25, 1.0, noise1(65.0*filament - 1.6*t))
               * mix(0.55, 1.0, noise1(22.0*filament + 0.8*t));
    rays = clamp(0.55 + uRayContrast*(rays - 0.55), 0.0, 1.0);
    float envelope = noise1(2.8*flow + 0.65*t + 9.0);
    float height = uCurtainHeight*(0.10 + 0.16*envelope + 0.065*uActivity);
    float hem = smoothstep(-0.035, 0.018, h);
    float above = max(h, 0.0)/height;
    // Display approximations in linear RGB, ordered by emission altitude.
    vec3 oxygenGreen = mix(vec3(0.19, 0.78, 0.016), vec3(0.016, 0.86, 0.45), uTealTint)*exp(-4.8*abs(above-uGreenHeight));
    float redCap = 0.4*exp(-4.2*abs(above-uRedHeight));
    vec3 oxygenRed = vec3(0.42, 0.012, 0.004)*redCap*uActivity*uUpperRed;
    float activeRay = smoothstep(0.60, 0.93, uActivity)*smoothstep(0.32, 0.72, rays);
    vec3 nitrogenFringe = vec3(0.72, 0.045, 0.29)*exp(-110.0*(above-uFringeHeight)*(above-uFringeHeight))*activeRay*uPinkFringe;
    vec3 pinkGlow = vec3(0.76, 0.035, 0.30)*0.58*exp(-3.6*abs(above-uPinkHeight))*uPinkGlow;
    vec3 purpleGlow = vec3(0.28, 0.025, 0.76)*0.5*exp(-3.2*abs(above-uPurpleHeight))*uPurpleGlow;
    float extent = 1.0 - smoothstep(0.88, 1.85, abs(az + 0.15*sin(t + layer)));
    vec3 lowerCurtain = (oxygenGreen + nitrogenFringe)*rays;
    float veil = mix(0.48, rays, 0.48)*mix(0.38, 1.0, noise1(flow*2.2 + layer - t*0.34));
    vec3 upperCurtain = (oxygenRed + pinkGlow + purpleGlow)*veil;
    light += (lowerCurtain + upperCurtain)*hem*extent*(0.22+0.78*envelope)/(1.0+layer);
  }
  light *= smoothstep(0.015, 0.13, elevation);
  // Square-root encoding retains faint detail in the 8-bit intermediate texture.
  outColor = vec4(sqrt(clamp(light, 0.0, 1.0)), 1.0);
}`;

  const FS = `
precision highp float;
uniform sampler2D uSky;
uniform sampler2D uTiles;      // atlas of high-resolution tiles (slots of uTileAtlas.y px, each with a 1 px border)
uniform sampler2D uTileMap0;   // per map tile of each level: 0 = not loaded, else 1 + atlas slot
uniform sampler2D uTileMap1;
uniform vec4 uTileGrid0;       // level 0 (e.g. 32K): cols, rows, map width in px, 0 = off
uniform vec4 uTileGrid1;       // level 1 (e.g. 64K), finer
uniform vec3 uTileAtlas;       // slots per side, slot size, tile size (px)
uniform sampler2D uAurora;
uniform float uAuroraVisibility;
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

// One tile level: its colour at uv (rgb) and how much it should count (a). The tiles have no
// mipmaps, so they fade in only once one tile pixel covers about a screen pixel or more.
vec4 tileLevel(sampler2D map, vec4 grid, vec2 uv, float span) {
  if (grid.w < 0.5) return vec4(0.0);
  float w = 1.0 - smoothstep(1.0, 2.0, span * grid.z);   // span * width: tile pixels per screen pixel
  if (w <= 0.0) return vec4(0.0);
  ivec2 cell = ivec2(min(uv * grid.xy, grid.xy - 1.0));
  float slot = texelFetch(map, cell, 0).r * 255.0 - 1.0;
  if (slot < -0.5) return vec4(0.0);
  vec2 local = uv * grid.xy - vec2(cell);
  vec2 sxy = vec2(mod(slot, uTileAtlas.x), floor(slot / uTileAtlas.x));
  vec2 auv = (sxy * uTileAtlas.y + 1.0 + local * uTileAtlas.z) / (uTileAtlas.x * uTileAtlas.y);
  return vec4(textureLod(uTiles, auv, 0.0).rgb, w);
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

    // Zoomed in far enough, the high-resolution tiles take over where they have loaded,
    // the finer level over the coarser one.
    float span = max(length(gx), length(gy));   // map widths per screen pixel
    for (int level = 0; level < 2; level++) {
      vec4 t = level == 0 ? tileLevel(uTileMap0, uTileGrid0, uv, span) : tileLevel(uTileMap1, uTileGrid1, uv, span);
      base = mix(base, t.rgb, t.a);
      sharp = mix(sharp, t.rgb, t.a);
    }
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

  // The sky itself. Brightness grows with the column of air looked through, so blend by
  // optical path (airmass) rather than by angle: a smooth gradient that brightens fast near the horizon.
  float altc = max(alt, 0.0);
  float amv = airmass(altc);
  float path = clamp((amv - 1.0) / 11.0, 0.0, 1.0);
  vec3 sky = mix(uZen, uHor, smoothstep(0.0, 1.0, pow(path, 0.7)));
  // Airglow: a faint green band about 10 degrees up, visible only from dark sites (van Rhijn brightening).
  sky += vec3(0.0005, 0.0014, 0.0007) * exp(-pow((altd - 11.0) / 9.0, 2.0)) * (1.0 - uPollution);
  // A town's light dome in one direction, plus general glow all round.
  float toward = 0.5 + 0.5 * cos(az - uDomeAz);
  sky += uDome * uPollution * exp(-max(altd, 0.0) / 13.0) * (0.3 + 0.7 * toward * toward);

  // Sunlight scattered in the air. Rayleigh (blue, broad, symmetric) plus Mie from aerosols
  // (white, strongly forward: the aureole). The light reaching each patch of sky has crossed a
  // column set by the Sun's altitude, so it reddens as the Sun sinks; light from near the
  // horizon has also crossed a long view path, which bleaches it toward white haze.
  const vec3 betaR = vec3(0.30, 0.62, 1.30);          // relative Rayleigh optical depth, ~1/lambda^4
  float cs = dot(d, uSunDir);
  float sunAlt = asin(clamp(uSunDir.z, -1.0, 1.0));
  float amSun = airmass(sunAlt);
  vec3 sunTrans = exp(-betaR * 0.11 * min(amSun, 40.0));
  vec3 viewTrans = exp(-betaR * 0.11 * min(amv, 40.0));
  float phR = 0.75 * (1.0 + cs * cs);
  float g = 0.76, g2 = g * g;
  float phM = (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * cs, 1.5) * 0.08;
  // Rayleigh: deep blue overhead, saturating toward the horizon. It is lit from high in the
  // atmosphere, so it keeps the Sun's own colour; the aureole and horizon glow are reddened.
  vec3 rayleigh = phR * (1.0 - viewTrans) / (1.0 - exp(-betaR.b * 0.11)) * vec3(0.30, 0.45, 0.80) * 0.12;
  float aureole = phM * (0.25 + 0.75 * path);
  float low = exp(-altd / 9.0);
  vec3 tint = uSunCol * mix(vec3(1.0), sunTrans / max(max(sunTrans.r, sunTrans.g), 1e-3), 0.65);
  sky += uSunCol * rayleigh * smoothstep(-0.10, 0.0, sunAlt);
  sky += tint * (0.9 * exp((cs - 1.0) * 25.0) + aureole * 0.45 + 0.3 * pow(max(cs, 0.0), 5.0)
               + low * (0.2 + 0.8 * pow(0.5 + 0.5 * cs, 3.0)));

  // Twilight on the far side: Earth's shadow rises as a blue-grey band above the antisolar
  // horizon, topped by the pink Belt of Venus.
  float tw = smoothstep(-0.12, -0.01, sunAlt) * (1.0 - smoothstep(0.02, 0.10, sunAlt));
  if (tw > 0.0) {
    float anti = pow(max(-cs, 0.0), 2.0);
    float shadowTop = clamp(-sunAlt, 0.0, 0.2) * 57.3 + 1.5;   // degrees
    float belt = exp(-pow((altd - shadowTop - 3.5) / 3.5, 2.0));
    float shade = 1.0 - smoothstep(shadowTop - 1.0, shadowTop + 1.0, altd);
    float lum = max(max(uSunCol.r, uSunCol.g), uSunCol.b);
    sky += vec3(0.85, 0.42, 0.48) * lum * 0.9 * belt * anti * tw;
    sky = mix(sky, sky * vec3(0.55, 0.62, 0.82), shade * anti * tw * 0.6);
  }

  // Moonlight: a halo round the Moon, with the same aerosol aureole.
  float cm = dot(d, uMoonDir);
  float phMm = (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * cm, 1.5) * 0.02;
  sky += uMoonCol * (2.5 * exp((cm - 1.0) * 60.0) + 0.6 * pow(max(cm, 0.0), 6.0) + phMm * (0.3 + 0.7 * path));

  if (uAuroraVisibility > 0.0 && alt > 0.0) {
    vec3 emission = texture(uAurora, gl_FragCoord.xy / uRes).rgb;
    emission *= emission * uAuroraVisibility;
    float luminance = dot(emission, vec3(0.2126, 0.7152, 0.0722));
    sky += mix(vec3(luminance), emission, smoothstep(0.0003, 0.014, luminance));
  }
  // Soft horizon: haze thickens into the ground over a fraction of a degree instead of a hard edge.
  vec3 hazeEdge = mix(uGround, sky, 0.45);
  float edge = smoothstep(-0.6, 0.35, altd);
  vec3 col = altd < -0.6 ? uGround : mix(hazeEdge, sky + star, edge);
  col = toSrgb(col);
  col += (hash(gl_FragCoord.xy + fract(uTime * 0.37) * 311.0) - 0.5) / 255.0;   // dither away banding
  outColor = vec4(col, 1.0);
}`;

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
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, depth: false, powerPreference: 'high-performance' });
    } catch (error) {
      console.warn('Three.js sky unavailable, using the generated sky.', error);
      return null;
    }

    const uniforms = { uSky: { value: null }, uRes: { value: new THREE.Vector2() }, uHasTex: { value: 0 } };
    const inputs = ['F', 'R', 'U', 'focal', 'lat', 'lst', 'time', 'exposure', 'thresh', 'starBoost',
      'pollution', 'domeAz', 'zen', 'hor', 'dome', 'ground', 'sunDir', 'sunCol', 'moonDir', 'moonCol',
      'activity', 'auroraTime', 'auroraVisibility', 'foldDepth', 'rayContrast', 'curtainHeight', 'upperRed', 'pinkFringe', 'pinkGlow', 'purpleGlow', 'tealTint', 'greenHeight', 'redHeight', 'pinkHeight', 'purpleHeight', 'fringeHeight'];
    const bindings = inputs.map(key => {
      const uniform = { value: null };
      uniforms['u' + key[0].toUpperCase() + key.slice(1)] = uniform;
      return { key, uniform };
    });
    const material = new THREE.RawShaderMaterial({
      uniforms, vertexShader: VS, fragmentShader: FS, glslVersion: THREE.GLSL3,
      depthTest: false, depthWrite: false
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(mesh);
    const camera = new THREE.Camera();
    const auroraTarget = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
    uniforms.uAurora = { value: auroraTarget.texture };
    uniforms.uPassSize = { value: new THREE.Vector2() };
    const auroraMaterial = new THREE.RawShaderMaterial({
      uniforms, vertexShader: VS, fragmentShader: auroraFragment, glslVersion: THREE.GLSL3,
      depthTest: false, depthWrite: false
    });

    // Phones drop the WebGL context when memory runs short (or the tab sits in the background).
    // Ask for it back, keep the decoded map, and upload it again once the context returns.
    let lost = false;
    const listeners = { lost: [], restored: [], tile: [] };
    canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault();   // allows the browser to restore the context
      lost = true;
      listeners.lost.forEach(fn => fn());
    });
    canvas.addEventListener('webglcontextrestored', () => {
      lost = false;
      const texture = uniforms.uSky.value;
      if (texture) texture.needsUpdate = true;
      auroraTarget.dispose();
      initTileGL();   // the old GL objects are gone; tiles are fetched again (from the cache)
      listeners.restored.forEach(fn => fn());
    });

    async function load(url) {
      const img = await decode(url);
      const texture = new THREE.Texture(img);
      texture.flipY = false;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      texture.needsUpdate = true;
      try {
        renderer.initTexture(texture);
        const gl = renderer.getContext();
        const error = gl.getError();
        if (error !== gl.NO_ERROR) throw new Error(`Sky texture upload failed (${error})`);
      } catch (error) {
        texture.dispose();
        img.close?.();
        throw error;
      }
      const previous = uniforms.uSky.value;
      uniforms.uSky.value = texture;
      uniforms.uHasTex.value = 1;
      previous?.dispose();
      previous?.image.close?.();
    }

    // ---- High-resolution tiles ("supermax"): maps too big for one texture (32K, 64K), cut into
    // tiles by tools/slice_starmap.py. Only the tiles in view are fetched, once zoomed in far
    // enough to need them, into one fixed atlas of slots shared by all levels; the least recently
    // seen give way. The atlas and the slot lookups are raw WebGL textures handed to three.js.
    const MAX_LEVELS = 2;
    uniforms.uTiles = { value: new THREE.Texture() };
    uniforms.uTileAtlas = { value: new THREE.Vector3(1, 1, 1) };
    for (let i = 0; i < MAX_LEVELS; i++) {
      uniforms['uTileMap' + i] = { value: new THREE.Texture() };
      uniforms['uTileGrid' + i] = { value: new THREE.Vector4(1, 1, 1, 0) };
    }
    let tiles = null;   // { levels, slotPx, tile, grid, slots, entries, free, uploads, inflight, atlasTex, wanted }
    let tileGen = 0;
    const gl = renderer.getContext();
    const LEVEL_KEY = 1 << 20;   // entry key = level * LEVEL_KEY + row * cols + col

    function rawTexture(holder, width, height, format, filter) {
      const tex = gl.createTexture();
      renderer.state.bindTexture(gl.TEXTURE_2D, tex);
      gl.texStorage2D(gl.TEXTURE_2D, 1, format, width, height);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const props = renderer.properties.get(holder);
      props.__webglTexture = tex;
      props.__webglInit = true;
      return tex;
    }
    function unpackPlain() {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    }
    // (Re)create the GPU side; all slots start empty. Also run after the context comes back.
    function initTileGL() {
      if (!tiles) return;
      tileGen++;
      const size = tiles.grid * tiles.slotPx;
      tiles.atlasTex = rawTexture(uniforms.uTiles.value, size, size, gl.SRGB8_ALPHA8, gl.LINEAR);
      tiles.levels.forEach((lv, i) => {
        lv.mapTex = rawTexture(uniforms['uTileMap' + i].value, lv.cols, lv.rows, gl.R8, gl.NEAREST);
        lv.map.fill(0);
        lv.mapDirty = true;
      });
      tiles.entries.clear();
      tiles.free = Array.from({ length: tiles.slots }, (_, i) => tiles.slots - 1 - i);
      tiles.uploads = [];
      tiles.inflight = 0;
    }
    function dropTileGL() {
      if (!tiles) return;
      if (!lost) {
        gl.deleteTexture(tiles.atlasTex);
        tiles.levels.forEach(lv => gl.deleteTexture(lv.mapTex));
      }
      for (const name of ['uTiles', ...Array.from({ length: MAX_LEVELS }, (_, i) => 'uTileMap' + i)]) {
        renderer.properties.remove(uniforms[name].value);
        uniforms[name].value = new THREE.Texture();
      }
      for (let i = 0; i < MAX_LEVELS; i++) uniforms['uTileGrid' + i].value.w = 0;
      for (const t of tiles.uploads) t.img.close?.();
      tiles = null;
      tileGen++;
    }

    // bases: folders made by slice_starmap.py (each with tiles.json), coarse to fine, all with the
    // same tile size; empty or null turns tiles off. Levels that fail to load are left out.
    async function setTiles(bases) {
      dropTileGL();
      bases = (bases || []).slice(0, MAX_LEVELS);
      const infos = (await Promise.all(bases.map(base => fetch(base + '/tiles.json')
        .then(r => r.ok ? r.json() : null).then(info => info && { base, ...info }).catch(() => null)))).filter(Boolean);
      if (!infos.length) return false;
      const slotPx = infos[0].tile + 2 * infos[0].pad;
      const levels = infos.filter(info => info.tile + 2 * info.pad === slotPx && info.cols * info.rows < LEVEL_KEY);
      const grid = Math.min(8, Math.floor(renderer.capabilities.maxTextureSize / slotPx));
      if (grid < 3) return false;
      dropTileGL();   // in case two calls overlapped
      tiles = { levels: levels.map(lv => ({ ...lv, map: new Uint8Array(lv.cols * lv.rows) })),
        slotPx, tile: levels[0].tile, grid, slots: grid * grid, entries: new Map(), wanted: [] };
      initTileGL();
      tiles.levels.forEach((lv, i) => uniforms['uTileGrid' + i].value.set(lv.cols, lv.rows, lv.width, 1));
      uniforms.uTileAtlas.value.set(grid, slotPx, tiles.tile);
      return true;
    }

    // Which tiles of each level cover the screen: coarse levels first (they fill in quickly and
    // stand in while finer tiles load), and within a level nearest the centre first.
    // Mirrors the shader's mapping.
    function visibleTiles(u) {
      const w = canvas.width, h = canvas.height;
      const sl = Math.sin(u.lat), cl = Math.cos(u.lat);
      const nx = 24, ny = Math.max(6, Math.round(24 * h / w));
      const cells = [];
      for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
        const sx = (i / nx - 0.5) * w / u.focal, sy = (j / ny - 0.5) * h / u.focal;
        let dx = u.F[0] + u.R[0] * sx + u.U[0] * sy, dy = u.F[1] + u.R[1] * sx + u.U[1] * sy, dz = u.F[2] + u.R[2] * sx + u.U[2] * sy;
        const n = Math.hypot(dx, dy, dz); dx /= n; dy /= n; dz /= n;
        if (dz < -0.02) continue;   // below the horizon: the ground covers it
        const dec = Math.asin(Math.max(-1, Math.min(1, sl * dz + cl * dy)));
        const ra = u.lst - Math.atan2(-dx, cl * dz - sl * dy);
        let mu = 0.5 - ra / (2 * Math.PI); mu -= Math.floor(mu);
        cells.push([mu, 0.5 - dec / Math.PI, Math.hypot(sx, sy)]);
      }
      const out = [];
      tiles.levels.forEach((lv, level) => {
        // map pixels per screen pixel along the celestial equator; the shader fades tiles in below 2
        if (lv.width / (2 * Math.PI * u.focal) >= 2) return;
        const found = new Map();
        for (const [mu, mv, dist] of cells) {
          const col = Math.min(lv.cols - 1, Math.floor(mu * lv.cols));
          const row = Math.min(lv.rows - 1, Math.max(0, Math.floor(mv * lv.rows)));
          const key = level * LEVEL_KEY + row * lv.cols + col;
          if (!found.has(key) || found.get(key) > dist) found.set(key, dist);
        }
        out.push(...[...found].sort((a, b) => a[1] - b[1]).map(e => e[0]));
      });
      return out.slice(0, tiles.slots);
    }

    function fetchTile(key, now, wanted) {
      let slot = tiles.free.pop();
      if (slot === undefined) {   // evict the least recently seen tile that is not in view
        let oldest = null;
        for (const [k, e] of tiles.entries) if (e.ready && !wanted.has(k) && (!oldest || e.seen < oldest[1].seen)) oldest = [k, e];
        if (!oldest) return false;
        setSlot(oldest[0], 0);
        tiles.entries.delete(oldest[0]);
        slot = oldest[1].slot;
      }
      const entry = { slot, ready: false, seen: now };
      tiles.entries.set(key, entry);
      tiles.inflight++;
      const lv = tiles.levels[Math.floor(key / LEVEL_KEY)], cell = key % LEVEL_KEY;
      const gen = tileGen, row = Math.floor(cell / lv.cols), col = cell % lv.cols;
      decode(`${lv.base}/${row}_${col}.jpg`).then(img => {
        if (gen !== tileGen) { img.close?.(); return; }
        tiles.inflight--;
        tiles.uploads.push({ key, entry, img });
        listeners.tile.forEach(fn => fn());
      }, err => {
        if (gen !== tileGen) return;
        tiles.inflight--;
        tiles.entries.delete(key);
        tiles.free.push(slot);
        console.warn('Star map tile unavailable', err);
      });
      return true;
    }
    function setSlot(key, value) {
      const lv = tiles.levels[Math.floor(key / LEVEL_KEY)];
      lv.map[key % LEVEL_KEY] = value;
      lv.mapDirty = true;
    }

    function updateTiles(u) {
      if (!tiles) return;
      const now = performance.now();
      // upload a couple of finished tiles per frame, so a burst of arrivals doesn't stall one frame
      for (let n = 0; n < 2 && tiles.uploads.length; n++) {
        const { key, entry, img } = tiles.uploads.shift();
        if (tiles.entries.get(key) !== entry) { img.close?.(); continue; }
        const sx = entry.slot % tiles.grid, sy = Math.floor(entry.slot / tiles.grid);
        renderer.state.bindTexture(gl.TEXTURE_2D, tiles.atlasTex);
        unpackPlain();
        gl.texSubImage2D(gl.TEXTURE_2D, 0, sx * tiles.slotPx, sy * tiles.slotPx, gl.RGBA, gl.UNSIGNED_BYTE, img);
        img.close?.();
        entry.ready = true;
        setSlot(key, entry.slot + 1);
      }
      if (tiles.uploads.length) listeners.tile.forEach(fn => fn());
      const list = visibleTiles(u);
      tiles.wanted = list;
      const wanted = new Set(list);
      for (const key of list) {
        const e = tiles.entries.get(key);
        if (e) { e.seen = now; continue; }
        if (tiles.inflight >= 6 || !fetchTile(key, now, wanted)) break;
      }
      for (const lv of tiles.levels) {
        if (!lv.mapDirty) continue;
        renderer.state.bindTexture(gl.TEXTURE_2D, lv.mapTex);
        unpackPlain();
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, lv.cols, lv.rows, gl.RED, gl.UNSIGNED_BYTE, lv.map);
        lv.mapDirty = false;
      }
    }

    function render(u) {
      if (lost) return;
      updateTiles(u);
      const size = uniforms.uRes.value;
      if (size.x !== canvas.width || size.y !== canvas.height) {
        size.set(canvas.width, canvas.height);
        renderer.setSize(size.x, size.y, false);
      }
      for (const { key, uniform } of bindings) uniform.value = u[key];
      if (u.auroraVisibility > 0) {
        const passSize = uniforms.uPassSize.value;
        passSize.set(Math.ceil(size.x / 2), Math.ceil(size.y / 2));
        auroraTarget.setSize(passSize.x, passSize.y);
        renderer.setRenderTarget(auroraTarget);
        mesh.material = auroraMaterial;
        renderer.render(scene, camera);
        mesh.material = material;
        renderer.setRenderTarget(null);
      }
      renderer.render(scene, camera);
    }

    return {
      maxTexture: renderer.capabilities.maxTextureSize,
      load, render, setTiles,
      // high-resolution tiles: map width (0 = off), tiles in view and how many of them have loaded
      get tileInfo() {
        if (!tiles) return { width: 0, wanted: 0, ready: 0 };
        // the finest level in view, and how many of all the tiles in view have loaded
        const top = tiles.wanted.length ? Math.floor(Math.max(...tiles.wanted) / LEVEL_KEY) : 0;
        return { width: tiles.levels[top].width, wanted: tiles.wanted.length,
          ready: tiles.wanted.filter(k => tiles.entries.get(k)?.ready).length };
      },
      // also catch a context that died without an event (seen after app switches on phones)
      get lost() { return lost || renderer.getContext().isContextLost(); },
      dispose() { try { renderer.dispose(); } catch (e) { /* context already gone */ } },
      on(event, fn) { listeners[event]?.push(fn); },
      get textureSize() { return uniforms.uSky.value?.image.width || 0; }
    };
  };
})();
