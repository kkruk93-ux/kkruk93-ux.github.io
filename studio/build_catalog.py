#!/usr/bin/env python3
"""Buduje data/articles.json i data/videos.json wyłącznie z plików (i, jeśli podane, z zapisanego odczytu X).
Nic nie wymyśla: brak linku = puste pole / „brak linku do oryginału na X”."""
from __future__ import annotations
import json, re, datetime
from pathlib import Path

ROOT = Path("/workspace/rovihere")
APP = Path(__file__).resolve().parent
OUT = APP / "data"
TZ = "Europe/Berlin"

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

def esc(s: str) -> str:
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")

def md_inline(s: str) -> str:
    s = esc(s)
    s = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", r'<a href="\2" target="_blank" rel="noopener noreferrer">\1</a>', s)
    s = re.sub(r"(https?://[^\s<]+)", r'<a href="\1" target="_blank" rel="noopener noreferrer">\1</a>', s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", s)
    return s

def md_to_html(md: str, img_map: dict[str, tuple[str, str]] | None = None) -> str:
    """Prosty markdown → HTML (nagłówki, akapity, listy, obrazy)."""
    img_map = img_map or {}
    lines = md.replace("\r\n", "\n").split("\n")
    out, para, in_ul = [], [], False

    def flush_p():
        nonlocal para
        if para:
            out.append("<p>" + md_inline(" ".join(para)) + "</p>")
            para = []

    def flush_ul():
        nonlocal in_ul
        if in_ul:
            out.append("</ul>")
            in_ul = False

    i = 0
    while i < len(lines):
        line = lines[i]
        raw = line.rstrip()
        if raw.startswith("```"):
            flush_p(); flush_ul()
            i += 1
            buf = []
            while i < len(lines) and not lines[i].startswith("```"):
                buf.append(lines[i]); i += 1
            out.append("<pre><code>" + esc("\n".join(buf)) + "</code></pre>")
            i += 1
            continue
        mimg = re.match(r"!\[([^\]]*)\]\(([^)]+)\)", raw.strip())
        if mimg:
            flush_p(); flush_ul()
            alt, src = mimg.group(1), mimg.group(2)
            out.append(f'<figure><img src="{esc(src)}" alt="{esc(alt)}"><figcaption>{md_inline(alt)}</figcaption></figure>')
            i += 1
            continue
        # IMAGE markers from drafts
        mmark = re.match(r"\[IMAGE:\s*([^,\]]+)", raw.strip())
        if mmark:
            flush_p(); flush_ul()
            key = Path(mmark.group(1).strip()).name
            if key in img_map:
                src, cap = img_map[key]
                out.append(f'<figure><img src="{esc(src)}" alt="{esc(cap)}"><figcaption>{md_inline(cap)}</figcaption></figure>')
            i += 1
            continue
        if re.match(r"^---+$", raw.strip()):
            flush_p(); flush_ul(); i += 1; continue
        hm = re.match(r"^(#{1,4})\s+(.+)$", raw)
        if hm:
            flush_p(); flush_ul()
            lvl = min(len(hm.group(1)) + 1, 5)  # article already has h1 title outside
            # keep h2-h4 as-is relative: # -> h2 in body if we already have title
            n = len(hm.group(1))
            tag = "h2" if n <= 2 else ("h3" if n == 3 else "h4")
            klass = ""
            title = hm.group(2).strip()
            low = title.lower()
            if re.search(r"firmly established|^facts\b|what the files show", low):
                klass = ' class="sec-fakt"'
            elif re.search(r"still open|theor|claim|should not be overstated", low):
                klass = ' class="sec-teoria"'
            elif re.search(r"conspirac|teoria spisk", low):
                klass = ' class="sec-spisek"'
            elif re.search(r"^sources\b|source document", low):
                klass = ' class="sec-dok"'
            out.append(f"<{tag}{klass}>{md_inline(title)}</{tag}>")
            i += 1
            continue
        if re.match(r"^[-*]\s+", raw):
            flush_p()
            if not in_ul:
                out.append("<ul>"); in_ul = True
            out.append("<li>" + md_inline(re.sub(r"^[-*]\s+", "", raw)) + "</li>")
            i += 1
            continue
        if not raw.strip():
            flush_p(); flush_ul(); i += 1; continue
        flush_ul()
        para.append(raw.strip())
        i += 1
    flush_p(); flush_ul()
    return "\n".join(out)

def parse_front(text: str) -> tuple[dict, str]:
    if not text.startswith("---"):
        return {}, text
    m = re.match(r"^---\n(.*?)\n---\n?(.*)$", text, re.S)
    if not m:
        return {}, text
    meta, body = m.group(1), m.group(2)
    d = {}
    for line in meta.splitlines():
        if ":" not in line:
            continue
        k, v = line.split(":", 1)
        k, v = k.strip(), v.strip().strip('"')
        if v.startswith("[") and v.endswith("]"):
            d[k] = [x.strip() for x in v[1:-1].split(",") if x.strip()]
        else:
            d[k] = v
    return d, body

def labels_from_text(text: str, preset=None):
    labs = list(preset or [])
    if re.search(r"firmly established|Label:\s*FACT|##\s*FACTS\b|What the files show", text, re.I):
        if "fakt" not in labs: labs.append("fakt")
    if re.search(r"cia\.gov|archives\.gov|gutenberg\.org|nasa\.gov|nsarchive|foia|blue book", text, re.I):
        if "dokument_zrodlowy" not in labs: labs.append("dokument_zrodlowy")
    if re.search(r"conspirac|teoria spisk", text, re.I) and re.search(r"labeled|oznacz|THEORIES AND CONSPIRACY", text, re.I):
        if "teoria_spiskowa" not in labs: labs.append("teoria_spiskowa")
    elif re.search(r"still open|##\s*THEORIES\b|the plover theory|speculation|unproven theory", text, re.I):
        if "teoria" not in labs: labs.append("teoria")
    return labs

def article_obj(**kw):
    zrodlo_x = kw.get("x_url") or ""
    status = kw.get("status") or ("opublikowany" if zrodlo_x else "w_plikach_nieopublikowany")
    return {
        "id": kw["id"],
        "tytul": kw["tytul"],
        "podtytul": kw.get("podtytul") or "",
        "autor": kw.get("autor") or "",
        "seria": kw.get("seria") or "",
        "data": kw.get("data") or "",
        "godz": kw.get("godz") or "",
        "strefa": kw.get("strefa") or TZ,
        "status_publikacji": status,
        "x_url": zrodlo_x or None,
        "x_post_url": kw.get("x_post_url") or None,
        "youtube_url": kw.get("youtube_url") or None,
        "okladka": kw.get("okladka") or "",
        "plik": kw.get("plik") or "",
        "etykiety": kw.get("etykiety") or [],
        "html": kw.get("html") or "",
        "uwaga": kw.get("uwaga") or (
            None if zrodlo_x else "brak linku do oryginału na X — tekst jest w naszych plikach, publikacja na X nie jest potwierdzona."
        ),
    }

def from_catalog_md(path: Path) -> dict | None:
    text = read(path)
    if not text or path.name.upper() == "PLAN.md":
        return None
    meta, body = parse_front(text)
    # skip first heading if it duplicates title
    title = meta.get("tytul") or ""
    body_work = body.lstrip()
    if title:
        body_work = re.sub(r"^#\s+" + re.escape(title) + r"\s*\n+", "", body_work, count=1)
    html = md_to_html(body_work)
    et = meta.get("etykiety") if isinstance(meta.get("etykiety"), list) else labels_from_text(text)
    return article_obj(
        id=meta.get("id") or path.stem,
        tytul=title or path.stem,
        podtytul=meta.get("podtytul") or "",
        autor=meta.get("autor") or "",
        seria=meta.get("seria") or "",
        data=meta.get("data") or "",
        godz=meta.get("godz") or "",
        strefa=meta.get("strefa") or TZ,
        status=meta.get("status") or "",
        x_url=meta.get("x_url") or "",
        x_post_url=meta.get("x_post_url") or "",
        youtube_url=meta.get("youtube_url") or "",
        okladka=meta.get("okladka") or "",
        plik=meta.get("plik_zrodlowy") or str(path.relative_to(ROOT)),
        etykiety=et,
        html=html,
        uwaga=meta.get("uwaga") or "",
    )

def extract_lubbock() -> dict:
    raw = read(ROOT / "x/2026-10-25-artykul.md")
    # drop draft header, HEADER lines, TEASER
    text = re.sub(r"^# X Article DRAFT[^\n]*\n+", "", raw)
    text = re.sub(r"^HEADER.*\n(?:\([^\n]+\)\n)?", "", text)
    text = re.split(r"\n---\s*\nTEASER:", text)[0]
    title_m = re.search(r"^TITLE:\s*(.+)$", text, re.M)
    title = title_m.group(1).strip() if title_m else "The Lubbock Lights"
    text = text.lstrip()
    text = re.sub(r"^TITLE:\s*.+\n+", "", text, count=1)
    # first heading-like paragraph after title is lead? starts with ## 
    img_map = {
        "2026-10-25-art-archive.png": ("assets/articles/lubbock-archive.jpg", "Archive image from the article package."),
        "2026-10-25-art-streetlights.png": ("assets/articles/lubbock-streetlights.jpg", "Lubbock street lights, from the article package."),
    }
    html = md_to_html(text, img_map)
    # YT id recorded in DLUGIE_FILMY.md for long #008
    yt = "https://youtu.be/MC-uEhrSx04"
    return article_obj(
        id="lubbock-2026-10-25",
        tytul=title,
        podtytul="Four professors, two weeks of sky, and one official word: unknown.",
        autor="X",
        seria="ufo",
        data="2026-10-25",
        godz="",
        status="w_plikach_nieopublikowany",
        x_url="",
        youtube_url=yt,
        okladka="assets/articles/lubbock.jpg",
        plik="x/2026-10-25-artykul.md",
        etykiety=labels_from_text(raw),
        html=html,
        uwaga="Szkic X Article w plikach (nagłówek: NOT PUBLISHED). Publiczny odczyt konta @RoviHere (21.11.2026) nie zwrócił opublikowanego artykułu. Link do filmu YT z youtube/DLUGIE_FILMY.md (identyfikator MC-uEhrSx04, long #008 Lubbock Lights).",
    )

def extract_stargate() -> dict:
    raw = read(ROOT / "x/article-stargate/ARTICLE.md")
    # body: from first "## 1." through before ## COUNTS
    m = re.search(r"(## 1\..*?)(?=\n## COUNTS\b)", raw, re.S)
    body = m.group(1) if m else raw
    src_m = re.search(r"## SOURCES.*?(?=\n## NOTES\b)", raw, re.S)
    if src_m:
        body = body + "\n\n" + src_m.group(0)
    img_map = {
        "img1.png": ("assets/articles/stargate-1.jpg", "Timeline 1972 to 1995, cover names (approximate dates)."),
        "img2.png": ("assets/articles/stargate-2.jpg", "DIA page 4: Sun Streak renamed Star Gate, 31 January 1991."),
        "img3.png": ("assets/articles/stargate-3.jpg", "1995 AIR verdict, lab vs operations."),
        "img4.png": ("assets/articles/stargate-4.jpg", "Declassification path 1995, 2002, 2005, 2017."),
    }
    title_m = re.search(r"^## TITLE[^\n]*\n(.+)$", raw, re.M)
    title = title_m.group(1).strip() if title_m else "Stargate: The Psychic Spy Files"
    sub_m = re.search(r"^## SUBTITLE.*\n(.+)$", raw, re.M)
    sub = sub_m.group(1).strip() if sub_m else ""
    html = md_to_html(body, img_map)
    return article_obj(
        id="stargate-2026-11-03",
        tytul=title,
        podtytul=sub,
        autor="X",
        seria="ufo",
        data="2026-11-03",
        godz="23:30",
        status="w_plikach_nieopublikowany",
        x_url="",
        youtube_url="https://youtu.be/eP4HdhWciA4",
        okladka="assets/articles/stargate.jpg",
        plik="x/article-stargate/ARTICLE.md",
        etykiety=labels_from_text(raw + "\nWhat the files show\nstill open"),
        html=html,
        uwaga="Pakiet X Article w plikach (adnotacja: nothing was published by the agent). Publiczny odczyt konta @RoviHere (21.11.2026) nie zwrócił opublikowanego artykułu. Link do odcinka YT jest w pakiecie.",
    )

def collect_articles() -> list[dict]:
    found = {}
    folder = ROOT / "x/artykuly"
    if folder.exists():
        for p in sorted(folder.glob("*.md")):
            if p.name.lower() == "plan.md" or p.name.startswith("_"):
                continue
            art = from_catalog_md(p)
            if art:
                found[art["id"]] = art
    # legacy packages from the current (normal) @RoviHere era, if not already filed
    if "lubbock-2026-10-25" not in found and (ROOT / "x/2026-10-25-artykul.md").exists():
        found["lubbock-2026-10-25"] = extract_lubbock()
    if "stargate-2026-11-03" not in found and (ROOT / "x/article-stargate/ARTICLE.md").exists():
        found["stargate-2026-11-03"] = extract_stargate()
    arts = list(found.values())
    arts.sort(key=lambda a: a.get("data") or "", reverse=True)
    return arts

def collect_videos() -> dict:
    opis = read(ROOT / "blue-mold/teledysk-glass-between-us/YT_OPIS_v2.txt")
    # first paragraph after title
    lines = [ln.strip() for ln in opis.splitlines() if ln.strip()]
    title = "Blue Mold – Glass Between Us (Official Music Video)"
    if lines:
        title = lines[0]
    # description: paragraph before "Music & visuals"
    desc = ""
    for ln in lines[1:]:
        if ln.startswith("Music &") or ln.startswith("🎧") or ln.startswith("#"):
            break
        desc += (ln + " ")
    desc = desc.strip()
    drive = "https://drive.google.com/file/d/176ArSlrhvbLJBsXMV7iog-BFTvOLnQYp/view"
    vid = {
        "id": "glass-between-us-v2",
        "tytul": title,
        "wersja": "v2",
        "jezyk_opisu": "en",
        "opis": desc,
        "ogladaj_url": drive,
        "pobierz_url": "https://drive.google.com/uc?export=download&id=176ArSlrhvbLJBsXMV7iog-BFTvOLnQYp",
        "okladka": "assets/videos/glass-between-us.jpg",
        "suno": "https://suno.com/@kkruk93",
        "youtube_kanal": "https://www.youtube.com/@RoviHere",
        "zrodlo_linku": "blue-mold/teledysk-glass-between-us/klipy/LOG.md",
        "zrodlo_opisu": "blue-mold/teledysk-glass-between-us/YT_OPIS_v2.txt",
        "dostep": "publiczny",
        "abonament_wymagany": False,
    }
    return {
        "uwaga": "Tylko oficjalne teledyski Blue Mold z potwierdzonym publicznym linkiem w plikach. Brak linku = pozycja nie jest dopisywana. Płatności i logowanie są wyłączone.",
        "abonament": {
            "status": "wylaczony",
            "opis_en": "Downloads are free. Account login and subscriptions are not enabled in this version. The catalog is structured so a future free or paid tier can be added later, without payments or sign-in now."
        },
        "wsparcie": {
            "linia": "☕ Support the channel (BTC): bc1qd05h6spuj8dqf9rs9fu4re9rh4q6k0gflfqum8",
            "btc": "bc1qd05h6spuj8dqf9rs9fu4re9rh4q6k0gflfqum8",
            "suno": "https://suno.com/@kkruk93",
            "zrodlo": "blue-mold/teledysk-glass-between-us/YT_OPIS_v2.txt (oraz youtube/STYL.md)"
        },
        "filmy": [vid],
    }

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    arts = collect_articles()
    vids = collect_videos()
    articles = {
        "wygenerowano": now_berlin(),
        "strefa": TZ,
        "uwaga": "Tylko artykuły (X Articles / dłuższe teksty) z okresu normalnej działalności @RoviHere. Bez zwykłych postów i komentarzy. Link do X tylko gdy publikacja jest potwierdzona. Nowe teksty należy kłaść do x/artykuly/RRRR-MM-DD-temat.md (PLAN.md: 2 tygodniowo).",
        "legenda": [
            {"id": "fakt", "nazwa": "FAKT"},
            {"id": "dokument_zrodlowy", "nazwa": "DOKUMENT ŹRÓDŁOWY"},
            {"id": "teoria", "nazwa": "TEORIA"},
            {"id": "teoria_spiskowa", "nazwa": "TEORIA SPISKOWA"},
        ],
        "artykuly": arts,
    }
    vids["wygenerowano"] = now_berlin()
    vids["strefa"] = TZ
    (OUT / "articles.json").write_text(json.dumps(articles, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT / "videos.json").write_text(json.dumps(vids, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT / "articles.js").write_text("window.RSS_ARTICLES = " + json.dumps(articles, ensure_ascii=False) + ";\n", encoding="utf-8")
    (OUT / "videos.js").write_text("window.RSS_VIDEOS = " + json.dumps(vids, ensure_ascii=False) + ";\n", encoding="utf-8")
    print("artykuly", len(arts), [a["id"]+":"+a["status_publikacji"] for a in arts])
    print("filmy", [f["id"] for f in vids["filmy"]])

if __name__ == "__main__":
    main()
