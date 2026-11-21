#!/usr/bin/env python3
"""Buduje data/firma.json i data/biblioteka.json wyłącznie z plików na boxie.
Nic nie wymyśla: brak liczby albo źródła = puste pole / „brak źródła”."""
from __future__ import annotations

import json, re, datetime
from pathlib import Path

ROOT = Path("/workspace/rovihere")
OUT = Path(__file__).resolve().parent / "data"
TZ = "Europe/Berlin"

OFFICIAL_HINTS = (
    "blue book", "bluebook", "project blue book",
    "archives.gov", "nara.gov", "national archives", "nara",
    "foia", "cia.gov", "cia.gov/readingroom", "crest",
    "nsarchive", "nsarchive2.gwu.edu", "national security archive",
    "gutenberg.org", "catalog.archives", "fold3",
    "af.mil", "usaf", "defense.gov", "history.navy.mil",
    "loc.gov", "nasa.gov",
)

WIKI_HINTS = ("wikipedia.org", "wiki/")

def now_berlin() -> str:
    try:
        from zoneinfo import ZoneInfo
        return datetime.datetime.now(ZoneInfo("Europe/Berlin")).strftime("%Y-%m-%d %H:%M")
    except Exception:
        return datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

def read(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return ""

def is_official(url: str, title: str = "") -> bool:
    t = (url + " " + title).lower()
    if "wikipedia" in t:
        return False
    return any(h in t for h in OFFICIAL_HINTS) or "project_blue_book" in t or "project-blue-book" in t

def slugify(s: str) -> str:
    s = (s or "").lower()
    s = re.sub(r"[#]+", "", s)
    s = re.sub(r"[^a-z0-9ąęćłńóśźż]+", "-", s, flags=re.I)
    return s.strip("-")[:60] or "x"

def extract_urls(text: str) -> list[dict]:
    out, seen = [], set()
    for m in re.finditer(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", text):
        title, url = m.group(1).strip(), m.group(2).strip()
        if url in seen:
            continue
        seen.add(url)
        out.append({"title": title, "url": url, "typ": "dokument_zrodlowy" if is_official(url, title) else "opracowanie"})
    for m in re.finditer(r"(https?://[^\s\)\]\>\"']+)", text):
        url = m.group(1).rstrip(".,;)")
        if url in seen:
            continue
        seen.add(url)
        out.append({"title": "", "url": url, "typ": "dokument_zrodlowy" if is_official(url) else "opracowanie"})
    return out

def labels_from_text(text: str) -> list[str]:
    labs = []
    low = text
    if re.search(r"Label:\s*FACT\b|^\s*\*\*Label:\s*FACT\*\*|\bFAKT\s*:", low, re.I | re.M):
        labs.append("fakt")
    if re.search(r"Fakty\s*\(weryfikacja", low, re.I):
        if "fakt" not in labs:
            labs.append("fakt")
    if re.search(r"TEORIA\s*SPISKOW|conspiracy\s*theor|Label:\s*CONSPIRACY", low, re.I):
        labs.append("teoria_spiskowa")
    elif re.search(r"Label:\s*THEORY\b|^\s*TEORIA\s*:|\*\*TEORIA\*\*", low, re.I | re.M):
        labs.append("teoria")
    return labs

# ---------- usage chart from ZUZYCIE.md ----------
def parse_zuzycie(text: str) -> list[dict]:
    pts = []
    # dated weekly % readings only, not "reset za 7 dni"
    for m in re.finditer(
        r"(?P<data>\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{4})[^\n]{0,80}?(?P<pct>\d+(?:[.,]\d+)?)\s*%",
        text,
    ):
        raw = m.group("data")
        if "." in raw and "-" not in raw:
            d, mo, y = raw.split(".")
            data = f"{y}-{int(mo):02d}-{int(d):02d}"
        else:
            data = raw
        # skip false positives like "15%" meaning something else? keep if nearby words
        ctx = text[max(0, m.start()-70): m.end()+40].lower()
        if not any(w in ctx for w in ("tydzień", "tygodniow", "tygodnia", "zuży", "odczyt", "premium", "tydzień")):
            # still allow "40%, reset" / "tydzień 59%"
            if "tydzień" not in ctx and "tygod" not in ctx and "zuży" not in ctx and "odczyt" not in ctx and "premium" not in ctx:
                continue
        pct = float(m.group("pct").replace(",", "."))
        if pct > 100:
            continue
        pts.append({"data": data, "pct": pct, "cytat": text[m.start():m.end()]})
    # also "tydzień 14,1%" with date in same bullet
    for m in re.finditer(
        r"(?P<data>\d{4}-\d{2}-\d{2})[^\n]{0,120}?tydzień\s+(?P<pct>\d+(?:[.,]\d+)?)\s*%",
        text, re.I,
    ):
        data, pct = m.group("data"), float(m.group("pct").replace(",", "."))
        if not any(p["data"] == data and abs(p["pct"]-pct)<0.05 for p in pts):
            pts.append({"data": data, "pct": pct, "cytat": m.group(0)[:80]})
    # 2026-11-21 09:54: 54%
    for m in re.finditer(r"(2026-\d{2}-\d{2})[^\n]{0,40}?(\d+(?:[.,]\d+)?)\s*%\s+zużycia", text, re.I):
        data, pct = m.group(1), float(m.group(2).replace(",", "."))
        if not any(p["data"] == data and abs(p["pct"]-pct)<0.05 for p in pts):
            pts.append({"data": data, "pct": pct, "cytat": m.group(0)})
    # „Tygodniowe: 40%” under the last dated heading in the same section
    last_date = None
    for line in text.splitlines():
        md = re.search(r"(20\d{2}-\d{2}-\d{2})", line) or re.search(r"(\d{1,2}\.\d{1,2}\.(20\d{2}))", line)
        if md:
            raw = md.group(0)
            if "." in raw and "-" not in raw:
                d, mo, y = raw.split(".")
                last_date = f"{y}-{int(mo):02d}-{int(d):02d}"
            else:
                last_date = raw
        m2 = re.search(r"(?:Tygodniowe|tydzień)\s*:\s*(\d+(?:[.,]\d+)?)\s*%", line, re.I)
        if m2 and last_date:
            pct = float(m2.group(1).replace(",", "."))
            pts.append({"data": last_date, "pct": pct, "cytat": line.strip()[:120]})

    # unique by date+pct, sort
    uniq = {}
    for p in pts:
        uniq[(p["data"], p["pct"])] = p
    return sorted(uniq.values(), key=lambda x: x["data"])

def parse_decyzje(text: str) -> list[dict]:
    items = []
    parts = re.split(r"\n(?=\d+\.\s+\*\*)", text)
    for part in parts:
        m = re.match(r"(\d+)\.\s+\*\*(.+?)\*\*\s*(.*)", part, re.S)
        if not m:
            continue
        items.append({"nr": int(m.group(1)), "tytul": m.group(2).strip(), "tresc": re.sub(r"\s+", " ", m.group(3)).strip()[:600]})
    roz = ""
    if "Rozstrzygnięcie użytkownika" in text:
        roz = text.split("Rozstrzygnięcie użytkownika", 1)[1].strip()
    return items, roz

def parse_kalendarz_rytm(text: str) -> list[dict]:
    rows = []
    in_table = False
    for line in text.splitlines():
        if line.startswith("| Godz.") or line.startswith("|---"):
            in_table = True
            continue
        if in_table:
            if not line.startswith("|"):
                in_table = False
                continue
            cols = [c.strip() for c in line.strip("|").split("|")]
            if len(cols) >= 3:
                rows.append({"godz": cols[0], "kto": cols[1], "co": cols[2]})
        if "Zasady stałe" in line:
            break
    return rows

def parse_yt_plan(path: Path) -> list[dict]:
    text = read(path)
    items = []
    # - 12.11 #034 Chiles-Whitted — https://...
    for m in re.finditer(
        r"[-*]\s+(\d{1,2}\.\d{1,2})(?:\s+(\d{2}:\d{2}))?\s+(?:(\d{2}:\d{2})\s+)?(.+?)(?:\s+[—–-]\s+(https://\S+))?\s*$",
        text, re.M,
    ):
        data, g1, g2, co, url = m.group(1), m.group(2), m.group(3), m.group(4).strip(), m.group(5)
        godz = g1 or g2 or ""
        year = "2026"
        d, mo = data.split(".")
        items.append({
            "data": f"{year}-{int(mo):02d}-{int(d):02d}",
            "godz": godz,
            "co": co,
            "url": url or "",
            "zrodlo": str(path.relative_to(ROOT)),
        })
    # Longi lines: - 15.11 #014 ...
    return items

def latest_yt_stats(text: str) -> dict:
    last = {}
    for m in re.finditer(
        r"(2026-\d{2}-\d{2})\s+~?(\d{1,2}:\d{2})[^\n]*?Kanał:\s*(\d+)\s+subskrybent\w*,\s*(\d+)\s+film",
        text,
    ):
        last = {
            "subskrybenci": int(m.group(3)),
            "filmy": int(m.group(4)),
            "data": m.group(1),
            "godz": m.group(2),
            "strefa": TZ,
            "zrodlo": "youtube/KOMENTARZE.md",
        }
    return last

def latest_x_followers() -> dict:
    files = sorted(Path(ROOT / "x").glob("2026-*.md"))
    last = {}
    for f in files:
        t = read(f)
        for m in re.finditer(r"Statystyki[^\n]{0,40}?\s+(?:(\d{2}:\d{2}))?:?\s*obserwujący\s+(\d+)", t, re.I):
            godz, n = m.group(1) or "", int(m.group(2))
            # date from filename
            data = f.stem  # 2026-11-21
            last = {
                "obserwujacy": n,
                "data": data,
                "godz": godz,
                "strefa": TZ,
                "zrodlo": f"x/{f.name}",
            }
    return last

# ---------- library graph ----------
def load_sources_json(path: Path) -> dict:
    try:
        return json.loads(read(path) or "{}")
    except Exception:
        return {}

def sources_from_json(d: dict) -> list[dict]:
    out = []
    blob = d.get("sources") or []
    if isinstance(blob, list):
        for s in blob:
            if not isinstance(s, dict):
                continue
            url = (s.get("url") or "").strip()
            title = (s.get("title") or "").strip()
            if not url:
                continue
            out.append({"title": title, "url": url, "typ": "dokument_zrodlowy" if is_official(url, title) else "opracowanie"})
    return out

def case_key(name: str) -> str:
    n = (name or "").lower()
    n = re.sub(r"^#\d+\s*", "", n)
    # drop common prefixes
    for p in ("rovi on earth files", "file"):
        n = n.replace(p, "")
    n = re.sub(r"\b(19|20)\d{2}\b", "", n)
    return slugify(n)[:40]

NODES = []
EDGES = []
SEEN = set()

def add_node(nid, **kw):
    if nid in SEEN:
        # merge labels/sources
        for n in NODES:
            if n["id"] == nid:
                for k, v in kw.items():
                    if k in ("etykiety",) and isinstance(v, list):
                        n[k] = list(dict.fromkeys((n.get(k) or []) + v))
                    elif k in ("zrodla",) and isinstance(v, list):
                        have = {x.get("url") for x in n.get(k) or []}
                        n[k] = (n.get(k) or []) + [x for x in v if x.get("url") not in have]
                    elif k == "platformy" and isinstance(v, list):
                        n[k] = list(dict.fromkeys((n.get(k) or []) + v))
                    elif not n.get(k) and v:
                        n[k] = v
                # recompute brak_zrodla
                docs = [z for z in (n.get("zrodla") or []) if z.get("typ") == "dokument_zrodlowy"]
                n["brak_zrodla"] = not bool(n.get("zrodla"))
                n["ma_dokument"] = bool(docs)
                if docs and "dokument_zrodlowy" not in n.get("etykiety", []):
                    n["etykiety"] = list(dict.fromkeys((n.get("etykiety") or []) + ["dokument_zrodlowy"]))
                break
        return
    SEEN.add(nid)
    zrodla = kw.get("zrodla") or []
    docs = [z for z in zrodla if z.get("typ") == "dokument_zrodlowy"]
    et = list(dict.fromkeys(kw.get("etykiety") or []))
    if docs and "dokument_zrodlowy" not in et:
        et.append("dokument_zrodlowy")
    kw["id"] = nid
    kw["etykiety"] = et
    kw["zrodla"] = zrodla
    kw["brak_zrodla"] = not bool(zrodla)
    kw["ma_dokument"] = bool(docs)
    NODES.append(kw)

def add_edge(a, b, typ):
    if not a or not b or a == b:
        return
    key = (a, b, typ)
    if key in SEEN:
        return
    SEEN.add("e:" + typ + a + b)
    EDGES.append({"from": a, "to": b, "typ": typ})

def collect_episodes():
    # shorts sources + md
    for f in Path(ROOT / "youtube").rglob("*sources.json"):
        if "upload_" in str(f) or "/build/" in str(f):
            continue
        d = load_sources_json(f)
        case = d.get("case") or d.get("episode") or f.parent.name
        ep = d.get("episode") or ""
        zrodla = sources_from_json(d)
        # sibling md
        md_text = ""
        for md in f.parent.glob("*.md"):
            md_text += "\n" + read(md)
            zrodla += [z for z in extract_urls(read(md)) if z["url"] not in {x["url"] for x in zrodla}]
        labs = labels_from_text(md_text)
        kind = "long" if "/dlugie/" in str(f).replace("\\", "/") else "krotki"
        plat = ["YouTube"]
        nid = "sprawa:" + case_key(case)
        add_node(nid, typ="sprawa", nazwa=case, odcinek=ep, etykiety=labs, zrodla=zrodla,
                 plik=str(f.relative_to(ROOT)), platformy=plat)
        mid = f"{kind}:{case_key(case)}"
        add_node(mid, typ=kind, nazwa=f"{ep} {case}".strip(), odcinek=ep, etykiety=labs,
                 zrodla=zrodla, plik=str(f.relative_to(ROOT)), platformy=["YouTube"])
        add_edge(nid, mid, "publikacja")
        add_edge("dzial:yt", mid, "dzial-projekt")
        add_edge("dzial:yt", nid, "dzial-projekt")

    # shorts folders without sources.json (older)
    for md in Path(ROOT / "youtube/shorts").rglob("*.md"):
        if md.name.lower() in ("readme.md", "studio_handoff.md"):
            continue
        t = read(md)
        m = re.search(r"#\s*(?:Rovi on Earth Files\s*)?(#\d+)\s*[–-]\s*(.+)", t)
        title = m.group(0) if m else md.stem
        case = m.group(2).split("·")[0].strip() if m else md.parent.name
        ep = m.group(1) if m else ""
        nid = "sprawa:" + case_key(case)
        zrodla = extract_urls(t)
        labs = labels_from_text(t)
        add_node(nid, typ="sprawa", nazwa=case, odcinek=ep, etykiety=labs, zrodla=zrodla,
                 plik=str(md.relative_to(ROOT)), platformy=["YouTube"])
        mid = "krotki:" + case_key(case)
        add_node(mid, typ="krotki", nazwa=f"{ep} {case}".strip(), odcinek=ep, etykiety=labs,
                 zrodla=zrodla, plik=str(md.relative_to(ROOT)), platformy=["YouTube"])
        add_edge(nid, mid, "publikacja")
        add_edge("dzial:yt", mid, "dzial-projekt")
        add_edge("dzial:yt", nid, "dzial-projekt")

    # TikTok packages
    for d in Path(ROOT / "tiktok").iterdir() if (ROOT / "tiktok").exists() else []:
        if not d.is_dir() or d.name.startswith("."):
            continue
        name = d.name
        # 2026-11-21_041_GreatFalls
        m = re.search(r"(\d{4}-\d{2}-\d{2}).*?(\d{3})[_-]?(.*)", name)
        case = (m.group(3).replace("_", " ") if m else name)
        nid = "sprawa:" + case_key(case or name)
        mid = "tiktok:" + case_key(case or name)
        md_text = "\n".join(read(p) for p in d.glob("*.md"))
        zrodla = extract_urls(md_text)
        labs = labels_from_text(md_text)
        add_node(nid, typ="sprawa", nazwa=case or name, etykiety=labs, zrodla=zrodla,
                 plik=str(d.relative_to(ROOT)), platformy=["TikTok"])
        add_node(mid, typ="tiktok", nazwa="TikTok " + (case or name), etykiety=labs, zrodla=zrodla,
                 plik=str(d.relative_to(ROOT)), platformy=["TikTok"])
        add_edge(nid, mid, "publikacja")
        add_edge("dzial:tiktok", mid, "dzial-projekt")
        add_edge("dzial:tiktok", nid, "dzial-projekt")

def collect_books_songs_games():
    books = [
        ("ksiazka:blekitna-plesn", "Błękitna Pleśń (tom 1 PL)", "ksiazka/"),
        ("ksiazka:blue-mold-en", "Blue Mold (EN)", "ksiazki-en/blue-mold/"),
        ("ksiazka:ghost-hull", "Ghost Hull", "ksiazki-en/ghost-hull/"),
    ]
    for nid, name, plik in books:
        if (ROOT / plik).exists():
            add_node(nid, typ="ksiazka", nazwa=name, plik=plik, platformy=[], etykiety=[], zrodla=[])
            add_edge("dzial:ksiazka", nid, "dzial-projekt")

    # songs: markdown titles in suno-rap
    for md in Path(ROOT / "suno-rap").rglob("*-suno.md"):
        if "odrzucon" in md.name or "prywatne" in str(md):
            continue
        t = read(md)
        title_m = re.search(r"^#\s+(.+)", t, re.M)
        title = title_m.group(1).strip() if title_m else md.stem.replace("-suno", "").replace("-", " ")
        # skip very long title lines
        title = title.split("–")[0].split("|")[0].strip()[:80]
        nid = "piosenka:" + slugify(title)
        add_node(nid, typ="piosenka", nazwa=title, plik=str(md.relative_to(ROOT)), platformy=["Suno"], etykiety=[], zrodla=[])
        add_edge("dzial:suno", nid, "dzial-projekt")
        # link to blue mold book if in blue-mold folder
        if "blue-mold" in str(md) and "ksiazka:blekitna-plesn" in SEEN:
            add_edge("ksiazka:blekitna-plesn", nid, "swiat")

    games = [
        ("gra:meadow-pile", "Meadow Pile 1.1", "playstudio/meadow-pile-release-1.1.0/"),
        ("gra:nimbus-yard", "Nimbus Yard 1.0", "playstudio/nimbus-yard-release-1.0.0/"),
        ("gra:twirlwood", "Twirlwood 2.0", "playstudio/twirlwood/"),
    ]
    for nid, name, plik in games:
        if (ROOT / plik).exists():
            add_node(nid, typ="gra", nazwa=name, plik=plik, platformy=[], etykiety=[], zrodla=[])
            add_edge("dzial:playstudio", nid, "dzial-projekt")

def collect_departments_decisions(decyzje):
    deps = [
        ("mostek", "Mostek"), ("novi", "Novi"), ("budzet", "Narzędzia i Budżet"),
        ("rovi", "Rovi Here"), ("x", "X"), ("prof", "Profesor"), ("pomysly", "Pomysły"),
        ("weryfikator", "Weryfikator"), ("marketing", "Marketing"),
        ("bluemold", "Blue Mold"), ("ksiazka", "Książka"), ("suno", "Suno Rap"),
        ("yt", "YouTube"), ("studio", "Technika i Studio"), ("tiktok", "TikTok"),
        ("playstudio", "Play Studio"), ("github", "GitHub"), ("wymowa", "Wymowa PL"),
        ("optymalizacja", "Optymalizacja"), ("parafraza", "Parafraza"), ("furtka", "Furtka"),
    ]
    for i, name in deps:
        add_node("dzial:" + i, typ="dzial", nazwa=name, etykiety=[], zrodla=[], plik="ZESPOL.md", platformy=[])
    # org edges
    for i in ("x", "prof", "pomysly", "weryfikator", "marketing"):
        add_edge("dzial:rovi", "dzial:" + i, "zespol")
    for i in ("ksiazka", "suno", "yt", "studio", "tiktok", "playstudio", "github", "wymowa"):
        add_edge("dzial:bluemold", "dzial:" + i, "zespol")
    for i in ("parafraza", "furtka"):
        add_edge("dzial:optymalizacja", "dzial:" + i, "zespol")
    add_edge("dzial:mostek", "dzial:rovi", "lacznik")
    add_edge("dzial:mostek", "dzial:bluemold", "lacznik")
    add_edge("dzial:mostek", "dzial:optymalizacja", "lacznik")
    add_edge("dzial:mostek", "dzial:novi", "lacznik")
    add_edge("dzial:mostek", "dzial:budzet", "lacznik")

    for d in decyzje:
        nid = "decyzja:" + str(d["nr"])
        add_node(nid, typ="decyzja", nazwa=d["tytul"], etykiety=[], zrodla=[],
                 plik="koordynacja/DECYZJE.md", opis=d["tresc"][:280], platformy=[])
        add_edge("dzial:mostek", nid, "decyzja")

def parse_rytm_nowy(plan_text: str) -> str:
    m = re.search(r"NOWY RYTM od [^\n]+", plan_text)
    return m.group(0).strip() if m else ""

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    kal_text = read(ROOT / "koordynacja/KALENDARZ.md")
    dec_text = read(ROOT / "koordynacja/DECYZJE.md")
    zuz_text = read(ROOT / "energia/ZUZYCIE.md")
    kom_text = read(ROOT / "youtube/KOMENTARZE.md")
    plan_p = ROOT / "youtube/plan-2026-11-12_2026-11-22.md"
    decyzje, roz = parse_decyzje(dec_text)
    rytm = parse_kalendarz_rytm(kal_text)
    plan_items = parse_yt_plan(plan_p) if plan_p.exists() else []
    rytm_nowy = parse_rytm_nowy(read(plan_p)) if plan_p.exists() else ""
    yt = latest_yt_stats(kom_text)
    x = latest_x_followers()
    zuzycie = parse_zuzycie(zuz_text)
    ostatnie_pct = zuzycie[-1] if zuzycie else None

    # library
    global NODES, EDGES, SEEN
    NODES, EDGES, SEEN = [], [], set()
    collect_departments_decisions(decyzje)
    collect_episodes()
    collect_books_songs_games()

    # drop official typ from non-http junk; prune empty
    for n in NODES:
        n["zrodla"] = [z for z in n.get("zrodla") or [] if str(z.get("url", "")).startswith("http")]
        docs = [z for z in n["zrodla"] if z.get("typ") == "dokument_zrodlowy"]
        n["ma_dokument"] = bool(docs)
        n["brak_zrodla"] = not bool(n["zrodla"])
        if docs and "dokument_zrodlowy" not in n.get("etykiety", []):
            n["etykiety"] = list(dict.fromkeys((n.get("etykiety") or []) + ["dokument_zrodlowy"]))
        elif n["brak_zrodla"] and n.get("typ") == "sprawa":
            n["uwaga_zrodla"] = "brak źródła"

    firma = {
        "wygenerowano": now_berlin(),
        "strefa": TZ,
        "uwaga": "Dane tylko z plików na boxie. Brak liczby = puste pole. Nic nie zostało wymyślone.",
        "kanaly": [
            {"id": "yt", "nazwa": "YouTube", "uchwyt": "@RoviHere", "url": "https://www.youtube.com/@RoviHere"},
            {"id": "tiktok", "nazwa": "TikTok", "uchwyt": "@roviheree", "url": "https://www.tiktok.com/@roviheree"},
            {"id": "x", "nazwa": "X", "uchwyt": "@RoviHere", "url": "https://x.com/RoviHere"},
            {"id": "suno", "nazwa": "Suno", "uchwyt": "@kkruk93", "url": "https://suno.com/@kkruk93"},
            {"id": "site", "nazwa": "Strona (GitHub Pages)", "uchwyt": "kkruk93-ux.github.io",
             "url": "https://kkruk93-ux.github.io/",
             "uwaga": "Główne repo kkruk93-ux.github.io w DECYZJE.md (pkt 10, 21.11.2026) jest jeszcze niezałożone. Działa m.in. https://kkruk93-ux.github.io/rovi-lingo/ i https://kkruk93-ux.github.io/twirlwood/."},
        ],
        "kalendarz": {
            "zrodlo_rytm": "koordynacja/KALENDARZ.md (stan na 08.11.2026)",
            "rytm": rytm,
            "rytm_aktualizacja": rytm_nowy or None,
            "rytm_aktualizacja_zrodlo": "youtube/plan-2026-11-12_2026-11-22.md" if rytm_nowy else None,
            "pozycje": plan_items,
        },
        "decyzje": {
            "zrodlo": "koordynacja/DECYZJE.md",
            "stan_na": "2026-11-21",
            "punkty": decyzje,
            "rozstrzygniecie": roz,
        },
        "zuzycie": {
            "zrodlo": "energia/ZUZYCIE.md",
            "punkty": zuzycie,
            "ostatni": ostatnie_pct,
        },
        "zarabianie": {
            "uwaga": "Tylko potwierdzone odczyty z plików. Cele (target) — brak w plikach, pola puste.",
            "youtube": {
                "subskrybenci": yt.get("subskrybenci"),
                "filmy": yt.get("filmy"),
                "data": yt.get("data"),
                "godz": yt.get("godz"),
                "strefa": yt.get("strefa"),
                "zrodlo": yt.get("zrodlo"),
                "cel_subskrybenci": None,
                "cel_opis": None,
            },
            "x": {
                "obserwujacy": x.get("obserwujacy"),
                "data": x.get("data"),
                "godz": x.get("godz"),
                "strefa": x.get("strefa"),
                "zrodlo": x.get("zrodlo"),
                "cel_obserwujacy": None,
                "cel_opis": None,
            },
            "tiktok": {
                "obserwujacy": None,
                "zrodlo": None,
                "uwaga": "W plikach zebrania: brak dostępu do statystyk TikTok.",
            },
        },
    }

    bibl = {
        "wygenerowano": now_berlin(),
        "strefa": TZ,
        "uwaga": "Węzły i krawędzie tylko z plików. Etykiety FAKT/TEORIA/TEORIA SPISKOWA wyłącznie gdy są w tekście. Dokument źródłowy = link do oryginału (Blue Book, NARA, FOIA, CIA itd.) znaleziony w naszych plikach. Brak linku = „brak źródła”. Nic nie zostało dopisane.",
        "legenda": [
            {"id": "fakt", "nazwa": "FAKT", "opis": "Potwierdzony w naszych notatkach (Label: FACT / Fakty weryfikacja)."},
            {"id": "dokument_zrodlowy", "nazwa": "DOKUMENT ŹRÓDŁOWY", "opis": "Link do oryginalnego dokumentu (np. Project Blue Book, NARA, FOIA, CIA), jeśli jest w plikach."},
            {"id": "teoria", "nazwa": "TEORIA", "opis": "Oznaczona w pliku jako teoria, nie jako fakt."},
            {"id": "teoria_spiskowa", "nazwa": "TEORIA SPISKOWA", "opis": "Dodatek wyraźnie oznaczony w pliku jako teoria spiskowa."},
            {"id": "brak_zrodla", "nazwa": "brak źródła", "opis": "W naszych plikach nie ma linku do źródła."},
        ],
        "wezly": NODES,
        "krawedzie": EDGES,
    }

    (OUT / "firma.json").write_text(json.dumps(firma, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT / "biblioteka.json").write_text(json.dumps(bibl, ensure_ascii=False, indent=2), encoding="utf-8")
    # JS fallbacks for file:// / offline
    (OUT / "firma.js").write_text("window.RSS_FIRMA = " + json.dumps(firma, ensure_ascii=False) + ";\n", encoding="utf-8")
    (OUT / "biblioteka.js").write_text("window.RSS_BIBLIOTEKA = " + json.dumps(bibl, ensure_ascii=False) + ";\n", encoding="utf-8")
    print("wezly", len(NODES), "krawedzie", len(EDGES), "zuzycie", len(zuzycie), "plan", len(plan_items))
    print("YT", yt, "X", x, "ostatni %", ostatnie_pct)
    typy = {}
    for n in NODES:
        typy[n["typ"]] = typy.get(n["typ"], 0) + 1
    print("typy", typy)
    spraw = [n for n in NODES if n["typ"] == "sprawa"]
    print("sprawy z dokumentem", sum(1 for n in spraw if n.get("ma_dokument")), "/", len(spraw))
    print("sprawy brak zrodla", sum(1 for n in spraw if n.get("brak_zrodla")), "/", len(spraw))

if __name__ == "__main__":
    main()
    import build_catalog
    build_catalog.main()
