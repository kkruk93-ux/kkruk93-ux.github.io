# Rovi Here · Mostek statku „Blue Mold”

Statyczna, animowana strona-gra: mostek statku Blue Mold. Za oknem gwiazdy, Ziemia i Księżyc, na ramie okna świeci pleśń. Rovi stoi z Shadow na ramieniu, a sześć klikalnych konsol otwiera panele w stylu gry.
Czysty HTML/CSS/JS, bez frameworków, bez serwera i bez kroku build. Wszystkie ścieżki są względne, więc strona działa też z podfolderu (`https://USER.github.io/REPO/`).

## Struktura
```
index.html            scena (inline SVG generowany przez tools/build_scene.py) + HUD + hotspoty + panel <dialog>
impressum.html        Impressum i Datenschutz (placeholdery danych osobowych do uzupełnienia)
css/style.css         wygląd, animacje, wersja mobilna, prefers-reduced-motion
js/main.js            układ sceny (wide / tall), gwiazdy (canvas), zarodniki, Shadow, klawiatura, panel
js/panels.js          treść paneli, czytana z data/*.json
js/audio.js           opcjonalny dźwięk (szum statku + blipy + krakanie), syntezowany, domyślnie wyłączony
data/log.json         Captain's Log (wpisy dzienne)       ← CODZIENNA AKTUALIZACJA
data/files.json       Rovi on Earth Files (#001…)          ← po publikacji odcinka
data/music.json       utwory Blue Mold
data/links.json       linki Comms + Cargo Bay (Spreadshop) + legal (Impressum)
data/crew.json        załoga (działy)
assets/fonts/         Big Shoulders Display + IBM Plex Mono (woff2, self-hosted, licencja OFL w plikach .txt)
assets/img/           og-image.png 1200×630, ikony, rovi-avatar.png
tools/                skrypty deweloperskie (niepotrzebne do hostingu)
_screens/             zrzuty ekranu z testów (nie wrzucamy do repo Pages)
.well-known/assetlinks.json  Digital Asset Links dla TWA gier Play Studio (ten sam host)
.nojekyll             GitHub Pages serwuje pliki 1:1 (bez Jekylla), w tym .well-known/
```

## Codzienna aktualizacja (bez przebudowy)
1. **Log:** dopisz obiekt **na końcu** listy `entries` w `data/log.json`:
   ```json
   { "date": "2026-10-04", "title": "Earth Files #007: Shag Harbour, 1967",
     "body": "Akapit 1.\n\nAkapit 2.", "tags": ["earth-files", "1967"],
     "link": { "label": "Watch on YouTube", "url": "https://www.youtube.com/@RoviHere/shorts" } }
   ```
   Wymagane są `date` (RRRR-MM-DD), `title` i `body`. Pola `tags` i `link` są opcjonalne. Strona sortuje wpisy od najnowszych, a przy tej samej dacie wyżej pokazuje wpis dopisany później. Najnowszy tytuł trafia też do paska „INCOMING” na dole ekranu. Teksty piszemy po angielsku, głosem Rovi.
2. **Files:** po publikacji Shorta zmień w `data/files.json` `"status": "incoming"` na `"archived"`. Możesz też dodać `"url": "https://youtube.com/shorts/…"`.
3. **Music:** nowy utwór dopisz w `data/music.json`. Status `released` z `url` pokazuje przycisk „Listen”, a status `production` pokazuje etykietę „In production”.
4. Sprawdź poprawność JSON: `python3 -m json.tool data/log.json > /dev/null`. Potem commit i push. GitHub Pages odświeża stronę w ~1 min. Dane są pobierane z `cache: no-cache`.

## Uruchomienie lokalne
```
cd site && python3 -m http.server 8000   →   http://localhost:8000/
```
Otwarcie `index.html` bezpośrednio z dysku (`file://`) nie wczyta paneli z JSON-ów. To ograniczenie przeglądarek, nie błąd strony.

## Wdrożenie na GitHub Pages
Strona firmy stoi w publicznym repozytorium użytkownika `kkruk93-ux/kkruk93-ux.github.io` (user site). Wypychamy **zawartość folderu `site/`** do katalogu głównego repo, gałąź `main`, folder `/ (root)`. Adres: `https://kkruk93-ux.github.io/`.

**Podglądy w social media** (X, Discord, Facebook) wymagają absolutnego adresu obrazka OG. Przy zmianie domeny uruchom:
```
python3 tools/set_site_url.py https://kkruk93-ux.github.io/
```
(Opcjonalnie) Własna domena: Settings → Pages → Custom domain plus rekord DNS CNAME. Potem jeszcze raz uruchom `set_site_url.py` z nowym adresem.

## Digital Asset Links (gry Play Studio)
Plik `.well-known/assetlinks.json` musi być dostępny pod:

`https://kkruk93-ux.github.io/.well-known/assetlinks.json`

Android sprawdza ten plik na hoście (nie w podścieżce gry). Obecne wpisy to klucze **upload** trzech TWA, zweryfikowane z keystore'ów:

- Meadow Pile (`com.rovihere.meadowpile`) → `/triple-tidy/`
- Nimbus Yard (`com.rovihere.nimbusyard`) → `/nimbus-yard/`
- Twirlwood (`com.rovihere.twirlwood`) → `/twirlwood/`

Format kolejnego wpisu (albo drugiego odcisku w tablicy `sha256_cert_fingerprints`):

```json
{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.rovihere.PRZYKLAD",
    "sha256_cert_fingerprints": [
      "AA:BB:CC:…:FF"
    ]
  }
}
```

Po wgraniu AAB włącz **Play App Signing**. Klucz, którym Google podpisuje APK, ma **inny** SHA-256 niż klucz upload. W Play Console: aplikacja → App signing → skopiuj odcisk **App signing key certificate** i dopisz go do tablicy odcisków danej aplikacji (zostaw też odcisk upload). Dopóki drugi odcisk nie jest w pliku, aplikacja może otwierać stronę w Custom Tab z paskiem adresu zamiast pełnoekranowego TWA.

Tester Google: https://developers.google.com/digital-asset-links/tools/generator

## Placeholdery / do uzupełnienia
- `data/links.json → merch`: sklep Spreadshop jeszcze nie istnieje (`placeholder: true`, przycisk „offline”). Po założeniu sklepu wpisz `url` i ustaw `placeholder: false`.
- `data/links.json → channels.kofi`: ukryty (`show: false`), bo konto Ko-fi nie istnieje.
- `data/links.json → legal`: podstrona `impressum.html` (Datenschutz: `impressum.html#datenschutz`) jest podpięta w stopce paneli. W Impressum zostawione są widoczne placeholdery imienia, adresu i e-maila do uzupełnienia — nie publikujemy danych osobowych, dopóki właściciel ich nie wpisze. To nie jest porada prawna. Strona nie używa cookies ani analityki.
- `data/music.json`: linki „Listen” prowadzą do wyszukiwania na kanale @RoviHere. Podmień je na bezpośrednie URL-e filmów.
- `data/files.json`: odcinki #006–#012 mają status „incoming” zgodnie z planem YouTube. Po publikacji zmień je na „archived”.

## Regeneracja grafiki (tylko gdy zmieniasz rysunki)
`python3 tools/build_scene.py` przerysowuje SVG sceny w `index.html`, a `python3 tools/build_og.py` obraz OG. Oba skrypty korzystają z kodu brandingu w `/workspace/rovihere/branding/src` (zmienna `BRAND_SRC`). Zrzuty testowe robi `python3 tools/screens.py _screens http://127.0.0.1:8000/` (Playwright + Chrome).

## Dostępność i wydajność
- Każda stacja to prawdziwy `<button>` nałożony na grafikę: Tab, Enter i Spacja działają, a skróty to `1`–`6`, `R` (Rovi), `S` (Shadow) i `Esc`. Linki głębokie typu `#log`, `#comms`, `#files`, `#crew`, `#music`, `#merch` i `#rovi` od razu otwierają panel.
- Przy `prefers-reduced-motion` animacje są wyłączone. Przycisk „Motion” w HUD wyłącza je ręcznie i zapamiętuje wybór.
- Pierwsze wejście pobiera ok. 300 KB przed kompresją (HTML ze sceną ~130 KB, fonty ~90 KB, CSS+JS ~55 KB, dane). GitHub Pages serwuje gzip. Gwiazdy rysuje canvas w ~30 fps i pauzuje się, gdy karta jest w tle.
