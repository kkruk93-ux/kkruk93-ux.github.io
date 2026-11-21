/* Rovi & Shadow Studio — biuro + sterowanie firmą. */
(function (w) {
  "use strict";
  var ZESPOL = w.RSS_ZESPOL || [];
  var STREFY = w.RSS_STREFY || [];
  var agents = ZESPOL.filter(function (a) { return a.typ === "agent"; });
  var byId = {};
  ZESPOL.forEach(function (a) { byId[a.id] = a; });

  var statusy = { aktualizacja: "", agenci: {} };
  var view = { x: 0, y: 0, k: 1 };
  var selected = null;
  var tab = "biuro"; // biuro | cmd | list | settings
  var cmdTo = "mostek";
  var cmdPrio = "normalny";
  var lista = null, listaCzas = "", listaBlad = "", ladowanie = false;
  var pointers = new Map();
  var lastPinch = 0;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function stOf(id) {
    var a = (statusy.agenci || {})[id] || {};
    var s = a.status || "wolne";
    if (s !== "pracuje" && s !== "czeka" && s !== "wolne") s = "wolne";
    return { status: s, notatka: a.notatka || "" };
  }
  function lampColor(s) {
    return s === "pracuje" ? "#3DDC84" : s === "czeka" ? "#F5B342" : "#5B6B7A";
  }
  function lampLabel(s) {
    return s === "pracuje" ? "pracuje" : s === "czeka" ? "czeka" : "wolne";
  }

  /* ---------- load statuses (local JSON, fallback already in page) ---------- */
  function applyStatus(j) {
    if (j && j.agenci) statusy = j;
  }
  if (w.RSS_STATUSY) applyStatus(w.RSS_STATUSY);
  try {
    fetch("data/statusy.json?_=" + Date.now(), { cache: "no-store" }).then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (j) { if (j) { applyStatus(j); renderFloor(); refreshOpenPanel(); } }).catch(function () {});
  } catch (e) {}

  /* ---------- SVG office ---------- */
  var VB = { w: 1600, h: 1040 };
  function floorSvg() {
    var h = "";
    h += '<defs>';
    h += '<pattern id="tile" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#5CE6F2" stroke-opacity=".05" stroke-width="1"/></pattern>';
    h += '<filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
    h += '<linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5CE6F2" stop-opacity=".10"/><stop offset="1" stop-color="#0E1B2B" stop-opacity=".55"/></linearGradient>';
    h += '<clipPath id="portClip"><circle cx="800" cy="148" r="62"/></clipPath>';
    h += '</defs>';
    h += '<rect x="16" y="16" width="1568" height="1008" rx="18" fill="#070c14" stroke="#1E7F94" stroke-opacity=".45" stroke-width="2"/>';
    h += '<rect x="16" y="16" width="1568" height="1008" rx="18" fill="url(#tile)"/>';
    /* windows / night sky along the top wall of gabinet */
    h += '<rect x="520" y="22" width="560" height="28" fill="#041018"/>';
    h += '<text x="800" y="42" text-anchor="middle" fill="#5CE6F2" fill-opacity=".55" font-size="11" font-family="ui-monospace,monospace" letter-spacing="3">SECTOR ANDROMEDA  ·  OBSERVATION DECK</text>';

    STREFY.forEach(function (z) {
      var isSala = z.id === "sala" || z.id === "gabinet";
      h += '<g class="zone" data-zone="' + esc(z.id) + '">';
      h += '<rect x="' + z.x + '" y="' + z.y + '" width="' + z.w + '" height="' + z.h + '" rx="14" fill="' + z.kolor + '" fill-opacity="' + (isSala ? ".08" : ".06") + '" stroke="' + z.kolor + '" stroke-opacity=".45" stroke-width="' + (isSala ? 2 : 1.2) + '"/>';
      if (isSala) {
        h += '<rect x="' + (z.x + 8) + '" y="' + (z.y + 8) + '" width="' + (z.w - 16) + '" height="' + (z.h - 16) + '" rx="10" fill="url(#glass)" stroke="#5CE6F2" stroke-opacity=".28"/>';
      }
      h += '<text x="' + (z.x + 16) + '" y="' + (z.y + 24) + '" fill="' + z.kolor + '" fill-opacity=".9" font-size="13" font-family="Segoe UI,system-ui,sans-serif" letter-spacing="2" font-weight="600">' + esc(z.nazwa.toUpperCase()) + '</text>';
      h += '</g>';
    });

    /* Gabinet honorowy: banner wall + official portrait */
    h += '<image href="assets/rovi-shadow-banner.jpg" x="540" y="72" width="520" height="96" preserveAspectRatio="xMidYMid slice" opacity=".55"/>';
    h += '<rect x="540" y="72" width="520" height="96" fill="none" stroke="#5CE6F2" stroke-opacity=".25"/>';
    h += '<circle cx="800" cy="148" r="66" fill="#041018" stroke="#5CE6F2" stroke-width="2" filter="url(#glow)"/>';
    h += '<image href="assets/rovi-shadow.jpg" x="738" y="86" width="124" height="124" clip-path="url(#portClip)" preserveAspectRatio="xMidYMid slice"/>';
    h += '<text x="800" y="232" text-anchor="middle" fill="#BFF6FA" font-size="15" font-weight="700" font-family="Segoe UI,system-ui,sans-serif" letter-spacing="3">ROVI  &amp;  SHADOW</text>';
    h += '<text x="800" y="252" text-anchor="middle" fill="#6B8A9E" font-size="11" font-family="Segoe UI,system-ui,sans-serif" letter-spacing="1.5">GABINET HONOROWY  ·  STUDIO</text>';
    h += '<rect class="hit" data-id="gabinet" x="500" y="40" width="600" height="260" fill="transparent" style="cursor:pointer"/>';

    /* Sala zebrań — table */
    h += '<ellipse cx="800" cy="530" rx="210" ry="70" fill="#0a1520" stroke="#5CE6F2" stroke-opacity=".55" stroke-width="2"/>';
    h += '<ellipse cx="800" cy="528" rx="186" ry="52" fill="#12202c" stroke="#2BB3C4" stroke-opacity=".3"/>';
    h += '<text x="800" y="524" text-anchor="middle" fill="#5CE6F2" font-size="11" letter-spacing="3" font-family="ui-monospace,monospace">SALA ZEBRAŃ</text>';
    h += '<text x="800" y="542" text-anchor="middle" fill="#6B8A9E" font-size="10" font-family="Segoe UI,system-ui,sans-serif">Mostek prowadzi  ·  szef główny zatwierdza</text>';
    /* chairs around table */
    [[620,500],[980,500],[680,470],[920,470],[680,590],[920,590],[800,600]].forEach(function (p, i) {
      h += '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="16" ry="10" fill="#0b141c" stroke="#1E7F94" stroke-opacity=".4"/>';
    });

    agents.forEach(function (a) { h += desk(a); });

    /* floor wordmark */
    h += '<text x="800" y="1008" text-anchor="middle" fill="#5CE6F2" fill-opacity=".18" font-size="22" letter-spacing="8" font-family="Segoe UI,system-ui,sans-serif">ROVI &amp; SHADOW STUDIO</text>';
    return h;
  }

  function desk(a) {
    var st = stOf(a.id);
    var lc = lampColor(st.status);
    var work = st.status === "pracuje";
    var wait = st.status === "czeka";
    var on = selected === a.id;
    var mon = work ? "0.95" : "0.45";
    var bob = work ? ' class="bob"' : "";
    var h = '<g class="desk" data-id="' + esc(a.id) + '" transform="translate(' + a.x + ' ' + a.y + ')">';
    h += '<rect class="hit" data-id="' + esc(a.id) + '" x="-58" y="-52" width="116" height="100" fill="transparent" style="cursor:pointer"/>';
    if (on) h += '<rect x="-60" y="-54" width="120" height="104" rx="10" fill="none" stroke="#5CE6F2" stroke-width="1.6" stroke-opacity=".9"/>';
    /* desktop */
    h += '<path d="M-46 8 L46 8 L40 28 L-40 28 Z" fill="#121c26" stroke="#2BB3C4" stroke-opacity=".35"/>';
    h += '<rect x="-28" y="-22" width="36" height="26" rx="2" fill="#071018" stroke="#1E7F94"/>';
    h += '<rect class="monitor" x="-24" y="-18" width="28" height="16" fill="#5CE6F2" fill-opacity="' + mon + '" filter="url(#glow)">';
    if (work) h += '<animate attributeName="fill-opacity" values="0.7;1;0.55;0.95" dur="2.4s" repeatCount="indefinite"/>';
    h += '</rect>';
    h += '<rect x="-6" y="4" width="12" height="5" fill="#0a1218"/>';
    /* lamp */
    h += '<circle class="lamp" cx="34" cy="6" r="5" fill="' + lc + '" stroke="#041018" stroke-width="1">';
    if (work || wait) h += '<animate attributeName="opacity" values="1;0.45;1" dur="1.8s" repeatCount="indefinite"/>';
    h += '</circle>';
    /* character */
    h += '<g' + bob + '>';
    h += '<circle cx="0" cy="-36" r="16" fill="#0E1B2B" stroke="#5CE6F2" stroke-opacity=".5"/>';
    h += '<text x="0" y="-30" text-anchor="middle" font-size="16">' + a.emoji + '</text>';
    h += '</g>';
    var nm = String(a.imie || "").split(" ");
    if (nm.length > 2) {
      h += '<text x="0" y="40" text-anchor="middle" fill="#E6EDF2" font-size="12" font-family="Segoe UI,system-ui,sans-serif" font-weight="600">';
      h += '<tspan x="0" dy="0">' + esc(nm.slice(0, -1).join(" ")) + '</tspan>';
      h += '<tspan x="0" dy="14">' + esc(nm[nm.length-1]) + '</tspan></text>';
    } else {
      h += '<text x="0" y="44" text-anchor="middle" fill="#E6EDF2" font-size="12" font-family="Segoe UI,system-ui,sans-serif" font-weight="600">' + esc(a.imie) + '</text>';
    }
    h += '</g>';
    return h;
  }

  function renderFloor() {
    var svg = $("#floor");
    if (!svg) return;
    svg.innerHTML = floorSvg();
    $$("#floor .hit").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.stopPropagation();
        openAgent(el.getAttribute("data-id"));
      });
    });
  }

  function applyView() {
    var svg = $("#floor");
    if (!svg) return;
    svg.style.transform = "translate(" + view.x + "px," + view.y + "px) scale(" + view.k + ")";
  }

  function fitRect(fx, fy, fw, fh) {
    var wrap = $("#floor-wrap");
    if (!wrap) return;
    var w = wrap.clientWidth, h = wrap.clientHeight;
    var k = Math.min(w / fw, h / fh) * 0.94;
    view.k = Math.max(0.28, Math.min(2.8, k));
    view.x = (w - fw * view.k) / 2 - fx * view.k;
    view.y = (h - fh * view.k) / 2 - fy * view.k;
    if (w < 900 && h > fh * view.k + 24) view.y = 12 - fy * view.k;
    applyView();
  }
  function fitView() { fitRect(0, 0, VB.w, VB.h); }
  function fitFeature() {
    var wrap = $("#floor-wrap");
    if (wrap && wrap.clientWidth < 900) fitRect(470, 20, 660, 730);
    else fitView();
  }

  function zoomAt(cx, cy, factor) {
    var nk = Math.max(0.35, Math.min(2.8, view.k * factor));
    var r = nk / view.k;
    view.x = cx - (cx - view.x) * r;
    view.y = cy - (cy - view.y) * r;
    view.k = nk;
    applyView();
  }

  function bindPanZoom() {
    var wrap = $("#floor-wrap");
    var dragging = false, armed = false, sx = 0, sy = 0, lx = 0, ly = 0;
    var THRESH = 8;
    wrap.addEventListener("pointerdown", function (e) {
      if (e.target.closest && e.target.closest(".zoom-tools")) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) { armed = true; dragging = false; sx = lx = e.clientX; sy = ly = e.clientY; }
    });
    wrap.addEventListener("pointermove", function (e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        var pts = Array.from(pointers.values());
        var d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        var cx = (pts[0].x + pts[1].x) / 2, cy = (pts[0].y + pts[1].y) / 2;
        if (lastPinch) zoomAt(cx, cy, d / lastPinch);
        lastPinch = d;
        dragging = false;
        return;
      }
      if (armed && !dragging && Math.hypot(e.clientX - sx, e.clientY - sy) > THRESH) {
        dragging = true;
        try { wrap.setPointerCapture(e.pointerId); } catch (err) {}
      }
      if (dragging) {
        view.x += e.clientX - lx; view.y += e.clientY - ly;
        lx = e.clientX; ly = e.clientY; applyView();
      }
    });
    function up(e) {
      var wasDrag = dragging, x = e.clientX, y = e.clientY;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) lastPinch = 0;
      if (pointers.size === 0) { dragging = false; armed = false; }
      if (!wasDrag && pointers.size === 0) {
        var n = document.elementFromPoint(x, y), id = null;
        while (n && n !== wrap) {
          if (n.getAttribute && n.getAttribute("data-id")) { id = n.getAttribute("data-id"); break; }
          n = n.parentElement || n.parentNode;
        }
        if (id) openAgent(id);
      }
    }
    wrap.addEventListener("pointerup", up);
    wrap.addEventListener("pointercancel", up);
    wrap.addEventListener("wheel", function (e) {
      e.preventDefault();
      var r = wrap.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY > 0 ? 0.92 : 1.08);
    }, { passive: false });
    $("#zIn").onclick = function () { var r = wrap.getBoundingClientRect(); zoomAt(r.width/2, r.height/2, 1.15); };
    $("#zOut").onclick = function () { var r = wrap.getBoundingClientRect(); zoomAt(r.width/2, r.height/2, 0.87); };
    $("#zFit").onclick = fitView;
  }

  /* ---------- panels ---------- */
  function openSheet(title, meta, bodyHtml, extraHead) {
    var sh = $("#sheet");
    sh.classList.add("open");
    document.body.classList.add("panel-open");
    $("#sheetTitle").textContent = title;
    $("#sheetMeta").textContent = meta || "";
    $("#sheetExtra").innerHTML = extraHead || "";
    $("#sheetBody").innerHTML = bodyHtml;
    $("#sheetClose").onclick = closeSheet;
  }
  function closeSheet() {
    $("#sheet").classList.remove("open");
    document.body.classList.remove("panel-open");
    selected = null;
    if (tab === "biuro") renderFloor();
  }
  function refreshOpenPanel() {
    if (!$("#sheet").classList.contains("open")) return;
    if (tab === "cmd") openCmd(cmdTo, true);
    else if (tab === "list") openList(true);
    else if (tab === "settings") openSettings(true);
    else if (selected) openAgent(selected, true);
  }

  function openAgent(id, keep) {
    var a = byId[id];
    if (!a) return;
    selected = id;
    if (tab !== "org" && tab !== "bibl") tab = "biuro";
    if (a.typ === "honor") {
      openSheet("Rovi & Shadow", "Gabinet honorowy · kanon serii Rovi on Earth Files",
        '<p class="opis">' + esc(a.opis) + "</p>" +
        '<div class="sheet-actions"><button class="btn primary" type="button" id="goCmdRovi">Polecenie do Rovi Here</button></div>',
        '<img class="portrait-lg" src="assets/rovi-shadow.jpg" width="72" height="72" alt="Rovi w czarnej fedorze i skórzanym trenczu, na prawym ramieniu cybernetyczny kruk Shadow ze świecącymi niebieskimi oczami.">');
      $("#goCmdRovi").onclick = function () { openCmd("rovi"); };
      renderFloor();
      syncDock();
      return;
    }
    var st = stOf(a.id);
    var head = '<div class="emoji-lg" aria-hidden="true">' + a.emoji + "</div>";
    var body = '<div class="status-row"><span class="lamp ' + st.status + '"></span><b>' + lampLabel(st.status) + "</b>" +
      (statusy.aktualizacja ? '<span style="color:var(--mute)">· stan na ' + esc(statusy.aktualizacja) + " (Berlin)</span>" : "") + "</div>" +
      '<p class="opis">' + esc(a.opis) + "</p>" +
      (st.notatka ? '<p class="notatka">' + esc(st.notatka) + "</p>" : "") +
      '<div class="sheet-actions"><button class="btn primary" type="button" id="goCmd">Wyślij polecenie</button></div>';
    openSheet(a.imie, a.zespol + " · " + a.rola, body, head);
    $("#goCmd").onclick = function () { openCmd(a.id); };
    renderFloor();
    syncDock();
  }

  function deptButtons() {
    return agents.map(function (d) {
      return '<button type="button" data-to="' + esc(d.id) + '"' + (d.id === cmdTo ? ' class="on"' : "") + ">" + d.emoji + " " + esc(d.imie) + "</button>";
    }).join("");
  }

  function openCmd(preset, keep) {
    if (!isSzef()) { w.RSS._szefReason = "Polecenia są dostępne tylko w trybie Szef. Wpisz token poniżej."; openSettings(); w.RSS._szefReason = ""; return; }
    tab = "cmd";
    if (preset && byId[preset] && byId[preset].typ === "agent") cmdTo = preset;
    selected = null;
    var api = w.RSS.api;
    var pol = api.ok();
    var c = api.cfg();
    var body = '<p class="link-row ' + (pol ? "on" : "off") + '"><span>' +
      (pol ? "Łącze gotowe · " + esc(api.host(c.url) || "apps script") : "Łącze nieustawione — wpisz token w Ustawieniach") +
      '</span><button class="btn ghost" type="button" id="cmdCfg">Łącze</button></p>' +
      '<label class="fld">Dział</label><div class="dept-grid" id="cmdTo">' + deptButtons() + "</div>" +
      '<label class="fld">Priorytet</label><div class="prio" id="cmdPrio">' +
      [["niski","Niski"],["normalny","Normalny"],["wysoki","Wysoki"],["pilne","Pilne"]].map(function (p) {
        return '<button type="button" data-p="' + p[0] + '" class="' + (p[0] === cmdPrio ? "on" : "") + '">' + p[1] + "</button>";
      }).join("") + "</div>" +
      '<label class="fld">Treść <span class="cnt" id="cmdN">0/' + api.MAKS + "</span></label>" +
      '<textarea id="cmdT" maxlength="' + api.MAKS + '" rows="5" placeholder="Co dział ma zrobić? Konkretnie: co, do kiedy, gdzie wynik…"></textarea>' +
      '<div class="sheet-actions"><button class="btn primary" type="button" id="cmdGo" disabled>' + (pol ? "Wyślij polecenie" : "Najpierw ustaw token") + "</button></div>" +
      '<div id="cmdMsg" class="msg" hidden></div>' +
      '<p class="opis" style="margin-top:14px;color:var(--mute);font-size:12px">Polecenie trafia do arkusza „RoviHere Polecenia” (ten sam co w aplikacji Blue Mold). Agenci odbierają wiersze ze statusem „nowe” i swoją nazwą działu.</p>';
    showPane("cmd");
    fillPane("view-cmd", "Nowe polecenie", "Sterowanie firmą · " + (byId[cmdTo] ? byId[cmdTo].imie : ""), body);
    $("#cmdCfg").onclick = function () { openSettings(); };
    $$("#cmdTo [data-to]").forEach(function (b) {
      b.onclick = function () {
        cmdTo = b.getAttribute("data-to");
        $$("#cmdTo [data-to]").forEach(function (o) { o.classList.toggle("on", o === b); });
        var m = $("#view-cmd .meta"); if (m) m.textContent = "Sterowanie firmą · " + (byId[cmdTo] ? byId[cmdTo].imie : "");
      };
    });
    $$("#cmdPrio [data-p]").forEach(function (b) {
      b.onclick = function () {
        cmdPrio = b.getAttribute("data-p");
        $$("#cmdPrio [data-p]").forEach(function (o) { o.classList.toggle("on", o === b); });
      };
    });
    var ta = $("#cmdT"), go = $("#cmdGo"), n = $("#cmdN");
    function upd() { var v = ta.value.trim(); n.textContent = ta.value.length + "/" + api.MAKS; go.disabled = !v || !pol; }
    ta.oninput = upd;
    go.onclick = function () {
      var txt = ta.value.trim(); if (!txt || !pol) return;
      var ag = byId[cmdTo]; if (!ag || !ag.wyslijJako) return;
      go.disabled = true; go.textContent = "Nadawanie…";
      var msg = $("#cmdMsg"); msg.hidden = true;
      api.dodaj(ag, txt, cmdPrio).then(function (j) {
        var p = j.polecenie || {};
        ta.value = ""; upd();
        go.disabled = false; go.textContent = "Wyślij polecenie";
        msg.hidden = false; msg.className = "msg good";
        msg.textContent = "Przyjęto " + (p.id || "polecenie") + " → " + ag.wyslijJako + " (status: nowe).";
        if (lista) lista.unshift(p); else lista = [p];
        if (p.id) { listaCzas = p.czas || listaCzas; api.saveCache(lista, listaCzas); }
      }, function (e) {
        go.disabled = false; go.textContent = "Wyślij polecenie";
        msg.hidden = false; msg.className = "msg bad";
        msg.textContent = "Nie wysłano: " + (e && e.message || "błąd");
      });
    };
    syncDock();
    renderFloor();
  }

  function stCls(s) {
    return { "nowe": "nowe", "w toku": "wtoku", "zrobione": "ok", "odrzucone": "odrz" }[String(s).toLowerCase()] || "nowe";
  }

  function listaHtml() {
    var api = w.RSS.api;
    if (!api.ok()) return '<p class="opis">Podłącz arkusz w Ustawieniach łącza (token), aby widzieć polecenia i ich status.</p>';
    var h = '<div class="cc-lh"><span>' + (ladowanie ? "Odbiór…" : (listaCzas ? "Stan z arkusza · " + esc(listaCzas) : "Jeszcze nie pobrano")) +
      '</span><button class="btn ghost" type="button" id="cmdRef"' + (ladowanie ? " disabled" : "") + ">Odśwież</button></div>";
    if (listaBlad) h += '<p class="cc-err">Błąd odczytu: ' + esc(listaBlad) + "</p>";
    if (lista && !lista.length) h += '<p class="opis">Arkusz nie ma jeszcze poleceń.</p>';
    if (lista && lista.length) {
      h += '<ul class="cc-cmds">' + lista.map(function (p) {
        return '<li><div class="h"><b>→ ' + esc(p.dzial) + '</b><span class="pr">' + esc(p.priorytet) +
          '</span><span class="sm st-' + stCls(p.status) + '">' + esc(String(p.status || "nowe").toUpperCase()) + "</span></div>" +
          '<p class="tr">' + esc(p.tresc) + "</p>" +
          (p.odpowiedz ? '<p class="od"><small>Odpowiedź</small>' + esc(p.odpowiedz) + "</p>" : "") +
          '<div class="f"><span>' + esc(p.id) + "</span><span>" + esc(p.czas) + (p.zrodlo ? " · " + esc(p.zrodlo) : "") + "</span></div></li>";
      }).join("") + "</ul>";
    }
    return h;
  }

  function bindLista() {
    var b = $("#cmdRef");
    if (b) b.onclick = function () { pobierzListe().then(function () { openList(true); }); };
  }

  function pobierzListe() {
    var api = w.RSS.api;
    if (!api.ok() || ladowanie) return Promise.resolve();
    ladowanie = true; listaBlad = "";
    return api.lista(50).then(function (j) {
      lista = j.polecenia || [];
      listaCzas = j.czas || berlin();
      api.saveCache(lista, listaCzas);
    }, function (e) { listaBlad = e.message; }).then(function () { ladowanie = false; });
  }

  function berlin() {
    try {
      return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date()).replace("T", " ");
    } catch (e) { return ""; }
  }

  function openList(keep) {
    if (!isSzef()) { w.RSS._szefReason = "Rejestr poleceń jest dostępny tylko w trybie Szef. Wpisz token poniżej."; openSettings(); w.RSS._szefReason = ""; return; }
    tab = "list";
    selected = null;
    var cache = w.RSS.api.loadCache();
    if (lista == null && cache.lista) { lista = cache.lista; listaCzas = cache.czas || ""; }
    showPane("list");
    fillPane("view-list", "Rejestr poleceń", "Ostatnie 50 z arkusza „RoviHere Polecenia”", listaHtml());
    bindLista();
    if (!keep && w.RSS.api.ok() && !ladowanie) {
      pobierzListe().then(function () {
        if (tab === "list") { fillPane("view-list", "Rejestr poleceń", "Ostatnie 50 z arkusza „RoviHere Polecenia”", listaHtml()); bindLista(); }
      });
    }
  }

  function openSettings(keep) {
    tab = "settings";
    selected = null;
    var api = w.RSS.api;
    var c = api.cfg();
    var body = '<p class="opis">Tryb <b>Szef</b> odblokowuje panel poleceń, rejestr, decyzje i limit zużycia. W przyszłej wersji publicznej te rzeczy zostają schowane. Adres i token zapisują się tylko w tej przeglądarce (localStorage). Nie ma ich w plikach aplikacji. Tokenu nie wklejaj do czatu.</p>' +
      (w.RSS && w.RSS._szefReason ? '<p class="szef-banner" style="display:block">' + esc(w.RSS._szefReason) + "</p>" : "") +
      '<label class="fld">Adres web app (/exec)</label>' +
      '<input class="cc-in" id="setUrl" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://script.google.com/macros/s/…/exec">' +
      '<label class="fld">Token</label>' +
      '<div class="tok-row"><input class="cc-in" id="setTok" type="password" autocomplete="off" spellcheck="false" placeholder="token"><button class="btn ghost" type="button" id="setShow">Pokaż</button></div>' +
      '<div class="sheet-actions"><button class="btn primary" type="button" id="setSave">Zapisz</button>' +
      '<button class="btn" type="button" id="setPing">Testuj połączenie</button>' +
      '<button class="btn ghost" type="button" id="setClr">Wyczyść</button></div>' +
      '<div id="setMsg" class="msg" hidden></div>' +
      '<p class="opis" style="margin-top:16px;color:var(--mute);font-size:12px">Domyślny adres to to samo wdrożenie Apps Script co w aplikacji Blue Mold. Każde urządzenie (np. telefon) ustawiasz raz. Jeśli token wycieknie, zmień go funkcją ustawToken() w skrypcie.</p>';
    showPane("settings");
    fillPane("view-settings", "Ustawienia łącza", "Arkusz poleceń", body);
    var u = $("#setUrl"), tk = $("#setTok");
    u.value = c.url || api.DOMYSLNY_URL;
    tk.value = c.token || "";
    $("#setShow").onclick = function () {
      tk.type = tk.type === "password" ? "text" : "password";
      this.textContent = tk.type === "password" ? "Pokaż" : "Ukryj";
    };
    function say(t, cls) { var m = $("#setMsg"); m.hidden = false; m.className = "msg " + cls; m.textContent = t; }
    $("#setSave").onclick = function () {
      api.saveLink(u.value, tk.value);
      var url = (u.value || "").trim(), tok = (tk.value || "").trim();
      if (url && !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url)) {
        say("Zapisano. Uwaga: adres nie wygląda jak …/macros/s/…/exec.", "warn");
      } else {
        say(url && tok ? "Zapisano. Tryb Szef: " + (api.ok() ? "włączony." : "jeszcze nie (brak adresu lub tokenu).") : "Zapisano (łącze niepełne — brak adresu lub tokenu).", url && tok ? "good" : "warn");
      }
      if (w.RSS && w.RSS.syncSzef) w.RSS.syncSzef();
    };
    $("#setClr").onclick = function () {
      u.value = ""; tk.value = ""; api.clearLink(); lista = null; listaCzas = "";
      say("Wyczyszczono token i adres z tej przeglądarki. Tryb publiczny.", "warn");
      if (w.RSS && w.RSS.syncSzef) w.RSS.syncSzef();
    };
    $("#setPing").onclick = function () {
      api.saveLink(u.value, tk.value);
      if (!api.ok()) { say("Uzupełnij adres i token.", "bad"); return; }
      say("Testowanie…", "warn");
      api.ping().then(function (j) {
        say("Połączono · czas serwera: " + (j.czas || "?"), "good");
      }, function (e) { say("Błąd: " + (e && e.message || "nieudane"), "bad"); });
    };
  }

  function openRoster() {
    tab = "biuro";
    var body = '<div class="legend"><span><i class="lamp pracuje" style="display:inline-block"></i> pracuje</span><span><i class="lamp czeka" style="display:inline-block"></i> czeka</span><span><i class="lamp wolne" style="display:inline-block"></i> wolne</span></div>';
    body += '<div class="roster">';
    agents.forEach(function (a) {
      var st = stOf(a.id);
      body += '<button type="button" data-id="' + esc(a.id) + '"><span class="lamp ' + st.status + '"></span><span>' + a.emoji + '</span><span class="nm">' + esc(a.imie) + '</span><span class="team">' + esc(a.zespol) + "</span></button>";
    });
    body += "</div>";
    openSheet("Zespół", (statusy.aktualizacja ? "Lampki na " + statusy.aktualizacja + " (Berlin)" : "Open space"), body, "");
    $$(".roster button").forEach(function (b) { b.onclick = function () { openAgent(b.getAttribute("data-id")); }; });
    syncDock();
  }

  function fillPane(id, title, meta, bodyHtml) {
    var v = $("#" + id);
    if (!v) return;
    v.innerHTML = '<div class="view-head"><h2>' + esc(title) + '</h2><p class="meta">' + esc(meta || "") + "</p></div><div class=\"view-body\">" + bodyHtml + "</div>";
  }

  function showPane(t) {
    tab = t;
    document.body.setAttribute("data-view", t);
    $$("#stage .view").forEach(function (v) {
      var on = v.id === "view-" + t;
      v.classList.toggle("on", on);
      if (on) v.removeAttribute("hidden");
      else v.setAttribute("hidden", "");
    });
    if (t !== "cmd" && t !== "list" && t !== "settings" && w.RSS.views) w.RSS.views.render(t);
    else {
      if (w.RSS.views && w.RSS.views.setLabel) w.RSS.views.setLabel(t);
      if (w.RSS.views && w.RSS.views.syncBrainShell) w.RSS.views.syncBrainShell(t);
    }
    syncDock();
    try { if (location.hash !== "#" + t) history.replaceState(null, "", "#" + t); } catch (e) {}
    if (t === "biuro") w.requestAnimationFrame(function () { fitFeature(); });
  }

  function syncDock() {
    $$("#dock button, #sidenav [data-tab]").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-tab") === tab);
    });
    $$(".bar-actions button[data-tab]").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-tab") === tab ? "true" : "false");
    });
  }

  var SZEF_TABS = { cmd: 1, list: 1, dec: 1, zuz: 1 };
  function isSzef() {
    return !!(w.RSS && w.RSS.api && w.RSS.api.ok());
  }
  function syncSzef() {
    document.body.classList.toggle("szef", isSzef());
    var f = $("#szefFoot");
    if (f) {
      f.textContent = isSzef()
        ? "Tryb Szef włączony na tym urządzeniu. Token zostaje tylko w tej przeglądarce."
        : "Tryb publiczny. Polecenia, decyzje i limit są schowane — odblokujesz je tokenem w Szef / Łącze.";
    }
  }
  function goTab(t) {
    if (!t) return;
    if (SZEF_TABS[t] && !isSzef()) {
      w.RSS._szefReason = "Ten panel jest dostępny tylko w trybie Szef. Wpisz token poniżej.";
      openSettings();
      w.RSS._szefReason = "";
      return;
    }
    closeSheet();
    if (t === "cmd") openCmd(cmdTo);
    else if (t === "list") openList();
    else if (t === "settings") openSettings();
    else showPane(t);
  }

  /* ---------- boot ---------- */
  function boot() {
    var cache = w.RSS.api.loadCache();
    if (cache.lista) { lista = cache.lista; listaCzas = cache.czas || ""; }
    renderFloor();
    fitFeature();
    bindPanZoom();
    w.addEventListener("resize", function () { fitFeature(); });
    w.requestAnimationFrame(function () { fitFeature(); });
    $$("#dock button, #sidenav [data-tab], .bar-actions button[data-tab]").forEach(function (b) {
      b.onclick = function () { goTab(b.getAttribute("data-tab")); };
    });
    var br = $("#btnRoster");
    if (br) br.onclick = function () { goTab("org"); };
    var brm = $("#btnRosterM");
    if (brm) brm.onclick = function () { goTab("org"); };
    $("#sheetClose").onclick = closeSheet;
    w.addEventListener("hashchange", function () {
      var h = (location.hash || "").replace(/^#/, "");
      if (h && h !== tab) goTab(h);
    });
    syncSzef();
    var start = (location.hash || "").replace(/^#/, "");
    if (start && start !== "biuro") goTab(start);
    else showPane("biuro");
    if (w.RSS.views && w.RSS.views.mountWorld) w.RSS.views.mountWorld();
    syncDock();
  }

  w.RSS = w.RSS || {};
  w.RSS.openSheet = openSheet;
  w.RSS.closeSheet = closeSheet;
  w.RSS.openAgent = openAgent;
  w.RSS.goTab = goTab;
  w.RSS.stOf = stOf;
  w.RSS.openCmd = openCmd;
  w.RSS.isSzef = isSzef;
  w.RSS.syncSzef = syncSzef;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window);
