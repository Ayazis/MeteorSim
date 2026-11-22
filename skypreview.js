/* Sky guide categories and little drawn previews for the info card.
 * Categories are colour coded (all stars share one colour); previews are impressions, not photos. */
(function () {
  const CATS = {
    star:    { label: 'Star',        color: [190, 225, 250] },
    cluster: { label: 'Star cluster', color: [250, 228, 170] },
    nebula:  { label: 'Nebula',      color: [248, 180, 210] },
    galaxy:  { label: 'Galaxy',      color: [205, 190, 250] },
    hole:    { label: 'Black hole',  color: [250, 195, 160] },
  };
  function category(o) {
    if (o.kind === 'star') return 'star';
    const t = (o.t || '').toLowerCase();
    if (t.includes('black hole')) return 'hole';
    if (t.includes('galaxy')) return 'galaxy';
    if (t.includes('nebula')) return 'nebula';
    return 'cluster';   // open, globular, pairs, asterisms, star clouds
  }
  // Each named star: [colour of the main star, size, companion colours]. Sizes: d dwarf / main
  // sequence, g giant, b bright giant, s supergiant. 'wd' is a white dwarf. Checked against spectral types.
  const STARS = {
    Sirius: ['A', 'd', ['wd']], Canopus: ['F', 'b', []], Arcturus: ['K2', 'g', []], 'Rigil Kentaurus': ['G', 'd', ['K', 'M']],
    Vega: ['A', 'd', []], Capella: ['G', 'g', ['G', 'M', 'M']], Rigel: ['B', 's', ['B']], Procyon: ['F', 'd', ['wd']],
    Betelgeuse: ['M', 's', []], Achernar: ['B', 'd', ['A']], Altair: ['A', 'd', []], Aldebaran: ['K5', 'g', []],
    Antares: ['M', 's', ['B']], Spica: ['B', 'd', ['B']], Pollux: ['K', 'g', []], Castor: ['A', 'd', ['A', 'M']],
    Fomalhaut: ['A', 'd', []], Deneb: ['A', 's', []], Regulus: ['B', 'd', ['wd', 'K', 'M']], Adhara: ['B', 'b', ['B']],
    Bellatrix: ['B', 'g', []], Elnath: ['B', 'g', []], Alnilam: ['B', 's', []], Alnitak: ['O', 's', ['B', 'B']],
    Mintaka: ['O', 'g', ['B', 'B']], Saiph: ['B', 's', []], Alioth: ['A', 'd', []], Dubhe: ['K', 'g', ['F']],
    Merak: ['A', 'd', []], 'Mizar & Alcor': ['A', 'd', ['A', 'A']], Alkaid: ['B', 'd', []], Polaris: ['F', 's', ['F', 'F']],
    Mirfak: ['F', 's', []], Algol: ['B', 'd', ['K', 'A']], Alpheratz: ['B', 'd', ['A']], Hamal: ['K2', 'g', []],
    Schedar: ['K', 'g', []], Kochab: ['K2', 'g', []], Eltanin: ['K2', 'g', []], Rasalhague: ['A', 'g', ['K']],
    Denebola: ['A', 'd', []], Algieba: ['K', 'g', ['G']], Markab: ['B', 'g', []], Albireo: ['K2', 'g', ['B']],
    Nunki: ['B', 'd', []], Shaula: ['B', 'd', ['B', 'B']],
  };
  const SIZE = { d: 14, g: 22, b: 27, s: 33 };
  const TINT = { O: [160, 185, 255], B: [175, 200, 255], A: [230, 238, 255], F: [255, 250, 230], G: [255, 236, 180],
    K: [255, 205, 130], K2: [255, 185, 110], K5: [255, 105, 65], M: [235, 70, 50], wd: [235, 240, 255] };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  // Small seeded random, so each object's preview is stable.
  function rng(seed) {
    let h = 2166136261;
    for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  }
  function glow(g, x, y, r, c, a = 1) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba([255, 255, 255], a));
    gr.addColorStop(0.18, rgba(c, a));
    gr.addColorStop(0.5, rgba(c, a * 0.25));
    gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  function blob(g, x, y, r, c, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(c, a)); gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  function bgStars(g, w, h, R, n) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = `rgba(255,255,255,${0.15 + R() * 0.5})`;
      g.fillRect(R() * w, R() * h, 1, 1);
    }
  }

  function drawStar(g, w, h, o, R) {
    const t = o.t.toLowerCase(), [cls, sz, comps] = STARS[o.n] || ['A', 'd', []], c = TINT[cls];
    const n = comps.length, cx = w / 2 - (n ? 12 : 0), cy = h / 2 + (n ? 6 : 0);
    const size = SIZE[sz];
    // the disc, with darkened limb
    const gr = g.createRadialGradient(cx - size * 0.2, cy - size * 0.2, 0, cx, cy, size);
    gr.addColorStop(0, rgba([255, 255, 255], 1)); gr.addColorStop(0.45, rgba(c, 1)); gr.addColorStop(1, rgba(c.map(v => v * 0.55), 1));
    blob(g, cx, cy, size * 1.9, c, 0.35);
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, size, 0, Math.PI * 2); g.fill();
    if (cls === 'M' || cls === 'K5') {   // mottled convection cells on cool giants
      g.save(); g.globalCompositeOperation = 'source-atop';
      for (let i = 0; i < 10; i++) {
        const a = R() * Math.PI * 2, d = R() * size * 0.7;
        blob(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d, size * 0.35, [120, 40, 20], 0.3);
      }
      g.restore();
    }
    if (t.includes('ring')) {
      g.strokeStyle = 'rgba(200,180,150,0.7)'; g.lineWidth = 2.5;
      g.beginPath(); g.ellipse(cx, cy, size * 3, size * 1.2, -0.3, 0, Math.PI * 2); g.stroke();
    }
    comps.forEach((k, i) => {   // companions, upper right, in their real colours
      const x = Math.min(w - 10, cx + size + 12 + i * 14), y = cy - size - 6 + i * 12;
      glow(g, x, Math.max(10, y), k === 'wd' ? 5 : k === 'M' ? 6 : 9, TINT[k]);
    });
    if (t.includes('planet')) { g.fillStyle = '#6a8098'; g.beginPath(); g.arc(cx - size - 12, cy + size * 0.6, 3.5, 0, Math.PI * 2); g.fill(); }
  }

  function drawCluster(g, w, h, o, R) {
    const t = o.t.toLowerCase(), cx = w / 2, cy = h / 2;
    if (t.includes('globular')) {
      blob(g, cx, cy, 34, [255, 225, 170], 0.5);
      for (let i = 0; i < 500; i++) {
        const r = Math.abs((R() + R() + R() - 1.5)) * 30, a = R() * Math.PI * 2;
        g.fillStyle = rgba(R() < 0.3 ? TINT.K : [255, 240, 210], 0.5 + R() * 0.5);
        g.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.2, 1.2);
      }
      return;
    }
    if (t.includes('asterism')) {   // the Coathanger: a row of six stars with a hook of four below
      const pts = [[-40, -8], [-24, -6], [-8, -5], [8, -5], [24, -6], [40, -8], [2, 6], [6, 16], [0, 26], [-6, 22]];
      for (const [x, y] of pts) glow(g, cx + x, cy + y, 5 + R() * 3, R() < 0.7 ? TINT.B : TINT.K, 1);
      return;
    }
    const centres = t.includes('pair') ? [[cx - 26, cy], [cx + 26, cy]] : [[cx, cy]];
    const spread = t.includes('cloud') ? 60 : t.includes('pair') ? 18 : 32;
    if (o.s === 'M45') blob(g, cx, cy, 45, [110, 150, 255], 0.35);   // the Pleiades' blue haze
    for (const [x0, y0] of centres) {
      const n = t.includes('cloud') ? 320 : 26;
      if (t.includes('cloud')) blob(g, x0, y0, 70, [255, 220, 170], 0.25);
      for (let i = 0; i < n; i++) {
        const a = R() * Math.PI * 2, r = Math.sqrt(R()) * spread;
        const bright = t.includes('cloud') ? 2.2 + R() * 1.5 : 2 + R() * 5;
        glow(g, x0 + Math.cos(a) * r * 1.3, y0 + Math.sin(a) * r * 0.9, bright, R() < (o.s === 'Mel 25' ? 0.6 : 0.8) ? TINT.B : TINT.K, 0.9);
      }
    }
  }

  function drawNebula(g, w, h, o, R) {
    const t = o.t.toLowerCase(), cx = w / 2, cy = h / 2;
    if (t.includes('planetary')) {
      blob(g, cx, cy, 34, [80, 200, 210], 0.35);
      g.lineWidth = 8;
      const rg = g.createRadialGradient(cx, cy, 12, cx, cy, 30);
      rg.addColorStop(0, 'rgba(90,220,220,0)'); rg.addColorStop(0.6, 'rgba(120,230,210,0.8)'); rg.addColorStop(1, 'rgba(255,90,90,0.7)');
      g.fillStyle = rg; g.beginPath(); g.ellipse(cx, cy, 30, 24, 0.4, 0, Math.PI * 2); g.fill();
      glow(g, cx, cy, 5, [230, 240, 255]);
      return;
    }
    if (t.includes('dark')) {
      for (let i = 0; i < 14; i++) blob(g, R() * w, R() * h * 0.8, 30 + R() * 25, [230, 70, 100], 0.35);
      g.fillStyle = 'rgb(6,6,10)';
      g.beginPath(); g.moveTo(cx - 12, h); g.bezierCurveTo(cx - 14, cy, cx - 4, cy - 22, cx + 14, cy - 14);
      g.bezierCurveTo(cx + 24, cy - 6, cx + 6, cy + 2, cx + 10, h); g.fill();
      return;
    }
    const c = t.includes('reflection') ? [110, 150, 255] : [240, 80, 120];
    for (let i = 0; i < 26; i++) {
      const a = R() * Math.PI * 2, r = R() * 34;
      blob(g, cx + Math.cos(a) * r * 1.5, cy + Math.sin(a) * r, 14 + R() * 22, i % 4 === 0 && !t.includes('reflection') ? [255, 170, 120] : c, 0.22);
    }
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 5; i++) {   // dust lanes
      g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 8 + R() * 8; g.lineCap = 'round'; g.filter = 'blur(3px)';
      g.beginPath(); g.moveTo(R() * w, R() * h); g.quadraticCurveTo(R() * w, R() * h, R() * w, R() * h); g.stroke();
    }
    g.filter = 'none'; g.globalCompositeOperation = 'lighter';
    if (t.includes('star-forming')) for (let i = 0; i < 4; i++) glow(g, cx + (R() - 0.5) * 20, cy + (R() - 0.5) * 14, 6, TINT.B);
  }

  function drawGalaxy(g, w, h, o, R) {
    const t = o.t.toLowerCase(), cx = w / 2, cy = h / 2;
    const edge = t.includes('starburst') || o.s === 'M104' || o.s === 'M31';
    const tilt = edge ? 0.3 : 0.65;
    g.save(); g.translate(cx, cy); g.rotate(-0.35); g.scale(1, tilt);
    blob(g, 0, 0, 55, [170, 180, 230], 0.3);
    if (!t.includes('starburst')) {
      for (let arm = 0; arm < 2; arm++) for (let i = 0; i < 160; i++) {
        const s = i / 160, ang = arm * Math.PI + s * 3.6 * Math.PI / 1.4, r = 6 + s * 50;
        const j = (R() - 0.5) * 8;
        g.fillStyle = rgba(R() < 0.25 ? [255, 150, 200] : [190, 210, 255], 0.5 * (1 - s) + 0.1);
        g.fillRect(Math.cos(ang) * (r + j), Math.sin(ang) * (r + j), 1.6, 1.6);
      }
    }
    blob(g, 0, 0, 16, [255, 235, 190], 0.95);
    if (o.s === 'M104' || o.s === 'M64') { g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(10,5,5,0.8)'; g.beginPath(); if (o.s === 'M64') g.ellipse(0, -6, 9, 5, 0, 0, Math.PI * 2); else g.ellipse(0, 1, 54, 4, 0, 0, Math.PI * 2); g.fill(); }
    g.restore();
    if (t.includes('starburst')) for (let i = 0; i < 12; i++) blob(g, cx + (R() - 0.5) * 16, cy + (R() - 0.5) * 50, 6 + R() * 8, [255, 70, 70], 0.4);
  }

  function drawHole(g, w, h) {
    const cx = w / 2, cy = h / 2;
    g.save(); g.translate(cx, cy); g.scale(1, 0.35);
    const rg = g.createRadialGradient(0, 0, 14, 0, 0, 58);
    rg.addColorStop(0, 'rgba(255,240,200,1)'); rg.addColorStop(0.4, 'rgba(255,150,60,0.8)'); rg.addColorStop(1, 'rgba(150,40,10,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(0, 0, 58, 0, Math.PI * 2); g.fill();
    g.restore();
    g.strokeStyle = 'rgba(255,190,110,0.8)'; g.lineWidth = 2.5;
    g.beginPath(); g.arc(cx, cy, 17, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#000'; g.beginPath(); g.arc(cx, cy, 15, 0, Math.PI * 2); g.fill();
  }

  const cache = new Map();
  function preview(o) {
    const key = o.n;
    if (cache.has(key)) return cache.get(key);
    const w = 120, h = 120, k = 2;
    const cv = document.createElement('canvas');
    cv.width = w * k; cv.height = h * k;
    const g = cv.getContext('2d');
    g.scale(k, k);
    g.fillStyle = '#04050b'; g.fillRect(0, 0, w, h);
    const R = rng(o.n);
    bgStars(g, w, h, R, 60);
    g.globalCompositeOperation = 'lighter';
    const cat = category(o);
    if (cat === 'nebula' && o.t.toLowerCase().includes('dark')) g.globalCompositeOperation = 'source-over';
    ({ star: drawStar, cluster: drawCluster, nebula: drawNebula, galaxy: drawGalaxy, hole: drawHole })[cat](g, w, h, o, R);
    const url = cv.toDataURL('image/png');
    cache.set(key, url);
    return url;
  }

  window.SkyCategories = { CATS, category, color: (o, a) => rgba(CATS[category(o)].color, a), preview };
})();
