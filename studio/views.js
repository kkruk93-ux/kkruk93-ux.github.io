/* Widoki v2: Biblioteka (graf), struktura, kalendarz, decyzje, zużycie, zarabianie, kanały. */
(function (w) {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  var LABELS = {
    biuro: "Biuro główne · sterowanie firmą",
    bibl: "Mapa wiedzy i pamięci firmy",
    org: "Szefowie i działy",
    cmd: "Nowe polecenie do działu",
    list: "Rejestr poleceń z arkusza",
    kal: "Kalendarz publikacji i rytm",
    dec: "Decyzje z odprawy",
    zar: "Zarabianie · odczyty z plików",
    zuz: "Zużycie limitu tygodniowego",
    kan: "Kanały publiczne",
    settings: "Tryb Szef · łącze z arkuszem",
    more: "Wszystkie działy aplikacji",
    art: "Artykuły · X Articles i dłuższe teksty",
    vid: "Filmy do pobrania · Blue Mold"
  };
  var TYP_NAZWA = {
    sprawa: "Sprawa UFO", krotki: "Short YouTube", long: "Długi film", tiktok: "TikTok",
    ksiazka: "Książka", piosenka: "Piosenka", gra: "Gra", dzial: "Dział", decyzja: "Decyzja"
  };
  var TYP_COL = {
    sprawa: "#5CE6F2", krotki: "#2BB3C4", long: "#1E7F94", tiktok: "#7AE0C8",
    ksiazka: "#C4A35A", piosenka: "#9B8CFF", gra: "#3DDC84", dzial: "#8AA4B8", decyzja: "#E0A24A"
  };
  var ET_NAZWA = {
    fakt: "FAKT", dokument_zrodlowy: "DOKUMENT ŹRÓDŁOWY",
    teoria: "TEORIA", teoria_spiskowa: "TEORIA SPISKOWA"
  };

  var firma = w.RSS_FIRMA || null;
  var bibl = w.RSS_BIBLIOTEKA || null;
  var articles = w.RSS_ARTICLES || null;
  var videos = w.RSS_VIDEOS || null;
  var artOpen = null;
  try {
    fetch("data/firma.json?_=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j) { firma = j; painted = {}; } }).catch(function () {});
    fetch("data/biblioteka.json?_=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j) { bibl = j; painted = {}; cy = null; } }).catch(function () {});
    fetch("data/articles.json?_=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j) { articles = j; } }).catch(function () {});
    fetch("data/videos.json?_=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j) { videos = j; } }).catch(function () {});
  } catch (e) {}

  var painted = {};
  var cy = null;
  var filt = { sprawa: true, krotki: false, long: false, tiktok: false, ksiazka: true, piosenka: true, gra: true, dzial: true, decyzja: true };
  var q = "";
  var listMode = false;
  var biblMode = "3d";
  var MODE_KEY = "rss-bibl-mode-v3";
  try {
    /* v3: always open on the 3D brain unless the user picked 2D/list after this bump. */
    var savedMode = w.localStorage.getItem(MODE_KEY);
    if (savedMode === "2d" || savedMode === "3d" || savedMode === "list") biblMode = savedMode;
    else biblMode = "3d";
  } catch (e) {}
  listMode = biblMode === "list";

  function canBrain() {
    return !!(w.RSS && w.RSS.brain3d && w.RSS.brain3d.canWebGL && w.RSS.brain3d.canWebGL());
  }
  function setBiblMode(m) {
    if (m === "3d" && !canBrain()) m = "2d";
    biblMode = m;
    listMode = m === "list";
    try { w.localStorage.setItem(MODE_KEY, m); } catch (e2) {}
  }

  function setLabel(tab) {
    var el = $("#viewLabel");
    if (el) el.textContent = LABELS[tab] || "";
  }

  function badges(n) {
    var h = (n.etykiety || []).map(function (e) {
      return '<span class="badge ' + esc(e) + '">' + esc(ET_NAZWA[e] || e) + "</span>";
    }).join("");
    if (n.brak_zrodla && n.typ === "sprawa") h += '<span class="badge brak_zrodla">brak źródła</span>';
    return h;
  }

  function srcList(n) {
    var zs = n.zrodla || [];
    if (!zs.length) return '<p class="opis">brak źródła</p>';
    return '<ul class="src-list">' + zs.map(function (z) {
      var typ = z.typ === "dokument_zrodlowy" ? "dokument źródłowy" : "opracowanie";
      return "<li><span class=\"typ\">" + typ + "</span>" +
        (z.url ? '<a href="' + esc(z.url) + '" target="_blank" rel="noopener noreferrer">' + esc(z.title || z.url) + "</a>" : esc(z.title || "")) +
        "</li>";
    }).join("") + "</ul>";
  }

  function openNode(n) {
    if (!n || !w.RSS || !w.RSS.openSheet) return;
    var typ = TYP_NAZWA[n.typ] || n.typ;
    var body = badges(n) +
      '<p class="opis" style="margin-top:10px">' + esc(n.opis || typ) + "</p>" +
      (n.odcinek ? '<p class="opis">Odcinek: ' + esc(n.odcinek) + "</p>" : "") +
      (n.platformy && n.platformy.length ? '<p class="opis">Platformy: ' + esc(n.platformy.join(", ")) + "</p>" : "") +
      (n.plik ? '<p class="opis" style="color:var(--mute);font-size:12px">Plik: ' + esc(n.plik) + "</p>" : "") +
      "<h3 style=\"margin:14px 0 6px;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:var(--mute)\">Źródła z naszych plików</h3>" +
      srcList(n);
    w.RSS.openSheet(n.nazwa || n.id, typ, body, "");
  }

  function nodeStyle(n) {
    var col = TYP_COL[n.typ] || "#8AA4B8";
    var et = n.etykiety || [];
    var shape = n.typ === "dzial" ? "round-rectangle" : n.typ === "decyzja" ? "diamond" : n.typ === "ksiazka" ? "round-octagon" : "ellipse";
    var border = col;
    var width = 2;
    var dash = [0];
    if (et.indexOf("teoria_spiskowa") >= 0) { border = "#FF5A8A"; width = 4; shape = "diamond"; }
    else if (et.indexOf("teoria") >= 0) { border = "#E0A24A"; width = 3; }
    else if (et.indexOf("dokument_zrodlowy") >= 0) { border = "#F5E6A3"; width = 3; }
    else if (et.indexOf("fakt") >= 0) { border = "#3DDC84"; width = 3; }
    if (n.brak_zrodla && n.typ === "sprawa") { dash = [4, 4]; if (et.indexOf("fakt") < 0 && et.indexOf("dokument_zrodlowy") < 0) border = "#5B6B7A"; }
    var size = n.typ === "dzial" ? 46 : n.typ === "sprawa" ? 32 : n.typ === "decyzja" ? 24 : 22;
    return { col: col, border: border, width: width, dash: dash, shape: shape, size: size };
  }

  function visibleIds() {
    var ids = {};
    (bibl.wezly || []).forEach(function (n) {
      if (!filt[n.typ]) return;
      if (q) {
        var hay = ((n.nazwa || "") + " " + (n.odcinek || "") + " " + (n.plik || "")).toLowerCase();
        if (hay.indexOf(q) < 0) return;
      }
      ids[n.id] = n;
    });
    return ids;
  }

  function elementsFromData() {
    var ids = visibleIds();
    var els = [];
    Object.keys(ids).forEach(function (id) {
      var n = ids[id];
      var st = nodeStyle(n);
      var label = (n.nazwa || id);
      if (label.length > 28) label = label.slice(0, 26) + "…";
      els.push({
        data: { id: n.id, label: label, typ: n.typ, raw: n },
        style: {
          "background-color": st.col,
          "border-color": st.border,
          "border-width": st.width,
          "border-style": st.dash[0] ? "dashed" : "solid",
          "shape": st.shape,
          "width": st.size,
          "height": st.size
        }
      });
    });
    (bibl.krawedzie || []).forEach(function (e, i) {
      if (!ids[e.from] || !ids[e.to]) return;
      els.push({ data: { id: "e" + i, source: e.from, target: e.to, typ: e.typ } });
    });
    return els;
  }

  function applyCyStyles(instance) {
    instance.style()
      .selector("node")
      .style({
        "label": "data(label)",
        "color": "#BFF6FA",
        "font-size": 10,
        "font-family": "Segoe UI, system-ui, sans-serif",
        "text-wrap": "wrap",
        "text-max-width": 76,
        "text-valign": "bottom",
        "text-margin-y": 4,
        "text-outline-color": "#05080F",
        "text-outline-width": 2,
        "background-opacity": 0.92,
        "overlay-padding": 4,
        "overlay-opacity": 0
      })
      .selector("node:selected")
      .style({
        "overlay-opacity": 0.15,
        "overlay-color": "#5CE6F2",
        "z-index": 999
      })
      .selector("edge")
      .style({
        "width": 1.1,
        "line-color": "rgba(43,179,196,0.35)",
        "curve-style": "haystack",
        "haystack-radius": 0.6,
        "opacity": 0.7
      })
      .update();
    instance.nodes().forEach(function (nd) {
      var raw = nd.data("raw") || {};
      var st = nodeStyle(raw);
      nd.style({
        "background-color": st.col,
        "border-color": st.border,
        "border-width": st.width,
        "border-style": st.dash[0] ? "dashed" : "solid",
        "shape": st.shape,
        "width": st.size,
        "height": st.size
      });
    });
  }

  function mountCy() {
    if (!w.cytoscape || !$("#cy") || !bibl) return;
    var narrow = w.innerWidth < 900;
    var els = elementsFromData();
    if (cy) { cy.destroy(); cy = null; }
    cy = w.cytoscape({
      container: $("#cy"),
      elements: els,
      minZoom: 0.12,
      maxZoom: 3.2,
      wheelSensitivity: 0.35,
      pixelRatio: Math.min(w.devicePixelRatio || 1, 2),
      hideEdgesOnViewport: !!narrow,
      textureOnViewport: !!narrow,
      motionBlur: false,
      autoungrabify: false,
      boxSelectionEnabled: false,
      layout: {
        name: "cose",
        animate: false,
        randomize: true,
        nodeOverlap: 12,
        nodeRepulsion: function () { return narrow ? 9000 : 16000; },
        idealEdgeLength: function () { return narrow ? 100 : 140; },
        numIter: narrow ? 900 : 1600,
        gravity: 0.2,
        initialTemp: 200,
        padding: 28
      }
    });
    applyCyStyles(cy);
    cy.on("tap", "node", function (evt) {
      var raw = evt.target.data("raw");
      openNode(raw);
    });
    cy.on("tap", function (evt) {
      if (evt.target === cy && w.RSS && w.RSS.closeSheet) w.RSS.closeSheet();
    });
    function refit() {
      if (!cy) return;
      try { cy.resize(); cy.fit(undefined, narrow ? 20 : 40); } catch (e) {}
    }
    setTimeout(refit, 40);
    setTimeout(refit, 280);
    setTimeout(refit, 700);
  }

  function renderBibl() {
    var root = $("#view-bibl");
    if (!root || !bibl) {
      if (root) root.innerHTML = '<div class="view-head"><h2>Biblioteka</h2><p>Brak danych grafu.</p></div>';
      return;
    }
    var nCount = (bibl.wezly || []).length, eCount = (bibl.krawedzie || []).length;
    if (biblMode === "3d" && !canBrain() && !(w.RSS && w.RSS.brain3d)) {
      /* module still loading — keep 3d so rss-brain-ready can mount */
    } else if (biblMode === "3d" && !canBrain()) {
      setBiblMode("2d");
    }
    var is3d = biblMode === "3d";
    var isList = biblMode === "list";
    var is2d = biblMode === "2d";
    root.innerHTML =
      '<div class="bibl-bar">' +
        '<div class="row"><input id="biblQ" type="search" placeholder="Szukaj sprawy, książki, piosenki…" value="' + esc(q) + '">' +
        '<button type="button" class="chip' + (is3d ? " on" : "") + '" id="bibl3d" ' + (canBrain() || is3d ? "" : "disabled title=\"WebGL niedostępny — mapa 2D\"") + '>3D mózg</button>' +
        '<button type="button" class="chip' + (is2d ? " on" : "") + '" id="bibl2d">Mapa 2D</button>' +
        '<button type="button" class="chip' + (isList ? " on" : "") + '" id="biblList">Lista</button>' +
        '<button type="button" class="chip" id="biblFit">Dopasuj</button></div>' +
        '<div class="infect-bar" id="infectBar"' + (is3d ? "" : " hidden") + '>' +
          '<button type="button" class="chip infect" id="biblInfect">Infekcja</button>' +
          '<label class="infect-loop"><input type="checkbox" id="biblInfectLoop"> Pętla</label>' +
          '<input type="range" id="biblInfectSlider" min="0" max="100" value="0" aria-label="Postęp infekcji Blue Mold">' +
          '<span id="biblInfectPct">0%</span>' +
          '<button type="button" class="chip on" id="biblSceneMold">Pleśń</button>' +
          '<button type="button" class="chip" id="biblSceneExam">Badanie kosmitów</button>' +
        '</div>' +
        '<div class="filters" id="biblFilt">' +
          [["sprawa","Sprawy"],["krotki","Shorty"],["long","Longi"],["tiktok","TikTok"],["ksiazka","Książki"],["piosenka","Piosenki"],["gra","Gry"],["dzial","Działy"],["decyzja","Decyzje"]].map(function (p) {
            return '<button type="button" data-f="' + p[0] + '" class="' + (filt[p[0]] ? "on" : "") + '">' + p[1] + "</button>";
          }).join("") +
        "</div>" +
        '<div class="legend-bibl">' +
          '<span><i style="color:#3DDC84;background:#3DDC84"></i>FAKT</span>' +
          '<span><i style="color:#F5E6A3;background:#F5E6A3"></i>DOKUMENT ŹRÓDŁOWY</span>' +
          '<span><i style="color:#E0A24A;background:#E0A24A"></i>TEORIA</span>' +
          '<span><i style="color:#FF5A8A;background:#FF5A8A"></i>TEORIA SPISKOWA</span>' +
          '<span><i style="color:#5B6B7A;background:transparent;border:1px dashed #5B6B7A;box-shadow:none;border-radius:50%"></i>brak źródła</span>' +
        "</div>" +
        '<details class="bibl-info"><summary>Skąd dane · ' + nCount + " węzłów · " + eCount + " krawędzi" + (bibl.wygenerowano ? " · " + bibl.wygenerowano + " (Europe/Berlin)" : "") + "</summary><p>" + esc(bibl.uwaga || "") + "</p></details>" +
      "</div>" +
      '<div id="brain3d" role="img" aria-label="Trójwymiarowa pamięć firmy w kształcie mózgu"' + (is3d && !isList ? "" : " hidden") + "></div>" +
      '<div id="cy" role="img" aria-label="Graf wiedzy firmy"' + (is2d ? "" : " hidden") + "></div>" +
      '<div class="bibl-list" id="biblItems"' + (isList ? "" : " hidden") + "></div>";

    function refreshList() {
      var box = $("#biblItems");
      if (!box) return;
      var ids = visibleIds();
      var arr = Object.keys(ids).map(function (k) { return ids[k]; });
      arr.sort(function (a, b) { return String(a.nazwa || "").localeCompare(String(b.nazwa || ""), "pl"); });
      box.innerHTML = arr.map(function (n) {
        return '<div class="glass node-item" data-id="' + esc(n.id) + '"><b>' + esc(n.nazwa) + "</b> " +
          '<span style="color:var(--mute);font-size:11px">' + esc(TYP_NAZWA[n.typ] || n.typ) + "</span><div>" + badges(n) + "</div></div>";
      }).join("") || '<p class="opis">Brak węzłów dla tych filtrów.</p>';
      $$(".node-item", box).forEach(function (el) {
        el.onclick = function () {
          var id = el.getAttribute("data-id");
          var n = (bibl.wezly || []).filter(function (x) { return x.id === id; })[0];
          openNode(n);
        };
      });
    }

    function mountBrain() {
      var api = w.RSS && w.RSS.brain3d;
      if (!api) return;
      if (!api.isMounted || !api.isMounted()) {
        if (!mountWorld()) {
          setBiblMode("2d");
          painted.bibl = false;
          renderBibl();
          return;
        }
      }
      var vis = visibleIds();
      var sl = $("#biblInfectSlider");
      if (api.setGraph) {
        api.setGraph({
          nodes: bibl.wezly || [],
          edges: bibl.krawedzie || [],
          visible: vis,
          onOpen: openNode
        });
      }
      if (api.setLibraryMode) api.setLibraryMode(true);
      if (api.setShellMode) api.setShellMode("bibl");
      if (sl && api.setInfection) api.setInfection((parseFloat(sl.value) || 0) / 100);
      if (api.setLoop && $("#biblInfectLoop")) api.setLoop(!!$("#biblInfectLoop").checked);
      if (api.resize) api.resize();
    }

    function applyBiblView() {
      var b3 = $("#brain3d"), cyEl = $("#cy"), list = $("#biblItems"), inf = $("#infectBar");
      $$("#bibl3d, #bibl2d, #biblList").forEach(function (b) {
        if (!b) return;
        var id = b.id;
        b.classList.toggle("on", (id === "bibl3d" && biblMode === "3d") || (id === "bibl2d" && biblMode === "2d") || (id === "biblList" && biblMode === "list"));
      });
      if (biblMode === "list") {
        document.body.classList.add("brain-hidden");
        if (b3) b3.hidden = true;
        if (cyEl) cyEl.hidden = true;
        if (list) list.hidden = false;
        if (inf) inf.hidden = true;
        refreshList();
      } else if (biblMode === "2d") {
        document.body.classList.add("brain-hidden");
        if (b3) b3.hidden = true;
        if (cyEl) cyEl.hidden = false;
        if (list) list.hidden = true;
        if (inf) inf.hidden = true;
        mountCy();
      } else {
        document.body.classList.remove("brain-hidden");
        if (cyEl) cyEl.hidden = true;
        if (list) list.hidden = true;
        if (b3) b3.hidden = true; /* shared #brain-world canvas */
        if (inf) inf.hidden = false;
        mountBrain();
      }
      if (w.RSS.brain3d && w.RSS.brain3d.resize) setTimeout(function () { w.RSS.brain3d.resize(); }, 40);
    }

    $$("#biblFilt [data-f]").forEach(function (b) {
      b.onclick = function () {
        var f = b.getAttribute("data-f");
        filt[f] = !filt[f];
        painted.bibl = false;
        renderBibl();
      };
    });
    var inp = $("#biblQ");
    if (inp) {
      inp.addEventListener("input", function () {
        q = (inp.value || "").trim().toLowerCase();
        if (biblMode === "list") refreshList();
        else if (biblMode === "2d") mountCy();
        else mountBrain();
      });
    }
    $("#biblFit") && ($("#biblFit").onclick = function () {
      if (biblMode === "3d" && w.RSS.brain3d && w.RSS.brain3d.fit) w.RSS.brain3d.fit();
      else if (cy) cy.fit(undefined, 24);
    });
    $("#bibl3d") && ($("#bibl3d").onclick = function () {
      setBiblMode("3d");
      applyBiblView();
    });
    $("#bibl2d") && ($("#bibl2d").onclick = function () {
      setBiblMode("2d");
      applyBiblView();
    });
    $("#biblList") && ($("#biblList").onclick = function () {
      setBiblMode("list");
      applyBiblView();
    });
    var sl = $("#biblInfectSlider"), pct = $("#biblInfectPct");
    if (sl) {
      sl.addEventListener("input", function () {
        var v = (parseFloat(sl.value) || 0) / 100;
        if (pct) pct.textContent = Math.round(v * 100) + "%";
        if (w.RSS.brain3d && w.RSS.brain3d.setInfection) w.RSS.brain3d.setInfection(v);
      });
    }
    $("#biblInfect") && ($("#biblInfect").onclick = function () {
      var api = w.RSS && w.RSS.brain3d;
      if (!api) return;
      var start = api.getProgress && api.getProgress() >= 0.98 ? 0 : (api.getProgress ? api.getProgress() : 0);
      api.play({ duration: 12000, from: start, loop: !!("#biblInfectLoop" && $("#biblInfectLoop") && $("#biblInfectLoop").checked) });
    });
    $("#biblInfectLoop") && ($("#biblInfectLoop").onchange = function () {
      if (w.RSS.brain3d && w.RSS.brain3d.setLoop) w.RSS.brain3d.setLoop(this.checked);
    });
    function syncSceneChips(mode) {
      var m = $("#biblSceneMold"), x = $("#biblSceneExam");
      if (m) m.classList.toggle("on", mode !== "exam");
      if (x) x.classList.toggle("on", mode === "exam");
    }
    $("#biblSceneMold") && ($("#biblSceneMold").onclick = function () {
      if (w.RSS.brain3d && w.RSS.brain3d.setSceneMode) w.RSS.brain3d.setSceneMode("mold");
      syncSceneChips("mold");
    });
    $("#biblSceneExam") && ($("#biblSceneExam").onclick = function () {
      if (w.RSS.brain3d && w.RSS.brain3d.setSceneMode) w.RSS.brain3d.setSceneMode("exam");
      syncSceneChips("exam");
    });
    if (w.RSS.brain3d && w.RSS.brain3d.getSceneMode) syncSceneChips(w.RSS.brain3d.getSceneMode());
    refreshList();
    applyBiblView();
  }

  function stOf(id) {
    var st = (w.RSS && w.RSS.stOf) ? w.RSS.stOf(id) : { status: "wolne", notatka: "" };
    return st;
  }

  function orgCard(a) {
    if (!a) return "";
    var st = stOf(a.id);
    return '<button type="button" class="org-card" data-id="' + esc(a.id) + '">' +
      '<div class="row"><span class="lamp ' + st.status + '"></span><span>' + (a.emoji || "") + '</span><span class="nm">' + esc(a.imie) + "</span></div>" +
      '<span class="role">' + esc(a.rola || "") + "</span></button>";
  }

  function renderOrg() {
    var root = $("#view-org");
    var Z = w.RSS_ZESPOL || [];
    var by = {};
    Z.forEach(function (a) { by[a.id] = a; });
    var honor = Z.filter(function (a) { return a.typ === "honor"; })[0];
    var rh = ["rovi", "x", "prof", "pomysly", "weryfikator", "marketing"];
    var bm = ["bluemold", "ksiazka", "suno", "yt", "studio", "tiktok", "playstudio", "github", "wymowa"];
    var opt = ["optymalizacja", "parafraza", "furtka"];
    var solo = ["novi", "budzet"];
    var aktual = (w.RSS_STATUSY && w.RSS_STATUSY.aktualizacja) || "";
    root.innerHTML =
      '<div class="view-head"><h2>Struktura firmy</h2>' +
      '<p class="meta">Szefowie i działy. Lampki: ' + (aktual ? esc(aktual) + " (Europe/Berlin)" : "z pliku statusów") + ". Źródło: ZESPOL.md + data/statusy.json.</p></div>" +
      '<div class="view-body org-tree">' +
        (honor ? '<button type="button" class="org-card org-honor" data-id="gabinet"><img src="assets/rovi-shadow.jpg" width="72" height="72" alt="Rovi w fedorze i Shadow na prawym ramieniu"><div><b>Rovi &amp; Shadow</b><span class="role">Gabinet honorowy · kanon serii. Polecenia dla szefa zespołu idą do Rovi Here.</span></div></button>' : "") +
        '<div class="org-stem"></div>' +
        orgCard(by.mostek) +
        '<div class="org-stem"></div>' +
        '<div class="org-cols">' +
          '<div class="org-col"><h3>Rovi Here</h3>' + rh.map(function (id) { return orgCard(by[id]); }).join("") + "</div>" +
          '<div class="org-col"><h3>Blue Mold</h3>' + bm.map(function (id) { return orgCard(by[id]); }).join("") + "</div>" +
          '<div class="org-col"><h3>Optymalizacja</h3>' + opt.map(function (id) { return orgCard(by[id]); }).join("") + "</div>" +
          '<div class="org-col"><h3>Nadzór i wsparcie</h3>' + solo.map(function (id) { return orgCard(by[id]); }).join("") + "</div>" +
        "</div></div>";
    $$("#view-org [data-id]").forEach(function (b) {
      b.onclick = function () { if (w.RSS && w.RSS.openAgent) w.RSS.openAgent(b.getAttribute("data-id")); };
    });
  }

  function renderKal() {
    var root = $("#view-kal");
    var k = (firma && firma.kalendarz) || {};
    var rytm = k.rytm || [];
    var rows = rytm.map(function (r) {
      return "<tr><td>" + esc(r.godz) + "</td><td>" + esc(r.kto) + "</td><td>" + esc(r.co) + "</td></tr>";
    }).join("");
    var poz = (k.pozycje || []).map(function (p) {
      var link = p.url ? ' — <a href="' + esc(p.url) + '" target="_blank" rel="noopener noreferrer">otwórz</a>' : "";
      return '<li class="glass"><b>' + esc(p.data) + (p.godz ? " " + esc(p.godz) : "") + "</b> " + esc(p.co) + link +
        '<div class="note-src">' + esc(p.zrodlo || "") + "</div></li>";
    }).join("");
    root.innerHTML =
      '<div class="view-head"><h2>Kalendarz</h2>' +
      '<p class="meta">Rytm z ' + esc(k.zrodlo_rytm || "koordynacja/KALENDARZ.md") + ". Tabela poniżej jest zapisem ze stanu na 08.11.2026 — nie nadpisujemy jej milcząco nowszym planem.</p></div>" +
      '<div class="view-body">' +
        (k.rytm_aktualizacja ? '<div class="glass" style="padding:12px 14px;margin-bottom:16px"><b>Późniejsza aktualizacja rytmu</b><p class="opis">' + esc(k.rytm_aktualizacja) + '</p><p class="note-src">Źródło: ' + esc(k.rytm_aktualizacja_zrodlo || "") + "</p></div>" : "") +
        (rows ? '<table class="rytm-table"><thead><tr><th>Godz.</th><th>Kto</th><th>Co</th></tr></thead><tbody>' + rows + "</tbody></table>" : '<p class="opis">Brak tabeli rytmu w pliku.</p>') +
        "<h3 style=\"font-size:14px;letter-spacing:1px;text-transform:uppercase;color:var(--mold2)\">Plan publikacji (z pliku planu YT)</h3>" +
        '<ul class="plan-list">' + (poz || '<li class="opis">Brak pozycji w planie.</li>') + "</ul>" +
      "</div>";
  }

  function renderDec() {
    var root = $("#view-dec");
    var d = (firma && firma.decyzje) || {};
    var cards = (d.punkty || []).map(function (p) {
      return '<article class="dec-card"><h3>' + esc(p.nr) + ". " + esc(p.tytul) + "</h3><p>" + esc(p.tresc) + "</p></article>";
    }).join("");
    root.innerHTML =
      '<div class="view-head"><h2>Decyzje</h2>' +
      '<p class="meta">Źródło: ' + esc(d.zrodlo || "koordynacja/DECYZJE.md") + (d.stan_na ? " · stan na " + esc(d.stan_na) : "") + " (Europe/Berlin).</p></div>" +
      '<div class="view-body"><div class="dec-list">' + cards + "</div>" +
      (d.rozstrzygniecie ? '<div class="glass" style="padding:14px;margin-top:16px"><h3 style="margin:0 0 8px">Rozstrzygnięcie użytkownika</h3><p class="opis" style="white-space:pre-wrap">' + esc(d.rozstrzygniecie) + "</p></div>" : "") +
      "</div>";
  }

  function renderZuz() {
    var root = $("#view-zuz");
    var z = (firma && firma.zuzycie) || {};
    var pts = z.punkty || [];
    var wdt = 640, h = 200, pad = 28;
    var svg = "";
    if (pts.length) {
      var max = 100;
      var xs = pts.map(function (_, i) { return pad + (i * (wdt - pad * 2)) / Math.max(pts.length - 1, 1); });
      var ys = pts.map(function (p) { return h - pad - (p.pct / max) * (h - pad * 2); });
      var d = xs.map(function (x, i) { return (i ? "L" : "M") + x.toFixed(1) + "," + ys[i].toFixed(1); }).join(" ");
      var area = d + " L" + xs[xs.length - 1].toFixed(1) + "," + (h - pad) + " L" + xs[0].toFixed(1) + "," + (h - pad) + " Z";
      svg = '<svg class="chart" viewBox="0 0 ' + wdt + " " + h + '" role="img" aria-label="Wykres zużycia limitu">' +
        '<defs><linearGradient id="zu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5CE6F2" stop-opacity=".35"/><stop offset="1" stop-color="#5CE6F2" stop-opacity="0"/></linearGradient></defs>' +
        '<line x1="' + pad + '" x2="' + (wdt - pad) + '" y1="' + (h - pad) + '" y2="' + (h - pad) + '" stroke="rgba(92,230,242,.25)"/>' +
        '<path d="' + area + '" fill="url(#zu)"/>' +
        '<path d="' + d + '" fill="none" stroke="#5CE6F2" stroke-width="2" filter="none"/>' +
        pts.map(function (p, i) {
          return '<circle cx="' + xs[i].toFixed(1) + '" cy="' + ys[i].toFixed(1) + '" r="4" fill="#BFF6FA" stroke="#5CE6F2"/>' +
            '<text x="' + xs[i].toFixed(1) + '" y="' + (ys[i] - 10).toFixed(1) + '" text-anchor="middle" fill="#BFF6FA" font-size="11">' + p.pct + "%</text>" +
            '<text x="' + xs[i].toFixed(1) + '" y="' + (h - 8) + '" text-anchor="middle" fill="#6B8A9E" font-size="9">' + esc(p.data.slice(5)) + "</text>";
        }).join("") + "</svg>";
    } else {
      svg = '<p class="opis">Brak odczytów procentowych w pliku.</p>';
    }
    var last = z.ostatni;
    root.innerHTML =
      '<div class="view-head"><h2>Zużycie</h2>' +
      '<p class="meta">Źródło: ' + esc(z.zrodlo || "energia/ZUZYCIE.md") + ". Tylko datowane odczyty z pliku. Ostatni: " +
      (last ? esc(String(last.pct)) + "% · " + esc(last.data) + " (Europe/Berlin)" : "brak") + ".</p></div>" +
      '<div class="view-body"><div class="glass" style="padding:12px 8px 4px">' + svg + "</div>" +
      '<div class="chart-legend">' + pts.map(function (p) { return "<span>" + esc(p.data) + " — " + p.pct + "% · " + esc(p.cytat) + "</span>"; }).join("") + "</div></div>";
  }

  function emptyGoal(label) {
    return '<div class="goal-box"><label>' + esc(label) + '</label><div class="empty">brak w plikach</div></div>';
  }
  function numOrEmpty(v, suffix) {
    if (v == null || v === "") return '<div class="num empty">brak danych</div>';
    return '<div class="num">' + esc(String(v)) + (suffix ? '<span style="font-size:18px;margin-left:8px;color:var(--mute);font-weight:500">' + esc(suffix) + "</span>" : "") + "</div>";
  }

  function renderZar() {
    var root = $("#view-zar");
    var z = (firma && firma.zarabianie) || {};
    var yt = z.youtube || {};
    var x = z.x || {};
    var tt = z.tiktok || {};
    root.innerHTML =
      '<div class="view-head"><h2>Zarabianie</h2>' +
      '<p class="meta">' + esc(z.uwaga || "Tylko potwierdzone odczyty. Cele — tylko jeśli są w plikach.") + "</p></div>" +
      '<div class="view-body"><div class="stat-grid">' +
        '<article class="stat-card"><div class="k">YouTube · @RoviHere</div>' +
          numOrEmpty(yt.subskrybenci, "subskrybentów") +
          '<div class="sub">' + (yt.filmy != null ? esc(String(yt.filmy)) + " filmów" : "liczba filmów: brak danych") + "</div>" +
          '<div class="src">' + (yt.data ? "Odczyt: " + esc(yt.data) + (yt.godz ? " " + esc(yt.godz) : "") + " (" + esc(yt.strefa || "Europe/Berlin") + ")" : "brak daty odczytu") +
          (yt.zrodlo ? " · " + esc(yt.zrodlo) : "") + "</div>" +
          emptyGoal("Cel: subskrybenci") + emptyGoal("Cel (opis)") +
        "</article>" +
        '<article class="stat-card"><div class="k">X · @RoviHere</div>' +
          numOrEmpty(x.obserwujacy, "obserwujących") +
          '<div class="sub"> </div>' +
          '<div class="src">' + (x.data ? "Odczyt: " + esc(x.data) + (x.godz ? " " + esc(x.godz) : "") + " (" + esc(x.strefa || "Europe/Berlin") + ")" : "brak daty odczytu") +
          (x.zrodlo ? " · " + esc(x.zrodlo) : "") + "</div>" +
          emptyGoal("Cel: obserwujący") + emptyGoal("Cel (opis)") +
        "</article>" +
        '<article class="stat-card"><div class="k">TikTok · @roviheree</div>' +
          numOrEmpty(tt.obserwujacy, "obserwujących") +
          '<div class="src">' + esc(tt.uwaga || "brak danych") + "</div>" +
          emptyGoal("Cel: obserwujący") +
        "</article>" +
      "</div></div>";
  }

  function renderKan() {
    var root = $("#view-kan");
    var ks = (firma && firma.kanaly) || [];
    root.innerHTML =
      '<div class="view-head"><h2>Kanały</h2><p class="meta">Publiczne adresy z materiałów firmy. Nic nie dopisujemy.</p></div>' +
      '<div class="view-body"><div class="kanal-grid">' + ks.map(function (k) {
        return '<a class="kanal-card" href="' + esc(k.url) + '" target="_blank" rel="noopener noreferrer">' +
          '<div class="h">' + esc(k.nazwa) + "</div><b>" + esc(k.uchwyt) + "</b>" +
          '<div class="u">' + esc(k.url) + "</div>" +
          (k.uwaga ? '<p class="opis" style="margin-top:8px;font-size:12px;color:var(--mute)">' + esc(k.uwaga) + "</p>" : "") +
          "</a>";
      }).join("") + "</div></div>";
  }


  function artById(id) {
    var list = (articles && articles.artykuly) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function renderArt() {
    var root = $("#view-art");
    if (!root) return;
    var list = (articles && articles.artykuly) || [];
    if (artOpen) {
      var a = artById(artOpen);
      if (!a) { artOpen = null; }
      else {
        var links = "";
        if (a.x_url) links += '<a class="btn primary" href="' + esc(a.x_url) + '" target="_blank" rel="noopener noreferrer">Oryginał na X</a>';
        if (a.x_post_url && a.x_post_url !== a.x_url) links += '<a class="btn" href="' + esc(a.x_post_url) + '" target="_blank" rel="noopener noreferrer">Post na X</a>';
        if (a.youtube_url) links += '<a class="btn" href="' + esc(a.youtube_url) + '" target="_blank" rel="noopener noreferrer">Film na YouTube</a>';
        if (!a.x_url) links += '<span class="uwaga">brak linku do oryginału na X</span>';
        var st = a.status_publikacji === "opublikowany" ? "Opublikowany na X" : "W plikach firmy — publikacja na X niepotwierdzona";
        root.innerHTML =
          '<div class="reader">' +
            '<button type="button" class="btn ghost back" id="artBack">← Wszystkie artykuły</button>' +
            '<div class="reader-hero">' + (a.okladka ? '<img src="' + esc(a.okladka) + '" alt="">' : "") +
            '<div class="reader-meta">' + esc((a.seria === "nauka" ? "Profesor" : a.autor || "Artykuł") + " · " + st) +
            (a.data ? " · " + esc(a.data) + (a.godz ? " " + esc(a.godz) : "") + " (" + esc(a.strefa || "Europe/Berlin") + ")" : "") + "</div>" +
            "<h1>" + esc(a.tytul) + "</h1>" +
            (a.podtytul ? '<p class="dek">' + esc(a.podtytul) + "</p>" : "") +
            '<div>' + badges({ typ: "artykul", etykiety: a.etykiety || [], brak_zrodla: false }) + "</div>" +
            '<div class="reader-links">' + links + "</div>" +
            (a.uwaga ? '<p class="uwaga">' + esc(a.uwaga) + "</p>" : "") +
            "</div>" +
            '<div class="reader-body">' + (a.html || "") + "</div>" +
            (a.plik ? '<p class="note-src">Źródło pliku: ' + esc(a.plik) + "</p>" : "") +
          "</div>";
        $("#artBack").onclick = function () { artOpen = null; renderArt(); };
        return;
      }
    }
    var cards = list.map(function (a) {
      return '<button type="button" class="glass art-card" data-id="' + esc(a.id) + '">' +
        (a.okladka ? '<img src="' + esc(a.okladka) + '" alt="">' : "<div></div>") +
        '<div class="pad"><div class="k">' + esc((a.seria === "nauka" ? "Profesor · nauka" : "sprawa UFO") + (a.data ? " · " + a.data : "")) + "</div>" +
        "<h3>" + esc(a.tytul) + "</h3>" +
        '<div>' + badges({ typ: "artykul", etykiety: a.etykiety || [], brak_zrodla: false }) +
        (a.status_publikacji === "opublikowany" ? '<span class="badge fakt">na X</span>' : '<span class="badge brak_zrodla">brak linku X</span>') +
        "</div>" +
        (a.podtytul ? "<p>" + esc(a.podtytul) + "</p>" : "") +
        "</div></button>";
    }).join("");
    root.innerHTML =
      '<div class="view-head"><h2>Artykuły</h2>' +
      '<p class="meta">' + esc((articles && articles.uwaga) || "Tylko artykuły, bez zwykłych postów i komentarzy.") + "</p></div>" +
      '<div class="view-body"><div class="art-list">' + (cards || '<p class="opis">Brak artykułów w katalogu.</p>') + "</div></div>";
    $$("#view-art .art-card").forEach(function (b) {
      b.onclick = function () { artOpen = b.getAttribute("data-id"); renderArt(); };
    });
  }

  function renderVid() {
    var root = $("#view-vid");
    if (!root) return;
    var pack = videos || {};
    var filmy = pack.filmy || [];
    var wspr = pack.wsparcie || {};
    var ab = pack.abonament || {};
    var cards = filmy.map(function (f) {
      var actions = "";
      if (f.ogladaj_url) actions += '<a class="btn primary" href="' + esc(f.ogladaj_url) + '" target="_blank" rel="noopener noreferrer">Obejrzyj</a>';
      if (f.pobierz_url) actions += '<a class="btn" href="' + esc(f.pobierz_url) + '" target="_blank" rel="noopener noreferrer">Pobierz</a>';
      if (!actions) actions += '<span class="uwaga">brak linku do pliku</span>';
      return '<article class="glass vid-card">' +
        (f.okladka ? '<img src="' + esc(f.okladka) + '" alt="' + esc(f.tytul) + '">' : "") +
        '<div class="pad"><h3>' + esc(f.tytul) + "</h3>" +
        '<div class="vid-actions">' + actions + "</div>" +
        '<p class="opis">' + esc(f.opis || "") + "</p>" +
        '<p class="support-line">' + esc(wspr.linia || "") +
        (wspr.suno ? '<br><a href="' + esc(wspr.suno) + '" target="_blank" rel="noopener noreferrer">' + esc(wspr.suno) + "</a>" : "") +
        "</p></div></article>";
    }).join("");
    root.innerHTML =
      '<div class="view-head"><h2>Filmy do pobrania</h2>' +
      '<p class="meta">' + esc(pack.uwaga || "") + "</p></div>" +
      '<div class="view-body">' +
        '<p class="note-arch">' + esc(ab.opis_en || "Downloads are free. No login and no payments in this version.") + "</p>" +
        '<div class="vid-grid">' + (cards || '<p class="opis">Brak filmów z potwierdzonym linkiem.</p>') + "</div>" +
      "</div>";
  }

  function renderMore() {
    var root = $("#view-more");
    var szef = w.RSS && w.RSS.isSzef && w.RSS.isSzef();
    var tiles = [
      ["art", "¶", "Artykuły", "X Articles i dłuższe teksty"],
      ["vid", "▶", "Filmy", "Blue Mold do obejrzenia i pobrania"],
      ["org", "☰", "Struktura", "Szefowie i działy"],
      ["kal", "◷", "Kalendarz", "Rytm i plan publikacji"],
      ["zar", "◈", "Zarabianie", "Odczyty z plików"],
      ["kan", "↗", "Kanały", "YT, X, TikTok, Suno"],
      ["settings", "⬡", "Szef / Łącze", szef ? "Tryb Szef włączony" : "Wpisz token, aby odblokować"]
    ];
    if (szef) {
      tiles = tiles.concat([
        ["cmd", "✉", "Polecenia", "Sterowanie działami"],
        ["list", "≡", "Rejestr", "Ostatnie polecenia"],
        ["dec", "▣", "Decyzje", "Z odprawy 21.11"],
        ["zuz", "▴", "Zużycie", "Limit tygodniowy"]
      ]);
    }
    root.innerHTML =
      '<div class="view-head"><h2>Więcej</h2><p class="meta">Pozostałe panele. Na laptopie cała nawigacja jest z lewej strony.</p></div>' +
      '<div class="view-body"><div class="more-grid">' + tiles.map(function (t) {
        return '<button type="button" class="more-tile" data-tab="' + t[0] + '"><span class="ico">' + t[1] + "</span><b>" + t[2] + "</b><span>" + t[3] + "</span></button>";
      }).join("") + "</div></div>";
    $$("#view-more [data-tab]").forEach(function (b) {
      b.onclick = function () { if (w.RSS && w.RSS.goTab) w.RSS.goTab(b.getAttribute("data-tab")); };
    });
  }

  function lobeTabFor(lobe) {
    var map = (w.RSS && w.RSS.brain3d && w.RSS.brain3d.lobeToTab) || {};
    var tab = map[lobe];
    if (tab === "cmd" && !(w.RSS.isSzef && w.RSS.isSzef())) tab = "biuro";
    if (tab === "list" && !(w.RSS.isSzef && w.RSS.isSzef())) tab = "org";
    if ((tab === "zuz" || tab === "dec") && !(w.RSS.isSzef && w.RSS.isSzef())) tab = "org";
    return tab;
  }

  function mountWorld() {
    var el = document.getElementById("brain-world");
    var api = w.RSS && w.RSS.brain3d;
    if (!el || !api || !api.canWebGL || !api.canWebGL()) {
      document.body.classList.remove("brain-shell");
      if (el) el.hidden = true;
      return false;
    }
    document.body.classList.add("brain-shell");
    el.hidden = false;
    el.setAttribute("aria-hidden", "false");
    var vis = (bibl && biblMode === "3d") ? visibleIds() : null;
    var opts = {
      nodes: (bibl && bibl.wezly) || [],
      edges: (bibl && bibl.krawedzie) || [],
      visible: vis,
      onOpen: openNode,
      onNavigate: function (lobe, tab) {
        tab = tab || lobeTabFor(lobe);
        if (tab && w.RSS.goTab) w.RSS.goTab(tab);
      },
      tab: document.body.getAttribute("data-view") || "biuro"
    };
    if (api.isMounted && api.isMounted()) {
      if (api.setOnNavigate) api.setOnNavigate(opts.onNavigate);
      if (api.setGraph && bibl) api.setGraph(opts);
      api.resize && api.resize();
      return true;
    }
    var ok = api.mount(el, opts);
    if (!ok) {
      document.body.classList.remove("brain-shell");
      el.hidden = true;
      return false;
    }
    return true;
  }

  function placeFloor() {
    var slot = document.getElementById("biuroSlot");
    var floor = document.getElementById("floor-wrap");
    if (!slot || !floor) return;
    if (document.body.classList.contains("brain-shell")) {
      if (floor.parentNode !== slot) slot.appendChild(floor);
    } else if (floor.parentNode === slot) {
      document.body.insertBefore(floor, document.getElementById("stage"));
    }
  }

  function syncBrainShell(tab) {
    var api = w.RSS && w.RSS.brain3d;
    var shell = document.body.classList.contains("brain-shell");
    if (!shell && canBrain()) mountWorld();
    shell = document.body.classList.contains("brain-shell");
    var hide = !shell || (tab === "bibl" && biblMode !== "3d");
    document.body.classList.toggle("brain-hidden", hide);
    if (api && api.setShellMode && shell) api.setShellMode(tab);
    if (api && api.setLibraryMode) api.setLibraryMode(tab === "bibl" && biblMode === "3d");
    placeFloor();
    if (api && api.resize) setTimeout(function () { api.resize(); }, 40);
  }

  function render(tab) {
    setLabel(tab);
    syncBrainShell(tab);
    if (tab === "biuro") { placeFloor(); return; }
    if (tab === "bibl") { renderBibl(); return; }
    if (tab === "art") { renderArt(); return; }
    if (tab === "vid") { renderVid(); return; }
    if (tab === "more") { renderMore(); return; }
    if (painted[tab]) return;
    if (tab === "org") renderOrg();
    else if (tab === "kal") renderKal();
    else if (tab === "dec") renderDec();
    else if (tab === "zuz") renderZuz();
    else if (tab === "zar") renderZar();
    else if (tab === "kan") renderKan();
    painted[tab] = true;
  }

  /* PWA install + SW */
  var deferredPrompt = null;
  w.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    var b = $("#btnInstall");
    if (b) b.hidden = false;
  });
  function bindInstall() {
    var b = $("#btnInstall");
    if (!b) return;
    b.onclick = function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () { deferredPrompt = null; b.hidden = true; });
    };
  }
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }

  function applyHudCollapse(on) {
    document.body.classList.toggle("hud-collapsed", !!on);
    var b = document.getElementById("hudToggle");
    if (b) {
      b.setAttribute("aria-expanded", on ? "false" : "true");
      b.textContent = on ? "Rozwiń panel" : "Zwiń panel";
    }
    try { localStorage.setItem("rss-hud-collapsed", on ? "1" : "0"); } catch (e) {}
    var api = w.RSS && w.RSS.brain3d;
    if (api && api.resize) setTimeout(function () { api.resize(); }, 50);
  }
  function bindHudToggle() {
    var b = document.getElementById("hudToggle");
    if (!b || b._rssBound) return;
    b._rssBound = true;
    var saved = false;
    try { saved = localStorage.getItem("rss-hud-collapsed") === "1"; } catch (e) {}
    applyHudCollapse(saved);
    b.onclick = function () {
      applyHudCollapse(!document.body.classList.contains("hud-collapsed"));
    };
  }
  bindHudToggle();

  w.RSS = w.RSS || {};
  w.RSS.views = { render: render, setLabel: setLabel, labels: LABELS, openNode: openNode, getCy: function () { return cy; }, syncBrainShell: syncBrainShell, mountWorld: mountWorld, applyHudCollapse: applyHudCollapse };
  w.addEventListener("rss-brain-progress", function (ev) {
    var v = ev.detail && ev.detail.progress;
    if (v == null) return;
    var sl = $("#biblInfectSlider"), pct = $("#biblInfectPct");
    if (sl && document.activeElement !== sl) sl.value = String(Math.round(v * 100));
    if (pct) pct.textContent = Math.round(v * 100) + "%";
  });
  w.addEventListener("rss-brain-ready", function () {
    mountWorld();
    var tab = document.body.getAttribute("data-view") || "biuro";
    syncBrainShell(tab);
    if (tab === "bibl" && biblMode === "3d") {
      painted.bibl = false;
      renderBibl();
    }
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindInstall);
  else bindInstall();
})(window);
