/* Meteor Storm Simulator
 * A real-time, ground-level view of a meteor shower or storm.
 * No dependencies. Directions are unit vectors: x = east, y = north, z = up.
 */
(() => {
  'use strict';

  // ------------------------------------------------------------------ constants
  const DEG = Math.PI / 180;
  const TAU = Math.PI * 2;
  const RE = 6371;        // km, Earth radius
  const HM = 100;         // km, typical meteor height
  const MAX_RANGE = Math.sqrt((RE + HM) ** 2 - RE ** 2); // ~1133 km, distance to a meteor on the horizon
  const EXT_K = 0.25;     // mag of atmospheric extinction per airmass
  const REF_LM = 6.5;     // the rate is defined for a pristine sky

  const SHOWERS = {
    leonids:  { name: 'Leonids',  v: 71, az: 105, alt: 52, r: 2.5, trainProb: 0.85,
      note: '71 km/s, the fastest major shower. The bright ones leave glowing green trains. The 1833 and 1966 storms came from this shower.' },
    perseids: { name: 'Perseids', v: 59, az: 35,  alt: 55, r: 2.2, trainProb: 0.55,
      note: '59 km/s, radiant in Perseus. The classic August shower, rich in bright meteors.' },
    geminids: { name: 'Geminids', v: 35, az: 160, alt: 68, r: 2.6, trainProb: 0.04,
      note: '35 km/s. Slower, longer-lasting and yellowish-white. Trains are rare.' },
    quadrantids: { name: 'Quadrantids', v: 41, az: 40, alt: 62, r: 2.1, trainProb: 0.08,
      note: '41 km/s, radiant in northern Boötes. A sharp January peak lasting only a few hours, with some bright, bluish meteors.' },
    lyrids:   { name: 'Lyrids',   v: 49, az: 70,  alt: 64, r: 2.1, trainProb: 0.25,
      note: '49 km/s, radiant near Vega. One of the oldest recorded showers, seen for about 2,700 years. Normally modest, with rare outbursts.' },
    etaAquariids: { name: 'η Aquariids', v: 66, az: 105, alt: 22, r: 2.4, trainProb: 0.6,
      note: '66 km/s, from Halley\'s Comet. The radiant is low before dawn, so many meteors skim the atmosphere and draw long, shallow trails.' },
    orionids: { name: 'Orionids', v: 66, az: 150, alt: 55, r: 2.5, trainProb: 0.55,
      note: '66 km/s, also from Halley\'s Comet. A gentle October shower with fast meteors that often leave trains.' },
    draconids: { name: 'Draconids', v: 20, az: 320, alt: 62, r: 2.6, trainProb: 0.01,
      note: '20 km/s, one of the slowest showers, seen in the evening. Usually almost absent, but it has stormed when Earth crossed fresh dust from comet Giacobini–Zinner.' },
    sporadic: { name: 'Sporadic', v: 0,   az: 0,   alt: 0,  r: 3.0, trainProb: 0.3,
      note: 'Background meteors from random directions and at random speeds, with no radiant.' },
  };

  // Rates are what a dark-adapted observer would see over the whole sky under a pristine sky,
  // close to the shower's ZHR. A scenario with `lm` also sets the sky darkness.
  const PRESETS = [
    { group: 'Any clear night' },
    { label: 'Ordinary night',   sub: '~10 per hour',     rate: 10 / 3600,   shower: 'sporadic', lm: 6.5,
      note: 'No shower active. Sporadic meteors arrive all year at a few to ten per hour, more after midnight.' },
    { label: 'Perseids, city',   sub: 'Peak, mag 3.5 sky', rate: 100 / 3600, shower: 'perseids', lm: 3.5,
      note: 'The same Perseids peak seen from a lit-up city. Only the brightest get through, so most people count a handful per hour.' },
    { label: 'Perseids, suburbs', sub: 'Peak, mag 5 sky', rate: 100 / 3600, shower: 'perseids', lm: 5.0,
      note: 'A typical backyard on peak night. You lose most of the meteors a pristine site would show.' },

    { group: 'Yearly showers at their peak' },
    { label: 'Quadrantids',      sub: '3–4 Jan · ~110/hr', rate: 110 / 3600, shower: 'quadrantids', lm: 6.5,
      note: 'One of the strongest showers of the year, but the peak lasts only about six hours and January weather often hides it.' },
    { label: 'Lyrids',           sub: '22 Apr · ~18/hr',  rate: 18 / 3600,  shower: 'lyrids', lm: 6.5,
      note: 'A modest spring shower. It surprised observers with about 90 per hour in 1982.' },
    { label: 'η Aquariids',      sub: '6 May · ~50/hr',   rate: 50 / 3600,  shower: 'etaAquariids', lm: 6.5,
      note: 'Best from the Southern Hemisphere. From mid-northern latitudes the radiant barely rises before dawn and you see far fewer.' },
    { label: 'Perseids peak',    sub: '12 Aug · ~100/hr', rate: 100 / 3600, shower: 'perseids', lm: 6.5,
      note: 'The best-known shower: warm nights and plenty of bright meteors and fireballs.' },
    { label: 'Orionids',         sub: '21 Oct · ~20/hr',  rate: 20 / 3600,  shower: 'orionids', lm: 6.5,
      note: 'Halley\'s debris, met for the second time each year. From 2006 to 2009 it ran at 50–70 per hour.' },
    { label: 'Geminids peak',    sub: '14 Dec · ~150/hr', rate: 150 / 3600, shower: 'geminids', lm: 6.5,
      note: 'Now the richest yearly shower, from the rocky asteroid 3200 Phaethon rather than a comet.' },

    { group: 'Outbursts and storms' },
    { label: 'Draconids 2011',   sub: '~400 per hour',    rate: 400 / 3600,  shower: 'draconids', lm: 6.5,
      note: 'An outburst predicted to within minutes, on 8 October 2011. Slow meteors in the early evening sky.' },
    { label: 'Leonids 1999',     sub: '~3,700 per hour',  rate: 3700 / 3600, shower: 'leonids', lm: 6.5,
      note: 'Seen from Europe and the Middle East on 18 November 1999. The peak lasted under an hour.' },
    { label: 'Leonids 2001',     sub: '~3,000 per hour',  rate: 3000 / 3600, shower: 'leonids', lm: 6.5,
      note: 'Seen from East Asia and Australia, with many bright meteors and fireballs.' },
    { label: 'Draconids 1933',   sub: '~10,000 per hour', rate: 10000 / 3600, shower: 'draconids', lm: 6.5,
      note: 'Over Europe on 9 October 1933: a slow evening storm, strongest for about an hour.' },
    { label: 'Leonids 1833',     sub: '~20 per second (est.)', rate: 20, shower: 'leonids', lm: 6.5,
      note: 'Seen across North America on 13 November 1833. It led to the discovery that a shower\'s meteors come from one radiant.' },
    { label: 'Leonids 1966',     sub: '~40 per second',   rate: 40,          shower: 'leonids', lm: 6.5,
      note: 'Over the western United States on 17 November 1966. Observers in Arizona saw meteors fall like rain for about 20 minutes.' },
    { label: '44 per second',    sub: '158,400 per hour', rate: 44,          shower: 'leonids' },
  ];

  // ------------------------------------------------------------------ helpers
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  const dir = (az, alt) => [Math.cos(alt) * Math.sin(az), Math.cos(alt) * Math.cos(az), Math.sin(alt)];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const azOf = v => Math.atan2(v[0], v[1]);

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) {
    let u = 0; while (!u) u = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * r());
  }
  // Kasten & Young airmass
  function airmass(alt) {
    const a = Math.max(alt, -0.5 * DEG);
    return 1 / (Math.sin(a) + 0.50572 * Math.pow(a / DEG + 6.07995, -1.6364));
  }
  // Distance (km) to a point at height HM seen at altitude `alt`
  function slantRange(alt) {
    return Math.sqrt((RE + HM) ** 2 - (RE * Math.cos(alt)) ** 2) - RE * Math.sin(alt);
  }
  const expRand = rate => -Math.log(1 - Math.random()) / rate;

  // ------------------------------------------------------------------ state
  const S = { rate: 44, shower: 'leonids', lm: 6.5, timeScale: 1, mode: 'sky', showRadiant: false, comet: true };
  let radVec = dir(SHOWERS.leonids.az * DEG, SHOWERS.leonids.alt * DEG);
  const setRadiant = (az, alt) => { radVec = dir(az, alt); };

  const cam = { yaw: 108 * DEG, pitch: 27 * DEG, fov: 100 * DEG };
  let W = 0, H = 0, DPR = 1, focal = 1;
  let F = [0, 1, 0], R = [1, 0, 0], U = [0, 0, 1];
  let skyDirty = true, skyRough = false, lastCamMove = -1e9;

  const canvas = document.getElementById('sky');
  const ctx = canvas.getContext('2d');
  const bg = document.createElement('canvas'); const bgx = bg.getContext('2d'); // sky, Milky Way, faint stars
  const fg = document.createElement('canvas'); const fgx = fg.getContext('2d'); // ground silhouette

  function updateCam() {
    cam.pitch = clamp(cam.pitch, -8 * DEG, 85 * DEG);
    cam.fov = clamp(cam.fov, 30 * DEG, 120 * DEG);
    cam.yaw = ((cam.yaw % TAU) + TAU) % TAU;
    F = dir(cam.yaw, cam.pitch);
    R = [Math.cos(cam.yaw), -Math.sin(cam.yaw), 0];
    U = cross(R, F);
    focal = (Math.max(W, H) / 2) / Math.tan(cam.fov / 2);
    skyDirty = true;
    lastCamMove = performance.now();
  }

  // Rectilinear (gnomonic) projection: great circles, and so meteor paths, are straight lines.
  const _p = [0, 0];
  function project(v) {
    const cz = dot(v, F);
    if (cz < 0.03) return null;
    _p[0] = W / 2 + (dot(v, R) / cz) * focal;
    _p[1] = H / 2 - (dot(v, U) / cz) * focal;
    return _p;
  }
  function unproject(x, y) {
    const sx = (x - W / 2) / focal, sy = -(y - H / 2) / focal;
    return norm([F[0] + R[0] * sx + U[0] * sy, F[1] + R[1] * sx + U[1] * sy, F[2] + R[2] * sx + U[2] * sy]);
  }
  const onScreen = (p, m = 0) => p[0] >= -m && p[0] <= W + m && p[1] >= -m && p[1] <= H + m;

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    for (const c of [canvas, bg, fg]) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); }
    updateCam();
  }

  function makeSprite(size, stops) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [o, col] of stops) gr.addColorStop(o, col);
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    return c;
  }
  const glow = makeSprite(64, [[0, 'rgba(255,255,255,1)'], [0.12, 'rgba(255,255,255,0.6)'],
    [0.4, 'rgba(255,255,255,0.12)'], [1, 'rgba(255,255,255,0)']]);
  const mwSprite = makeSprite(32, [[0, 'rgba(200,212,240,1)'], [0.5, 'rgba(190,200,232,0.35)'], [1, 'rgba(180,190,220,0)']]);

  // ------------------------------------------------------------------ the static sky
  const srand = mulberry32(1966);

  // Stars: random positions, magnitudes with roughly the real growth (~3x more per magnitude).
  const STAR_COLORS = [[190, 210, 255], [225, 232, 255], [255, 250, 242], [255, 236, 205], [255, 212, 170]];
  const faintStars = [], brightStars = [];
  for (let i = 0; i < 9000; i++) {
    const z = srand() * 2 - 1, ph = srand() * TAU, rxy = Math.sqrt(1 - z * z);
    let m = 7.2 + Math.log(1 - srand()) / Math.log(3.1);
    const cr = srand();
    if (z < -0.05) continue;
    if (m < -1.4) m = -1.4 + srand() * 0.6;
    const col = STAR_COLORS[cr < 0.12 ? 0 : cr < 0.35 ? 1 : cr < 0.7 ? 2 : cr < 0.9 ? 3 : 4];
    const alt = Math.asin(z), am = airmass(alt);
    const s = { v: [rxy * Math.cos(ph), rxy * Math.sin(ph), z], m, alt, am, css: rgb(col),
      mEff: m + EXT_K * (am - 1), ph: srand() * TAU, f: 5 + srand() * 9, f2: 3 + srand() * 5 };
    (m < 2.4 ? brightStars : faintStars).push(s);
  }

  // Milky Way: a band of soft dots around a great circle, brighter and wider toward a "core", with a dark rift.
  const GP = dir(290 * DEG, 28 * DEG);
  const E1 = norm(cross(GP, [0, 0, 1])), E2 = cross(GP, E1);
  const THC = 3.75;
  const mw = [];      // fine grain
  const mwGlow = [];  // broad, smooth base
  for (let i = 0; i < 30000; i++) {
    const th = srand() * TAU;
    const d = Math.atan2(Math.sin(th - THC), Math.cos(th - THC));
    const core = Math.exp(-((d / 0.9) ** 2));
    const b = gauss(srand) * (3 + 5.5 * core) * DEG;
    let w = (0.3 + 1.3 * core) * (0.45 + srand() * 0.9);
    if (Math.abs(d) < 1.3 && b > -1 * DEG && b < 3 * DEG) w *= 0.3;
    const cb = Math.cos(b), sb = Math.sin(b), ct = Math.cos(th), st = Math.sin(th);
    const v = [cb * (ct * E1[0] + st * E2[0]) + sb * GP[0],
               cb * (ct * E1[1] + st * E2[1]) + sb * GP[1],
               cb * (ct * E1[2] + st * E2[2]) + sb * GP[2]];
    if (v[2] < -0.05) continue;
    const q = { v, w: w * Math.pow(10, -0.4 * EXT_K * (airmass(Math.asin(v[2])) - 1)) };
    (i % 10 === 0 ? mwGlow : mw).push(q);
  }

  // Horizon: rolling hills with patches of conifers, in degrees of altitude, every 0.1° of azimuth.
  const TN = 3600;
  const terr = new Float32Array(TN);
  for (let i = 0; i < TN; i++) {
    const a = (i / TN) * TAU;
    terr[i] = Math.max(0.15, 0.9 + 0.55 * Math.sin(a * 2 + 0.7) + 0.35 * Math.sin(a * 5 + 2.1)
      + 0.18 * Math.sin(a * 11 + 0.3) + 0.07 * Math.sin(a * 29 + 1.3));
  }
  const hills = terr.slice();
  const forest = a => Math.sin(a * 3 + 1.1) + 0.6 * Math.sin(a * 7 + 0.4) > -0.35;
  for (let k = 0; k < 1100; k++) {
    const c = Math.floor(srand() * TN), a = (c / TN) * TAU;
    if (!forest(a)) continue;
    const h = 0.9 + srand() * 2.8;
    const round = srand() < 0.15;
    const hw = Math.max(2, Math.round((round ? 0.45 : 0.19) * h * 10 * (0.8 + srand() * 0.5)));
    const base = hills[c];
    for (let j = -hw; j <= hw; j++) {
      const idx = (c + j + TN) % TN, f = 1 - Math.abs(j) / hw;
      const y = round ? base + h * 0.8 * Math.sqrt(1 - (j / hw) ** 2)
                      : base + h * f * (0.9 + 0.1 * Math.sin(j * 2.7 + k));
      if (y > terr[idx]) terr[idx] = y;
    }
  }
  const terrainAt = az => terr[((Math.round((az / DEG) * 10) % TN) + TN) % TN];

  // Comet: a bright one low in the east before dawn. It sits still among the stars over a night's
  // watch. The gas (ion) tail points straight away from the Sun; the dust tail curves behind it.
  const COMET = { az: 80, alt: 12, sunAz: 95, sunAlt: -20, ionLen: 24, dustLen: 16 };
  const dustSprite = makeSprite(32, [[0, 'rgba(255,238,212,1)'], [0.5, 'rgba(255,230,200,0.35)'], [1, 'rgba(255,225,190,0)']]);
  const ionSprite = makeSprite(32, [[0, 'rgba(140,185,255,1)'], [0.5, 'rgba(130,175,255,0.3)'], [1, 'rgba(120,165,255,0)']]);
  const comaSprite = makeSprite(64, [[0, 'rgba(225,255,232,1)'], [0.2, 'rgba(175,240,205,0.5)'], [1, 'rgba(140,220,180,0)']]);
  const comet = (() => {
    const crand = mulberry32(1997);
    const head = dir(COMET.az * DEG, COMET.alt * DEG), sun = dir(COMET.sunAz * DEG, COMET.sunAlt * DEG);
    const c = dot(head, sun);
    const t = norm([head[0] * c - sun[0], head[1] * c - sun[1], head[2] * c - sun[2]]); // away from the Sun
    const n = cross(head, t);
    const pts = [];
    // s: degrees along the tail, l: degrees to the side, r: sprite radius in degrees
    const add = (s, l, r, a, u, sprite) => {
      const cs = Math.cos(s * DEG), sn = Math.sin(s * DEG), lt = l * DEG;
      const v = norm([head[0] * cs + t[0] * sn + n[0] * lt, head[1] * cs + t[1] * sn + n[1] * lt, head[2] * cs + t[2] * sn + n[2] * lt]);
      if (v[2] < -0.02) return;
      const ext = Math.pow(10, -0.4 * EXT_K * (airmass(Math.asin(v[2])) - 1));
      pts.push({ v, r, a: a * ext, u, sprite });
    };
    // Dust tail: a fan of synchrones, curving more the older the dust.
    const NS = 9;
    for (let j = 0; j < NS; j++) {
      const f = j / (NS - 1), len = COMET.dustLen * (1 - 0.4 * f) * (0.9 + crand() * 0.2);
      const br = (1 - 0.55 * f) * (0.75 + crand() * 0.5);
      const N = 110;
      for (let k = 1; k <= N; k++) {
        const u = k / N, s = u * len;
        add(s, (1.6 + 4 * f) * u * u * COMET.dustLen / 10, 0.35 + u * 1.9, 0.06 * br * (1 - u) ** 1.2, s / COMET.ionLen, dustSprite);
      }
    }
    // Ion tail: thin, slightly diverging rays with knots.
    for (let j = 0; j < 7; j++) {
      const ang = gauss(crand) * 0.03, len = COMET.ionLen * (0.6 + crand() * 0.4);
      const br = 0.4 + crand() * 0.6, fq = 8 + crand() * 14, ph = crand() * TAU;
      const N = 160;
      for (let k = 1; k <= N; k++) {
        const u = k / N, s = u * len;
        const knots = (0.65 + 0.35 * Math.sin(u * fq + ph)) ** 2;
        add(s, s * ang, 0.15 + u * 0.55, 0.3 * br * knots * (1 - u) ** 0.8, s / COMET.ionLen, ionSprite);
      }
    }
    const ext = Math.pow(10, -0.4 * EXT_K * (airmass(COMET.alt * DEG) - 1));
    return { head, t, pts, ext };
  })();

  // ------------------------------------------------------------------ cached layers
  function skyColors() {
    const t = clamp((6.6 - S.lm) / 3.4, 0, 1);
    return {
      zen: mix([3, 5, 11], [27, 26, 37], t),
      hor: mix([13, 17, 27], [80, 60, 45], t),
      ground: mix([2, 3, 5], [10, 9, 10], t),
    };
  }

  function renderBg(quick) {
    const c = bgx;
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    const col = skyColors();
    const yH = H / 2 + Math.tan(cam.pitch) * focal;            // horizon line (no camera roll)
    const y35 = H / 2 - Math.tan(35 * DEG - cam.pitch) * focal;
    const g = c.createLinearGradient(0, yH, 0, y35);
    g.addColorStop(0, rgb(col.hor));
    g.addColorStop(0.35, rgb(mix(col.hor, col.zen, 0.65)));
    g.addColorStop(1, rgb(col.zen));
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);

    c.globalCompositeOperation = 'lighter';
    const mwVis = clamp((S.lm - 4.6) / 1.6, 0, 1);
    if (mwVis > 0) {
      // While the view is moving, draw only the cheap smooth layer (brightened to make up for the grain).
      const layers = quick ? [[mwGlow, 6.5, 0.026]] : [[mwGlow, 6.5, 0.022], [mw, 1.1, 0.02]];
      for (const [pts, deg, alpha] of layers) {
        const sz = Math.max(4, focal * Math.tan(deg * DEG));
        for (const q of pts) {
          const p = project(q.v);
          if (!p || !onScreen(p, sz)) continue;
          c.globalAlpha = q.w * alpha * mwVis;
          c.drawImage(mwSprite, p[0] - sz / 2, p[1] - sz / 2, sz, sz);
        }
      }
    }
    for (const s of faintStars) {
      if (s.mEff > S.lm) continue;
      const p = project(s.v);
      if (!p || !onScreen(p, 2)) continue;
      const vis = S.lm - s.mEff;
      const r = 0.5 + Math.max(0, 4 - s.mEff) * 0.28;
      c.globalAlpha = Math.min(1, 0.18 + vis * 0.24);
      c.fillStyle = s.css;
      if (r < 0.9) c.fillRect(p[0] - r, p[1] - r, r * 2, r * 2);
      else { c.beginPath(); c.arc(p[0], p[1], r, 0, TAU); c.fill(); }
    }
    if (S.comet) drawComet(c, quick);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  function drawComet(c, quick) {
    // A bright sky drowns the faint outer tail first, then the rest.
    const dark = clamp((S.lm - 2.8) / 3.7, 0, 1);
    const fade = (6.8 - S.lm) * 1.1;
    const pxPerDeg = focal * DEG;
    for (let i = 0; i < comet.pts.length; i += quick ? 2 : 1) {
      const q = comet.pts[i];
      const a = q.a * dark * Math.exp(-q.u * fade) * (quick ? 2 : 1);
      if (a < 0.002) continue;
      const sz = Math.max(2, 2 * q.r * pxPerDeg);
      const p = project(q.v);
      if (!p || !onScreen(p, sz)) continue;
      c.globalAlpha = Math.min(1, a);
      c.drawImage(q.sprite, p[0] - sz / 2, p[1] - sz / 2, sz, sz);
    }
    const p = project(comet.head);
    if (!p || !onScreen(p, 40)) return;
    const x = p[0], y = p[1], e = comet.ext * (0.45 + 0.55 * dark);
    for (const [rDeg, a] of [[0.9, 0.22], [0.35, 0.5], [0.12, 0.9]]) {
      const sz = Math.max(4, 2 * rDeg * pxPerDeg);
      c.globalAlpha = a * e;
      c.drawImage(comaSprite, x - sz / 2, y - sz / 2, sz, sz);
    }
    c.globalAlpha = Math.min(1, e * 1.2);
    c.drawImage(glow, x - 5, y - 5, 10, 10);
    c.fillStyle = 'rgb(255,255,245)';
    c.beginPath(); c.arc(x, y, 1.3, 0, TAU); c.fill();
  }

  function renderFg() {
    const c = fgx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, fg.width, fg.height);
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    c.beginPath();
    let first = true, firstX = 0, lastX = 0;
    for (let d = -880; d <= 880; d++) {
      const az = cam.yaw + d * 0.1 * DEG;
      const p = project(dir(az, terrainAt(az) * DEG));
      if (!p) continue;
      if (first) { c.moveTo(p[0], p[1]); firstX = p[0]; first = false; } else c.lineTo(p[0], p[1]);
      lastX = p[0];
    }
    if (first) return;
    c.lineTo(lastX, 1e5);
    c.lineTo(firstX, 1e5);
    c.closePath();
    c.fillStyle = rgb(skyColors().ground);
    c.fill();
  }

  // ------------------------------------------------------------------ meteors
  const meteors = [], trains = [];
  let simT = 0, nextSpawn = 0;
  let seen = [], seenStart = 0, totalSeen = 0, fireballs = 0, tallyStart = 0;

  const resetSpawn = () => { nextSpawn = simT + expRand(S.rate); };
  const resetSeen = () => { seen = []; seenStart = simT; };

  function sampleMag(r) {
    // N(<=m) grows by a factor r per magnitude, up to the naked-eye limit
    return Math.max(-9, REF_LM + Math.log(1 - Math.random()) / Math.log(r));
  }

  function spawnOne() {
    const sh = SHOWERS[S.shower];
    for (let tries = 0; tries < 2500; tries++) {
      // candidate position on the sky
      const z = Math.random(), ph = Math.random() * TAU, rxy = Math.sqrt(1 - z * z);
      const P = [rxy * Math.cos(ph), rxy * Math.sin(ph), z];
      const alt = Math.asin(z);
      const range = slantRange(alt);
      // Low in the sky you look through much more of the meteor layer per patch of sky...
      if (Math.random() > (range / MAX_RANGE) ** 2) continue;
      if (S.mode === 'view') { const p = project(P); if (!p || !onScreen(p)) continue; }
      // ...but those meteors are farther away and seen through more air.
      const m = sampleMag(sh.r);
      const mEff = m + 5 * Math.log10(range / HM) + EXT_K * (airmass(alt) - 1);
      if (mEff > REF_LM) continue;

      let rad = radVec, v = sh.v;
      if (S.shower === 'sporadic') {
        const rz = -0.15 + Math.random() * 1.15, rp = Math.random() * TAU, rr = Math.sqrt(1 - rz * rz);
        rad = [rr * Math.cos(rp), rr * Math.sin(rp), rz];
        v = 12 + Math.random() * 58;
      }

      // Direction of travel on the sky: along the great circle away from the radiant.
      const c = dot(P, rad);
      let t = [P[0] * c - rad[0], P[1] * c - rad[1], P[2] * c - rad[2]];
      const tl = Math.hypot(t[0], t[1], t[2]);
      if (tl < 1e-5) {
        const a = Math.random() * TAU;
        const e = norm(cross(P, [0, 0, 1]));
        const n = cross(P, e);
        t = [e[0] * Math.cos(a) + n[0] * Math.sin(a), e[1] * Math.cos(a) + n[1] * Math.sin(a), e[2] * Math.cos(a) + n[2] * Math.sin(a)];
      } else t = [t[0] / tl, t[1] / tl, t[2] / tl];

      const elong = Math.acos(clamp(c, -1, 1));
      const omega = (v * Math.sin(elong)) / range;                   // rad/s across the sky
      const dur = clamp((10 + Math.random() * 35) / v, 0.08, 2.2) * (1 + Math.max(0, 1 - mEff) * 0.1);
      const L = omega * dur;

      const tv = clamp((v - 25) / 45, 0, 1);
      meteors.push({
        P, t, sA: -L / 2, L, dur, age: 0, m: mEff,
        head: mix([255, 232, 190], [212, 234, 255], tv).map(Math.round),
        trail: mix([255, 160, 80], [120, 255, 175], tv).map(Math.round),
        flareAt: 0.5 + Math.random() * 0.45,
        flareAmp: mEff < 1.5 && Math.random() < 0.35 ? 0.6 + Math.random() * 1.8 : 0,
        train: mEff < 2 && Math.random() < sh.trainProb,
      });

      // Did it land in the view, above the trees, bright enough for this sky?
      if (mEff <= S.lm && alt > terrainAt(azOf(P)) * DEG) {
        const p = project(P);
        if (p && onScreen(p)) {
          seen.push(simT); totalSeen++;
          if (mEff <= -4) fireballs++;
        }
      }
      return;
    }
  }

  const arcPoint = (M, s) => {
    const c = Math.cos(s), sn = Math.sin(s);
    return [M.P[0] * c + M.t[0] * sn, M.P[1] * c + M.t[1] * sn, M.P[2] * c + M.t[2] * sn];
  };

  function lightCurve(p, M) {
    let I = p < 0.65 ? Math.sin((p / 0.65) * Math.PI / 2) : Math.cos(((p - 0.65) / 0.35) * Math.PI / 2);
    I = Math.max(0, I) ** 0.9;
    if (M.flareAmp) I += M.flareAmp * Math.exp(-(((p - M.flareAt) / 0.045) ** 2));
    return I;
  }

  function makeTrain(M) {
    const pts = [];
    for (let k = 0; k < 16; k++) pts.push(arcPoint(M, M.sA + M.L * (0.12 + 0.83 * k / 15)));
    trains.push({
      pts, age: 0,
      life: 0.5 + Math.max(0, 1.5 - M.m) * 0.75 * (0.6 + Math.random() * 0.8),
      a0: clamp((2 - M.m) * 0.07, 0.04, 0.55),
      col: M.trail, seed: Math.random() * 100,
      wx: (Math.random() - 0.5) * 6, wy: (Math.random() - 0.3) * 4,
    });
  }

  let visibleNow = 0;

  function drawMeteors(dt) {
    ctx.lineCap = 'round';
    let flash = 0;
    visibleNow = 0;
    for (let i = meteors.length - 1; i >= 0; i--) {
      const M = meteors[i];
      M.age += dt;
      const p = M.age / M.dur;
      if (p >= 1) {
        if (M.train && M.m <= S.lm) makeTrain(M);
        meteors[i] = meteors[meteors.length - 1]; meteors.pop();
        continue;
      }
      if (M.m > S.lm + 0.3) continue;
      const I = lightCurve(p, M);
      if (I < 0.005) continue;
      const mNow = M.m - 2.5 * Math.log10(I);
      const vis = S.lm - mNow;
      if (vis < -0.3) continue;
      // A monitor can't match a dark-adapted eye, so faint meteors get a floor of visibility.
      const a = clamp(0.5 + vis * 0.2, 0, 1);

      const sH = M.sA + M.L * p;
      const tailFrac = Math.min(0.85, 0.5 + Math.max(0, 2 - M.m) * 0.06);
      const sT = Math.max(M.sA, sH - M.L * tailFrac);
      let ph = project(arcPoint(M, sH)); if (!ph) continue;
      const hx = ph[0], hy = ph[1];
      ph = project(arcPoint(M, sT)); if (!ph) continue;
      const tx = ph[0], ty = ph[1];
      if ((hx < -60 && tx < -60) || (hx > W + 60 && tx > W + 60) || (hy < -60 && ty < -60) || (hy > H + 60 && ty > H + 60)) continue;
      if (onScreen([hx, hy])) visibleNow++;

      const w = Math.min(7, 1.4 + Math.max(0, 3.5 - mNow) * 0.42);
      const [hr, hg, hb] = M.head, [tr, tg, tb] = M.trail;
      if (Math.hypot(hx - tx, hy - ty) > 0.5) {
        const g = ctx.createLinearGradient(tx, ty, hx, hy);
        g.addColorStop(0, `rgba(${tr},${tg},${tb},0)`);
        g.addColorStop(0.55, `rgba(${tr},${tg},${tb},${(a * 0.4).toFixed(3)})`);
        g.addColorStop(1, `rgba(${hr},${hg},${hb},${a.toFixed(3)})`);
        ctx.strokeStyle = g;
        ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
        if (mNow < 1) { ctx.globalAlpha = 0.25; ctx.lineWidth = w * 3.2; ctx.stroke(); ctx.globalAlpha = 1; }
      }
      const hs = mNow < 2.5 ? Math.min(60, 3 + (2.5 - mNow) * 4.5) : 2.5;
      ctx.globalAlpha = a * (mNow < 2.5 ? 0.9 : 0.6);
      ctx.drawImage(glow, hx - hs, hy - hs, hs * 2, hs * 2);
      ctx.globalAlpha = 1;
      if (mNow < -2) flash += Math.pow(10, -0.4 * (mNow + 2)) * 0.01;
    }
    return flash;
  }

  function drawTrains(dt) {
    const sc = focal / 900;
    const dark = clamp((S.lm - 3) / 3.5, 0.15, 1);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (let i = trains.length - 1; i >= 0; i--) {
      const T = trains[i];
      T.age += dt;
      const k = T.age / T.life;
      if (k >= 1) { trains[i] = trains[trains.length - 1]; trains.pop(); continue; }
      const a = T.a0 * (1 - k) * (1 - k) * dark;
      ctx.beginPath();
      let started = false;
      for (let j = 0; j < T.pts.length; j++) {
        const p = project(T.pts[j]);
        if (!p) { started = false; continue; }
        const x = p[0] + (Math.sin(j * 0.8 + T.seed + T.age * 0.6) * T.age * 3 + T.wx * T.age) * sc;
        const y = p[1] + (Math.cos(j * 0.55 + T.seed) * T.age * 2 + T.wy * T.age) * sc;
        if (started) ctx.lineTo(x, y); else { ctx.moveTo(x, y); started = true; }
      }
      const c = mix(T.col, [200, 90, 90], k);
      ctx.strokeStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;
      ctx.lineWidth = (1.2 + T.age * 1.8) * Math.max(0.6, sc);
      ctx.stroke();
      ctx.globalAlpha = 0.35; ctx.lineWidth *= 3; ctx.stroke(); ctx.globalAlpha = 1;
    }
  }

  function drawBrightStars(t) {
    for (const s of brightStars) {
      if (s.mEff > S.lm) continue;
      const p = project(s.v);
      if (!p || !onScreen(p, 10)) continue;
      const amp = 0.06 + 0.16 * Math.min(1, (s.am - 1) / 3);   // twinkles more low down
      const tw = 1 + amp * 0.5 * (Math.sin(t * s.f + s.ph) + Math.sin(t * s.f2 + s.ph * 2));
      const vis = S.lm - s.mEff;
      const a = clamp(0.3 + vis * 0.2, 0, 1) * tw;
      const r = 0.6 + Math.max(0, 4 - s.mEff) * 0.3;
      ctx.globalAlpha = Math.min(1, a);
      ctx.fillStyle = s.css;
      ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.fill();
      ctx.globalAlpha = Math.min(1, a) * 0.3;
      const g = r * 5;
      ctx.drawImage(glow, p[0] - g, p[1] - g, g * 2, g * 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawRadiant() {
    if (!S.showRadiant || S.shower === 'sporadic') return;
    const p = project(radVec);
    if (!p || !onScreen(p, 20)) return;
    const x = p[0], y = p[1];
    ctx.save();
    ctx.strokeStyle = 'rgba(155,215,255,0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.arc(x, y, 16, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(155,215,255,0.85)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${SHOWERS[S.shower].name} radiant`, x, y - 24);
    ctx.restore();
  }

  // ------------------------------------------------------------------ loop
  let last = performance.now(), realT = 0, lastHud = 0;

  function frame(now) {
    render(now);
    requestAnimationFrame(frame);
  }

  function render(now) {
    const dtReal = Math.min(0.1, (now - last) / 1000);
    last = now; realT += dtReal;
    const dt = dtReal * S.timeScale;

    if (dt > 0) {
      simT += dt;
      let n = 0;
      while (nextSpawn <= simT && n < 3000) { spawnOne(); nextSpawn += expRand(S.rate); n++; }
      if (n >= 3000) resetSpawn();
    }
    if (skyDirty) {
      const moving = now - lastCamMove < 150;
      renderBg(moving); renderFg();
      skyDirty = false; skyRough = moving;
    } else if (skyRough && now - lastCamMove >= 150) {
      renderBg(false); skyRough = false;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(bg, 0, 0);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    ctx.globalCompositeOperation = 'lighter';
    drawBrightStars(realT);
    drawTrains(dt);
    const flash = drawMeteors(dt);

    ctx.globalCompositeOperation = 'source-over';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(fg, 0, 0);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    if (flash > 0.002) {   // a fireball lights up the whole landscape
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(110,130,160,${Math.min(0.32, flash).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    drawRadiant();

    if (now - lastHud > 250) { updateHud(); lastHud = now; }
  }

  // ------------------------------------------------------------------ UI
  const $ = id => document.getElementById(id);
  const nf = new Intl.NumberFormat('en-US');
  const el = {
    hudBig: $('hudBig'), hudUnit: $('hudUnit'), hudSub: $('hudSub'), hudSeen: $('hudSeen'),
    rate: $('rate'), rateNum: $('rateNum'), rateOut: $('rateOut'), compare: $('compare'),
    presets: $('presets'), presetNote: $('presetNote'), showerSeg: $('showerSeg'), showerNote: $('showerNote'),
    lm: $('lm'), lmOut: $('lmOut'), fov: $('fov'), fovOut: $('fovOut'),
    timeSeg: $('timeSeg'), modeSeg: $('modeSeg'), showRadiant: $('showRadiant'), showComet: $('showComet'),
    stSeen: $('stSeen'), stFire: $('stFire'), stNow: $('stNow'), stTime: $('stTime'),
  };

  function fmtDur(sec) {
    if (sec < 1) return `${Math.round(sec * 1000)} ms`;
    if (sec < 90) return `${sec < 10 ? sec.toFixed(1) : Math.round(sec)} seconds`;
    if (sec < 5400) return `${Math.round(sec / 60)} minutes`;
    return `${(sec / 3600).toFixed(1)} hours`;
  }
  function fmtNum(x) {
    if (x >= 100) return nf.format(Math.round(x));
    if (x >= 10) return String(Math.round(x));
    return x.toFixed(1).replace(/\.0$/, '');
  }
  function formatRate(r) {
    if (r >= 1) {
      return { big: fmtNum(r), unit: r === 1 ? 'meteor / second' : 'meteors / second',
        sub: `${nf.format(Math.round(r * 3600))} per hour · one every ${fmtDur(1 / r)}` };
    }
    const ph = r * 3600;
    return { big: fmtNum(ph), unit: 'meteors / hour', sub: `about one every ${fmtDur(1 / r)}` };
  }
  function fmtShortRate(r) {
    if (r >= 1) return `${r.toFixed(r < 10 ? 1 : 0)} per second`;
    if (r * 60 >= 1) return `${(r * 60).toFixed(1)} per minute`;
    return `${Math.round(r * 3600)} per hour`;
  }

  const sliderToRate = v => Math.pow(10, -3 + (v * 6) / 1000);
  const rateToSlider = r => Math.round(((Math.log10(r) + 3) / 6) * 1000);

  function lmLabel(lm) {
    const name = lm >= 6.3 ? 'Pristine' : lm >= 5.7 ? 'Rural' : lm >= 4.8 ? 'Suburban' : lm >= 4 ? 'Bright suburb' : 'City';
    return `${name} · mag ${lm.toFixed(1)}`;
  }

  function refreshRateUi() {
    const f = formatRate(S.rate);
    el.rateOut.textContent = `${f.big} ${f.unit.replace('meteors ', '').replace('meteor ', '')}`;
    const x = S.rate / (100 / 3600);
    el.compare.textContent = x >= 1.5
      ? `About ${nf.format(Math.round(x))}× a Perseids peak (~100 per hour).`
      : x >= 0.67 ? 'About the rate of a Perseids peak (~100 per hour).'
      : `About 1/${Math.round(1 / x)} of a Perseids peak (~100 per hour).`;
    let note = '';
    for (const b of el.presets.querySelectorAll('.preset')) {
      const pr = PRESETS[+b.dataset.i];
      const on = Math.abs(S.rate - pr.rate) / pr.rate < 0.01 && S.shower === pr.shower
        && (pr.lm === undefined || Math.abs(S.lm - pr.lm) < 0.05);
      b.classList.toggle('active', on);
      if (on && pr.note && !note) note = pr.note;
    }
    el.presetNote.textContent = note;
    el.presetNote.hidden = !note;
  }

  function setRate(r, from) {
    S.rate = clamp(r, 0.001, 1000);
    if (from !== 'slider') el.rate.value = rateToSlider(S.rate);
    if (from !== 'num') el.rateNum.value = S.rate >= 1 ? +S.rate.toFixed(1) : +S.rate.toPrecision(2);
    resetSpawn(); resetSeen();
    refreshRateUi();
    updateHud();
  }

  function setShower(key) {
    S.shower = key;
    const sh = SHOWERS[key];
    if (key !== 'sporadic') setRadiant(sh.az * DEG, sh.alt * DEG);
    for (const b of el.showerSeg.children) b.classList.toggle('active', b.dataset.s === key);
    el.showerNote.textContent = sh.note;
    resetSeen();
    refreshRateUi();
  }

  function setSeg(seg, attr, value) {
    for (const b of seg.children) b.classList.toggle('active', b.dataset[attr] === String(value));
  }

  function updateHud() {
    const f = formatRate(S.rate);
    el.hudBig.textContent = f.big;
    el.hudUnit.textContent = f.unit;
    el.hudSub.textContent = f.sub;
    const win = S.rate >= 0.3 ? 10 : 600;
    let k = 0; while (k < seen.length && seen[k] < simT - win) k++;
    if (k) seen.splice(0, k);
    const span = Math.min(win, simT - seenStart);
    let text;
    if (span < 1.5) text = 'Counting…';
    else if (!seen.length) text = `None in this view yet (${fmtDur(span)})`;
    else text = `You're seeing ${fmtShortRate(seen.length / span)} in this view`;
    if (S.lm < REF_LM - 0.05) text += ' · light pollution hides the faint ones';
    el.hudSeen.textContent = text;

    el.stSeen.textContent = nf.format(totalSeen);
    el.stFire.textContent = nf.format(fireballs);
    el.stNow.textContent = String(visibleNow);
    const el2 = Math.floor(simT - tallyStart);
    el.stTime.textContent = `${Math.floor(el2 / 60)}:${String(el2 % 60).padStart(2, '0')}`;
  }

  // build preset buttons and shower segment
  PRESETS.forEach((pr, i) => {
    if (pr.group) {
      const h = document.createElement('div');
      h.className = 'preset-group'; h.textContent = pr.group;
      el.presets.appendChild(h);
      return;
    }
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'preset'; b.dataset.i = i;
    b.innerHTML = `<b>${pr.label}</b><span>${pr.sub}</span>`;
    b.addEventListener('click', () => {
      if (pr.lm !== undefined) setLm(pr.lm);
      setShower(pr.shower); setRate(pr.rate);
    });
    el.presets.appendChild(b);
  });
  for (const [key, sh] of Object.entries(SHOWERS)) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.s = key; b.textContent = sh.name;
    b.addEventListener('click', () => setShower(key));
    el.showerSeg.appendChild(b);
  }

  el.rate.addEventListener('input', () => setRate(sliderToRate(+el.rate.value), 'slider'));
  el.rateNum.addEventListener('input', () => { const v = parseFloat(el.rateNum.value); if (v > 0) setRate(v, 'num'); });
  el.rateNum.addEventListener('change', () => setRate(S.rate));

  function setLm(lm, from) {
    S.lm = lm; if (from !== 'slider') el.lm.value = lm;
    el.lmOut.textContent = lmLabel(S.lm); skyDirty = true; resetSeen();
    refreshRateUi();
  }
  el.lm.addEventListener('input', () => setLm(+el.lm.value, 'slider'));
  const syncFov = () => { el.fov.value = Math.round(cam.fov / DEG); el.fovOut.textContent = `${Math.round(cam.fov / DEG)}°`; };
  el.fov.addEventListener('input', () => { cam.fov = +el.fov.value * DEG; updateCam(); syncFov(); });

  let lastSpeed = 1;
  function setTime(t) {
    if (t > 0) lastSpeed = t;
    S.timeScale = t; setSeg(el.timeSeg, 't', t);
  }
  el.timeSeg.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setTime(+b.dataset.t); });
  el.modeSeg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    S.mode = b.dataset.m; setSeg(el.modeSeg, 'm', S.mode); resetSeen();
  });
  el.showRadiant.addEventListener('change', () => { S.showRadiant = el.showRadiant.checked; });
  const setComet = on => { S.comet = el.showComet.checked = on; skyDirty = true; };
  el.showComet.addEventListener('change', () => setComet(el.showComet.checked));
  $('findComet').addEventListener('click', () => {
    setComet(true);
    // frame the head low in the view with the tail rising above it
    const mid = arcPoint({ P: comet.head, t: comet.t }, COMET.ionLen * 0.35 * DEG);
    cam.yaw = azOf(mid); cam.pitch = Math.asin(mid[2]); updateCam();
  });
  $('resetTally').addEventListener('click', () => { totalSeen = 0; fireballs = 0; tallyStart = simT; updateHud(); });
  $('fullscreen').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  });
  const setPanel = open => document.body.classList.toggle('ui-hidden', !open);
  $('closePanel').addEventListener('click', () => setPanel(false));
  $('openPanel').addEventListener('click', () => setPanel(true));

  // ---- looking around
  const pointers = new Map();
  let pinch = null;
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.shiftKey || e.altKey) && S.shower !== 'sporadic') {
      const v = unproject(e.clientX, e.clientY);
      setRadiant(azOf(v), Math.max(0, Math.asin(v[2])));
      S.showRadiant = el.showRadiant.checked = true;
      return;
    }
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.classList.add('dragging');
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, fov: cam.fov };
    }
  });
  canvas.addEventListener('pointermove', e => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    if (pointers.size === 1) {
      cam.yaw -= (e.clientX - prev.x) / focal;
      cam.pitch += (e.clientY - prev.y) / focal;
      updateCam();
    }
    prev.x = e.clientX; prev.y = e.clientY;
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      cam.fov = pinch.fov * pinch.d / (Math.hypot(a.x - b.x, a.y - b.y) || 1);
      updateCam(); syncFov();
    }
  });
  const endPointer = e => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!pointers.size) canvas.classList.remove('dragging');
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    cam.fov *= Math.exp(e.deltaY * 0.0012);
    updateCam(); syncFov();
  }, { passive: false });

  window.addEventListener('keydown', e => {
    if (e.target instanceof HTMLInputElement && e.target.type === 'number') return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); setTime(S.timeScale === 0 ? lastSpeed : 0); }
    else if (k === 'h') setPanel(document.body.classList.contains('ui-hidden'));
    else if (k === 'z') document.body.classList.toggle('zen');
    else if (k === 'c') setComet(!S.comet);
    else if (k === 'f') $('fullscreen').click();
    else if (k === 'arrowleft') { cam.yaw -= 5 * DEG; updateCam(); }
    else if (k === 'arrowright') { cam.yaw += 5 * DEG; updateCam(); }
    else if (k === 'arrowup') { e.preventDefault(); cam.pitch += 5 * DEG; updateCam(); }
    else if (k === 'arrowdown') { e.preventDefault(); cam.pitch -= 5 * DEG; updateCam(); }
  });
  window.addEventListener('resize', resize);

  // handy for poking at the simulation from the browser console
  window.meteorSim = { S, cam, meteors, trains, comet, render, setRate: r => setRate(r),
    project: v => { const p = project(v); return p && [p[0], p[1]]; }, arcPoint };

  // ------------------------------------------------------------------ start
  if (window.innerWidth < 700) setPanel(false);
  resize();
  el.lm.value = S.lm; el.lmOut.textContent = lmLabel(S.lm);
  syncFov();
  setTime(1);
  setSeg(el.modeSeg, 'm', S.mode);
  setShower(S.shower);
  setRate(S.rate);
  requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
})();
