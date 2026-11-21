// Rovi Here · Bridge of the Blue Mold — scene, stations, panels. No dependencies, no build.
import { renderStation, STATIONS } from './panels.js';
import { Sound } from './audio.js';

const NS = 'http://www.w3.org/2000/svg';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const app = $('#app');
const svg = $('#scene');
const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');

const state = {
  motion: !(root.classList.contains('rm')) && !mqReduce.matches,
  layout: null,
  win: null,      // window polygon bbox in viewBox units
  lastTrigger: null,
};

function svgEl(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
const r1 = (v) => Math.round(v * 10) / 10;
const rand = (a, b) => a + Math.random() * (b - a);

// ------------------------------------------------------------------ layout
function computeLayout() {
  const w = app.clientWidth, h = app.clientHeight, a = w / h;
  let VW, VH, mode;
  if (a >= 1) { mode = 'wide'; VW = Math.max(1500, 900 * a); VH = VW / a; }
  else { mode = 'tall'; VW = 900; VH = 900 / a; if (VH < 1500) { VH = 1500; VW = 1500 * a; } }
  const L = { mode, VW, VH, st: [] };

  if (mode === 'wide') {
    const cx0 = (VW - 1500) / 2, lift = 26;
    for (let i = 0; i < 6; i++) L.st.push({ x: cx0 + i * 252, y: VH - 300 - lift, s: 1 });
    L.floor = VH - lift;
    const T = 96, B = VH - 262 - lift, Lx = Math.max(28, cx0 - 40), R = VW - Lx, c = 120;
    L.win = { L: Lx, R, T, B, c };
    L.struts = [Lx + (R - Lx) * 0.555];
    const s = 0.62 * Math.min(1.15, VH / 900);
    const hx = cx0 + 1500 * 0.79, hatTop = T + 66;
    L.rovi = { s, tx: hx - 510 * s, ty: hatTop - 160 * s };
    L.earth = { x: R + 60, y: B + 330, r: 800 };
    L.glow = { x: hx + 40, y: hatTop + 300 * s, r: 460 };
    L.labels = true;
    L.moon = { x: Lx + (R - Lx) * 0.13, y: T + (B - T) * 0.36, s: 1 };
    L.mold = { BL: [Lx + 4, B - 6], BR: [R - 4, B - 6], sc: 1 };
  } else {
    const cx0 = (VW - 900) / 2, sc = 1.14, sw = 240 * sc, sh = 300 * sc, gap = (900 - 3 * sw) / 4, lift = 70;
    const row2 = VH - sh - lift, row1 = row2 - sh - 6;
    for (let i = 0; i < 6; i++) L.st.push({ x: cx0 + gap + (i % 3) * (sw + gap), y: i < 3 ? row1 : row2, s: sc });
    L.floor = VH - lift;
    const T = 150, B = row1 + 90, Lx = 22, R = VW - 22, c = 70;
    L.win = { L: Lx, R, T, B, c };
    L.struts = [];
    const s = Math.min(0.92, Math.max(0.6, (row1 + 40 - (T + 120)) / 680));
    const ty = row1 + 40 - 840 * s, hatTop = ty + 160 * s;
    const hx = cx0 + 900 * 0.6;
    L.rovi = { s, tx: hx - 510 * s, ty };
    L.earth = { x: R + 80, y: hatTop + 330 * s, r: 620 };
    L.glow = { x: hx + 40, y: hatTop + 280 * s, r: 420 };
    L.labels = false;
    L.moon = { x: 130, y: T + 150, s: 0.85 };
    const my = T + (row1 - T) * 0.5;
    L.mold = { BL: [Lx + 4, my], BR: [R - 4, my + 140], sc: 0.8 };
  }
  return L;
}

function winPath(w) {
  const { L, R, T, B, c } = w;
  return `M ${r1(L)} ${r1(T + c)} L ${r1(L + c * 1.3)} ${r1(T)} L ${r1(R - c * 1.3)} ${r1(T)} L ${r1(R)} ${r1(T + c)} L ${r1(R)} ${r1(B)} L ${r1(L)} ${r1(B)} Z`;
}

function dayOfYear(d = new Date()) {
  const start = Date.UTC(d.getFullYear(), 0, 0);
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - start) / 864e5);
}

function drawHull(L) {
  const g = $('#L-hull'); g.textContent = '';
  const { VW, VH, win } = L;
  const wp = winPath(win);
  svgEl('path', { d: `M 0 0 H ${r1(VW)} V ${r1(VH)} H 0 Z ${wp}`, fill: 'url(#gHull)', 'fill-rule': 'evenodd' }, g);
  // wall below window
  svgEl('rect', { x: 0, y: r1(win.B), width: r1(VW), height: r1(VH - win.B), fill: 'url(#gWall)' }, g);
  // panel seams
  const seams = [];
  for (let x = 160; x < VW; x += 260) seams.push(`M ${x} ${r1(win.B + 18)} V ${r1(VH)}`);
  seams.push(`M 0 ${r1(win.B + 60)} H ${r1(VW)}`);
  seams.push(`M 0 ${r1(win.T - 30)} H ${r1(VW)}`);
  seams.push(`M ${r1(win.L - 14)} 0 V ${r1(VH)} M ${r1(win.R + 14)} 0 V ${r1(VH)}`);
  svgEl('path', { d: seams.join(' '), stroke: '#152434', 'stroke-width': 3, fill: 'none' }, g);
  // struts
  for (const sx of L.struts) {
    svgEl('rect', { x: r1(sx - 9), y: r1(win.T), width: 18, height: r1(win.B - win.T), fill: '#0A121C' }, g);
    svgEl('path', { d: `M ${r1(sx + 9)} ${r1(win.T)} V ${r1(win.B)}`, stroke: '#2A3D52', 'stroke-width': 2 }, g);
    svgEl('path', { d: `M ${r1(sx - 9)} ${r1(win.T)} V ${r1(win.B)}`, stroke: '#05080D', 'stroke-width': 2 }, g);
  }
  // frame
  svgEl('path', { d: wp, fill: 'none', stroke: '#2C4057', 'stroke-width': 10, 'stroke-linejoin': 'round' }, g);
  svgEl('path', { d: wp, fill: 'none', stroke: '#05080D', 'stroke-width': 3, 'stroke-linejoin': 'round' }, g);
  svgEl('path', { d: `M ${r1(win.L + 8)} ${r1(win.B - 3)} H ${r1(win.R - 8)}`, stroke: '#2BB3C4', 'stroke-width': 2, opacity: .45 }, g);
  // bolts along ceiling band
  const bolts = svgEl('g', { fill: '#1B2838', stroke: '#2C3F55', 'stroke-width': 2 }, g);
  for (let x = win.L + 140; x < win.R - 100; x += 180) svgEl('circle', { cx: r1(x), cy: r1(win.T - 14), r: 4.5 }, bolts);
  for (let x = win.L + 60; x < win.R; x += 200) svgEl('circle', { cx: r1(x), cy: r1(win.B + 38), r: 4.5 }, bolts);
  // floor strip under the consoles
  svgEl('rect', { x: 0, y: r1(L.floor - 4), width: r1(VW), height: r1(VH - L.floor + 4), fill: '#03050A' }, g);
  svgEl('path', { d: `M 0 ${r1(L.floor - 4)} H ${r1(VW)}`, stroke: '#1E3044', 'stroke-width': 2 }, g);
  if (L.labels) {
    const t = svgEl('g', { class: 'svgmono', 'font-size': 14, 'letter-spacing': 5, fill: '#4E667B', 'text-anchor': 'middle' }, g);
    const d = new Date();
    svgEl('text', { x: r1(VW / 2), y: r1(win.T - 44) }, t).textContent = `SECTOR ANDROMEDA · ORBIT SOL III · SD ${d.getFullYear()}.${String(dayOfYear(d)).padStart(3, '0')}`;
  }
  // backlight behind Rovi
  const gl = $('#L-glow'); gl.textContent = '';
  svgEl('circle', { class: 'backlight', cx: r1(L.glow.x), cy: r1(L.glow.y), r: L.glow.r, fill: 'url(#gGlowSoft)' }, gl);
}

function drawSpores(L) {
  const g = $('#L-spores'); g.textContent = '';
  const { win } = L;
  const n = L.mode === 'wide' ? 26 : 20;
  for (let i = 0; i < n; i++) {
    const big = Math.random() < 0.3;
    const x = rand(win.L + 30, win.R - 30), y = rand(win.T + 80, win.B + 160);
    const c = svgEl('circle', {
      class: 'spore', cx: r1(x), cy: r1(y), r: big ? r1(rand(6, 11)) : r1(rand(1.4, 3.2)),
      fill: big ? 'url(#gGlow)' : '#7FF0F8',
    }, g);
    c.style.cssText = `--t:${rand(14, 30).toFixed(1)}s;--d:-${rand(0, 30).toFixed(1)}s;--dx:${rand(-60, 60).toFixed(0)}px;--dy:${rand(-260, -120).toFixed(0)}px;--o:${rand(.25, .8).toFixed(2)}`;
  }
}

function place(id, x, y, s = 1) { const e = document.getElementById(id); if (e) e.setAttribute('transform', `translate(${r1(x)} ${r1(y)}) scale(${s})`); }

function applyLayout() {
  const L = computeLayout();
  state.layout = L;
  svg.setAttribute('viewBox', `0 0 ${r1(L.VW)} ${r1(L.VH)}`);
  root.dataset.layout = L.mode;
  place('earth', L.earth.x, L.earth.y, L.earth.r / 1000);
  place('moon', L.moon.x, L.moon.y, L.moon.s);
  drawHull(L);
  const w = L.win;
  place('moldTL', w.L + w.c * 0.62, w.T + w.c * 0.5, L.mode === 'wide' ? 1 : 0.8);
  place('moldBL', L.mold.BL[0], L.mold.BL[1], L.mold.sc);
  place('moldTR', w.R - w.c * 0.62, w.T + w.c * 0.5, L.mode === 'wide' ? 1 : 0.8);
  place('moldBR', L.mold.BR[0], L.mold.BR[1], L.mold.sc * 0.9);
  place('moldMid', w.L + (w.R - w.L) * 0.3, w.B + 4, L.mode === 'wide' ? 0.8 : 0.0001);
  place('rovi', L.rovi.tx, L.rovi.ty, r1(L.rovi.s * 1000) / 1000);
  STATIONS.forEach((id, i) => place('st-' + id, L.st[i].x, L.st[i].y, L.st[i].s));
  drawSpores(L);
  stars.resize(L);
  requestAnimationFrame(placeHotspots);
}

// HTML buttons sit exactly over the SVG art (real, focusable, accessible)
function placeHotspots() {
  const box = app.getBoundingClientRect();
  for (const btn of $$('.hotspot')) {
    const id = btn.dataset.station;
    const hit = id === 'rovi' ? $('#hit-rovi') : id === 'shadow' ? $('#hit-shadow') : $(`#st-${id} .hit`);
    if (!hit) continue;
    const r = hit.getBoundingClientRect();
    btn.style.left = `${r.left - box.left}px`; btn.style.top = `${r.top - box.top}px`;
    btn.style.width = `${r.width}px`; btn.style.height = `${r.height}px`;
    btn.style.setProperty('--sw', `${r.width}px`);
  }
  $('#stations').classList.add('placed');
}

function artFor(id) { return id === 'rovi' || id === 'shadow' ? $('#rovi') : $(`#st-${id}`); }
function bindHotspots() {
  for (const btn of $$('.hotspot')) {
    const id = btn.dataset.station;
    const on = () => { artFor(id)?.classList.add('hot'); btn.classList.add('hot'); Sound.blip(id === 'shadow' ? 1200 : 660, 0.04); };
    const off = () => { artFor(id)?.classList.remove('hot'); btn.classList.remove('hot'); };
    btn.addEventListener('pointerenter', on); btn.addEventListener('pointerleave', off);
    btn.addEventListener('focus', on); btn.addEventListener('blur', off);
    btn.addEventListener('click', () => { if (id === 'shadow') shadowPoke(); else openPanel(id, btn); });
  }
  addEventListener('keydown', (e) => {
    if (e.target.closest('input,textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    if ($('#panel').open) return;
    const k = e.key.toLowerCase();
    const btn = $(`.hotspot[data-key="${k}"]`);
    if (btn) { e.preventDefault(); btn.focus({ preventScroll: true }); btn.click(); }
  });
}

// ------------------------------------------------------------------ starfield (canvas, behind the hull)
const stars = (() => {
  const cv = $('#stars'), ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1, list = [], k = 1, clip = null, raf = 0, last = 0, t0 = performance.now();
  let shoot = null, nextShoot = 4000, ship = null, nextShip = 18000;
  const shipPath = new Path2D('M 0 9 L 26 4 L 44 2 L 70 7 L 78 10 L 70 13 L 44 18 L 26 16 Z M 30 4 L 40 -4 L 48 2 Z');
  function resize(L) {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = app.clientWidth; H = app.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    k = W / L.VW; // viewBox → px
    const w = L.win;
    clip = { x: w.L * k, y: w.T * k, w: (w.R - w.L) * k, h: (w.B - w.T) * k };
    const n = Math.round(Math.min(420, (clip.w * clip.h) / 2600));
    list = Array.from({ length: n }, () => {
      const z = Math.random();
      return { x: Math.random(), y: Math.random(), z, r: (z < .8 ? rand(.4, 1.0) : rand(1.0, 1.8)), tw: rand(0, 6.28), ts: rand(.4, 2.2), c: Math.random() < .12 ? '#BFF6FA' : '#DDF6FF' };
    });
    draw(performance.now(), true);
  }
  function draw(now, force) {
    const t = (now - t0) / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!clip) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(clip.x, clip.y, clip.w, clip.h); ctx.clip();
    const moving = state.motion;
    for (const s of list) {
      const speed = 0.0012 + s.z * 0.004;
      let x = (s.x - (moving ? t * speed : 0)) % 1; if (x < 0) x += 1;
      const px = clip.x + x * clip.w, py = clip.y + s.y * clip.h;
      const a = moving ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.ts + s.tw)) : 0.7;
      ctx.globalAlpha = a * (0.35 + s.z * 0.65);
      ctx.fillStyle = s.c;
      ctx.fillRect(px, py, s.r * (k > .6 ? 1.3 : 1.1), s.r * (k > .6 ? 1.3 : 1.1));
    }
    if (moving) {
      // shooting star
      if (!shoot && now > nextShoot) { shoot = { x: clip.x + rand(.2, 1) * clip.w, y: clip.y + rand(0, .45) * clip.h, t: now, len: rand(80, 160), ang: rand(2.6, 2.9) }; }
      if (shoot) {
        const p = (now - shoot.t) / 900;
        if (p > 1) { shoot = null; nextShoot = now + rand(5000, 13000); }
        else {
          const dx = Math.cos(shoot.ang), dy = Math.sin(shoot.ang), d = p * 420;
          const hx = shoot.x + dx * d, hy = shoot.y + dy * d;
          const g = ctx.createLinearGradient(hx, hy, hx - dx * shoot.len, hy - dy * shoot.len);
          g.addColorStop(0, 'rgba(220,250,255,.9)'); g.addColorStop(1, 'rgba(92,230,242,0)');
          ctx.globalAlpha = Math.sin(p * Math.PI); ctx.strokeStyle = g; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - dx * shoot.len, hy - dy * shoot.len); ctx.stroke();
        }
      }
      // distant ship crossing
      if (!ship && now > nextShip) { ship = { t: now, y: clip.y + rand(.12, .4) * clip.h, dur: rand(16000, 24000), s: rand(.22, .34) }; }
      if (ship) {
        const p = (now - ship.t) / ship.dur;
        if (p > 1) { ship = null; nextShip = now + rand(30000, 60000); }
        else {
          const x = clip.x + clip.w * (1.05 - p * 1.15);
          ctx.globalAlpha = 0.75; ctx.save(); ctx.translate(x, ship.y); ctx.scale(-ship.s, ship.s);
          ctx.fillStyle = '#9FB3C4'; ctx.fill(shipPath);
          ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now / 90); ctx.fillStyle = '#5CE6F2';
          ctx.beginPath(); ctx.arc(80, 10, 4, 0, 6.28); ctx.fill(); ctx.restore();
        }
      }
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (now - last < 33) return; // ~30 fps is plenty for a drifting starfield
    last = now; draw(now);
  }
  function start() { if (!raf && state.motion && !document.hidden) raf = requestAnimationFrame(loop); }
  function stop() { cancelAnimationFrame(raf); raf = 0; draw(performance.now(), true); }
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  return { resize, start, stop };
})();

// ------------------------------------------------------------------ Shadow the raven
const shadowEl = $('#shadow');
const SHADOW_LINES = [
  'KRRAA. Translation: the file or nothing.',
  'Shadow has logged your cursor. Shadow is unimpressed.',
  'Recon report: eight billion biological units. Still no landing permit.',
  'Optics at 100 %. Patience at 12 %.',
  'Do not feed the raven. The raven feeds on data.',
  'KRRK. Your tab count has been noted.',
  'Shadow sees the signal. Shadow does not answer it.',
];
let lineIdx = Math.floor(Math.random() * SHADOW_LINES.length);
function shadowAct(cls, ms) {
  if (!shadowEl || !state.motion) return;
  shadowEl.classList.remove(cls); void shadowEl.getBBox(); shadowEl.classList.add(cls);
  setTimeout(() => shadowEl.classList.remove(cls), ms);
}
function shadowLoop() {
  const r = Math.random();
  if (r < 0.12) shadowAct('flap', 950);
  else if (r < 0.32) shadowAct('look', 2500);
  else shadowAct('blink', 260);
  setTimeout(shadowLoop, rand(2200, 5200));
}
let bubbleT = 0;
function shadowPoke() {
  shadowAct('flap', 950);
  Sound.caw();
  const b = $('#bubble');
  const hit = $('#hit-shadow').getBoundingClientRect();
  lineIdx = (lineIdx + 1) % SHADOW_LINES.length;
  b.innerHTML = `<b>SHADOW // RECON</b>${SHADOW_LINES[lineIdx]}`;
  const bw = Math.min(240, innerWidth - 24);
  let x = hit.left + hit.width / 2 - bw / 2; x = Math.max(12, Math.min(innerWidth - bw - 12, x));
  b.style.width = bw + 'px'; b.style.left = x + 'px';
  b.style.top = Math.max(70, hit.top - 86) + 'px';
  b.classList.add('on');
  clearTimeout(bubbleT); bubbleT = setTimeout(() => b.classList.remove('on'), 4200);
}

// ------------------------------------------------------------------ panel
const panel = $('#panel');
async function openPanel(id, trigger) {
  state.lastTrigger = trigger || null;
  const body = $('#panel-body');
  const meta = renderStation.meta(id);
  $('#panel-code').textContent = meta.code;
  $('#panel-title').textContent = meta.title;
  $('#panel-foot').innerHTML = renderStation.foot(id);
  body.innerHTML = '<p class="lead typing">Receiving transmission</p>';
  body.scrollTop = 0;
  if (!panel.open) panel.showModal();
  Sound.blip(440, 0.08); setTimeout(() => Sound.blip(880, 0.06), 70);
  try { await renderStation(id, body, { motion: state.motion, sound: Sound }); }
  catch (err) {
    console.warn(err);
    body.innerHTML = '<p class="lead">Signal lost. The data file could not be read.</p><p class="lead">If you opened the site straight from disk (file://), serve it over HTTP instead, e.g. <code>python3 -m http.server</code>.</p>';
  }
}
$('#panel-close').addEventListener('click', () => panel.close());
panel.addEventListener('click', (e) => { if (e.target === panel) panel.close(); }); // click on backdrop
panel.addEventListener('close', () => { Sound.blip(330, 0.06); state.lastTrigger?.focus({ preventScroll: true }); });

// ------------------------------------------------------------------ HUD
function tickClock() {
  const d = new Date();
  $('#clock').textContent = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
async function loadTicker() {
  try {
    const entries = await renderStation.logEntries();
    const e = entries[0];
    if (e) $('#ticker-text').textContent = `${e.date} · ${e.title}`;
  } catch { $('#ticker-text').textContent = 'Bridge systems online'; }
}

function setMotion(on, save = true) {
  state.motion = on;
  root.classList.toggle('rm', !on);
  $('#btn-motion').setAttribute('aria-pressed', String(on));
  if (save) try { localStorage.setItem('rh-motion', on ? 'on' : 'off'); } catch {}
  on ? stars.start() : stars.stop();
}
$('#btn-motion').addEventListener('click', () => setMotion(!state.motion));
$('#btn-sound').addEventListener('click', async () => {
  const on = await Sound.toggle();
  $('#btn-sound').setAttribute('aria-pressed', String(on));
});
mqReduce.addEventListener?.('change', (e) => setMotion(!e.matches, false));

// ------------------------------------------------------------------ boot
let rz = 0;
addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(applyLayout); });
document.fonts?.ready?.then(() => requestAnimationFrame(placeHotspots));

applyLayout();
bindHotspots();
setMotion(state.motion, false);
tickClock(); setInterval(tickClock, 15000);
loadTicker();
setTimeout(shadowLoop, 1800);
requestAnimationFrame(() => app.classList.add('ready'));
// deep link: index.html#log opens a station
function openFromHash() {
  const hash = location.hash.slice(1);
  if (STATIONS.includes(hash) || hash === 'rovi') openPanel(hash, $(`.hotspot[data-station="${hash}"]`));
}
setTimeout(openFromHash, 400);
addEventListener('hashchange', openFromHash);
