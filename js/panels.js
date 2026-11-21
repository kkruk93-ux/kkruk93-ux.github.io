// Station panels. Content comes from /data/*.json so daily routines only edit data files.
export const STATIONS = ['log', 'comms', 'files', 'crew', 'music', 'merch'];

const META = {
  log:   { code: 'Station 01 // Captain\'s log', title: 'Captain\'s Log' },
  comms: { code: 'Station 02 // Comms array', title: 'Comms' },
  files: { code: 'Station 03 // Archive', title: 'Rovi on Earth Files' },
  crew:  { code: 'Station 04 // Personnel', title: 'Crew Roster' },
  music: { code: 'Station 05 // Audio console', title: 'Blue Mold Audio' },
  merch: { code: 'Station 06 // Cargo bay', title: 'Cargo Bay' },
  rovi:  { code: 'Observer dossier // Classified', title: 'Rovi Here' },
};

const cache = {};
async function data(name) {
  if (!cache[name]) {
    cache[name] = fetch(`data/${name}.json`, { cache: 'no-cache' }).then((r) => {
      if (!r.ok) throw new Error(`${name}.json: HTTP ${r.status}`);
      return r.json();
    });
    cache[name].catch(() => delete cache[name]);
  }
  return cache[name];
}

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^(https?:|mailto:|\.?\/|[\w-]+\.html)/i.test(u || '') ? u : '#');
const paras = (t = '') => String(t).split(/\n\s*\n/).map((p) => `<p>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('');
function stardate(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  if (isNaN(d)) return '';
  const doy = Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5);
  return `SD ${d.getUTCFullYear()}.${String(doy).padStart(3, '0')}`;
}
const ext = (u) => `href="${esc(safeUrl(u))}" target="_blank" rel="noopener noreferrer"`;

const ICON = {
  youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 9l5 3-5 3z" fill="currentColor"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4l16 16M20 4L4 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M14 3c.5 3 2.5 4.6 5 4.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  kofi: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z M16 10h2a2 2 0 0 1 0 4h-2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  signal: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  wave: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M2 12h3l2-6 3 12 3-9 2 5 2-2h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>',
};

async function logEntries() {
  const d = await data('log');
  return (d.entries || [])
    .map((e, i) => ({ ...e, _i: i }))
    .filter((e) => e && e.date && e.title)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b._i - a._i));
}

function typeInto(el, text, motion) {
  if (!motion) { el.textContent = text; return; }
  el.textContent = ''; el.classList.add('typing');
  let i = 0;
  const step = () => {
    el.textContent = text.slice(0, ++i);
    if (i < text.length) setTimeout(step, 22); else el.classList.remove('typing');
  };
  step();
}

const R = {
  async log(body, ctx) {
    const entries = await logEntries();
    const PAGE = 8; let shown = 0;
    body.innerHTML = '<p class="lead">Daily transmissions from the observation deck. <em>Newest first.</em></p><div class="log-list"></div>';
    const list = body.querySelector('.log-list');
    const more = document.createElement('button');
    more.className = 'more'; more.type = 'button'; more.textContent = 'Load older entries';
    const add = () => {
      const chunk = entries.slice(shown, shown + PAGE);
      chunk.forEach((e, j) => {
        const art = document.createElement('article');
        art.className = 'log-entry';
        art.innerHTML = `<p class="log-meta">${esc(e.date)} <span>· ${stardate(e.date)}</span></p>
          <h3 class="log-title"></h3>${paras(e.body)}
          ${e.link && e.link.url ? `<p><a ${ext(e.link.url)}>${esc(e.link.label || 'Open link')} ↗</a></p>` : ''}
          ${Array.isArray(e.tags) && e.tags.length ? `<ul class="tags">${e.tags.map((t) => `<li>#${esc(t)}</li>`).join('')}</ul>` : ''}`;
        list.appendChild(art);
        const h = art.querySelector('.log-title');
        if (shown === 0 && j === 0) typeInto(h, e.title, ctx.motion); else h.textContent = e.title;
      });
      shown += chunk.length;
      if (shown >= entries.length) more.remove(); else body.appendChild(more);
    };
    more.addEventListener('click', add);
    if (!entries.length) list.innerHTML = '<p class="lead">No transmissions yet.</p>';
    else add();
  },

  async comms(body) {
    const d = await data('links');
    const ch = (d.channels || []).filter((c) => c.show !== false);
    body.innerHTML = `<p class="lead">Open a channel to the observer. <em>Transmissions are one-way. Mostly.</em></p>
      <ul class="cards">${ch.map((c) => `<li><a class="card" ${ext(c.url)}>
        <span class="card-k">${ICON[c.id] || ICON.signal}${esc(c.name)} ${c.placeholder ? '<span class="badge b-off">Placeholder</span>' : '<span class="badge b-live">Live</span>'}</span>
        <span class="card-t">${esc(c.handle)}</span>
        <span class="card-d">${esc(c.desc)}</span>
        <span class="card-go">Open channel ↗</span></a></li>`).join('')}</ul>`;
  },

  async files(body) {
    const [d, l] = await Promise.all([data('files'), data('links')]);
    const yt = (l.channels || []).find((c) => c.id === 'youtube');
    const rows = (d.files || []).slice().sort((a, b) => b.no - a.no);
    body.innerHTML = `<p class="lead">${esc(d.intro)}</p>
      <table class="ftable"><thead><tr><th scope="col">File</th><th scope="col">Case</th><th scope="col" class="yr">Year</th><th scope="col">Status</th></tr></thead><tbody>
      ${rows.map((f) => `<tr class="${f.status === 'archived' ? 'archived' : 'incoming'}"><td>#${String(f.no).padStart(3, '0')}</td>
        <td><span class="case">${f.url ? `<a ${ext(f.url)}>${esc(f.case)} ↗</a>` : esc(f.case)}</span><span class="place">${esc(f.place)} · ${esc(f.year)}</span></td>
        <td class="yr">${esc(f.year)}</td>
        <td>${f.status === 'archived' ? '<span class="badge b-arch">Archived</span>' : '<span class="badge b-off">Incoming</span>'}</td></tr>`).join('')}
      </tbody></table>
      ${yt ? `<div class="row"><a class="btn" ${ext(yt.url.replace(/\/$/, '') + '/shorts')}>Watch the Files ↗</a></div>` : ''}`;
  },

  async crew(body) {
    const d = await data('crew');
    body.innerHTML = `<p class="lead">${esc(d.note)}</p>
      <ul class="cards">${(d.crew || []).map((c) => `<li class="card">
        <span class="card-k"><span class="dot ${esc(c.status)}" aria-hidden="true"></span>${esc(c.rank)}</span>
        <span class="card-t">${esc(c.name)}</span>
        <span class="card-d"><strong>${esc(c.station)}.</strong> ${esc(c.desc)}</span>
        <span class="sr-only">Status: ${esc(c.status)}</span></li>`).join('')}</ul>`;
  },

  async music(body, ctx) {
    const d = await data('music');
    body.innerHTML = `<p class="lead">${esc(d.intro)}</p>
      <ul class="tracks">${(d.tracks || []).map((t) => `<li class="track">
        <span class="track-ico">${ICON.wave}</span>
        <span><span class="track-t">${esc(t.title)}</span><br><span class="track-s">${esc(t.subtitle)} · ${esc(t.genre)} · ${esc(t.date)}</span></span>
        ${t.status === 'released' && t.url ? `<a class="btn" ${ext(t.url)} aria-label="Listen to ${esc(t.title)} on YouTube">Listen ↗</a>` : '<span class="badge-wrap"><span class="badge b-off">In production</span></span>'}
      </li>`).join('')}</ul>
      <div class="row"><button type="button" class="btn ghost" id="hum-btn">${ctx.sound.on ? 'Mute ship hum' : 'Play ship hum'}</button><span class="track-s">A synthesized engine drone, generated in your browser.</span></div>`;
    const btn = body.querySelector('#hum-btn');
    btn.addEventListener('click', async () => {
      const on = await ctx.sound.toggle();
      btn.textContent = on ? 'Mute ship hum' : 'Play ship hum';
      document.getElementById('btn-sound')?.setAttribute('aria-pressed', String(on));
    });
  },

  async merch(body) {
    const d = await data('links');
    const m = d.merch || {};
    const xl = (d.channels || []).find((c) => c.id === 'x');
    body.innerHTML = `<p class="lead"><span class="badge b-off">Status: ${esc(m.status || 'sealed')}</span></p>
      <p class="lead">${esc(m.teaser)}</p>
      <ul class="cargo">${(m.items || []).map((i) => `<li><b>${esc(i.name)}</b><span>${esc(i.kind)} · ${esc(i.status)}</span></li>`).join('')}</ul>
      <div class="row">
        ${m.placeholder ? `<span class="btn" aria-disabled="true">${esc(m.store_name || 'Store')} · offline</span>` : `<a class="btn" ${ext(m.url)}>Open ${esc(m.store_name || 'store')} ↗</a>`}
        ${xl ? `<a class="btn ghost" ${ext(xl.url)}>Get the drop signal on X ↗</a>` : ''}
      </div>`;
  },

  async rovi(body) {
    body.innerHTML = `<div class="dossier">
      <img class="dossier-img" src="assets/img/rovi-avatar.png" width="340" height="340" alt="Rovi: grey alien, black fedora, glossy black eyes, with Shadow the raven on his shoulder.">
      <div>
        <dl class="dl">
          <dt>Subject</dt><dd>Rovi Here</dd>
          <dt>Origin</dt><dd>Sector Andromeda</dd>
          <dt>Status</dt><dd>Analytical Module: Active</dd>
          <dt>Assignment</dt><dd>Observe Earth. ~50 cycles in orbit so far.</dd>
          <dt>Profile</dt><dd>Tall, slim, grey. Wrinkled skin, large glossy black eyes. Black fedora, long black leather trench coat.</dd>
          <dt>Companion</dt><dd>Shadow: black cybernetic raven, glowing blue optics, right shoulder.</dd>
          <dt>Ship</dt><dd>The Blue Mold. Do not touch the walls.</dd>
        </dl>
        <p>A cold, cynical analyst of the planet's biological units. Rovi files one real, documented UFO case at a time and keeps the soundtrack heavy.</p>
        <p class="quote">The file or nothing.</p>
      </div></div>`;
  },
};

export async function renderStation(id, body, ctx) {
  if (!R[id]) throw new Error('unknown station ' + id);
  await R[id](body, ctx);
}
renderStation.meta = (id) => META[id] || { code: 'Station', title: id };
renderStation.logEntries = logEntries;
renderStation.foot = (id) => `<span>Blue Mold // Deck 03</span><span class="legal"></span><span>Esc to close</span>`;
// legal links (imprint / privacy) when configured in data/links.json
data('links').then((d) => {
  const l = d.legal || {};
  const parts = [];
  if (l.imprint_url) parts.push(`<a href="${esc(safeUrl(l.imprint_url))}">Imprint</a>`);
  if (l.privacy_url) parts.push(`<a href="${esc(safeUrl(l.privacy_url))}">Privacy</a>`);
  if (parts.length) renderStation.foot = () => `<span>Blue Mold // Deck 03</span><span class="legal">${parts.join(' · ')}</span><span>Esc to close</span>`;
}).catch(() => {});
