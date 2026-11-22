/* Deep-sky photos: real images of nebulae, galaxies and clusters, placed on the sky at their true
 * position, size and orientation, and faded in as you zoom toward them. Each has a small version that
 * loads when the object first gets big enough to notice, and a 2048 px version once it fills the view.
 * Photos: ESO and NOIRLab/NSF/AURA, CC BY 4.0 (credit lines below are shown on screen while in view).
 * Nothing loads until the sharpest star map is in, so photos never sit over the generated or 4K sky.
 * Backgrounds were set to black and edges feathered, so a photo adds onto the sky like light. */
(function () {
  const OBJECTS = [
    {"id": "m31", "code": "M31", "name": "Andromeda Galaxy", "ra": 9.93263, "dec": 40.41221, "w": 2.704, "h": 0.9817, "rot": -120.3, "credit": "KPNO/NOIRLab/NSF/AURA/Adam Block", "src": "https://noirlab.edu/public/images/noao-m31fsqblock/"},
    {"id": "m42", "code": "M42", "name": "Orion Nebula", "ra": 83.78442, "dec": -5.4787, "w": 0.9992, "h": 0.776, "rot": 0.2, "credit": "ESO/G. Beccari", "src": "https://www.eso.org/public/images/eso1723a/"},
    {"id": "m45", "code": "M45", "name": "Pleiades", "ra": 56.55438, "dec": 24.11007, "w": 1.1447, "h": 0.8355, "rot": -90.7, "credit": "NOIRLab/NSF/AURA/T.A. Rector (University of Alaska Anchorage), R. Cool (University of Arizona) and WIYN", "src": "https://noirlab.edu/public/images/noao-m45/"},
    {"id": "m8", "code": "M8", "name": "Lagoon Nebula", "ra": 270.90413, "dec": -24.38694, "w": 1.5582, "h": 1.0435, "rot": 0.0, "credit": "ESO", "src": "https://www.eso.org/public/images/eso0936a/"},
    {"id": "m20", "code": "M20", "name": "Trifid Nebula", "ra": 270.47117, "dec": -23.02941, "w": 0.3912, "h": 0.3912, "rot": 0.2, "credit": "Todd Boroson/NOIRLab/ NSF /AURA", "src": "https://noirlab.edu/public/images/noao-m20/"},
    {"id": "m17", "code": "M17", "name": "Omega Nebula", "ra": 275.35604, "dec": -16.1662, "w": 0.5473, "h": 0.5473, "rot": 1.9, "credit": "Hillary Mathis, N.A.Sharp, REU program/NOIRLab/ NSF /AURA", "src": "https://noirlab.edu/public/images/noao-m17/"},
    {"id": "m13", "code": "M13", "name": "Hercules Cluster", "ra": 250.54408, "dec": 36.59652, "w": 0.3583, "h": 0.3583, "rot": 89.9, "credit": "T.A. Rector (University of Alaska Anchorage) and H. Schweiker (WIYN and NOIRLab/ NSF /AURA)", "src": "https://noirlab.edu/public/images/noao-m13kpno4m/"},
    {"id": "m33", "code": "M33", "name": "Triangulum Galaxy", "ra": 23.27783, "dec": 30.48549, "w": 1.381, "h": 0.9735, "rot": 60.9, "credit": "KPNO/NOIRLab/NSF/AURA/Ken Hotelling/Flynn Haase", "src": "https://noirlab.edu/public/images/noao-m33hotelling/"},
    {"id": "m51", "code": "M51", "name": "Whirlpool Galaxy", "ra": 202.47204, "dec": 47.40226, "w": 0.5537, "h": 0.5163, "rot": -0.4, "credit": "K. Rhode, M. Young and WIYN/NOIRLab/ NSF /AURA/", "src": "https://noirlab.edu/public/images/noao1309a/"},
    {"id": "ngc3372", "code": "NGC 3372", "name": "Carina Nebula", "ra": 161.27375, "dec": -59.86324, "w": 1.0303, "h": 1.1057, "rot": -0.0, "credit": "ESO. Acknowledgement: VPHAS+ Consortium/Cambridge Astronomical Survey Unit", "src": "https://www.eso.org/public/images/eso1250a/"},
    {"id": "ngc7293", "code": "NGC 7293", "name": "Helix Nebula", "ra": 337.46942, "dec": -20.89059, "w": 0.57, "h": 0.4512, "rot": 2.8, "credit": "NOIRLab/ NSF /AURA", "src": "https://noirlab.edu/public/images/noao-02179/"},
    {"id": "ngc7000", "code": "NGC 7000", "name": "North America Nebula", "ra": 313.46612, "dec": 44.31067, "w": 4.1768, "h": 2.8562, "rot": -3.0, "credit": "KPNO/NOIRLab/NSF/AURA/Adam Block", "src": "https://noirlab.edu/public/images/noao-n7000mosblock/"},
    {"id": "ngc2237", "code": "NGC 2237", "name": "Rosette Nebula", "ra": 98.04567, "dec": 4.91767, "w": 1.5792, "h": 1.3437, "rot": 0.0, "credit": "CTIO/NOIRLab/DOE/NSF/AURA Image Processing: T.A. Rector (University of Alaska Anchorage/NSF NOIRLab), D. de Martin & M. Zamani (NSF NOIRLab)", "src": "https://noirlab.edu/public/images/noirlab2424a/"},
    {"id": "b33", "code": "B33", "name": "Horsehead Nebula", "ra": 85.22908, "dec": -2.71834, "w": 0.943, "h": 0.9588, "rot": 89.7, "credit": "T.A.Rector (NOIRLab/ NSF /AURA) and Hubble Heritage Team (STScI/AURA/NASA)", "src": "https://noirlab.edu/public/images/noao0126a/"},
    {"id": "ngc1499", "code": "NGC 1499", "name": "California Nebula", "ra": 59.55875, "dec": 36.63297, "w": 1.702, "h": 2.531, "rot": 56.7, "credit": "KPNO/NOIRLab/NSF/AURA/Adam Block", "src": "https://noirlab.edu/public/images/noao-n1499block/"},
    {"id": "m81", "code": "M81", "name": "Bode's Galaxy", "ra": 148.75204, "dec": 68.91793, "w": 0.3865, "h": 0.3865, "rot": 0.3, "credit": "N.A.Sharp/NOIRLab/ NSF /AURA/", "src": "https://noirlab.edu/public/images/noao-m81/"},
    {"id": "m82", "code": "M82", "name": "Cigar Galaxy", "ra": 148.92354, "dec": 69.6789, "w": 0.193, "h": 0.1288, "rot": -179.9, "credit": "N.A.Sharp/NOIRLab/ NSF /AURA/", "src": "https://noirlab.edu/public/images/noao-m82/"},
    {"id": "m27", "code": "M27", "name": "Dumbbell Nebula", "ra": 299.90383, "dec": 22.72122, "w": 0.1483, "h": 0.1272, "rot": 2.1, "credit": "REU program/NOIRLab/ NSF /AURA", "src": "https://noirlab.edu/public/images/noao-m27/"},
    {"id": "m44", "code": "M44", "name": "Beehive Cluster", "ra": 130.06862, "dec": 19.71869, "w": 1.0152, "h": 1.0152, "rot": -180.0, "credit": "NOIRLab/ NSF /AURA", "src": "https://noirlab.edu/public/images/noao-m44/"},
    {"id": "m104", "code": "M104", "name": "Sombrero Galaxy", "ra": 190.04146, "dec": -11.61198, "w": 0.1957, "h": 0.146, "rot": 0.2, "credit": "Todd Boroson/NOIRLab/ NSF /AURA/", "src": "https://noirlab.edu/public/images/noao-m104/"},
    {"id": "m5", "code": "M5", "name": "Messier 5", "ra": 229.83433, "dec": 1.98889, "w": 0.5775, "h": 0.5775, "rot": 2.6, "credit": "Hillary Mathis, REU Program/NOIRLab/ NSF /AURA", "src": "https://noirlab.edu/public/images/noao-m5/"},
    {"id": "m22", "code": "M22", "name": "Sagittarius Cluster", "ra": 278.96554, "dec": -24.02734, "w": 0.5775, "h": 0.4332, "rot": 1.9, "credit": "N.A.Sharp, REU program/NOIRLab/ NSF /AURA", "src": "https://noirlab.edu/public/images/noao-m22/"},
    {"id": "m11", "code": "M11", "name": "Wild Duck Cluster", "ra": 282.82896, "dec": -6.36347, "w": 0.2888, "h": 0.2888, "rot": 2.1, "credit": "N.A.Sharp, REU program/NOIRLab/ NSF /AURA", "src": "https://noirlab.edu/public/images/noao-m11/"},
    {"id": "m35", "code": "M35", "name": "Messier 35", "ra": 92.40167, "dec": 24.22804, "w": 0.7897, "h": 0.6768, "rot": 2.3, "credit": "N.A.Sharp/NOIRLab/ NSF /AURA", "src": "https://noirlab.edu/public/images/noao-m35/"},
    {"id": "m78", "code": "M78", "name": "Messier 78", "ra": 86.50867, "dec": 0.01008, "w": 0.5963, "h": 0.609, "rot": -0.2, "credit": "T. A. Rector/University of Alaska Anchorage, H. Schweiker/WIYN and NOIRLab/ NSF /AURA", "src": "https://noirlab.edu/public/images/noao-m78/"},
    {"id": "m24", "code": "M24", "name": "Sagittarius Star Cloud", "ra": 274.34762, "dec": -18.63594, "w": 1.112, "h": 1.0287, "rot": 0.0, "credit": "Vanessa Harvey, REU program/NOIRLab/ NSF /AURA", "src": "https://noirlab.edu/public/images/noao-m24/"},
    {"id": "m7", "code": "M7", "name": "Ptolemy's Cluster", "ra": 268.17579, "dec": -34.74093, "w": 0.987, "h": 0.987, "rot": 1.8, "credit": "N.A.Sharp, REU program/NOIRLab/ NSF /AURA", "src": "https://noirlab.edu/public/images/noao-m7/"},
    {"id": "m39", "code": "M39", "name": "Messier 39", "ra": 322.95438, "dec": 48.46395, "w": 0.7753, "h": 0.7753, "rot": -0.8, "credit": "WIYN/KPNO/NOIRLab/ NSF /AURA/H. Schweiker", "src": "https://noirlab.edu/public/images/noao-m39/"},
    {"id": "m41", "code": "M41", "name": "Messier 41", "ra": 101.56488, "dec": -20.68646, "w": 0.705, "h": 0.705, "rot": 2.2, "credit": "NOIRLab/ NSF /AURA", "src": "https://noirlab.edu/public/images/noao-m41/"},
    {"id": "m94", "code": "M94", "name": "Croc's Eye Galaxy", "ra": 192.68788, "dec": 41.11261, "w": 0.2823, "h": 0.2835, "rot": 1.4, "credit": "Hillary Mathis, N.A.Sharp/NOIRLab/ NSF /AURA/", "src": "https://noirlab.edu/public/images/noao-m94/"},
    {"id": "m63", "code": "M63", "name": "Sunflower Galaxy", "ra": 199.085, "dec": 42.08855, "w": 0.3402, "h": 0.2582, "rot": 1.2, "credit": "N.A.Sharp/NOIRLab/ NSF /AURA/", "src": "https://noirlab.edu/public/images/noao-m63/"},
    {"id": "m64", "code": "M64", "name": "Black Eye Galaxy", "ra": 194.20367, "dec": 21.67543, "w": 0.242, "h": 0.242, "rot": 1.3, "credit": "NOIRLab/ NSF /AURA", "src": "https://noirlab.edu/public/images/noao-m64/"},
    {"id": "m106", "code": "M106", "name": "Messier 106", "ra": 184.99529, "dec": 47.37415, "w": 0.5755, "h": 0.5775, "rot": 2.1, "credit": "N.A.Sharp, REU program/NOIRLab/ NSF /AURA/", "src": "https://noirlab.edu/public/images/noao-m106/"},
    {"id": "m65", "code": "M65", "name": "Messier 65", "ra": 169.68983, "dec": 13.13368, "w": 0.1162, "h": 0.1735, "rot": -0.2, "credit": "NOIRLab/ NSF /AURA", "src": "https://noirlab.edu/public/images/noao-m65/"},
    {"id": "m66", "code": "M66", "name": "Messier 66", "ra": 170.02779, "dec": 12.99689, "w": 0.1323, "h": 0.1653, "rot": -0.4, "credit": "NOIRLab/ NSF /AURA", "src": "https://noirlab.edu/public/images/noao-m66/"},
    {"id": "m74", "code": "M74", "name": "Phantom Galaxy", "ra": 24.23425, "dec": 15.80643, "w": 0.3438, "h": 0.2608, "rot": -1.8, "credit": "Todd Boroson/NOIRLab/ NSF /AURA/", "src": "https://noirlab.edu/public/images/noao-m74/"},
    {"id": "m92", "code": "M92", "name": "Messier 92", "ra": 259.41517, "dec": 43.18862, "w": 0.4793, "h": 0.4793, "rot": 2.6, "credit": "Hillary Mathis, REU program/NOIRLab/ NSF /AURA", "src": "https://noirlab.edu/public/images/noao-m92/"}
  ];
  const DEG = Math.PI / 180;
  // Lets the rest of the page mark objects that have a photo (a catalogue code like 'M31', or a name).
  const norm = t => String(t || '').toLowerCase().replace(/\s+/g, '');
  const find = object => object ? OBJECTS.find(o => norm(o.code) === norm(object.s) || norm(o.name) === norm(object.n)) || null : null;
  window.DeepSkyPhotos = { has: object => !!find(object), find, list: OBJECTS };
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // Small and full-size images, fetched on demand. A full-size photo takes 16 MB once decoded, so only
  // the few most recently drawn are kept (fewer on phones, which otherwise lose the WebGL sky).
  const images = new Map();
  const MAX_FULL = matchMedia('(pointer: coarse)').matches ? 3 : 8;
  function evict() {
    const full = [...images].filter(([k]) => !k.endsWith('_s'));
    if (full.length <= MAX_FULL) return;
    full.sort((a, b) => a[1].used - b[1].used);
    for (const [k, rec] of full.slice(0, full.length - MAX_FULL)) {
      if (rec.img) { rec.img.width = rec.img.height = 0; }   // free the canvas memory now
      images.delete(k);
    }
  }
  function image(o, full) {
    const key = o.id + (full ? '' : '_s');
    let rec = images.get(key);
    if (rec) rec.used = performance.now();
    if (!rec) {
      rec = { img: null, ready: false, used: performance.now() };
      const img = new Image();
      img.onload = () => { rec.img = toLight(img); rec.ready = true; if (full) evict(); };
      img.src = 'assets/deepsky/' + key + '.jpg';
      images.set(key, rec);
    }
    return rec.ready ? rec.img : null;
  }

  // The 2D layer sits over the WebGL sky, so blending can only cover it, not add to it. Turn each
  // photo into light over transparency (alpha = brightness), which over the sky behaves like adding.
  function toLight(img) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
    for (let i = 0; i < a.length; i += 4) {
      const m = Math.max(a[i], a[i + 1], a[i + 2]);
      if (m === 0) { a[i + 3] = 0; continue; }
      const k = 255 / m;
      a[i] *= k; a[i + 1] *= k; a[i + 2] *= k; a[i + 3] = m;
    }
    x.putImageData(d, 0, 0);
    return c;
  }

  const creditEl = document.createElement('div');
  creditEl.id = 'dsoCredit';
  creditEl.className = 'dso-credit';
  document.body.appendChild(creditEl);
  let creditText = '';

  // The object's own position from the sky catalogue (a photo's centre can sit a little off it),
  // so the spinner lands on the sky-guide marker.
  const catalogue = window.SKY_INFO?.deep || [];
  function markerAt(o, ms, lst) {
    const entry = catalogue.find(e => norm(e.s) === norm(o.code) || norm(e.n) === norm(o.name));
    if (!entry) return null;
    const p = ms.project(ms.eqToHor(entry.ra * 15 * DEG, entry.dec * DEG, lst));
    return p && p.slice();
  }

  function drawSpinner(ctx, x, y) {
    const t = performance.now() / 1000, r = 15;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,205,150,0.95)';
    const a = t * 5;
    ctx.beginPath(); ctx.arc(x, y, r, a, a + Math.PI * 1.3); ctx.stroke();
    ctx.restore();
  }

  function start(MS) {
    MS.addLayer((ctx, dt, ms) => {
      const view = ms.getView(), fovDeg = view.fov / DEG;
      const shown = [], spinners = [];
      // Photos sit on top of the high-resolution star map only: nothing is fetched or drawn before it is in.
      if (fovDeg < 60 && ms.skyFull) {
        const day = ms.getPollution().day;
        const lst = ms.getObserver().lst;
        for (const o of OBJECTS) {
          const size = Math.max(o.w, o.h);
          let alpha = smooth(0.03, 0.15, size / fovDeg) * (1 - 0.85 * day);
          if (alpha <= 0.005) continue;
          const ra = o.ra * DEG, dec = o.dec * DEG, eps = 0.002;
          const c = ms.eqToHor(ra, dec, lst);
          const alt = Math.asin(Math.max(-1, Math.min(1, c[2]))) / DEG;
          alpha *= smooth(-1, 6, alt);   // gone below the horizon, dimmed close to it
          if (alpha <= 0.005) continue;
          const p0 = ms.project(c);
          if (!p0) continue;
          const pN = ms.project(ms.eqToHor(ra, dec + eps, lst));
          const pE = ms.project(ms.eqToHor(ra + eps / Math.cos(dec), dec, lst));
          if (!pN || !pE) continue;
          // screen pixels per radian toward celestial north and east
          const N = [(pN[0] - p0[0]) / eps, (pN[1] - p0[1]) / eps], E = [(pE[0] - p0[0]) / eps, (pE[1] - p0[1]) / eps];
          // "North is rot° left of vertical": the image's up and right axes on the sky
          const t = o.rot * DEG, ct = Math.cos(t), st = Math.sin(t);
          const up = [ct * N[0] - st * E[0], ct * N[1] - st * E[1]];
          const right = [-st * N[0] - ct * E[0], -st * N[1] - ct * E[1]];
          const halfW = o.w / 2 * DEG, halfH = o.h / 2 * DEG;
          const reach = Math.hypot(right[0] * halfW, right[1] * halfW) + Math.hypot(up[0] * halfH, up[1] * halfH);
          if (p0[0] < -reach || p0[1] < -reach || p0[0] > view.width + reach || p0[1] > view.height + reach) continue;
          const widthPx = 2 * Math.hypot(right[0], right[1]) * halfW;
          const wantFull = widthPx > 500;
          const full = wantFull ? image(o, true) : null;
          const img = full || image(o, false);
          // Still on its way (or the sharper version is): show a small spinner on the object.
          if (!img || (wantFull && !full)) spinners.push(markerAt(o, ms, lst) || p0.slice());
          if (!img) continue;
          const sx = 2 * halfW / img.width, sy = 2 * halfH / img.height;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(p0[0], p0[1]);
          ctx.transform(right[0] * sx, right[1] * sx, -up[0] * sy, -up[1] * sy, 0, 0);
          ctx.drawImage(img, -img.width / 2, -img.height / 2);
          ctx.restore();
          if (alpha > 0.25) shown.push(o);
        }
      }
      for (const [x, y] of spinners) drawSpinner(ctx, x, y);
      const text = shown.length ? shown.map(o => `${o.name} (${o.code}): ${o.credit}`).join(' · ') + ' · CC BY 4.0' : '';
      if (text !== creditText) { creditText = text; creditEl.textContent = text; creditEl.hidden = !text; }
    });
  }

  if (window.MeteorSim) start(window.MeteorSim);
  else window.addEventListener('meteorsim-ready', () => start(window.MeteorSim), { once: true });
})();
