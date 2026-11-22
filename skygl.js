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
    const listeners = { lost: [], restored: [] };
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

    function render(u) {
      if (lost) return;
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
      load, render,
      get lost() { return lost; },
      on(event, fn) { listeners[event]?.push(fn); },
      get textureSize() { return uniforms.uSky.value?.image.width || 0; }
    };
  };
})();
