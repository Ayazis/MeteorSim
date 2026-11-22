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
  let LAT = 45 * DEG;     // observer latitude (radians); set by the location control
  const DOME_AZ = 245 * DEG;      // direction of the nearest town's light dome

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

  // Radiant positions on the sky at each shower's peak (J2000 RA, Dec in degrees). The real sky is
  // turned so that each radiant stands at the az/alt given above.
  const RADIANTS = {
    leonids: [152, 22], perseids: [48, 58], geminids: [112, 33], quadrantids: [230, 49],
    lyrids: [271, 34], etaAquariids: [338, -1], orionids: [95, 16], draconids: [262, 54],
  };

  // Peak dates [month, day] of each shower. Evening showers are best the evening of that date,
  // the rest in the pre-dawn hours of it.
  const PEAKS = {
    leonids: [11, 17], perseids: [8, 12], geminids: [12, 14], quadrantids: [1, 3], lyrids: [4, 22],
    etaAquariids: [5, 6], orionids: [10, 21], draconids: [10, 8, 'evening'],
  };
  // The dates of historic outbursts, used by the scenarios of the same name.
  const HIST_DATES = {
    'Draconids 2011': [2011, 10, 8], 'Leonids 1999': [1999, 11, 18], 'Leonids 2001': [2001, 11, 18],
    'Draconids 1933': [1933, 10, 9], 'Leonids 1833': [1833, 11, 13], 'Leonids 1966': [1966, 11, 17],
  };

  // Observing sites. tz is the standard-time offset from UTC in hours (daylight saving is ignored),
  // bortle the typical sky there.
  const SITES = [
    { name: 'Dark countryside, 45° N', lat: 45.0, lon: 7.5, tz: 1, bortle: 2 },
    { group: 'Dark-sky sites' },
    { name: 'Atacama Desert, Chile', lat: -24.63, lon: -70.40, tz: -4, bortle: 1 },
    { name: 'Mauna Kea, Hawaii', lat: 19.82, lon: -155.47, tz: -10, bortle: 1 },
    { name: 'La Palma, Canary Islands', lat: 28.76, lon: -17.89, tz: 0, bortle: 1 },
    { name: 'NamibRand, Namibia', lat: -24.95, lon: 16.00, tz: 2, bortle: 1 },
    { name: 'Aoraki Mackenzie, New Zealand', lat: -43.99, lon: 170.46, tz: 12, bortle: 1 },
    { name: 'Death Valley, California', lat: 36.46, lon: -116.87, tz: -8, bortle: 1.5 },
    { name: 'Yellowknife, Canada', lat: 62.45, lon: -114.37, tz: -7, bortle: 3 },
    { name: 'Tromsø, Norway', lat: 69.65, lon: 18.96, tz: 1, bortle: 4 },
    { group: 'Cities' },
    { name: 'Reykjavík, Iceland', lat: 64.15, lon: -21.94, tz: 0, bortle: 6 },
    { name: 'Amsterdam, Netherlands', lat: 52.37, lon: 4.90, tz: 1, bortle: 8 },
    { name: 'New York, USA', lat: 40.71, lon: -74.01, tz: -5, bortle: 9 },
    { name: 'Cape Town, South Africa', lat: -33.92, lon: 18.42, tz: 2, bortle: 7 },
    { name: 'Sydney, Australia', lat: -33.87, lon: 151.21, tz: 10, bortle: 8 },
    { name: 'Tokyo, Japan', lat: 35.68, lon: 139.69, tz: 9, bortle: 9 },
  ];

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
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;
  const toLinear = c => c.map(x => Math.pow(x / 255, 2.2));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // Equatorial (RA, Dec) <-> horizon direction, at latitude LAT and local sidereal time `lst`.
  function eqToHor(ra, dec, lst) {
    const h = lst - ra, sl = Math.sin(LAT), cl = Math.cos(LAT), sd = Math.sin(dec), cd = Math.cos(dec);
    return norm([-cd * Math.sin(h), cl * sd - sl * cd * Math.cos(h), sl * sd + cl * cd * Math.cos(h)]);
  }
  function horToEq(v, lst) {
    const sl = Math.sin(LAT), cl = Math.cos(LAT);
    const dec = Math.asin(clamp(sl * v[2] + cl * v[1], -1, 1));
    return [lst - Math.atan2(-v[0], cl * v[2] - sl * v[1]), dec];
  }
  // Atmospheric extinction per colour channel (relative to the zenith), normalised so the
  // brightest channel stays at 1: things low in the sky turn yellow, then orange-red.
  const EXT_RGB = [0.13, 0.2, 0.34];
  function reddening(am) {
    const f = EXT_RGB.map(k => Math.pow(10, -0.4 * k * (am - 1)));
    const m = Math.max(...f);
    return f.map(x => x / m);
  }
  // ---- time, the Sun and the Moon
  const jdOf = ms => ms / 86400000 + 2440587.5;
  // Greenwich mean sidereal time (IAU 1982, as in Meeus ch. 12), radians.
  function gmst(ms) {
    const d = jdOf(ms) - 2451545, T = d / 36525;
    const g = 280.46061837 + 360.98564736629 * d + 0.000387933 * T * T - T * T * T / 38710000;
    return (((g % 360) + 360) % 360) * DEG;
  }
  function eclToEq(lam, bet, eps) {
    const sl = Math.sin(lam), cl = Math.cos(lam), sb = Math.sin(bet), cb = Math.cos(bet), se = Math.sin(eps), ce = Math.cos(eps);
    return [Math.atan2(sl * cb * ce - sb * se, cl * cb), Math.asin(clamp(sb * ce + cb * se * sl, -1, 1))];
  }
  // Low-precision Sun (Astronomical Almanac, ~0.01°).
  function sunPos(ms) {
    const n = jdOf(ms) - 2451545;
    const L = 280.460 + 0.9856474 * n, g = (357.528 + 0.9856003 * n) * DEG;
    const lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * DEG;
    const [ra, dec] = eclToEq(lam, 0, (23.439 - 0.0000004 * n) * DEG);
    return { ra, dec, lam };
  }
  // Low-precision Moon (Astronomical Almanac, ~0.3°), with its horizontal parallax and phase.
  function moonPos(ms, sunLam) {
    const T = (jdOf(ms) - 2451545) / 36525;
    const s = (a, b) => Math.sin((a + b * T) * DEG), c = (a, b) => Math.cos((a + b * T) * DEG);
    const lam = (218.32 + 481267.881 * T + 6.29 * s(135.0, 477198.87) - 1.27 * s(259.3, -413335.36)
      + 0.66 * s(235.7, 890534.22) + 0.21 * s(269.9, 954397.74) - 0.19 * s(357.5, 35999.05)
      - 0.11 * s(186.5, 966404.03)) * DEG;
    const bet = (5.13 * s(93.3, 483202.02) + 0.28 * s(228.2, 960400.89) - 0.28 * s(318.3, 6003.15)
      - 0.17 * s(217.6, -407332.21)) * DEG;
    const par = (0.9508 + 0.0518 * c(134.9, 477198.87) + 0.0095 * c(259.2, -413335.38)
      + 0.0078 * c(235.7, 890534.23) + 0.0028 * c(269.9, 954397.70)) * DEG;
    const [ra, dec] = eclToEq(lam, bet, 23.439 * DEG);
    const elong = Math.acos(clamp(Math.cos(bet) * Math.cos(lam - sunLam), -1, 1));
    return { ra, dec, par, illum: (1 - Math.cos(elong)) / 2,
      waxing: ((((lam - sunLam) % TAU) + TAU) % TAU) < Math.PI };
  }

  // ---- sky brightness. SQM in mag/arcsec²; B in units of a 22.0 mag/arcsec² sky.
  // Naked-eye limiting magnitude from sky brightness (a common fit to Schaefer's model).
  const sqmToLm = q => 7.93 - 5 * Math.log10(Math.pow(10, 4.316 - q / 5) + 1);
  const lmToSqm = lm => 5 * (4.316 - Math.log10(Math.max(1e-6, Math.pow(10, (7.93 - lm) / 5) - 1)));
  const sqmToB = q => Math.pow(10, -0.4 * (q - 22));
  // Bortle class -> typical zenith SQM.
  const BORTLE_SQM = [22.0, 21.8, 21.5, 20.9, 20.0, 19.3, 18.7, 18.0, 17.2];
  const BORTLE_NAMES = ['Excellent dark site', 'Truly dark site', 'Rural sky', 'Rural/suburban transition',
    'Suburban sky', 'Bright suburban sky', 'Suburban/urban transition', 'City sky', 'Inner-city sky'];
  function bortleToSqm(b) {
    const x = clamp(b, 1, 9) - 1, i = Math.min(7, Math.floor(x));
    return lerp(BORTLE_SQM[i], BORTLE_SQM[i + 1], x - i);
  }
  function sqmToBortle(q) {
    if (q >= BORTLE_SQM[0]) return 1;
    for (let i = 0; i < 8; i++) {
      if (q >= BORTLE_SQM[i + 1]) return 1 + i + (BORTLE_SQM[i] - q) / (BORTLE_SQM[i] - BORTLE_SQM[i + 1]);
    }
    return 9;
  }
  const bortleToLm = b => sqmToLm(bortleToSqm(b));
  const lmToBortle = lm => sqmToBortle(lmToSqm(lm));
  // Zenith sky brightness from the Sun at altitude h (degrees), through twilight into day.
  const SUN_H = [-90, -18, -15, -12, -9, -6, -3, 0, 5, 15, 90];
  const SUN_Q = [40, 23.6, 21.4, 18.9, 16.1, 13.1, 10.4, 7.9, 6.2, 4.8, 4.0];
  function interp(xs, ys, x) {
    if (x <= xs[0]) return ys[0];
    for (let i = 1; i < xs.length; i++) if (x <= xs[i]) return lerp(ys[i - 1], ys[i], (x - xs[i - 1]) / (xs[i] - xs[i - 1]));
    return ys[ys.length - 1];
  }
  // Twilight and day sky colours (sRGB) by solar altitude: zenith and horizon.
  const TW_H = [-18, -12, -8, -4, -1, 3, 10, 25];
  const TW_ZEN = [[0, 0, 0], [6, 11, 26], [16, 30, 66], [34, 62, 118], [52, 92, 158], [64, 112, 186], [70, 124, 204], [66, 124, 214]];
  const TW_HOR = [[0, 0, 0], [16, 22, 42], [52, 54, 82], [150, 104, 92], [214, 142, 96], [222, 182, 150], [178, 200, 224], [172, 204, 236]];

  // ------------------------------------------------------------------ state
  const S = { rate: 44, shower: 'leonids', lm: 6.5, timeScale: 1, mode: 'sky', showRadiant: false, comet: false, guide: false };
  S.cardinals = true;
  let radRa = 0, radDec = 0; // the radiant, fixed among the stars
  let radVec = [0, 0, 1];
  let radFactor = 1;         // sin(radiant altitude): the share of the ZHR you can see

  // Observer and clock. clockMs is the simulated UTC time; it runs at the chosen speed.
  const OBS = { name: SITES[0].name, lat: SITES[0].lat, lon: SITES[0].lon, tz: SITES[0].tz };
  LAT = OBS.lat * DEG;
  let clockMs = Date.now();
  const lstNow = () => gmst(clockMs) + OBS.lon * DEG;
  // Sun, Moon and the light they add, refreshed every frame by updateLight().
  let sunVec = [0, 0, -1], moonVec = [0, 0, -1], eclPole = [0, 0, 1], moon = { illum: 0, waxing: true };
  let sunAltDeg = -90, moonAltDeg = -90;
  let lmNow = S.lm;          // limiting magnitude now: light pollution plus twilight and moonlight
  let sqmNow = 21.7, dayF = 0, lightKey = '';

  function updateLight() {
    const lst = lstNow();
    const sp = sunPos(clockMs);
    sunVec = eqToHor(sp.ra, sp.dec, lst);
    eclPole = eqToHor(270 * DEG, 66.56 * DEG, lst);   // north ecliptic pole
    const mp = moonPos(clockMs, sp.lam);
    let mv = eqToHor(mp.ra, mp.dec, lst);
    const malt = Math.asin(clamp(mv[2], -1, 1)) - mp.par * Math.sqrt(Math.max(0, 1 - mv[2] * mv[2])); // topocentric
    moonVec = dir(azOf(mv), malt);
    moon = mp;
    sunAltDeg = Math.asin(clamp(sunVec[2], -1, 1)) / DEG;
    moonAltDeg = malt / DEG;
    let B = sqmToB(lmToSqm(S.lm)) + sqmToB(interp(SUN_H, SUN_Q, sunAltDeg));
    if (moonAltDeg > -1) {
      B += sqmToB(18.7) * mp.illum ** 3 * smooth(-1, 8, moonAltDeg) * (0.4 + 0.6 * Math.max(0, moonVec[2]));
    }
    sqmNow = 22 - 2.5 * Math.log10(B);
    lmNow = Math.min(S.lm, sqmToLm(sqmNow));
    dayF = smooth(-18, 4, sunAltDeg);
    // redraw the cached layers when the light has changed visibly
    const key = `${lmNow.toFixed(2)}|${dayF.toFixed(3)}|${(mp.illum * smooth(-1, 8, moonAltDeg)).toFixed(2)}`;
    if (key !== lightKey) { lightKey = key; skyDirty = true; }
  }

  const MIN_FOV = 1;       // degrees: close enough to fill the screen with the Moon
  const cam = { yaw: 108 * DEG, pitch: 24 * DEG, fov: 100 * DEG };
  let W = 0, H = 0, DPR = 1, focal = 1;
  let F = [0, 1, 0], R = [1, 0, 0], U = [0, 0, 1];
  let skyDirty = true, skyRough = false, lastCamMove = -1e9;

  const canvas = document.getElementById('sky');
  const ctx = canvas.getContext('2d');
  const bg = document.createElement('canvas'); const bgx = bg.getContext('2d'); // generated sky (fallback) and comet
  const fg = document.createElement('canvas'); const fgx = fg.getContext('2d'); // landscape
  const ml = document.createElement('canvas'); const mx = ml.getContext('2d');  // meteors and trains
  const bl1 = document.createElement('canvas'); const b1x = bl1.getContext('2d'); // bloom
  const bl2 = document.createElement('canvas'); const b2x = bl2.getContext('2d');
  const HAS_FILTER = typeof b2x.filter === 'string';

  // The real sky, if WebGL2 is available and the star map loads (it can't from file://).
  // The 4K map comes first so the sky appears quickly; big screens then swap in the 8K map.
  let glCanvas = document.getElementById('skygl');
  let sky = null, skyReady = false, sky8k = null, skyGen = 0;
  // The WebGL sky is usable: loaded, and its context not lost. Otherwise the 2D canvas draws a generated sky.
  const skyLive = () => !!(sky && skyReady && !sky.lost);
  // The 8K map is fetched once the view needs it: on a big screen, or when zoomed in.
  function wantSky8k() {
    if (!sky || !skyReady || sky8k || sky.maxTexture < 8192) return;
    const longSide = Math.max(W, H) * DPR;
    const pxPerDeg = longSide / (cam.fov / DEG);        // screen pixels per degree of sky
    const big = longSide >= 1600 && !matchMedia('(pointer: coarse)').matches;
    if (!big && pxPerDeg < 4096 / 360 * 1.5) return;   // the 4K map still holds up
    const gen = skyGen;
    sky8k = sky.load('assets/starmap_8k.jpg')
      .then(() => { if (gen === skyGen) { skyDirty = true; updateResInfo(); } })
      .catch(err => console.warn('8K star map unavailable, keeping the 4K map.', err));
  }
  // Supermax: the 32K and 64K maps in tiles, fetched only for what is in view once the coarser map runs out of detail.
  const SUPERMAX_TILES = ['assets/sky32k', 'assets/sky64k'];
  function applySupermax() {
    if (!sky) return;
    const gen = skyGen;
    sky.setTiles(SUPERMAX_TILES)
      .then(ok => { if (gen === skyGen) { skyDirty = true; updateResInfo(); if (!ok) console.warn('Supermax tiles need a larger GPU texture size; keeping the 8K map.'); } })
      .catch(err => console.warn('Supermax star map tiles unavailable.', err));
  }
  function skyLost() {
    document.body.classList.remove('real-sky');
    skyDirty = true;
    updateResInfo();
  }
  // Start (or restart) the WebGL sky on the current canvas and load the star map into it.
  function startSky() {
    const gen = ++skyGen;
    skyReady = false; sky8k = null;
    sky = window.SkyGL ? window.SkyGL(glCanvas) : null;
    if (!sky) return;
    sky.on('lost', () => {
      if (gen !== skyGen) return;
      console.warn('WebGL context lost: drawing the generated sky until it comes back.');
      skyLost();
    });
    sky.on('tile', () => { if (gen === skyGen) { skyDirty = true; updateResInfo(); } });
    applySupermax();
    sky.on('restored', () => {
      if (gen !== skyGen) return;
      if (skyReady) document.body.classList.add('real-sky');
      skyDirty = true;
      updateResInfo();
    });
    sky.load('assets/starmap_4k.jpg')
      .then(() => {
        if (gen !== skyGen) return;
        skyReady = true; skyDirty = true;
        document.body.classList.add('real-sky');
        wantSky8k();
        updateResInfo();
      })
      .catch(err => console.warn('Star map unavailable, using the generated sky.', err));
  }
  // Switching apps on a phone can kill the context for good (iOS rarely gives it back).
  // When the page is shown again, or on a slow heartbeat, a context that stays dead for a
  // moment is replaced: a fresh canvas, a fresh renderer, and the star map loaded again
  // (from the browser cache, so it is quick).
  function rebuildSky(why) {
    console.warn(`Rebuilding the WebGL sky: ${why}.`);
    sky.dispose();
    const fresh = glCanvas.cloneNode(false);
    fresh.width = glCanvas.width; fresh.height = glCanvas.height;
    glCanvas.replaceWith(fresh);
    glCanvas = fresh;
    skyLost();
    startSky();
  }
  let deadSince = 0;
  function checkSky() {
    if (!sky || document.hidden) { deadSince = 0; return; }
    if (!sky.lost) { deadSince = 0; return; }
    const now = performance.now();
    if (!deadSince) { deadSince = now; return; }
    if (now - deadSince < 1200) return;
    deadSince = 0;
    rebuildSky('the context did not come back');
  }
  // Phones can also drop the star map from graphics memory while the app is in the background
  // without reporting the context as lost, leaving a dark sky with no stars. So after the page has
  // been hidden, the sky is always rebuilt and the map loaded again (from the browser cache).
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = performance.now(); return; }
    if (sky && hiddenAt && performance.now() - hiddenAt > 400) rebuildSky('the page was in the background');
    hiddenAt = 0;
  });
  window.addEventListener('pageshow', e => { if (e.persisted && sky) rebuildSky('restored from the back-forward cache'); });
  setInterval(checkSky, 1000);
  startSky();

  // What is on screen: field of view and which map sizes are in use (or still loading).
  const hudRes = document.getElementById('hudRes');
  const kLabel = w => w ? `${Math.round(w / 1024)}K` : '–';
  let resInfoReady = false;   // the Moon's map state is declared further down
  function updateResInfo() {
    if (!hudRes || !resInfoReady) return;
    const f = cam.fov / DEG;
    let stars = skyLive() ? kLabel(sky.textureSize) + (sky8k && sky.textureSize < 8192 ? ' → 8K…' : '') : 'generated';
    const ti = skyLive() ? sky.tileInfo : null;
    if (ti && ti.wanted) stars += ` + ${kLabel(ti.width)} tiles` + (ti.ready < ti.wanted ? ` ${ti.ready}/${ti.wanted}…` : '');
    const moonTxt = kLabel(moonMap.w) + (moonMap.loading ? ` → ${kLabel(moonMap.loading)}…` : '');
    hudRes.textContent = `FOV ${f < 10 ? f.toFixed(1) : Math.round(f)}° · star map ${stars} · Moon ${moonTxt}`;
  }

  function updateCam() {
    cam.pitch = clamp(cam.pitch, -8 * DEG, 85 * DEG);
    cam.fov = clamp(cam.fov, MIN_FOV * DEG, 120 * DEG);
    cam.yaw = ((cam.yaw % TAU) + TAU) % TAU;
    F = dir(cam.yaw, cam.pitch);
    R = [Math.cos(cam.yaw), -Math.sin(cam.yaw), 0];
    U = cross(R, F);
    focal = (Math.max(W, H) / 2) / Math.tan(cam.fov / 2);
    skyDirty = true;
    lastCamMove = performance.now();
    drawCompass();
    wantSky8k();
    updateResInfo();
  }

  // ---- compass: a heading tape in the HUD
  const compassCv = document.getElementById('compassTape');
  const compassRead = document.getElementById('compassRead');
  const POINTS16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const pointName = azDeg => POINTS16[Math.round((((azDeg % 360) + 360) % 360) / 22.5) % 16];
  function drawCompass() {
    if (!compassCv) return;
    const cw = compassCv.clientWidth || 280, chh = compassCv.clientHeight || 30;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (compassCv.width !== Math.round(cw * dpr)) { compassCv.width = Math.round(cw * dpr); compassCv.height = Math.round(chh * dpr); }
    const c = compassCv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, cw, chh);
    const yawD = cam.yaw / DEG, span = 50, pxd = cw / (2 * span);   // ±50° of heading across the tape
    c.textAlign = 'center';
    for (let a = Math.ceil((yawD - span) / 5) * 5; a <= yawD + span; a += 5) {
      const x = cw / 2 + (a - yawD) * pxd;
      const fadeEdge = 1 - Math.abs(a - yawD) / span;
      const n = ((a % 360) + 360) % 360;
      const major = n % 45 === 0, mid15 = n % 15 === 0;
      c.globalAlpha = Math.max(0, fadeEdge) ** 0.6;
      c.strokeStyle = major ? 'rgba(227,233,243,0.85)' : 'rgba(143,155,177,0.6)';
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(x + 0.5, chh - 1); c.lineTo(x + 0.5, chh - (major ? 9 : mid15 ? 6 : 3.5)); c.stroke();
      if (major) {
        const name = POINTS16[n / 22.5];
        c.font = `${name.length === 1 ? 600 : 500} ${name.length === 1 ? 12.5 : 11}px Inter, system-ui, sans-serif`;
        c.fillStyle = n === 0 ? '#9bd7ff' : 'rgba(227,233,243,0.9)';
        c.fillText(name, x, chh - 13);
      } else if (mid15) {
        c.font = '400 9.5px Inter, system-ui, sans-serif';
        c.fillStyle = 'rgba(143,155,177,0.8)';
        c.fillText(String(n), x, chh - 13);
      }
    }
    c.globalAlpha = 1;
    c.fillStyle = '#9bd7ff';
    c.beginPath(); c.moveTo(cw / 2 - 4, 0); c.lineTo(cw / 2 + 4, 0); c.lineTo(cw / 2, 5); c.closePath(); c.fill();
    if (compassRead) {
      const az = Math.round(yawD) % 360, alt = Math.round(cam.pitch / DEG);
      compassRead.textContent = `${az}° ${pointName(yawD)} · ${alt}° up`;
    }
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
    for (const c of [canvas, glCanvas, bg, fg, ml]) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); }
    bl1.width = Math.ceil(W / 4); bl1.height = Math.ceil(H / 4);
    bl2.width = HAS_FILTER ? bl1.width : Math.ceil(W / 12);
    bl2.height = HAS_FILTER ? bl1.height : Math.ceil(H / 12);
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
    const rc = reddening(am).map((x, i) => Math.round(col[i] * x));
    const s = { v: [rxy * Math.cos(ph), rxy * Math.sin(ph), z], m, alt, am, css: rgb(rc), rgb: rc,
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

  // Landscape: three layers in degrees of altitude, every 0.05° of azimuth — a distant mountain range,
  // nearer hills and the treeline in front. Haze makes the far layers a touch lighter.
  const TN = 7200;   // samples per full circle (every 0.05°)
  const far = new Float32Array(TN), mid = new Float32Array(TN), near = new Float32Array(TN), terr = new Float32Array(TN);
  const ridge = x => (1 - Math.abs(Math.sin(x))) ** 2;
  for (let i = 0; i < TN; i++) {
    const a = (i / TN) * TAU;
    const r = (ridge(a * 3 + 0.4) + 0.5 * ridge(a * 7 + 1.9) + 0.25 * ridge(a * 17 + 0.7) + 0.12 * ridge(a * 41 + 2.2)) / 1.87;
    const range = smooth(0.15, 0.85, 0.5 + 0.5 * Math.sin(a - 1.63));   // the mountains lie to the south
    far[i] = 0.35 + (0.4 + 3.6 * r ** 1.6) * range;
    mid[i] = Math.max(0.15, 0.75 + 0.45 * Math.sin(a * 2 + 0.7) + 0.3 * Math.sin(a * 5 + 2.1)
      + 0.15 * Math.sin(a * 11 + 0.3) + 0.06 * Math.sin(a * 29 + 1.3));
    near[i] = Math.max(0.05, mid[i] * 0.55 + 0.1 * Math.sin(a * 13 + 1.1));
  }
  const forest = a => Math.sin(a * 3 + 1.1) + 0.6 * Math.sin(a * 7 + 0.4) > -0.35;
  for (let k = 0; k < 2200; k++) {
    const c = Math.floor(srand() * TN), a = (c / TN) * TAU;
    if (!forest(a)) continue;
    const h = 0.6 + srand() * 1.9;
    const round = srand() < 0.12;
    const hw = Math.max(2, Math.round((round ? 0.4 : 0.2) * h * 20 * (0.85 + srand() * 0.3)));
    const base = near[c];
    for (let j = -hw; j <= hw; j++) {
      const idx = (c + j + TN) % TN, f = 1 - Math.abs(j) / hw;
      // conifers: a narrow spire with slightly concave sides; broadleaf trees: a dome
      const y = round ? base + h * 0.75 * Math.sqrt(1 - (j / hw) ** 2)
                      : base + h * f ** 1.25 * (0.96 + 0.04 * srand());
      if (y > near[idx]) near[idx] = y;
    }
  }
  for (let i = 0; i < TN; i++) terr[i] = Math.max(far[i], mid[i], near[i]);
  const terrIdx = az => ((Math.round((az / DEG) * 20) % TN) + TN) % TN;
  const terrainAt = az => terr[terrIdx(az)];

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
    // Twilight, daylight and moonlight add to the night sky (added as light, in linear space).
    const twZ = toLinear(interpRgb(TW_ZEN, sunAltDeg)), twH = toLinear(interpRgb(TW_HOR, sunAltDeg));
    const mb = moon.illum ** 3 * smooth(-1, 10, moonAltDeg);
    const add = (night, tw, moonLin) => fromLinear(toLinear(night).map((x, i) => x + tw[i] + moonLin[i] * mb));
    return {
      t, day: dayF,
      zen: add(mix([3, 5, 11], [26, 25, 36], t), twZ, [0.006, 0.010, 0.022]),
      hor: add(mix([12, 16, 26], [62, 50, 44], t), twH, [0.009, 0.012, 0.020]),
      dome: mix([0, 0, 0], [120, 84, 52], t * (1 - dayF)),
      ground: mix(mix([2, 3, 5], [10, 9, 10], t), [44, 50, 40], dayF ** 1.5 * 0.9 + mb * 0.06),
    };
  }
  function interpRgb(cols, h) {
    if (h <= TW_H[0]) return cols[0];
    for (let i = 1; i < TW_H.length; i++) {
      if (h <= TW_H[i]) {
        const f = (h - TW_H[i - 1]) / (TW_H[i] - TW_H[i - 1]);
        return toLinear(cols[i - 1]).map((x, k) => x + (toLinear(cols[i])[k] - x) * f).map(x => Math.pow(x, 1 / 2.2) * 255);
      }
    }
    return cols[cols.length - 1];
  }
  const fromLinear = c => c.map(x => Math.min(255, Math.pow(Math.max(0, x), 1 / 2.2) * 255));

  function renderBg(quick) {
    const c = bgx;
    if (skyLive()) {
      // The real sky is drawn by WebGL; this layer only carries the comet.
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, bg.width, bg.height);
      c.setTransform(DPR, 0, 0, DPR, 0, 0);
      c.globalCompositeOperation = 'lighter';
      if (S.comet) drawComet(c, quick);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      return;
    }
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    const col = skyColors();
    const yH = H / 2 + Math.tan(cam.pitch) * focal;            // horizon line (no camera roll)
    const y35 = H / 2 - Math.tan(35 * DEG - cam.pitch) * focal;
    const g = c.createLinearGradient(0, yH, 0, y35);
    g.addColorStop(0, rgb(mix(col.hor, col.dome, 0.5)));
    g.addColorStop(0.35, rgb(mix(col.hor, col.zen, 0.65)));
    g.addColorStop(1, rgb(col.zen));
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);

    c.globalCompositeOperation = 'lighter';
    const mwVis = clamp((lmNow - 4.6) / 1.6, 0, 1);
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
      if (s.mEff > lmNow) continue;
      const p = project(s.v);
      if (!p || !onScreen(p, 2)) continue;
      const vis = lmNow - s.mEff;
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
    const dark = clamp((lmNow - 2.8) / 3.7, 0, 1);
    const fade = (6.8 - lmNow) * 1.1;
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

  function fillLayer(c, arr, color) {
    c.beginPath();
    let first = true, firstX = 0, lastX = 0;
    for (let d = -1760; d <= 1760; d++) {
      const az = cam.yaw + d * 0.05 * DEG;
      const p = project(dir(az, arr[terrIdx(az)] * DEG));
      if (!p) continue;
      if (first) { c.moveTo(p[0], p[1]); firstX = p[0]; first = false; } else c.lineTo(p[0], p[1]);
      lastX = p[0];
    }
    if (first) return;
    c.lineTo(lastX, 1e5);
    c.lineTo(firstX, 1e5);
    c.closePath();
    c.fillStyle = color;
    c.fill();
  }

  function renderFg() {
    const c = fgx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, fg.width, fg.height);
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    const col = skyColors();
    const haze = mix(col.hor, col.dome, 0.4);
    fillLayer(c, far, rgb(mix(haze, col.ground, 0.6)));
    fillLayer(c, mid, rgb(mix(haze, col.ground, 0.83)));
    fillLayer(c, near, rgb(col.ground));
  }

  // Faint compass points on the horizon, just above the landscape.
  function drawCardinals() {
    if (!S.cardinals) return;
    ctx.save();
    ctx.textAlign = 'center';
    const a0 = 0.32 + 0.3 * dayF;
    for (let i = 0; i < 8; i++) {
      const az = i * 45 * DEG, major = i % 2 === 0;
      const p = project(dir(az, (terrainAt(az) + (major ? 1.6 : 1.3)) * DEG));
      if (!p || !onScreen(p, 20)) continue;
      ctx.font = `${major ? 600 : 500} ${major ? 13 : 11}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = i === 0 ? `rgba(155,215,255,${a0 + 0.15})` : `rgba(210,222,240,${a0})`;
      ctx.fillText(POINTS16[i * 2], p[0], p[1]);
    }
    ctx.restore();
  }

  // NASA LRO colour map of the Moon (public domain, NASA's Scientific Visualization Studio).
  // The disc is shaded per pixel from it: lit from the Sun's side, with earthshine on the rest.
  // Three sizes: 1K straight away, then 2K and 4K only once the Moon is drawn big enough to show them.
  // Phones stop at 2K: the 4K map alone takes 64 MB of memory once decoded.
  const MOON_MAPS = [[1024, 'assets/moon_1k.jpg'], [2048, 'assets/moon_2k.jpg'], [4096, 'assets/moon_4k.jpg']]
    .slice(0, matchMedia('(pointer: coarse)').matches ? 2 : 3);
  const moonMap = { data: null, w: 0, h: 0, loading: 0 };
  function loadMoonMap(width, url) {
    moonMap.loading = width;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0);
      if (img.width > moonMap.w) {
        moonMap.data = x.getImageData(0, 0, c.width, c.height).data;
        moonMap.w = c.width; moonMap.h = c.height; moonKey = '';
      }
      moonMap.loading = 0;
      updateResInfo();
    };
    img.onerror = () => { console.warn('Moon map unavailable:', url); moonMap.loading = 0; updateResInfo(); };
    img.src = url;
    updateResInfo();
  }
  resInfoReady = true;
  loadMoonMap(...MOON_MAPS[0]);
  // A disc n pixels across shows about half the map's width, so it wants roughly 2n texels round.
  function wantMoonMap(n) {
    if (moonMap.loading || !moonMap.data) return;
    const next = MOON_MAPS.find(([w]) => w > moonMap.w);
    if (next && n * 2.2 > moonMap.w) loadMoonMap(...next);
  }
  const moonDisc = document.createElement('canvas');
  const moonDiscCtx = moonDisc.getContext('2d');
  let moonKey = '';
  function renderMoonDisc(n, sunAng, northAng, k, earthshine, cool) {
    const key = [moonMap.w, n, sunAng.toFixed(2), northAng.toFixed(2), k.toFixed(3), earthshine.toFixed(2), cool].join();
    if (key === moonKey) return moonDisc;
    moonKey = key;
    if (moonDisc.width !== n) { moonDisc.width = moonDisc.height = n; }
    const out = moonDiscCtx.createImageData(n, n), o = out.data;
    const { data, w, h } = moonMap;
    const ci = 2 * k - 1, si = Math.sqrt(Math.max(0, 1 - ci * ci));
    const lx = Math.cos(sunAng) * si, ly = Math.sin(sunAng) * si, lz = ci;
    const nx = Math.cos(northAng), ny = Math.sin(northAng), ex = -ny, ey = nx;
    const tint = cool ? [0.94, 0.97, 1.02] : [1.04, 1.0, 0.93];
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n * 2 - 1, v = (j + 0.5) / n * 2 - 1, rr = u * u + v * v;
        const idx = (j * n + i) * 4;
        if (rr >= 1) { o[idx + 3] = 0; continue; }
        const z = Math.sqrt(1 - rr);
        const yl = -(u * nx + v * ny), xl = u * ex + v * ey;   // lunar north up, east to the right
        const lon = Math.atan2(xl, z), lat = Math.asin(Math.max(-1, Math.min(1, -yl)));
        const tx = Math.min(w - 1, Math.floor((0.5 + lon / TAU) * w));
        const ty = Math.min(h - 1, Math.floor((0.5 - lat / Math.PI) * h));
        const t = (ty * w + tx) * 4;
        // Lommel-Seeliger: the Moon's dusty surface looks almost flat-lit, with a soft terminator.
        const mu0 = u * lx + v * ly + z * lz;
        const lit = mu0 > 0 ? 2 * mu0 / (mu0 + z) : 0;
        const soft = Math.min(1, Math.max(0, (mu0 + 0.03) / 0.06));
        const b = Math.max(lit * soft * 0.75, earthshine) * 1.5;
        for (let c = 0; c < 3; c++) o[idx + c] = Math.min(255, data[t + c] * b * tint[c]);
        // a slightly soft limb for antialiasing
        o[idx + 3] = 255 * Math.min(1, (1 - Math.sqrt(rr)) * n * 0.5);
      }
    }
    moonDiscCtx.putImageData(out, 0, 0);
    return moonDisc;
  }

  // The Sun and the Moon, with the Moon's phase and its bright limb turned toward the Sun.
  function drawSunMoon() {
    const pxPerDeg = focal * DEG;
    if (moonVec[2] > -0.02) {
      const p = project(moonVec);
      if (p && onScreen(p, 60)) {
        const x = p[0], y = p[1], r = Math.max(2.2, 0.259 * pxPerDeg);
        // screen direction toward the Sun along the great circle
        const c = dot(sunVec, moonVec);
        const tv = norm([sunVec[0] - moonVec[0] * c, sunVec[1] - moonVec[1] * c, sunVec[2] - moonVec[2] * c]);
        const q = project(norm([moonVec[0] + tv[0] * 0.01, moonVec[1] + tv[1] * 0.01, moonVec[2] + tv[2] * 0.01]));
        const ang = q ? Math.atan2(q[1] - y, q[0] - x) : 0;
        const k = moon.illum;
        const night = 1 - 0.6 * dayF;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = r * (6 + 10 * k);
        ctx.globalAlpha = (0.08 + 0.4 * k * k) * night;
        ctx.drawImage(glow, x - g, y - g, g * 2, g * 2);
        ctx.globalCompositeOperation = 'source-over';
        if (moonMap.data) {
          // screen direction of celestial north at the Moon, which sets the lunar map's orientation
          const ncp = [0, Math.cos(LAT), Math.sin(LAT)];
          const cn = dot(ncp, moonVec);
          const nv = norm([ncp[0] - moonVec[0] * cn, ncp[1] - moonVec[1] * cn, ncp[2] - moonVec[2] * cn]);
          const qn = project(norm([moonVec[0] + nv[0] * 0.01, moonVec[1] + nv[1] * 0.01, moonVec[2] + nv[2] * 0.01]));
          const northAng = qn ? Math.atan2(qn[1] - y, qn[0] - x) : -Math.PI / 2;
          const n = Math.max(8, Math.min(1024, Math.ceil(2 * r * DPR)));
          wantMoonMap(n);
          const disc = renderMoonDisc(n, ang, northAng, k, 0.045 * (1 - dayF), dayF > 0.5);
          ctx.globalAlpha = 1;
          ctx.drawImage(disc, x - r, y - r, 2 * r, 2 * r);
        } else {
          ctx.translate(x, y); ctx.rotate(ang);
          // earthshine on the dark part
          ctx.globalAlpha = 0.16 * (1 - dayF);
          ctx.fillStyle = 'rgb(70,80,100)';
          ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
          const e = (2 * k - 1) * r;
          ctx.globalAlpha = 0.97;
          ctx.fillStyle = dayF > 0.5 ? 'rgb(236,240,248)' : 'rgb(250,246,232)';
          ctx.beginPath();
          ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
          ctx.ellipse(0, 0, Math.max(0.01, Math.abs(e)), r, 0, Math.PI / 2, e >= 0 ? 1.5 * Math.PI : -Math.PI / 2, e < 0);
          ctx.fill();
        }
        ctx.restore();
      }
    }
    if (sunVec[2] > -0.02) {
      const p = project(sunVec);
      if (p && onScreen(p, 200)) {
        const x = p[0], y = p[1], r = Math.max(3, 0.267 * pxPerDeg);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const [s, a] of [[40, 0.18], [12, 0.45], [4, 0.9]]) {
          ctx.globalAlpha = a; ctx.drawImage(glow, x - r * s, y - r * s, r * s * 2, r * s * 2);
        }
        ctx.globalAlpha = 1; ctx.fillStyle = 'rgb(255,250,236)';
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
  }

  // Add-on layers (see the MeteorSim API at the end): drawn over the sky, behind meteors and landscape.
  const layers = [];
  function drawLayers(dt) {
    for (const fn of layers) {
      ctx.save();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      try { fn(ctx, dt, API); } catch (err) { console.warn('MeteorSim layer failed', err); }
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------ meteors
  const meteors = [], trains = [];
  let simT = 0, nextSpawn = 0, auroraTime = 0;
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
      // Colour comes from what glows. Fast meteors excite magnesium and iron (blue-green head) and
      // leave the green oxygen line in their wake; slow ones are dominated by sodium (yellow-orange).
      // Each meteoroid's make-up varies a little, and low meteors are reddened by the air.
      const mg = clamp(tv + (Math.random() - 0.5) * 0.35, 0, 1), na = clamp(1 - tv + (Math.random() - 0.5) * 0.35, 0, 1);
      const head0 = mix(mix([255, 226, 170], [215, 238, 255], mg), [255, 214, 150], na * 0.35);
      const trail0 = mix(mix([255, 150, 70], [110, 255, 170], mg), [255, 176, 90], na * 0.4);
      const red = reddening(airmass(alt));
      const head = head0.map((x, i) => x * red[i]), trail = trail0.map((x, i) => x * red[i]);
      meteors.push({
        P, t, sA: -L / 2, L, dur, age: 0, m: mEff, tv,
        head0: head, trail0: trail, head: head.slice(), trail: trail.slice(),
        flareAt: 0.5 + Math.random() * 0.45,
        flareAmp: mEff < 1.5 && Math.random() < 0.35 ? 0.6 + Math.random() * 1.8 : 0,
        train: mEff < 2 && Math.random() < sh.trainProb,
        seed: Math.random() * 1000,
      });

      // Did it land in the view, above the trees, bright enough for this sky?
      if (mEff <= lmNow && alt > terrainAt(azOf(P)) * DEG) {
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

  function drawMeteors(dt, pass) {
    const ctx = mx;   // meteors go on their own layer so they can bloom
    ctx.lineCap = 'round';
    let flash = 0;
    visibleNow = 0;
    for (let i = meteors.length - 1; i >= 0; i--) {
      const M = meteors[i];
      M.age += dt;
      const p = M.age / M.dur;
      if (p >= 1) {
        if (M.train && M.m <= lmNow) makeTrain(M);
        meteors[i] = meteors[meteors.length - 1]; meteors.pop();
        continue;
      }
      if (M.m > lmNow + 0.3) continue;
      const I = lightCurve(p, M);
      if (I < 0.005) continue;
      // The colour shifts along the flight: the head turns yellow-orange as the meteoroid slows and
      // sodium takes over, and goes white-hot in a flare.
      {
        const late = smooth(0.55, 1, p) * (0.4 + 0.6 * (1 - M.tv));
        const hot = M.flareAmp ? Math.exp(-(((p - M.flareAt) / 0.06) ** 2)) : 0;
        for (let k = 0; k < 3; k++) {
          const h = M.head0[k] * lerp(1, [1, 0.84, 0.62][k], late);
          M.head[k] = Math.round(lerp(h, 255, hot * 0.7));
          M.trail[k] = Math.round(M.trail0[k] * lerp(1, [1, 0.75, 0.6][k], late * 0.5));
        }
      }
      const mNow = M.m - 2.5 * Math.log10(I);
      const vis = lmNow - mNow;
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

      const w = Math.min(7, 1.3 + Math.max(0, 3.5 - mNow) * 0.42);
      if (mNow < -2) flash += Math.pow(10, -0.4 * (mNow + 2)) * 0.01;
      if (pass) {
        pass.add(hx, hy, tx, ty, w, a, mNow, M);
        continue;
      }
      const len = Math.hypot(hx - tx, hy - ty);
      if (len > 0.5) {
        const g = ctx.createLinearGradient(tx, ty, hx, hy);
        g.addColorStop(0, rgba(M.trail, 0));
        g.addColorStop(0.55, rgba(M.trail, a * 0.4));
        g.addColorStop(0.92, rgba(M.head, a * 0.85));
        g.addColorStop(1, rgba(M.head, a));
        ctx.strokeStyle = g;
        ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
        // a thin white-hot core along the front of bright meteors
        if (mNow < 2) {
          const cx = lerp(hx, tx, 0.35), cy = lerp(hy, ty, 0.35);
          const cg = ctx.createLinearGradient(cx, cy, hx, hy);
          cg.addColorStop(0, 'rgba(255,255,255,0)');
          cg.addColorStop(1, `rgba(255,255,255,${(a * 0.9).toFixed(3)})`);
          ctx.strokeStyle = cg; ctx.lineWidth = Math.max(1, w * 0.35);
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(hx, hy); ctx.stroke();
        }
      }
      // Fireballs shed glowing fragments behind the head.
      if (mNow < -1 && len > 4) {
        const nx = -(hy - ty) / len, ny = (hx - tx) / len;
        const n = Math.min(9, 3 + Math.round(-mNow));
        for (let k = 1; k <= n; k++) {
          const f = (k / (n + 1)) * 0.45 + 0.03 * Math.sin(M.seed + k * 7.1 + M.age * 40);
          const off = Math.sin(M.seed * 1.3 + k * 3.7) * w * 0.9;
          const sx = lerp(hx, tx, f) + nx * off, sy = lerp(hy, ty, f) + ny * off;
          const r = (1 - k / (n + 2)) * (1.5 + w * 0.6);
          ctx.globalAlpha = a * 0.7 * (1 - k / (n + 1)) * (0.6 + 0.4 * Math.sin(M.age * 60 + k));
          ctx.drawImage(glow, sx - r * 2, sy - r * 2, r * 4, r * 4);
        }
        ctx.globalAlpha = 1;
      }
      const hs = mNow < 2.5 ? Math.min(60, 3 + (2.5 - mNow) * 4.5) : 2.5;
      ctx.globalAlpha = a * (mNow < 2.5 ? 0.9 : 0.6);
      ctx.drawImage(glow, hx - hs, hy - hs, hs * 2, hs * 2);
      ctx.globalAlpha = 1;

    }
    return flash;
  }

  function drawTrains(dt) {
    const ctx = mx;
    const sc = focal / 900;
    const dark = clamp((lmNow - 3) / 3.5, 0.15, 1);
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
      if (s.mEff > lmNow) continue;
      const p = project(s.v);
      if (!p || !onScreen(p, 10)) continue;
      const low = Math.min(1, (s.am - 1) / 4);
      const amp = 0.08 + 0.3 * low;   // twinkles more low down
      const tw = 1 + amp * 0.5 * (Math.sin(t * s.f + s.ph) + Math.sin(t * s.f2 + s.ph * 2));
      // Bright stars low down flash colours too: the air splits their light like a weak prism and
      // each colour scintillates on its own.
      let css = s.css;
      if (s.m < 1.6 && low > 0.05) {
        const cf = low * smooth(1.6, -0.5, s.m) * 0.55;
        const c = s.rgb.map((x, k) => clamp(x * (1 + cf * Math.sin(t * (s.f * 1.7 + k * 2.3) + s.ph * (k + 1) * 3.1)), 0, 255) | 0);
        css = `rgb(${c[0]},${c[1]},${c[2]})`;
      }
      const vis = lmNow - s.mEff;
      const a = clamp(0.3 + vis * 0.2, 0, 1) * tw;
      const r = 0.6 + Math.max(0, 4 - s.mEff) * 0.3;
      ctx.globalAlpha = Math.min(1, a);
      ctx.fillStyle = css;
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
    ctx.font = '500 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${SHOWERS[S.shower].name} radiant`, x, y - 24);
    ctx.restore();
  }


  // ---- Sky guide: names of stars, star systems, deep-sky objects and constellations
  const INFO = window.SKY_INFO || { stars: [], deep: [], constellations: [] };
  const HR = TAU / 24;
  function drawConstellationLines() {
    if (!el.showLines.checked) return;
    const lst = lstNow();
    ctx.save();
    ctx.strokeStyle = 'rgba(151,188,234,0.44)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const path of window.CONSTELLATION_LINES) {
      let previous = null;
      for (const [ra, dec] of path) {
        const current = eqToHor(ra * DEG, dec * DEG, lst);
        if (previous) {
          // Clip against the camera plane before the perspective divide.
          let a = previous, b = current;
          const za = dot(a, F), zb = dot(b, F), near = 0.031;
          if (za >= near || zb >= near) {
            if (za < near || zb < near) {
              const t = (near - za) / (zb - za);
              const cut = a.map((v, i) => v + t * (b[i] - v));
              if (za < near) a = cut;
              else b = cut;
            }
            ctx.moveTo(...project(a));
            ctx.lineTo(...project(b));
          }
        }
        previous = current;
      }
    }
    ctx.stroke();
    ctx.restore();
  }
  const guideItems = [
    ...INFO.stars.map(o => ({ ...o, kind: 'star' })),
    ...INFO.deep.map(o => ({ ...o, kind: 'deep' })),
  ];
  let guideHits = [], guideHover = null, guidePinned = null;
  const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  function fmtLy(d) {
    if (d >= 1e6) return `${(d / 1e6).toFixed(1)} million light-years`;
    return `${nf.format(d < 20 ? +d.toFixed(1) : Math.round(d))} light-years`;
  }
  function drawGuide() {
    guideHits = [];
    const linesVisible = el.showLines.checked;
    if (!S.guide && !linesVisible) return;
    const lst = lstNow();
    const narrow = cam.fov < 70 * DEG;
    ctx.save();
    ctx.textAlign = 'center';
    // constellations, faint and spaced out
    ctx.font = '400 11px Inter, system-ui, sans-serif';
    ctx.fillStyle = linesVisible ? 'rgba(185,210,248,0.85)' : 'rgba(155,180,230,0.42)';
    for (const c of (linesVisible ? window.CONSTELLATION_LABELS : INFO.constellations)) {
      const v = eqToHor(c.ra * HR, c.dec * DEG, lst);
      if (v[2] < 0.03) continue;
      if (Math.asin(v[2]) <= terrainAt(azOf(v)) * DEG) continue;
      const p = project(v);
      if (!p || !onScreen(p, -10)) continue;
      ctx.fillText(c.n.toUpperCase().split('').join('\u200A'), p[0], p[1]);
    }
    if (!S.guide) { ctx.restore(); return; }
    for (const o of guideItems) {
      const v = eqToHor(o.ra * HR, o.dec * DEG, lst);
      o.v = v;
      if (v[2] < 0) continue;
      const p = project(v);
      if (!p || !onScreen(p, 10)) continue;
      const x = p[0], y = p[1];
      const deep = o.kind === 'deep';
      const hidden = o.m > lmNow;   // too faint to see under this sky
      const active = o === guideHover || o === guidePinned;
      if (!active && !narrow && (deep ? o.m > 7 : o.m > 1.7)) { guideHits.push({ o, x, y }); continue; }
      const a = (hidden ? 0.35 : 0.75) * (active ? 1.3 : 1);
      ctx.strokeStyle = window.SkyCategories ? SkyCategories.color(o, a) : deep ? `rgba(255,205,150,${a})` : `rgba(155,215,255,${a})`;
      ctx.lineWidth = 1;
      const r = deep ? 9 : 7;
      ctx.beginPath();
      if (deep) { ctx.setLineDash([2, 3]); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
      else { ctx.arc(x, y, r, 0, TAU); ctx.stroke(); }
      ctx.fillStyle = ctx.strokeStyle;
      ctx.font = `${active ? 500 : 400} 11.5px Inter, system-ui, sans-serif`;
      ctx.fillText(hasPhoto(o) ? `${o.n} *` : o.n, x, y - r - 5);
      guideHits.push({ o, x, y });
    }
    ctx.restore();
    updateCard();
  }
  function guideAt(x, y) {
    let best = null, bd = 22 * 22;
    for (const h of guideHits) {
      const d = (h.x - x) ** 2 + (h.y - y) ** 2;
      if (d < bd) { bd = d; best = h.o; }
    }
    return best;
  }
  const skyCard = document.getElementById('skyCard');
  let cardFor = null;
  // Objects with a deep-sky photo get an asterisk (deepsky.js loads after this file, so look it up late).
  const hasPhoto = o => !!(window.DeepSkyPhotos && window.DeepSkyPhotos.has(o));
  const PHOTO_NOTE = '* Photo available: zoom in to see it';

  function updateCard() {
    const o = guideHover || guidePinned;
    const h = o && guideHits.find(g => g.o === o);
    if (!S.guide || !h) { skyCard.hidden = true; cardFor = null; return; }
    if (cardFor !== o) {
      cardFor = o;
      const v = o.v, alt = Math.asin(clamp(v[2], -1, 1)) / DEG;
      const az = ((Math.atan2(v[0], v[1]) / DEG) + 360) % 360;
      const where = o.kind === 'deep' ? `${o.s}` : o.c;
      const cat = window.SkyCategories;
      skyCard.innerHTML = `<div class="head">${cat ? `<img class="preview" alt="" src="${cat.preview(o)}">` : ''}<div>${cat ? `<span class="cat" style="--c:${cat.color(o, 1)}">${cat.CATS[cat.category(o)].label}</span>` : ''}<h2></h2><div class="kind"></div></div></div><dl>
        <dt>Distance</dt><dd>${fmtLy(o.d)}</dd>
        <dt>Brightness</dt><dd>magnitude ${o.m.toFixed(1)}${o.m > lmNow ? ' · too faint for this sky' : ''}</dd>
        <dt>Position</dt><dd>${Math.round(alt)}° up, ${COMPASS[Math.round(az / 45) % 8]} (${Math.round(az)}°)</dd>
        </dl><p></p>`;
      skyCard.querySelector('h2').textContent = hasPhoto(o) ? `${o.n} *` : o.n;
      const kind = skyCard.querySelector('.kind');
      kind.textContent = `${o.t} · ${where}`;
      if (hasPhoto(o)) {
        // "zoom in" is a button: it flies the view in on the object so the photo shows.
        const zoom = document.createElement('a');
        zoom.href = '#'; zoom.className = 'zoom-link'; zoom.textContent = 'zoom in';
        zoom.addEventListener('click', e => { e.preventDefault(); goToObject(o); });
        kind.append(' · * Photo available: ', zoom, ' to see it');
      }
      skyCard.querySelector('p').textContent = o.i;
      const photo = window.DeepSkyPhotos?.find(o);
      if (photo) {
        // Where the photo comes from, with a link to its page (credit and licence are there too).
        const line = document.createElement('div');
        line.className = 'photo-src';
        const a = document.createElement('a');
        a.href = photo.src; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = 'View source ↗';
        line.append(`Photo: ${photo.credit} (CC BY 4.0) · `, a);
        skyCard.append(line);
      }
      skyCard.hidden = false;
    }
    const cw = skyCard.offsetWidth, ch = skyCard.offsetHeight;
    let x = h.x + 18, y = h.y + 14;
    if (x + cw > W - 12) x = h.x - cw - 18;
    if (y + ch > H - 12) y = H - ch - 12;
    skyCard.style.left = `${Math.max(12, x)}px`;
    skyCard.style.top = `${Math.max(12, y)}px`;
  }

  // Composite the meteor layer with a soft bloom, as bright light scatters in the eye.
  function compositeMeteors() {
    b1x.globalCompositeOperation = 'copy';
    b1x.drawImage(ml, 0, 0, bl1.width, bl1.height);
    b2x.globalCompositeOperation = 'copy';
    if (HAS_FILTER) { b2x.filter = 'blur(3px)'; b2x.drawImage(bl1, 0, 0); b2x.filter = 'none'; }
    else b2x.drawImage(bl1, 0, 0, bl2.width, bl2.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(ml, 0, 0);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(bl2, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 0.35;
    ctx.drawImage(bl1, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  // Project adjoining vertical slices so the curtain stays fixed to the horizon as the camera turns.
  function drawAurora() {
    const activity = S.aurora;
    if (!activity || sunAltDeg >= -3) return;
    const pole = LAT < 0 ? Math.PI : 0;
    const visibility = activity * (1 - smooth(-16, -3, sunAltDeg)) * (0.3 + 0.7 * smooth(2, 7, S.lm));
    const phase = auroraTime * 0.14;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let layer = 0; layer < 2; layer++) {
      let lastBase, lastTop;
      for (let i = -156; i <= 156; i++) {
        const a = i * 0.75 * DEG;
        const fold = Math.sin(4 * a + phase + layer) + 0.4 * Math.sin(11 * a - phase);
        const base = (7 + layer * 9 + activity * 12 + 4 * fold * appearance.foldDepth) * DEG;
        const height = (8 + activity * 16 + 4 * Math.sin(5 * a + phase)) * DEG * appearance.curtainHeight;
        const b = project(dir(pole + a, base))?.slice();
        const t = project(dir(pole + a + 0.045 * fold * appearance.foldDepth, base + height))?.slice();
        if (b && t && lastBase && lastTop &&
            Math.max(b[0], t[0], lastBase[0], lastTop[0]) >= 0 &&
            Math.min(b[0], t[0], lastBase[0], lastTop[0]) <= W) {
          const rays = clamp(0.65 + appearance.rayContrast * (0.22 * Math.sin(61 * a + 3 * fold) + 0.13 * Math.sin(97 * a - phase)), 0, 1);
          ctx.globalAlpha = visibility * rays * (1 - smooth(0.8, 2.04, Math.abs(a))) / (1 + layer);
          const g = ctx.createLinearGradient(b[0], b[1], t[0], t[1]);
          g.addColorStop(0, 'rgba(140,219,65,0)');
          g.addColorStop(appearance.fringeHeight, `rgba(218,96,152,${0.52 * smooth(0.6, 0.93, activity) * rays * appearance.pinkFringe})`);
          g.addColorStop(appearance.greenHeight, `rgba(${129 - 86*appearance.tealTint},225,${54 + 130*appearance.tealTint},0.72)`);
          if (appearance.pinkGlow > 0) g.addColorStop(appearance.pinkHeight, `rgba(250,104,185,${0.32*appearance.pinkGlow})`);
          if (appearance.purpleGlow > 0) {
            g.addColorStop(appearance.purpleHeight, `rgba(153,65,241,${0.32 * appearance.purpleGlow * rays})`);
          }
          g.addColorStop(appearance.redHeight, `rgba(186,51,41,${0.19 * activity * appearance.upperRed})`);
          g.addColorStop(1, 'rgba(186,51,41,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(...lastBase); ctx.lineTo(...b); ctx.lineTo(...t); ctx.lineTo(...lastTop);
          ctx.closePath(); ctx.fill();
        }
        lastBase = b; lastTop = t;
      }
    }
    ctx.restore();
  }

  function renderSky() {
    const col = skyColors();
    sky.render({
      F, R, U, focal: focal * DPR,
      lat: LAT, lst: lstNow(), time: simT,
      activity: S.aurora, auroraTime, ...appearance,
      auroraVisibility: S.aurora * (1 - smooth(-16, -3, sunAltDeg)) * (0.3 + 0.7 * smooth(2, 7, S.lm)),
      exposure: 1.7,
      starBoost: 2.2,
      // The faint end of the map sinks into a brighter sky. The map's pixel values grow more slowly
      // than star flux, so the cut has to rise faster than the sky (exponent 1.35, fitted so that a
      // Bortle 9 sky shows only stars to about magnitude 3.3).
      thresh: Math.max(0, 0.011 * (Math.pow(10, 0.4 * 1.35 * (REF_LM - lmNow)) - 1)),
      pollution: col.t,
      domeAz: DOME_AZ,
      zen: toLinear(col.zen), hor: toLinear(col.hor), dome: toLinear(col.dome), ground: toLinear(col.ground),
      sunDir: sunVec, sunCol: sunGlowColor(), moonDir: moonVec, eclPole,
      // How dark the sky is for the faintest natural glows (zodiacal light, airglow): no twilight,
      // little moonlight, far from town lights.
      natural: smooth(-12, -18, sunAltDeg) * (1 - 0.85 * moon.illum * smooth(-2, 10, moonAltDeg)),
      moonCol: [0.016, 0.019, 0.026].map(x => x * moon.illum ** 3 * smooth(-1, 6, moonAltDeg)),
    });
  }
  // The glow around the Sun: warm and strong when it is low, through twilight into day.
  function sunGlowColor() {
    const s = smooth(-18, -3, sunAltDeg) * 0.55 + smooth(-3, 20, sunAltDeg) * 0.45;
    const warm = 1 - smooth(-2, 25, sunAltDeg);
    return mix([0.55, 0.62, 0.75], [1.0, 0.5, 0.2], warm).map(x => x * s * 0.35);
  }

  // ------------------------------------------------------------------ loop
  let last = performance.now(), realT = 0, lastHud = 0;

  function frame(now) {
    stepFlight(now);
    render(now);
    requestAnimationFrame(frame);
  }

  function render(now) {
    const dtReal = Math.min(0.1, (now - last) / 1000);
    last = now; realT += dtReal;
    // The clock and sky run at the chosen speed. Meteors never run faster than real time:
    // they last a fraction of a second, so fast-forward speeds up only the turning sky.
    const dt = dtReal * Math.min(1, S.timeScale);
    if (S.timeScale > 0) clockMs += dtReal * S.timeScale * 1000;
    updateLight();
    if (S.shower !== 'sporadic') radVec = eqToHor(radRa, radDec, lstNow());
    radFactor = S.shower === 'sporadic' ? 1 : Math.max(0, radVec[2]);

    if (dt > 0) {
      simT += dt;
      auroraTime += dt * S.auroraSpeed;
      let n = 0;
      // A shower's rate scales with the sine of the radiant's altitude, as in the ZHR.
      while (nextSpawn <= simT && n < 3000) { if (Math.random() < radFactor) spawnOne(); nextSpawn += expRand(S.rate); n++; }
      if (n >= 3000) resetSpawn();
    }
    const real = skyLive();
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
    if (real) {
      renderSky();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(bg, 0, 0);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (!real) {
      ctx.globalCompositeOperation = 'lighter';
      drawBrightStars(realT);
    }
    ctx.globalCompositeOperation = 'source-over';
    drawConstellationLines();
    if (!real) drawAurora();
    drawSunMoon();
    drawLayers(dt);

    mx.setTransform(1, 0, 0, 1, 0, 0);
    mx.clearRect(0, 0, ml.width, ml.height);
    mx.setTransform(DPR, 0, 0, DPR, 0, 0);
    mx.globalCompositeOperation = 'lighter';
    drawTrains(dt);
    const pass = real ? sky.meteors : null;
    const flash = drawMeteors(dt, pass);
    pass?.render(W, H);
    compositeMeteors();

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
    drawCardinals();
    drawRadiant();
    drawGuide();

    if (now - lastHud > 250) { updateHud(); refreshClockUi(); lastHud = now; }
  }

  // ------------------------------------------------------------------ UI
  const $ = id => document.getElementById(id);
  const nf = new Intl.NumberFormat('en-US');
  const el = {
    hudBig: $('hudBig'), hudUnit: $('hudUnit'), hudSub: $('hudSub'), hudSeen: $('hudSeen'),
    rate: $('rate'), rateNum: $('rateNum'), rateOut: $('rateOut'), compare: $('compare'),
    presets: $('presets'), presetNote: $('presetNote'), showerSeg: $('showerSeg'), showerNote: $('showerNote'),
    lm: $('lm'), lmOut: $('lmOut'), lmNote: $('lmNote'), fov: $('fov'), fovOut: $('fovOut'),
    timeSeg: $('timeSeg'), modeSeg: $('modeSeg'), showRadiant: $('showRadiant'), showComet: $('showComet'), showGuide: $('showGuide'),
    site: $('site'), lat: $('lat'), lon: $('lon'), geo: $('geo'), locOut: $('locOut'), siteNote: $('siteNote'),
    date: $('date'), tod: $('tod'), todOut: $('todOut'), now: $('nowBtn'), sunNote: $('sunNote'), hudClock: $('hudClock'),
    showCardinals: $('showCardinals'), showLines: $('showLines'),
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
    const b = lmToBortle(lm);
    return `Bortle ${Math.round(b)} · ${BORTLE_NAMES[Math.round(b) - 1]}`;
  }
  function lmDetail(lm) {
    return `Night sky about ${lmToSqm(lm).toFixed(2)} mag/arcsec² (SQM). Stars to magnitude ${lm.toFixed(1)} at the zenith.`;
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

  // ---- clock helpers, in the site's standard time
  function localParts(ms) {
    const d = new Date(ms + OBS.tz * 3600e3);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), min: d.getUTCHours() * 60 + d.getUTCMinutes() };
  }
  const fromLocal = (y, m, d, min) => {
    const t = new Date(0); t.setUTCFullYear(y, m - 1, d); t.setUTCHours(0, 0, 0, 0);
    return t.getTime() + min * 60e3 - OBS.tz * 3600e3;
  };
  const sunAltAt = ms => {
    const sp = sunPos(ms);
    return Math.asin(eqToHor(sp.ra, sp.dec, gmst(ms) + OBS.lon * DEG)[2]) / DEG;
  };
  // The best moment of the night ending on the morning of y-m-d (or the evening of it): dark,
  // with the radiant as high as it gets. Usually the hours before dawn.
  function bestTime(y, m, d, rd, evening) {
    const start = fromLocal(y, m, d, evening ? 12 * 60 : -12 * 60);
    let best = start + 12 * 3600e3, bs = -Infinity;
    for (let i = 0; i <= 144; i++) {
      const ms = start + i * 600e3, sAlt = sunAltAt(ms);
      const dark = clamp((-sAlt - 4) / 14, 0, 1);
      const r = rd ? Math.max(0, eqToHor(rd[0] * DEG, rd[1] * DEG, gmst(ms) + OBS.lon * DEG)[2]) : 0.5;
      const score = dark * (r + 0.02) + 1e-4 * -sAlt + 1e-5 * r;
      if (score > bs) { bs = score; best = ms; }
    }
    return best;
  }
  function jumpToNight(key, date) {
    const pk = PEAKS[key];
    let ymd = date;
    if (!ymd && pk) ymd = [localParts(clockMs).y, pk[0], pk[1]];
    if (!ymd) {   // no peak: tonight
      const lp = localParts(clockMs + 12 * 3600e3);
      ymd = [lp.y, lp.m, lp.d];
    }
    setClock(bestTime(ymd[0], ymd[1], ymd[2], RADIANTS[key], pk && pk[2] === 'evening'));
  }
  function setClock(ms) {
    clockMs = ms;
    updateLight();
    if (S.shower !== 'sporadic') radVec = eqToHor(radRa, radDec, lstNow());
    skyDirty = true;
    resetSeen();
    refreshClockUi();
  }

  function setShower(key, opts = {}) {
    S.shower = key;
    const sh = SHOWERS[key];
    const rd = RADIANTS[key];
    if (rd) {
      // The radiant's real position among the stars: where it stands depends on the place and time.
      radRa = rd[0] * DEG; radDec = rd[1] * DEG;
      radVec = eqToHor(radRa, radDec, lstNow());
    }
    if (opts.jump !== false) jumpToNight(key, opts.date);
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
    let sub = f.sub;
    if (S.shower !== 'sporadic') {
      const ra = Math.asin(clamp(radVec[2], -1, 1)) / DEG;
      sub += ra > 0 ? ` · radiant ${Math.round(ra)}° up, ${Math.round(radFactor * 100)}% of the rate reaches you`
        : ' · radiant below the horizon, so almost none now';
    }
    el.hudSub.textContent = sub;
    const win = S.rate >= 0.3 ? 10 : 600;
    let k = 0; while (k < seen.length && seen[k] < simT - win) k++;
    if (k) seen.splice(0, k);
    const span = Math.min(win, simT - seenStart);
    let text;
    if (span < 1.5) text = 'Counting…';
    else if (!seen.length) text = `None in this view yet (${fmtDur(span)})`;
    else text = `You're seeing ${fmtShortRate(seen.length / span)} in this view`;
    if (lmNow < S.lm - 0.3) text += sunAltDeg > -18 ? (sunAltDeg > -0.8 ? ' · daylight hides all but fireballs' : ' · twilight hides the faint ones') : ' · moonlight hides the faint ones';
    else if (S.lm < REF_LM - 0.05) text += ' · light pollution hides the faint ones';
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
      setShower(pr.shower, { date: HIST_DATES[pr.label] }); setRate(pr.rate);
      setPanel(false);   // starting a scenario hides the panel so the sky is in full view
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

  // The light-pollution slider is in Bortle classes; inside, it is the limiting magnitude S.lm.
  function setLm(lm, from) {
    S.lm = clamp(lm, 2.5, 7.2); if (from !== 'slider') el.lm.value = lmToBortle(S.lm).toFixed(1);
    el.lmOut.textContent = lmLabel(S.lm); el.lmNote.textContent = lmDetail(S.lm);
    updateLight(); skyDirty = true; resetSeen();
    refreshRateUi();
  }
  el.lm.addEventListener('input', () => setLm(bortleToLm(+el.lm.value), 'slider'));
  const syncFov = () => { el.fov.value = Math.round(cam.fov / DEG); el.fovOut.textContent = `${Math.round(cam.fov / DEG)}°`; };
  el.fov.addEventListener('input', () => { cam.fov = +el.fov.value * DEG; updateCam(); syncFov(); });

  let lastSpeed = 1;
  function setTime(t) {
    if (t > 0) lastSpeed = t;
    S.timeScale = t; setSeg(el.timeSeg, 't', t);
  }
  el.timeSeg.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setTime(+b.dataset.t); });
  // ---- date, time of day and place
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const p2 = n => String(n).padStart(2, '0');
  const tzLabel = tz => `UTC${tz >= 0 ? '+' : '−'}${Math.abs(tz)}`;
  function phaseName(k, waxing) {
    if (k < 0.03) return 'New Moon';
    if (k > 0.97) return 'Full Moon';
    if (Math.abs(k - 0.5) < 0.06) return waxing ? 'First quarter' : 'Last quarter';
    return `${waxing ? 'Waxing' : 'Waning'} ${k < 0.5 ? 'crescent' : 'gibbous'}`;
  }
  function refreshClockUi() {
    if (!el.date) return;
    const lp = localParts(clockMs);
    const ds = `${String(lp.y).padStart(4, '0')}-${p2(lp.m)}-${p2(lp.d)}`;
    if (document.activeElement !== el.date && el.date.value !== ds) el.date.value = ds;
    if (document.activeElement !== el.tod) el.tod.value = lp.min;
    const hm = `${p2(Math.floor(lp.min / 60))}:${p2(lp.min % 60)}`;
    el.todOut.textContent = `${hm} ${tzLabel(OBS.tz)}`;
    const phase = sunAltDeg >= -0.83 ? 'Daytime' : sunAltDeg > -6 ? 'Civil twilight' : sunAltDeg > -12 ? 'Nautical twilight'
      : sunAltDeg > -18 ? 'Astronomical twilight' : 'Full night';
    el.sunNote.textContent = `${phase}: Sun ${Math.round(sunAltDeg)}°. ${phaseName(moon.illum, moon.waxing)}, `
      + `${Math.round(moon.illum * 100)}% lit, ${moonAltDeg > 0 ? `${Math.round(moonAltDeg)}° up` : 'below the horizon'}.`;
    if (el.hudClock) el.hudClock.textContent = `${OBS.name} · ${lp.d} ${MONTHS[lp.m - 1]} ${lp.y}, ${hm}`;
  }
  el.date.addEventListener('change', () => {
    const m = /^(\d{4,})-(\d{2})-(\d{2})$/.exec(el.date.value);
    if (m) setClock(fromLocal(+m[1], +m[2], +m[3], localParts(clockMs).min));
  });
  el.tod.addEventListener('input', () => {
    const lp = localParts(clockMs);
    setClock(fromLocal(lp.y, lp.m, lp.d, +el.tod.value));
  });
  el.now.addEventListener('click', () => setClock(Date.now()));

  function setLocation(site, applyLm) {
    const lp = localParts(clockMs);   // keep the same local clock time at the new place
    OBS.name = site.name;
    OBS.lat = clamp(site.lat, -90, 90);
    OBS.lon = ((site.lon + 540) % 360) - 180;
    OBS.tz = site.tz !== undefined ? site.tz : Math.round(OBS.lon / 15);
    LAT = OBS.lat * DEG;
    if (applyLm && site.bortle) setLm(bortleToLm(site.bortle));
    el.lat.value = +OBS.lat.toFixed(2); el.lon.value = +OBS.lon.toFixed(2);
    const ns = `${Math.abs(OBS.lat).toFixed(1)}° ${OBS.lat >= 0 ? 'N' : 'S'}`, ew = `${Math.abs(OBS.lon).toFixed(1)}° ${OBS.lon >= 0 ? 'E' : 'W'}`;
    el.locOut.textContent = `${ns}, ${ew}`;
    el.siteNote.textContent = `${site.name}. Clock in local standard time, ${tzLabel(OBS.tz)}.`;
    setClock(fromLocal(lp.y, lp.m, lp.d, lp.min));
  }
  SITES.forEach((st, i) => {
    if (st.group) {
      const g = document.createElement('optgroup'); g.label = st.group; el.site.appendChild(g); return;
    }
    const o = document.createElement('option'); o.value = i; o.textContent = st.name;
    (el.site.lastElementChild && el.site.lastElementChild.tagName === 'OPTGROUP' ? el.site.lastElementChild : el.site).appendChild(o);
  });
  const customOpt = document.createElement('option'); customOpt.value = 'custom'; customOpt.textContent = 'Custom position';
  el.site.appendChild(customOpt);
  el.site.addEventListener('change', () => { const st = SITES[+el.site.value]; if (st) setLocation(st, true); });
  const fromInputs = () => {
    const la = parseFloat(el.lat.value), lo = parseFloat(el.lon.value);
    if (!isFinite(la) || !isFinite(lo)) return;
    el.site.value = 'custom';
    setLocation({ name: 'Custom position', lat: la, lon: lo }, false);
  };
  el.lat.addEventListener('change', fromInputs);
  el.lon.addEventListener('change', fromInputs);
  if (!navigator.geolocation) el.geo.hidden = true;
  el.geo.addEventListener('click', () => {
    el.geo.textContent = 'Locating…';
    navigator.geolocation.getCurrentPosition(pos => {
      el.geo.textContent = 'Use my location';
      el.site.value = 'custom';
      setLocation({ name: 'My location', lat: pos.coords.latitude, lon: pos.coords.longitude,
        tz: -new Date().getTimezoneOffset() / 60 }, false);
    }, () => { el.geo.textContent = 'Location unavailable'; setTimeout(() => { el.geo.textContent = 'Use my location'; }, 2500); },
    { maximumAge: 600000, timeout: 15000 });
  });
  const aurora = $('aurora');
  function updateAurora() {
    S.aurora = Number(aurora.value) / 100;
    $('auroraOut').value = S.aurora ? aurora.value + '%' : 'Off';
  }
  aurora.addEventListener('input', updateAurora);
  updateAurora();
  const auroraSpeed = $('auroraSpeed');
  function updateAuroraSpeed() {
    S.auroraSpeed = Number(auroraSpeed.value);
    $('auroraSpeedOut').value = S.auroraSpeed === 0 ? 'Paused' : S.auroraSpeed + '×';
  }
  auroraSpeed.addEventListener('input', updateAuroraSpeed);
  updateAuroraSpeed();

  const appearance = {};
  for (const key of ['foldDepth', 'rayContrast', 'curtainHeight', 'upperRed', 'pinkFringe', 'pinkGlow', 'purpleGlow', 'tealTint', 'greenHeight', 'redHeight', 'pinkHeight', 'purpleHeight', 'fringeHeight']) {
    const slider = $(key);
    const update = () => {
      appearance[key] = Number(slider.value) / 100;
      $(key + 'Out').value = slider.value + '%';
    };
    slider.addEventListener('input', update);
    update();
  }
  const auroraLooks = {
    green: { aurora: 92, foldDepth: 140, rayContrast: 105, curtainHeight: 85, upperRed: 12, pinkFringe: 4, pinkGlow: 0, purpleGlow: 0, tealTint: 35, greenHeight: 10, redHeight: 45, pinkHeight: 70, purpleHeight: 90, fringeHeight: 4 },
    magenta: { aurora: 56, foldDepth: 18, rayContrast: 55, curtainHeight: 165, upperRed: 120, pinkFringe: 0, pinkGlow: 130, purpleGlow: 65, tealTint: 0, greenHeight: 8, redHeight: 42, pinkHeight: 66, purpleHeight: 90, fringeHeight: 4 },
    teal: { aurora: 100, foldDepth: 150, rayContrast: 140, curtainHeight: 180, upperRed: 8, pinkFringe: 15, pinkGlow: 18, purpleGlow: 48, tealTint: 100, greenHeight: 18, redHeight: 55, pinkHeight: 65, purpleHeight: 86, fringeHeight: 5 }
  };
  const lookSelector = $('auroraLook');
  for (const key of ['aurora', ...Object.keys(appearance)]) {
    $(key).addEventListener('input', () => { lookSelector.value = ''; });
  }
  lookSelector.addEventListener('change', () => {
    const name = lookSelector.value;
    if (!name) return;
    for (const [key, value] of Object.entries(auroraLooks[name])) {
      const slider = $(key);
      slider.value = value;
      slider.dispatchEvent(new Event('input'));
    }
    lookSelector.value = name;
  });
  $('exportAurora').addEventListener('click', () => {
    const preset = { version: 2, activity: S.aurora, speed: S.auroraSpeed, ...appearance };
    const url = URL.createObjectURL(new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'meteorsim-aurora.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  el.showCardinals.addEventListener('change', () => { S.cardinals = el.showCardinals.checked; });

  el.modeSeg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    S.mode = b.dataset.m; setSeg(el.modeSeg, 'm', S.mode); resetSeen();
  });
  el.showRadiant.addEventListener('change', () => { S.showRadiant = el.showRadiant.checked; });
  const setGuide = on => { S.guide = el.showGuide.checked = on; if (!on) guidePinned = guideHover = null; };
  el.showGuide.addEventListener('change', () => setGuide(el.showGuide.checked));
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
  const fold = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const catalogue = [...guideItems, ...INFO.constellations].map(object => {
    const detail = [object.t || 'Constellation', object.s || object.c].filter(Boolean).join(' · ');
    return { object, detail, name: fold(object.n), search: fold([object.n, detail, object.i].join(' ')) };
  });
  const search = $('gotoSearch');
  const results = $('gotoResults');
  // Smooth camera flight, eased in and out. Pan and zoom run together and end together over a
  // fixed time, so a longer pan simply moves faster. The zoom follows a log scale (even from 100°
  // to 1°) but never gets narrower than three times the distance still to pan (across the short side of the screen), so the object
  // stays in view while the view turns toward it. Any drag, pinch or scroll stops the flight;
  // with reduced motion requested it is just quicker.
  let flight = null;
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function flyTo(target, fov) {
    const quick = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.5 : 1;
    flight = { target, yaw0: cam.yaw, pitch0: cam.pitch, fov0: cam.fov, fov1: fov, t0: performance.now(), ms: 1800 * quick };
  }
  function stepFlight(now) {
    if (!flight) return;
    const f = flight, u = clamp((now - f.t0) / f.ms, 0, 1), k = ease(u);
    const [yaw1, pitch1] = f.target();
    const dYaw = ((yaw1 - f.yaw0 + 3 * Math.PI) % TAU) - Math.PI;
    cam.yaw = f.yaw0 + dYaw * k;
    cam.pitch = f.pitch0 + (pitch1 - f.pitch0) * k;
    const left = (1 - k) * Math.hypot(dYaw * Math.cos(pitch1), pitch1 - f.pitch0);   // pan still to go, radians
    const zoomed = f.fov0 * Math.pow(f.fov1 / f.fov0, k);
    const aspect = Math.max(W, H) / Math.max(1, Math.min(W, H));   // fov spans the long side; keep it on the short one
    cam.fov = f.fov1 < f.fov0 ? Math.min(f.fov0, Math.max(zoomed, 3 * left * aspect)) : zoomed;
    updateCam(); syncFov();
    if (u >= 1) flight = null;
  }
  const stopFlight = () => { flight = null; };

  function goToObject(object) {
    const v = eqToHor(object.ra * HR, object.dec * DEG, lstNow());
    const altitude = Math.asin(clamp(v[2], -1, 1));
    if (altitude < 0) {
      $('gotoStatus').textContent = `${object.n} is ${Math.abs(altitude / DEG).toFixed(1)}° below the horizon at this place and time.`;
      return;
    }
    const photo = window.DeepSkyPhotos?.list.find(p => hasPhoto(object) && (p.code.replace(/\s/g, '') === String(object.s || '').replace(/\s/g, '') || p.name === object.n));
    const fov = photo ? clamp(Math.max(photo.w, photo.h) * 2.2, MIN_FOV, 60) * DEG : cam.fov;   // close enough to show the photo
    // The sky turns while we fly, so the target is worked out afresh every frame.
    flyTo(() => { const t = eqToHor(object.ra * HR, object.dec * DEG, lstNow()); return [azOf(t), Math.asin(clamp(t[2], -1, 1))]; }, fov);
    setGuide(true);
    guideHover = null;
    guidePinned = object.kind ? object : null;
    $('gotoStatus').textContent = `Viewing ${object.n}.`;
    setPanel(false);
    $('openPanel').focus();
  }
  // The list only opens once something is typed.
  function renderCatalogue() {
    const query = fold(search.value.trim());
    results.hidden = !query;
    if (!query) { results.replaceChildren(); $('gotoStatus').textContent = ''; return; }
    const matches = catalogue.filter(entry => entry.search.includes(query));
    const rank = entry => entry.name === query ? 0 : entry.name.startsWith(query) ? 1 : 2;
    matches.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    results.replaceChildren();
    for (const {object, detail} of matches) {
      const button = document.createElement('button');
      button.type = 'button';
      const photo = hasPhoto(object);
      button.textContent = photo ? `${object.n} *` : object.n;
      if (photo) button.title = PHOTO_NOTE;
      const small = document.createElement('small');
      small.textContent = photo ? `${detail} · photo` : detail;
      button.append(small);
      button.onclick = () => goToObject(object);
      results.append(button);
    }
    results.scrollTop = 0;
    $('gotoStatus').textContent = matches.length ? '' : 'No matching sky objects.';
  }
  search.addEventListener('input', renderCatalogue);
  search.addEventListener('keydown', e => {
    if (e.key === 'Enter') results.firstElementChild?.click();
    if (e.key === 'ArrowDown') { e.preventDefault(); results.firstElementChild?.focus(); }
  });
  $('closePanel').addEventListener('click', () => setPanel(false));
  $('openPanel').addEventListener('click', () => setPanel(true));

  // ---- looking around
  const pointers = new Map();
  let pinch = null;
  // A double-click / double-tap toggles the sky guide. Turning it on opens the card of whatever is
  // under the finger; the guide's hit list is built while drawing, so if it was off, wait two frames
  // for it before picking the object.
  function guideOnAt(x, y) {
    if (S.guide) { guidePinned = guideAt(x, y); return; }
    setGuide(true);
    requestAnimationFrame(() => requestAnimationFrame(() => { guidePinned = guideAt(x, y); }));
  }
  // A long press toggles the constellation lines and names.
  function toggleLines() {
    el.showLines.checked = !el.showLines.checked;
    el.showLines.dispatchEvent(new Event('change', { bubbles: true }));
    skyDirty = true;
  }
  let longPress = null, lastTap = null;
  // Hovering: the card stays up while the pointer crosses the gap to it and while it is over it,
  // so its links can be clicked.
  let hoverOff = 0, overCard = false;
  function leaveHover() {
    clearTimeout(hoverOff);
    hoverOff = setTimeout(() => { if (!overCard) { guideHover = null; canvas.style.cursor = ''; } }, 400);
  }
  skyCard.addEventListener('pointerenter', () => { overCard = true; clearTimeout(hoverOff); });
  skyCard.addEventListener('pointerleave', () => { overCard = false; if (guideHover) leaveHover(); });
  const cancelLongPress = () => { if (longPress) { clearTimeout(longPress.timer); longPress = null; } };
  canvas.addEventListener('contextmenu', e => e.preventDefault());   // a long press must not open a menu

  canvas.addEventListener('pointerdown', e => {
    stopFlight();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    cancelLongPress();
    if (!e.shiftKey && !e.altKey) {
      const x = e.clientX, y = e.clientY;
      longPress = { x, y, timer: setTimeout(() => { longPress = null; pointers.forEach(p => { p.held = true; }); toggleLines(); }, 550) };
    }
    if ((e.shiftKey || e.altKey) && S.shower !== 'sporadic') {
      const v = unproject(e.clientX, e.clientY);
      v[2] = Math.max(0, v[2]);
      [radRa, radDec] = horToEq(norm(v), lstNow());
      radVec = eqToHor(radRa, radDec, lstNow());
      S.showRadiant = el.showRadiant.checked = true;
      return;
    }
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
    canvas.classList.add('dragging');
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, fov: cam.fov };
      cancelLongPress();
    }
  });
  canvas.addEventListener('pointermove', e => {
    const prev = pointers.get(e.pointerId);
    if (!prev) {
      if (S.guide && e.pointerType === 'mouse') {
        const o = guideAt(e.clientX, e.clientY);
        if (o) { clearTimeout(hoverOff); if (o !== guideHover) { guideHover = o; canvas.style.cursor = 'pointer'; } }
        else if (guideHover) leaveHover();
      }
      return;
    }
    if (longPress && Math.hypot(e.clientX - longPress.x, e.clientY - longPress.y) > 8) cancelLongPress();
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
    const p = pointers.get(e.pointerId);
    cancelLongPress();
    const tap = p && !p.held && e.type === 'pointerup' && pointers.size === 1 && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 6;
    if (tap) {
      const now = performance.now();
      if (lastTap && now - lastTap.t < 350 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
        lastTap = null;
        if (S.guide) setGuide(false);   // a double-click toggles the guide
        else guideOnAt(e.clientX, e.clientY);
      } else {
        lastTap = { t: now, x: e.clientX, y: e.clientY };
        if (S.guide) guidePinned = guideAt(e.clientX, e.clientY);
      }
    }
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!pointers.size) canvas.classList.remove('dragging');
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    stopFlight();
    cam.fov *= Math.exp(e.deltaY * 0.0012);
    updateCam(); syncFov();
  }, { passive: false });

  window.addEventListener('keydown', e => {
    if (e.target === search || (e.key === ' ' && e.target.closest?.('button, summary'))) return;
    if (e.target instanceof HTMLInputElement && (e.target.type === 'number' || e.target.type === 'date')) return;
    if (e.target instanceof HTMLSelectElement) return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); setTime(S.timeScale === 0 ? lastSpeed : 0); }
    else if (k === 'h') setPanel(document.body.classList.contains('ui-hidden'));
    else if (k === 'z') document.body.classList.toggle('zen');
    else if (k === 'c') setComet(!S.comet);
    else if (k === 'i') setGuide(!S.guide);
    else if (k === 'l') toggleLines();
    else if (k === 'f') $('fullscreen').click();
    else if (k === 'arrowleft') { cam.yaw -= 5 * DEG; updateCam(); }
    else if (k === 'arrowright') { cam.yaw += 5 * DEG; updateCam(); }
    else if (k === 'arrowup') { e.preventDefault(); cam.pitch += 5 * DEG; updateCam(); }
    else if (k === 'arrowdown') { e.preventDefault(); cam.pitch -= 5 * DEG; updateCam(); }
  });
  window.addEventListener('resize', resize);

  // handy for poking at the simulation from the browser console
  window.meteorSim = { S, cam, meteors, trains, comet, render, setRate: r => setRate(r), setLm: l => setLm(l),
    project: v => { const p = project(v); return p && [p[0], p[1]]; }, arcPoint,
    get realSky() { return !!(sky && skyReady); }, get skyTexture() { return sky ? sky.textureSize : 0; } };

  /* ------------------------------------------------------------------ window.MeteorSim
   * A small API for add-on modules (an aurora layer, overlays...). Directions are unit vectors in
   * horizon coordinates: x = east, y = north, z = up. Angles in radians unless named *Deg.
   *
   *   getObserver()   -> { name, lat, lon (degrees, east positive), tz (hours), date: Date (UTC instant),
   *                        lst (local sidereal time, radians), sunAlt, sunAz, moonAlt, moonAz (degrees),
   *                        moonIllum (0..1), sunDir, moonDir (vectors) }
   *   getPollution()  -> { bortle (1..9), sqm (night sky from light pollution, mag/arcsec²),
   *                        lm (limiting magnitude from light pollution alone), sqmNow, lmNow (including
   *                        twilight and moonlight), t (0..1 light-pollution strength), day (0..1 daylight) }
   *   getView()       -> { yaw (azimuth of view centre), pitch, fov, width, height (CSS px), focal (px/tan) }
   *   eqToHor(ra, dec[, lst]) -> vector      horToEq(vec[, lst]) -> [ra, dec]
   *   dir(az, alt) -> vector                 azAlt(vec) -> [az, alt]
   *   project(vec) -> [x, y] in CSS px, or null if behind the camera     unproject(x, y) -> vector
   *   projectAzAlt(azDeg, altDeg) -> [x, y] | null
   *   terrainAlt(az) -> altitude of the landscape's skyline at that azimuth, degrees
   *   addLayer(fn)    -> remove(). fn(ctx, dt, MeteorSim) runs every frame with the main 2D context
   *                      (transform set to CSS pixels), after the sky, Sun and Moon and before the meteors
   *                      and the landscape. dt is simulated seconds since the last frame (meteor clock).
   *   setLocation({ name, lat, lon, tz }), setTime(Date | ms)
   *   realSky, skyTexture (width of the star map in use), skyFull (the sharpest star map has loaded)
   * A 'meteorsim-ready' event fires on window once this API exists.
   */
  const API = {
    get realSky() { return skyLive(); },
    get skyTexture() { return sky ? sky.textureSize : 0; },
    // true once the star map is the sharpest this device will get (8K, or 4K where 8K can't be used)
    get skyFull() { return skyLive() && (sky.textureSize >= 8192 || sky.maxTexture < 8192); },
    getObserver() {
      return { name: OBS.name, lat: OBS.lat, lon: OBS.lon, tz: OBS.tz, date: new Date(clockMs), lst: lstNow(),
        sunAlt: sunAltDeg, sunAz: (((azOf(sunVec) / DEG) % 360) + 360) % 360, moonAlt: moonAltDeg,
        moonAz: (((azOf(moonVec) / DEG) % 360) + 360) % 360, moonIllum: moon.illum,
        sunDir: sunVec.slice(), moonDir: moonVec.slice() };
    },
    getPollution() {
      return { bortle: lmToBortle(S.lm), sqm: lmToSqm(S.lm), lm: S.lm, sqmNow, lmNow,
        t: clamp((6.6 - S.lm) / 3.4, 0, 1), day: dayF };
    },
    getView: () => ({ yaw: cam.yaw, pitch: cam.pitch, fov: cam.fov, width: W, height: H, focal }),
    eqToHor: (ra, dec, lst = lstNow()) => eqToHor(ra, dec, lst),
    horToEq: (v, lst = lstNow()) => horToEq(v, lst),
    dir, azAlt: v => [azOf(v), Math.asin(clamp(v[2], -1, 1))],
    project: v => { const p = project(v); return p && [p[0], p[1]]; },
    projectAzAlt: (azDeg, altDeg) => { const p = project(dir(azDeg * DEG, altDeg * DEG)); return p && [p[0], p[1]]; },
    unproject: (x, y) => unproject(x, y),
    terrainAlt: az => terrainAt(az),
    addLayer(fn) { layers.push(fn); return () => { const i = layers.indexOf(fn); if (i >= 0) layers.splice(i, 1); }; },
    setLocation: site => { el.site.value = 'custom'; setLocation({ name: 'Custom position', ...site }, false); },
    setTime: t => setClock(+t),
  };
  window.MeteorSim = API;

  // ------------------------------------------------------------------ start
  if (window.innerWidth < 700) setPanel(false);
  resize();
  setLocation(SITES[0], false);
  setLm(S.lm);
  syncFov();
  setTime(1);
  setSeg(el.modeSeg, 'm', S.mode);
  setShower(S.shower);
  setRate(S.rate);
  requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
  window.dispatchEvent(new Event('meteorsim-ready'));
})();
