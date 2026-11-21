// Famous impacts: cinematic replays of notable bolides and crater-forming impacts,
// drawn on their own overlay canvas (#impacts) above the sky view, with their own render loop.
// Reads window.meteorSim.cam (if present) only to find the horizon line.
(() => {
  'use strict';
  const DEG = Math.PI / 180;
  const C_SOUND = 0.32; // km/s, rough mean over the path from burst to ground

  // obsKm: where the replay puts you (horizontal distance to burst/impact point).
  // altKm: airburst / peak-brightness altitude (0 = ground impact). peakSun: peak brightness relative to the Sun.
  // dir: +1 enters from the left, -1 from the right. kind: 'air' | 'graze' | 'crater' | 'global'.
  const EVENTS = [
    {
      id: 'chelyabinsk', name: 'Chelyabinsk', when: '15 Feb 2013, 09:20 local', where: 'Chelyabinsk Oblast, Russia',
      kind: 'air', diam: '~19 m', mass: '~12,000 t', speed: '19.2 km/s', angle: 18, energy: '~500 kt TNT',
      outcome: 'Airburst at ~30 km altitude', effects: 'Shock wave shattered windows in ~7,200 buildings across six cities',
      toll: '~1,500 injured, mostly by flying glass; no deaths',
      note: 'The largest object known to have hit Earth since Tunguska, unseen until it arrived out of the dawn sky. For a moment it was about 30 times brighter than the Sun, and people walked to their windows to look, so the shock wave that came minutes later caught them there.',
      obsKm: 40, altKm: 30, peakSun: 30, dir: -1, dur: 6, frags: 9, shockS: 142, shake: 0.8,
    },
    {
      id: 'tunguska', name: 'Tunguska', when: '30 Jun 1908, ~07:17 local', where: 'Podkamennaya Tunguska, Siberia',
      kind: 'air', diam: '~50–60 m', mass: '~100,000 t', speed: '~15–30 km/s', angle: 35, energy: '~3–15 Mt TNT',
      outcome: 'Airburst at ~5–10 km altitude; no crater', effects: '~80 million trees flattened over 2,150 km²; seen and heard across Siberia',
      toll: 'Possibly 1–3 people; the area was almost uninhabited',
      note: 'The largest impact event in recorded history. At the trading post of Vanavara, 65 km away, a man was thrown from his porch and felt his shirt burning. Night skies over Europe glowed bright for days afterwards.',
      obsKm: 65, altKm: 8, peakSun: 300, dir: 1, dur: 5, frags: 4, shockS: 200, shake: 1,
    },
    {
      id: 'sikhote', name: 'Sikhote-Alin', when: '12 Feb 1947, 10:38 local', where: 'Primorsky Krai, Soviet Far East',
      kind: 'crater', diam: '~2–3 m (iron)', mass: '~70–100 t before entry; 23 t recovered', speed: '~14 km/s', angle: 41, energy: '~10 kt TNT (est.)',
      outcome: 'Broke up at ~5.6 km; a shower of iron', effects: 'Over 100 craters, the largest 26 m across, in a strewn field of 1.3 km²',
      toll: 'None',
      note: 'An iron meteorite that shattered in the air and rained down as thousands of pieces. A fireball brighter than the Sun was seen for 300 km and left a smoke trail that hung in the sky for hours. Many fragments still show the thumbprint-like scallops of ablation.',
      obsKm: 30, altKm: 5.6, peakSun: 3, dir: -1, dur: 5, frags: 14, shockS: 95, shake: 0.4,
    },
    {
      id: 'peekskill', name: 'Peekskill fireball', when: '9 Oct 1992, 19:48 local', where: 'Kentucky to New York, USA',
      kind: 'air', diam: '~1–2 m', mass: '~5–10 t before entry; 12.4 kg landed', speed: '14.7 km/s', angle: 3.4, energy: '~0.1–0.2 kt TNT (est.)',
      outcome: 'A 40 s, 700 km long fireball that broke into ~70 pieces', effects: 'One 12.4 kg stone hit a parked Chevrolet Malibu',
      toll: 'None — one dented car',
      note: 'Crossing several states on a Friday evening at a very shallow angle, it was filmed by at least 16 people at high-school football games: the first fireball recorded on video from so many sides. Its orbit was worked out from the footage.',
      obsKm: 120, altKm: 40, peakSun: 0.02, dir: 1, dur: 12, frags: 16, shockS: 0, shake: 0,
    },
    {
      id: 'carancas', name: 'Carancas', when: '15 Sep 2007, ~11:40 local', where: 'Near Lake Titicaca, Peru (3,800 m)',
      kind: 'crater', diam: '~1–2 m (stony)', mass: '~10 t before entry; ~3 t at impact', speed: '~12 km/s entry; ~3–6 km/s at impact', angle: 45, energy: '~1–3 t TNT at impact',
      outcome: 'Hit the ground intact: a 13.5 m crater', effects: 'Boiling groundwater filled the crater; locals reported nausea, likely from arsenic in the water vapour',
      toll: 'None',
      note: 'Stony meteorites this small normally break up and slow to free fall. Carancas survived nearly whole, perhaps helped by the thin air of the Altiplano, and blasted a crater that surprised meteoriticists.',
      obsKm: 1.5, altKm: 0, peakSun: 0.5, dir: 1, dur: 4, frags: 2, shockS: 5, shake: 0.35,
    },
    {
      id: 'graze', name: 'Great Daylight Fireball', when: '10 Aug 1972, 14:30 local', where: 'Utah, USA, to Alberta, Canada',
      kind: 'graze', diam: '~3–14 m', mass: '~1,000 t?', speed: '15 km/s', angle: 0, energy: 'Little deposited; it left again',
      outcome: 'Skimmed the atmosphere 57 km up, then went back to space', effects: 'Seen in daylight for ~100 s along 1,500 km; a sonic boom was heard',
      toll: 'None',
      note: 'An Earth-grazer: it dipped into the upper atmosphere over the Rockies and climbed back out, losing about a third of its mass. Had it come in a little steeper, it might have produced a Hiroshima-sized airburst.',
      obsKm: 200, altKm: 57, peakSun: 0.002, dir: 1, dur: 14, frags: 0, shockS: 0, shake: 0,
    },
    {
      id: 'barringer', name: 'Meteor Crater (Barringer)', when: '~50,000 years ago', where: 'Arizona, USA',
      kind: 'crater', diam: '~50 m (iron)', mass: '~300,000 t', speed: '~12–20 km/s', angle: 45, energy: '~10 Mt TNT',
      outcome: 'A crater 1.2 km wide and 170 m deep', effects: 'Winds of hundreds of km/h and fire within several km; ejecta blanket still visible',
      toll: 'Before people lived there; mammoths and ground sloths roamed the plain',
      note: 'The first crater proven to be from an impact, by Eugene Shoemaker in 1960, who found shocked minerals formed only at extreme pressures. Most of the iron vaporised or melted; fragments of the Canyon Diablo meteorite litter the surrounding desert.',
      obsKm: 25, altKm: 0, peakSun: 1000, dir: -1, dur: 3, frags: 3, shockS: 78, shake: 1, cloud: 1,
    },
    {
      id: 'popigai', name: 'Popigai', when: '~35.7 million years ago', where: 'Northern Siberia, Russia',
      kind: 'crater', diam: '~5–8 km', mass: '~10¹⁴ kg', speed: '~20 km/s', angle: 45, energy: '~10⁷ Mt TNT (est.)',
      outcome: 'A crater ~100 km wide', effects: 'Shock turned graphite in the target rocks into impact diamonds, now one of the largest diamond deposits known',
      toll: 'Regional devastation; no mass extinction',
      note: 'One of the largest craters on Earth, from the late Eocene. Its shock pressures were so high that graphite became diamond instantly across the impact zone. It happened around the same time as the Chesapeake Bay impact.',
      obsKm: 400, altKm: 0, peakSun: 1e5, dir: 1, dur: 2.5, frags: 0, shockS: 1250, shake: 1, cloud: 2, ejecta: 0.5,
    },
    {
      id: 'chicxulub', name: 'Chicxulub', when: '66.0 million years ago', where: 'Yucatán Peninsula, Mexico',
      kind: 'global', diam: '~10–15 km', mass: '~10¹⁵ kg', speed: '~20 km/s', angle: 60, energy: '~10⁸ Mt TNT (~4×10²³ J)',
      outcome: 'A crater ~180 km wide, now buried', effects: 'Global firestorms from re-entering ejecta, megatsunamis, years of darkness and cold',
      toll: '~75% of species, including all non-avian dinosaurs',
      note: 'An asteroid came in steeply from the northeast and hit shallow sea over sulphate-rich rock. Ejecta thrown above the atmosphere rained back worldwide within hours, heating the sky like an oven, and soot and sulphate aerosols then blocked sunlight for years.',
      obsKm: 1000, altKm: 0, peakSun: 1e6, dir: -1, dur: 2, frags: 0, shockS: 3100, shake: 1, cloud: 3, ejecta: 1,
    },
  ];

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const $ = id => document.getElementById(id);

  // ---------------------------------------------------------------- canvas
  const cv = document.createElement('canvas');
  cv.id = 'impacts'; cv.setAttribute('aria-hidden', 'true');
  const sky = $('sky');
  (sky && sky.parentNode ? sky.parentNode.insertBefore(cv, sky.nextSibling) : document.body.appendChild(cv));
  let pass = null, ctx = null;
  function initRenderer() {
    if (pass || ctx) return;
    if (window.THREE) {
      try { pass = createImpactPass(cv); }
      catch (error) { console.warn('Impact WebGL renderer unavailable.', error); }
    }
    if (!pass) ctx = cv.getContext('2d');
    resize();
  }
  function clear() {
    if (pass) pass.clear();
    else ctx?.clearRect(0, 0, cv.width, cv.height);
  }
  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    if (pass) { pass.resize(W,H,DPR); return; }
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx?.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize); resize();

  // A replay is authored on the tangent plane of its opening view. Map pixels
  // between that fixed plane and the live camera by rotating their sightlines.
  function viewBasis(view) {
    const { yaw, pitch } = view;
    const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
    return [[cy,-sy,0], [sy*sp,cy*sp,-cp], [sy*cp,cy*cp,sp]];
  }
  function pixelProjection(from, to) {
    const source = viewBasis(from), target = viewBasis(to);
    const dot = (a,b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
    const columns = source.map(axis => {
      const z = dot(axis,target[2]);
      return [dot(axis,target[0])*to.focal + z*to.width/2,
              dot(axis,target[1])*to.focal + z*to.height/2, z];
    });
    for (let i=0; i<3; i++) {
      columns[0][i] /= from.focal;
      columns[1][i] /= from.focal;
      columns[2][i] -= columns[0][i]*from.width/2 + columns[1][i]*from.height/2;
    }
    return columns.flat();
  }

  function horizonY() {
    const s = window.meteorSim, cam = s && s.cam;
    if (!cam) return H * 0.78;
    const focal = (Math.max(W, H) / 2) / Math.tan(cam.fov / 2);
    return H / 2 + Math.tan(cam.pitch) * focal;
  }
  function focalPx() {
    const cam = window.meteorSim && window.meteorSim.cam;
    return (Math.max(W, H) / 2) / Math.tan((cam ? cam.fov : 100 * DEG) / 2);
  }

  // ---------------------------------------------------------------- card
  const card = document.createElement('div');
  card.id = 'impactCard'; card.hidden = true; card.setAttribute('role', 'dialog'); card.setAttribute('aria-live', 'polite');
  document.body.appendChild(card);
  const caption = document.createElement('div');
  caption.id = 'impactCaption'; caption.setAttribute('aria-live', 'polite');
  document.body.appendChild(caption);

  function renderCard(e) {
    const rows = [
      ['Date', e.when], ['Location', e.where], ['Diameter', e.diam], ['Mass', e.mass], ['Speed', e.speed],
      ['Entry angle', e.kind === 'graze' ? 'Grazing, ~0°' : `~${e.angle}° from horizontal`], ['Energy', e.energy],
      [e.altKm > 0 && e.kind !== 'crater' ? 'Airburst' : 'Result', e.outcome], ['Effects', e.effects], ['Casualties', e.toll],
    ];
    card.innerHTML = `<div class="ic-head"><div><div class="ic-kicker">Famous impacts</div><h2>${e.name}</h2></div>
      <button type="button" class="icon-btn" data-a="close" aria-label="Close">&times;</button></div>
      <dl class="stats">${rows.map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('')}</dl>
      <p class="note">${e.note}</p>
      <p class="ic-view">Seen from ${e.obsKm < 10 ? e.obsKm + ' km' : '~' + e.obsKm + ' km'} away${e.peakSun >= 1 ? `, peaking ~${fmtSun(e.peakSun)} brighter than the Sun` : ''}.</p>
      <div class="ic-actions"><button type="button" class="chip" data-a="replay">Replay</button>
      <button type="button" class="chip" data-a="close">Close</button></div>`;
    card.hidden = false;
  }
  function fmtSun(x) { return x >= 1000 ? `10${sup(Math.round(Math.log10(x)))}×` : `${Math.round(x)}×`; }
  function sup(n) { return String(n).split('').map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]).join(''); }
  card.addEventListener('click', ev => {
    const a = ev.target.closest('[data-a]'); if (!a) return;
    if (a.dataset.a === 'replay' && cur) play(cur.e); else stop();
  });
  window.addEventListener('keydown', ev => { if (ev.key === 'Escape' && cur) stop(); });

  // ---------------------------------------------------------------- panel list
  function buildList() {
    const box = $('impactList'); if (!box) return;
    box.innerHTML = '';
    for (const e of EVENTS) {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.id = e.id;
      b.innerHTML = `<span>${e.name}</span><small>${e.when.replace(/,.*$/, '')}</small>`;
      b.addEventListener('click', () => play(e));
      box.appendChild(b);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildList); else buildList();

  // ---------------------------------------------------------------- simulation
  let cur = null, raf = 0;
  const rnd = (a, b) => a + Math.random() * (b - a);

  function play(e) {
    initRenderer();
    stop(true);
    const hy = horizonY(), f = focalPx();
    // where the burst / impact appears: elevation from altitude and distance
    const elev = Math.atan2(e.altKm, e.obsKm);
    let bx = W * (0.5 + 0.12 * e.dir), by = Math.min(hy - Math.tan(elev) * f, H * 0.92);
    if (e.altKm === 0) by = hy - 2;
    by = Math.max(by, H * 0.12);
    // incoming direction on screen: comes down at the entry angle, compressed a little by perspective
    const a = Math.max(e.angle, 2) * DEG, L = Math.max(W, H) * (e.kind === 'graze' ? 1.4 : 0.9);
    const ux = e.dir * Math.cos(a), uy = Math.sin(a);
    let sx = bx - ux * L, sy = by - uy * L;
    if (e.kind === 'graze') { sx = e.dir > 0 ? -80 : W + 80; sy = by + H * 0.05; bx = W - sx; }
    // real shock delay is often minutes: replay time is compressed so the cinematic stays watchable
    const realShock = e.shockS;
    const shockAt = realShock ? e.dur + Math.min(realShock, 9) : 0;
    cur = {
      anchor: window.MeteorSim.getView(), e, t: 0, last: performance.now(), sx, sy, bx, by, hy, shockAt, realShock, smoke: [], sparks: [], frags: [],
      end: Math.max(e.dur + 14, shockAt + 6) + (e.ejecta ? 10 : 0), shaken: false,
    };
    document.body.classList.add('impact-on');
    renderCard(e);
    caption.textContent = ''; caption.classList.remove('show');
    document.querySelectorAll('#impactList button').forEach(b => b.setAttribute('aria-pressed', b.dataset.id === e.id));
    raf = requestAnimationFrame(frame);
  }

  function stop(keep) {
    cancelAnimationFrame(raf); raf = 0;
    clear();
    document.documentElement.style.removeProperty('--impact-shake');
    cv.style.transform = ''; if (sky) sky.style.transform = '';
    caption.classList.remove('show');
    if (!keep) {
      cur = null; card.hidden = true; document.body.classList.remove('impact-on');
      document.querySelectorAll('#impactList button').forEach(b => b.setAttribute('aria-pressed', 'false'));
    }
  }

  function say(text) { caption.textContent = text; caption.classList.add('show'); }

  function frame(now) {
    const c = cur; if (!c) return;
    const dt = Math.min(0.05, (now - c.last) / 1000); c.last = now; c.t += dt;
    const e = c.e, t = c.t, D = e.dur;
    const flash = flashCurve(e,t);
    const view = window.MeteorSim.getView();
    let transform = '';
    if (pass) {
      pass.draw(c,W,H,reduced.matches ? Math.min(.14,flash) : flash, pixelProjection(view,c.anchor));
    } else {
      const [a,b,g,d,f,h,x,y,z] = pixelProjection(c.anchor,view);
      cv.style.transformOrigin = '0 0';
      cv.style.width = c.anchor.width + 'px';
      cv.style.height = c.anchor.height + 'px';
      cv.width !== Math.round(c.anchor.width*DPR) && (cv.width = Math.round(c.anchor.width*DPR));
      cv.height !== Math.round(c.anchor.height*DPR) && (cv.height = Math.round(c.anchor.height*DPR));
      ctx.setTransform(DPR,0,0,DPR,0,0);
      transform = 'matrix3d('+[a,b,0,g,d,f,0,h,0,0,1,0,x,y,0,z].join(',')+')';
      drawCanvas(c,dt,e,t,D,c.anchor.width,c.anchor.height);
    }

    // captions and the shock wave
    if (t >= D && !c.said) {
      c.said = true;
      if (e.kind === 'graze') say('It climbs back out of the atmosphere and returns to space.');
      else if (c.realShock) say(`Silence. The shock wave arrives after ${fmtDelay(c.realShock)}${c.realShock > 9 ? ' (shortened here)' : ''}.`);
      else say('Too far and too high: no shock wave reaches you, only a distant rumble at most.');
    }
    if (c.shockAt && t >= c.shockAt && !c.shaken) {
      c.shaken = true;
      say(`Shock wave: ${fmtDelay(c.realShock)} after the flash.` + (e.kind === 'global' ? ' Then ejecta begins raining back across the sky.' : ''));
    }
    const sk = c.shockAt && t >= c.shockAt ? Math.max(0, 1 - (t - c.shockAt) / 2.2) * e.shake : 0;
    if (!reduced.matches && sk > 0) {
      const a = 14 * sk;
      const tr = `translate(${rnd(-a, a).toFixed(1)}px, ${rnd(-a, a).toFixed(1)}px)`;
      transform = tr + ' ' + transform; if (sky) sky.style.transform = tr;
    } else if (sky) sky.style.transform = '';
    cv.style.transform = transform;
    if (!pass && reduced.matches && sk > 0.3) { ctx.fillStyle = `rgba(255,255,255,${0.06 * sk})`; ctx.fillRect(0, 0, W, H); }

    if (t > c.end) { caption.classList.remove('show'); clear(); cv.style.transform = ''; if (sky) sky.style.transform = ''; raf = 0; return; }
    raf = requestAnimationFrame(frame);
  }

  function drawCanvas(c,dt,e,t,D,W,H) {
    ctx.clearRect(0, 0, W, H);

    // progress along the path: accelerating brightness, ending at burst/impact
    const p = Math.min(1, t / D);
    const ease = e.kind === 'graze' ? p : 1 - Math.pow(1 - p, 1.6);
    const hx = c.sx + (c.bx - c.sx) * ease;
    let hyy = c.sy + (c.by - c.sy) * ease;
    if (e.kind === 'graze') hyy = c.sy - Math.sin(p * Math.PI) * H * 0.12; // dips in and climbs out
    const alive = t < D;
    // brightness: magnitude grows exponentially toward the end (ablation rises as the air thickens)
    const peakLog = Math.log10(e.peakSun + 1e-4); // -4 .. 6
    const b = alive ? (e.kind === 'graze' ? Math.sin(p * Math.PI) : Math.pow(p, 3)) : 0;
    const headR = 3 + 10 * b * Math.max(0.3, (peakLog + 4) / 10);

    // smoke trail: deposited along the path, lingers, spreads and drifts with the wind
    if (alive) {
      for (let i = 0; i < 3; i++) c.smoke.push({ x: hx + rnd(-2, 2), y: hyy + rnd(-2, 2), r: 2 + b * 6, age: 0, hot: 1 });
      if (e.frags && p > 0.55 && Math.random() < e.frags * dt * 1.5) {
        c.frags.push({ x: hx, y: hyy, vx: (c.bx - c.sx) / D * rnd(0.6, 1.0) + rnd(-40, 40), vy: (c.by - c.sy) / D * rnd(0.6, 1.0) + rnd(-30, 30), life: rnd(0.4, 1.2), age: 0 });
      }
    }
    for (const s of c.smoke) { s.age += dt; s.r += dt * (4 + s.age * 0.6); s.x += dt * 6; s.y += dt * 1.5; s.hot = Math.max(0, 1 - s.age / 2.5); }
    while (c.smoke.length > 1400) c.smoke.shift();

    // the sky lightens with the fireball; the whole landscape lights up for the brightest
    const flashI = flashCurve(e, t);
    if (flashI > 0.001) {
      ctx.fillStyle = `rgba(255, 246, 225, ${Math.min(0.92, flashI)})`;
      ctx.fillRect(0, 0, W, H);
    }

    // darkening and ejecta glow (Popigai, Chicxulub)
    if (e.ejecta && t > D) {
      const k = Math.min(1, (t - D - 2) / 8) * e.ejecta;
      if (k > 0) {
        const g = ctx.createLinearGradient(0, 0, 0, c.hy);
        g.addColorStop(0, `rgba(120, 25, 10, ${0.55 * k})`); g.addColorStop(1, `rgba(255, 90, 30, ${0.45 * k})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, c.hy + 4);
        // re-entering ejecta: countless short glowing streaks across the whole sky
        const n = Math.round(160 * k * dt * 60 / 4);
        for (let i = 0; i < n; i++) c.sparks.push({ x: rnd(-50, W + 50), y: rnd(-40, c.hy * 0.7), vx: rnd(-120, 120), vy: rnd(140, 320), age: 0, life: rnd(0.4, 1.1) });
      }
    }

    // smoke (drawn dark-lit by the fireball while young)
    for (const s of c.smoke) {
      const fade = Math.max(0, 1 - s.age / 26);
      if (fade <= 0) continue;
      ctx.fillStyle = s.hot > 0.05
        ? `rgba(255, ${170 + 60 * s.hot | 0}, ${120 * s.hot | 0}, ${0.25 * s.hot * fade})`
        : `rgba(205, 200, 195, ${0.05 * fade * (flashI > 0.1 ? 2 : 1)})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }

    // fragments
    ctx.globalCompositeOperation = 'lighter';
    for (const fr of c.frags) {
      fr.age += dt; if (fr.age > fr.life) continue;
      fr.x += fr.vx * dt; fr.y += fr.vy * dt;
      const k = 1 - fr.age / fr.life;
      glow(fr.x, fr.y, 2 + 6 * k, `rgba(255, 220, 160, ${0.8 * k})`);
      c.smoke.push({ x: fr.x, y: fr.y, r: 1.5, age: 0, hot: 0.6 });
    }
    // the bolide itself: a hot head with a short blazing tail
    if (alive) {
      const tl = 40 + 160 * b;
      const dx = c.bx - c.sx, dy = c.by - c.sy, dl = Math.hypot(dx, dy) || 1;
      const g = ctx.createLinearGradient(hx, hyy, hx - dx / dl * tl, hyy - dy / dl * tl);
      g.addColorStop(0, `rgba(255, 250, 235, ${0.4 + 0.6 * b})`); g.addColorStop(1, 'rgba(255, 140, 60, 0)');
      ctx.strokeStyle = g; ctx.lineWidth = headR * 0.9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hx, hyy); ctx.lineTo(hx - dx / dl * tl, hyy - dy / dl * tl); ctx.stroke();
      glow(hx, hyy, headR * (3 + 4 * b), `rgba(255, 235, 200, ${0.25 + 0.6 * b})`);
      glow(hx, hyy, headR, 'rgba(255,255,255,1)');
    }
    // terminal burst
    if (t >= D && t < D + 3 && e.kind !== 'graze') {
      const k = 1 - (t - D) / 3;
      glow(c.bx, c.by, 30 + 260 * Math.max(0.2, (peakLog + 2) / 8) * (1 - k * 0.5), `rgba(255, 240, 210, ${0.9 * k})`);
    }
    // sparks
    for (const s of c.sparks) {
      s.age += dt; if (s.age > s.life) continue;
      s.x += s.vx * dt; s.y += s.vy * dt; const k = 1 - s.age / s.life;
      ctx.strokeStyle = `rgba(255, ${150 + 80 * k | 0}, 90, ${0.7 * k})`; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.05, s.y - s.vy * 0.05); ctx.stroke();
    }
    c.sparks = c.sparks.filter(s => s.age < s.life);
    ctx.globalCompositeOperation = 'source-over';

    // impact on the horizon: a fireball dome, then a rising mushroom / dust cloud
    if (e.cloud && t > D) {
      const u = t - D, sc = [0, 1, 2.4, 4][e.cloud];
      const hy = c.hy;
      const dome = Math.min(1, u / 1.5);
      const r = (20 + 40 * sc) * Math.sqrt(dome) * (1 + u * 0.08);
      const heat = Math.max(0, 1 - u / (6 + 4 * sc));
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, hy); ctx.clip();
      // stem and cap rise and cool
      const capY = hy - r * 0.6 - u * (6 + 8 * sc);
      const cg = ctx.createRadialGradient(c.bx, capY, 0, c.bx, capY, r * 1.4);
      cg.addColorStop(0, `rgba(255, ${190 * heat + 60 | 0}, ${100 * heat + 40 | 0}, ${0.55 + 0.3 * heat})`);
      cg.addColorStop(1, 'rgba(80, 60, 50, 0)');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(c.bx, capY, r * 1.4, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(${120 + 120 * heat | 0}, ${80 + 60 * heat | 0}, 60, ${0.35})`;
      ctx.fillRect(c.bx - r * 0.25, capY, r * 0.5, hy - capY);
      const dg = ctx.createRadialGradient(c.bx, hy, 0, c.bx, hy, r * 1.6);
      dg.addColorStop(0, `rgba(255, 250, 230, ${heat})`); dg.addColorStop(0.4, `rgba(255, 150, 60, ${0.6 * heat})`); dg.addColorStop(1, 'rgba(255, 80, 30, 0)');
      ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(c.bx, hy, r * 1.6, Math.PI, 0); ctx.fill();
      ctx.restore();
    }

  }

  // whole-screen flash strength: log-scaled so a 30x-Sun Chelyabinsk nearly whites out the view,
  // a dim fireball barely tints it, and a Chicxulub-scale impact saturates for longer
  function flashCurve(e, t) {
    const D = e.dur, L = Math.log10(e.peakSun + 1e-4);
    const peak = Math.max(0, Math.min(1, (L + 2.5) / 4.2));
    if (e.kind === 'graze') { const p = t / D; return p < 1 ? 0.06 * peak * Math.sin(p * Math.PI) : 0; }
    if (t < D) return peak * Math.pow(t / D, 6) * 0.9;
    const hold = e.kind === 'global' ? 2.5 : e.cloud ? 1 : 0.25;
    const u = t - D;
    if (u < hold) return peak;
    return peak * Math.exp(-(u - hold) / (0.5 + (e.cloud || 0) * 0.8));
  }

  function fmtDelay(s) {
    if (s < 90) return `${Math.round(s)} s`;
    const m = Math.floor(s / 60), r = Math.round(s % 60);
    return r ? `${m} min ${r} s` : `${m} min`;
  }

  function glow(x, y, r, col) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(255, 200, 150, 0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  window.famousImpacts = { EVENTS, play: id => { const e = EVENTS.find(x => x.id === id); if (e) play(e); }, stop: () => stop() };
})();
