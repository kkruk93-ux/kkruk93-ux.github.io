/* Klient arkusza „RoviHere Polecenia” — ten sam protokół co Blue Mold Centrum.
   Token i adres /exec są tylko w localStorage tej przeglądarki. Nigdy w plikach,
   logach ani w interfejsie poza polem typu password. */
(function (w) {
  "use strict";
  var K_URL = "bm-api-url";
  var K_TOK = "bm-api-token";
  var K_CACHE = "rss-cmd-cache";
  var DOMYSLNY_URL = "https://script.google.com/macros/s/AKfycbw3UCB26CXzg4vAuljzxGTMDmvqGsCr7SfVGqYayBhcTX7o1IIeQzFw_HHIH9s_7YTi/exec";
  var MAKS = 2000;
  var ZRODLO = "Rovi & Shadow Studio";

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) {
    try {
      if (v == null || v === "") localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch (e) {}
  }

  function cfg() {
    return { url: (lsGet(K_URL) || DOMYSLNY_URL).trim(), token: lsGet(K_TOK) || "" };
  }
  function ok() { var c = cfg(); return !!(c.url && c.token); }
  function host(u) {
    try { return new URL(u).host; } catch (e) { return ""; }
  }

  function zadanie(metoda, dane) {
    var c = cfg();
    if (!c.url || !c.token) return Promise.reject(new Error("łącze nieskonfigurowane"));
    var ctl = w.AbortController ? new AbortController() : null;
    var tm = setTimeout(function () { if (ctl) ctl.abort(); }, 20000);
    var url = c.url;
    var opt = { method: metoda, redirect: "follow", cache: "no-store", credentials: "omit" };
    dane = dane || {};
    if (metoda === "GET") {
      var q = Object.keys(dane).map(function (k) {
        return encodeURIComponent(k) + "=" + encodeURIComponent(dane[k]);
      });
      q.push("token=" + encodeURIComponent(c.token), "_=" + Date.now());
      url += (url.indexOf("?") < 0 ? "?" : "&") + q.join("&");
    } else {
      dane.token = c.token;
      opt.headers = { "Content-Type": "text/plain;charset=utf-8" };
      opt.body = JSON.stringify(dane);
    }
    if (ctl) opt.signal = ctl.signal;
    return fetch(url, opt).then(function (r) {
      return r.text().then(function (t) { return { r: r, t: t }; });
    }).then(function (x) {
      clearTimeout(tm);
      var j;
      try { j = JSON.parse(x.t); } catch (e) {
        throw new Error("odpowiedź nie jest JSON (HTTP " + x.r.status + ") – sprawdź adres /exec i dostęp „Każdy”");
      }
      if (!j || j.ok !== true) throw new Error((j && j.blad) || "nieznany błąd backendu");
      return j;
    }, function (e) {
      clearTimeout(tm);
      throw new Error(e && e.name === "AbortError" ? "przekroczony czas (20 s)" : "brak połączenia z backendem");
    });
  }

  function trescDoWysylki(agent, tekst) {
    var t = String(tekst || "").trim();
    if (agent && agent.legacy === false) {
      var tag = "[Dział: " + agent.wyslijJako + "]\n";
      if (t.indexOf(tag) !== 0) t = tag + t;
    }
    if (t.length > MAKS) t = t.slice(0, MAKS);
    return t;
  }

  function dodaj(agent, tekst, prio) {
    var t = trescDoWysylki(agent, tekst);
    if (!t) return Promise.reject(new Error("pusta treść polecenia"));
    return zadanie("POST", {
      akcja: "dodaj",
      dzial: agent.wyslijJako,
      tresc: t,
      priorytet: prio || "normalny",
      zrodlo: ZRODLO
    });
  }

  function lista(n) {
    return zadanie("GET", { akcja: "lista", n: n || 50 });
  }

  function ping() {
    return zadanie("GET", { akcja: "ping" });
  }

  function saveLink(url, token) {
    lsSet(K_URL, String(url || "").trim());
    lsSet(K_TOK, String(token || "").trim());
  }

  function clearLink() {
    lsSet(K_URL, "");
    lsSet(K_TOK, "");
    lsSet(K_CACHE, "");
  }

  function loadCache() {
    try {
      var c = JSON.parse(lsGet(K_CACHE) || "null");
      if (c && Array.isArray(c.lista)) return c;
    } catch (e) {}
    return { lista: null, czas: "" };
  }

  function saveCache(listaArr, czas) {
    lsSet(K_CACHE, JSON.stringify({ lista: listaArr, czas: czas || "" }));
  }

  w.RSS = w.RSS || {};
  w.RSS.api = {
    DOMYSLNY_URL: DOMYSLNY_URL,
    MAKS: MAKS,
    ZRODLO: ZRODLO,
    cfg: cfg,
    ok: ok,
    host: host,
    zadanie: zadanie,
    dodaj: dodaj,
    lista: lista,
    ping: ping,
    saveLink: saveLink,
    clearLink: clearLink,
    loadCache: loadCache,
    saveCache: saveCache,
    trescDoWysylki: trescDoWysylki
  };
})(window);
