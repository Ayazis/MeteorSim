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
  // Spectral class of each named star (primary), for its preview colour.
  const SPEC = {
    Sirius: 'A', Canopus: 'F', Arcturus: 'K', 'Rigil Kentaurus': 'G', Vega: 'A', Capella: 'G', Rigel: 'B',
    Procyon: 'F', Betelgeuse: 'M', Achernar: 'B', Altair: 'A', Aldebaran: 'K', Antares: 'M', Spica: 'B',
    Pollux: 'K', Castor: 'A', Fomalhaut: 'A', Deneb: 'A', Regulus: 'B', Adhara: 'B', Bellatrix: 'B',
    Elnath: 'B', Alnilam: 'B', Alnitak: 'O', Mintaka: 'O', Saiph: 'B', Alioth: 'A', Dubhe: 'K', Merak: 'A',
    'Mizar & Alcor': 'A', Alkaid: 'B', Polaris: 'F', Mirfak: 'F', Algol: 'B', Alpheratz: 'B', Hamal: 'K',
    Schedar: 'K', Kochab: 'K', Eltanin: 'K', Rasalhague: 'A', Denebola: 'A', Algieba: 'K', Markab: 'B',
    Albireo: 'K', Nunki: 'B', Shaula: 'B',
  };
  const TINT = { O: [160, 185, 255], B: [175, 200, 255], A: [230, 238, 255], F: [255, 250, 230], G: [255, 236, 180], K: [255, 196, 120], M: [255, 130, 80] };
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
    const t = o.t.toLowerCase(), c = TINT[SPEC[o.n] || 'A'];
    const cx = w / 2, cy = h / 2;
    const size = t.includes('supergiant') ? 34 : t.includes('giant') ? 26 : 16;
    // the disc, with darkened limb
    const gr = g.createRadialGradient(cx - size * 0.2, cy - size * 0.2, 0, cx, cy, size);
    gr.addColorStop(0, rgba([255, 255, 255], 1)); gr.addColorStop(0.45, rgba(c, 1)); gr.addColorStop(1, rgba(c.map(v => v * 0.55), 1));
    blob(g, cx, cy, size * 2.2, c, 0.35);
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, size, 0, Math.PI * 2); g.fill();
    if (SPEC[o.n] === 'M' || t.includes('red')) {   // mottled convection cells on cool giants
      for (let i = 0; i < 10; i++) {
        const a = R() * Math.PI * 2, d = R() * size * 0.7;
        blob(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d, size * 0.35, [120, 40, 20], 0.25);
      }
    }
    if (t.includes('ring')) {
      g.strokeStyle = 'rgba(200,180,150,0.7)'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(cx, cy, size * 2.6, size * 1.1, -0.3, 0, Math.PI * 2); g.stroke();
    }
    // companions for binaries and multiples
    const n = /sextuple/.test(t) ? 3 : /quadruple/.test(t) ? 2 : /binary|double|triple|multiple/.test(t) ? 1 : 0;
    for (let i = 0; i < n + (/triple/.test(t) ? 1 : 0); i++) {
      const cc = o.n === 'Albireo' ? TINT.B : /white-dwarf|white dwarf/.test(o.i) && i === 0 ? [235, 240, 255] : TINT[['B', 'K', 'M', 'G'][Math.floor(R() * 4)]];
      const x = cx + size + 14 + i * 16, y = cy - 14 + R() * 28;
      glow(g, Math.min(w - 8, cx + size * 0.7 + 10 + i * 12), cy - size - 4 + i * 10, /dwarf/.test(o.i) && i === 0 ? 6 : 9, cc);
    }
    if (t.includes('planet')) { g.fillStyle = '#5a7088'; g.beginPath(); g.arc(cx - size - 16, cy + 10, 4, 0, Math.PI * 2); g.fill(); }
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
    const centres = t.includes('pair') ? [[cx - 26, cy], [cx + 26, cy]] : [[cx, cy]];
    const spread = t.includes('cloud') ? 60 : t.includes('pair') ? 18 : 32;
    if (o.s === 'M45') blob(g, cx, cy, 45, [110, 150, 255], 0.35);   // the Pleiades' blue haze
    for (const [x0, y0] of centres) {
      const n = t.includes('cloud') ? 320 : 26;
      if (t.includes('cloud')) blob(g, x0, y0, 70, [255, 220, 170], 0.25);
      for (let i = 0; i < n; i++) {
        const a = R() * Math.PI * 2, r = Math.sqrt(R()) * spread;
        const bright = t.includes('cloud') ? 2.2 + R() * 1.5 : 2 + R() * 5;
        glow(g, x0 + Math.cos(a) * r * 1.3, y0 + Math.sin(a) * r * 0.9, bright, R() < 0.8 ? TINT.B : TINT.K, 0.9);
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
    for (let i = 0; i < 5; i++) {   // dust lanes
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3 + R() * 5;
      g.beginPath(); g.moveTo(R() * w, R() * h); g.quadraticCurveTo(R() * w, R() * h, R() * w, R() * h); g.stroke();
    }
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
    if (o.s === 'M104' || o.s === 'M64') { g.fillStyle = 'rgba(10,5,5,0.75)'; g.fillRect(-50, o.s === 'M64' ? -8 : -2, 100, 5); }
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
