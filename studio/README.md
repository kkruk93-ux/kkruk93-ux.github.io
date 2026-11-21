# Rovi & Shadow Studio

Oficjalna aplikacja biura i sterowania firmą **Rovi & Shadow Studio**. Wersja 2: instalowalna PWA na telefon (m.in. Samsung S23 Ultra) i laptop — biuro, graf wiedzy, polecenia, kalendarz, decyzje, zużycie, zarabianie i kanały w jednym miejscu.

Wygląd kanonu „Rovi on Earth Files”: noir, teal, stalowy błękit, ziarno filmowe. W gabinecie honorowym są **Rovi** (Grey w czarnej fedorze i skórzanym trenczu) oraz **SHADOW** (cybernetyczny kruk na prawym ramieniu) — oficjalny portret Concept B.

Aplikacja nie publikuje się sama. Szef główny decyduje o wgraniu na GitHub Pages.

## Co jest w v2

- Responsywna powłoka: dolna nawigacja na telefonie, panel boczny na laptopie.
- PWA: `manifest.webmanifest`, ikony 192 i 512, service worker (tryb offline powłoki). SW **nie** cache’uje backendu Apps Script ani adresów z tokenem.
- **Biblioteka** — mapa wiedzy jak graf (Cytoscape.js, licencja MIT). Węzły i krawędzie pochodzą wyłącznie z plików na boxie (`build_data.py` → `data/biblioteka.json`). Sprawy UFO mają etykiety FAKT / DOKUMENT ŹRÓDŁOWY / TEORIA / TEORIA SPISKOWA, albo „brak źródła”, gdy w plikach nie ma linku. Nic nie jest dopisywane.
- **Artykuły** — tylko X Articles / dłuższe teksty (nie zwykłe posty). Katalog: `python3 build_catalog.py` albo razem z `build_data.py`. Nowe pliki: `x/artykuly/RRRR-MM-DD-temat.md`.
- **Filmy do pobrania** — oficjalne teledyski Blue Mold z przyciskiem obejrzyj/pobierz. Opisy po angielsku, linia Support (BTC). Bez płatności i logowania; pole `abonament` jest przygotowane na później.
- **Tryb Szef** — polecenia, rejestr, decyzje i limit widać dopiero po wpisaniu tokenu w Łączu. Wersja publiczna tych paneli nie pokazuje.
- **Zarabianie** — tylko prawdziwe odczyty (np. YouTube 53 subskrybentów, X 4110 obserwujących). Cele, jeśli nie ma ich w plikach, zostają puste.
- Kalendarz, decyzje, wykres zużycia, kanały, schemat struktury — z `data/firma.json`.
- Biuro z lampkami i panel poleceń (bez zmian w zabezpieczeniach tokenu).

Dane buduje się tak:

```bash
python3 build_data.py
```

Skrypt czyta tylko pliki w `/workspace/rovihere/` i nic nie wymyśla.

## Sterowanie firmą (polecenia)

Ten sam backend Apps Script co w aplikacji Blue Mold Centrum:

- Arkusz: **RoviHere Polecenia**, zakładka `Polecenia`.
- Zapis: POST `text/plain` z JSON (`akcja=dodaj`, `dzial`, `tresc` max 2000 znaków, `priorytet`, `zrodlo=Rovi & Shadow Studio`).
- Odczyt: GET `akcja=lista&n=50`. Test łącza: GET `akcja=ping`.
- Adres `/exec` i **token** użytkownik wpisuje w Łączu. Zapis tylko w `localStorage` tej przeglądarki, pod tymi samymi kluczami co Centrum (`bm-api-url`, `bm-api-token`). Tokenu nie ma w plikach, w czacie ani w kodzie.

Backend **nie ma białej listy działów**. Dla działów spoza oryginalnej dwunastki treść dostaje nagłówek `[Dział: …]`.

Agenci czytają arkusz (status `nowe` + nazwa w kolumnie `dzial`) i zmieniają status akcją `status`.

## Uruchomienie

Tylko darmowe narzędzia, bez konta i bez płatności:

```bash
cd /workspace/rovihere/rovi-shadow-studio
python3 -m http.server 8765 --bind 127.0.0.1
```

Otwórz http://127.0.0.1:8765/ . Na telefonie: ta sama strona przez HTTPS (np. GitHub Pages, po zgodzie szefa), Łącze → wklej token raz, „Dodaj do ekranu głównego”.

## Pliki

- `index.html`, `style.css`, `app.js`, `views.js`, `api.js` — aplikacja (bez płatnego buildu).
- `sw.js`, `manifest.webmanifest` — PWA.
- `build_data.py` — generator `data/firma.json` i `data/biblioteka.json` (+ odpowiedniki `.js`).
- `data/zespol.js`, `data/statusy.json` — działy i lampki.
- `lib/cytoscape.min.js` — graf (MIT), zob. `NOTICE`.
- `assets/` — portret Concept B, banner, ikony, ziarno filmowe.

Centrum (statek) zostaje nietknięte.
