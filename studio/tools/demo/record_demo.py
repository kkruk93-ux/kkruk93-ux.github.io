#!/usr/bin/env python3
"""Record a cinematic product demo of Rovi & Shadow Studio (local only)."""
from __future__ import annotations

import json
import shutil
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

APP = "http://127.0.0.1:8765/#bibl"
NODE_ID = "sprawa:mariana-film-great-falls-montana-sierpie"
OUT = Path("/tmp/rss-demo")
WORK = Path("/workspace/rovihere/rovi-shadow-studio/tools/demo")
PORTRAIT = "/workspace/rovihere/rovi-shadow-studio/assets/rovi-shadow-512.png"
BRAND_PORTRAIT = "/workspace/rovihere/branding/B/B_avatar_1024.png"

VEIL_CSS = """
#rss-demo-veil {
  position: fixed; inset: 0; z-index: 2147483646;
  background: #05080F;
  display: flex; align-items: center; justify-content: center;
  opacity: 1; transition: opacity 800ms ease;
  pointer-events: none;
  font-family: 'Cinzel', 'Source Serif Pro', 'Times New Roman', serif;
  color: #BFF6FA;
}
#rss-demo-veil .card {
  display: flex; flex-direction: column; align-items: center;
  text-align: center; gap: 22px; padding: 40px;
  transform: scale(1); animation: rssKen 8s ease-out forwards;
}
#rss-demo-veil img.portrait {
  width: 340px; height: 340px; object-fit: cover;
  border-radius: 8px;
  box-shadow: 0 0 0 1px rgba(92,230,242,.35), 0 0 90px rgba(30,127,148,.45);
}
#rss-demo-veil .kicker {
  font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
  letter-spacing: 0.42em; text-transform: uppercase;
  font-size: 13px; color: #2BB3C4; margin: 8px 0 0;
}
#rss-demo-veil h1 {
  margin: 0; font-weight: 500; font-size: 54px;
  letter-spacing: 0.14em; line-height: 1.15;
}
#rss-demo-veil .sub {
  font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
  letter-spacing: 0.28em; text-transform: uppercase;
  font-size: 15px; color: #8AA4B8; margin: 0;
}
#rss-demo-veil .links {
  font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
  letter-spacing: 0.08em; font-size: 15px; color: #BFF6FA;
  opacity: 0.85; margin-top: 8px;
}
#rss-demo-pointer {
  position: fixed; z-index: 2147483645; width: 22px; height: 22px;
  margin: -11px 0 0 -11px; border-radius: 50%;
  border: 2px solid #5CE6F2; background: rgba(92,230,242,.25);
  box-shadow: 0 0 18px #5CE6F2; pointer-events: none;
  opacity: 0; transition: opacity 200ms ease;
}
@keyframes rssKen { from { transform: scale(1); } to { transform: scale(1.04); } }
"""

FONT_FACES = """
@font-face { font-family: 'Cinzel'; src: url('/tools/demo/fonts/Cinzel.ttf') format('truetype'); font-weight: 400 700; }
@font-face { font-family: 'IBM Plex Sans'; src: url('/tools/demo/fonts/IBMPlexSans.ttf') format('truetype'); font-weight: 100 700; }
"""

INIT_JS = """
(() => {
  const inject = () => {
    try {
      if (!document.getElementById('rss-demo-boot') && document.documentElement) {
        const st = document.createElement('style');
        st.id = 'rss-demo-boot';
        st.textContent = `html,body{background:#05080F!important}
          #rss-demo-veil{position:fixed;inset:0;z-index:2147483646;background:#05080F;}`;
        document.documentElement.appendChild(st);
      }
      const host = document.body || document.documentElement;
      if (host && !document.getElementById('rss-demo-veil')) {
        const v = document.createElement('div');
        v.id = 'rss-demo-veil';
        host.appendChild(v);
      }
    } catch (e) {}
  };
  inject();
  document.addEventListener('DOMContentLoaded', inject);
})();
"""

TITLE_HTML = """
<div class="card">
  <img class="portrait" alt="" src="ASSET">
  <div class="kicker">Oficjalna aplikacja firmy</div>
  <h1>Rovi &amp; Shadow Studio</h1>
  <p class="sub">Pamięć, mapa i biuro w jednym miejscu</p>
</div>
"""

END_HTML = """
<div class="card">
  <img class="portrait" alt="" src="ASSET">
  <div class="kicker">Oficjalna aplikacja firmy</div>
  <h1>Rovi &amp; Shadow Studio</h1>
  <p class="links">YouTube @RoviHere &nbsp;·&nbsp; TikTok @roviheree &nbsp;·&nbsp; X @RoviHere</p>
</div>
"""


def setup_fonts():
    font_dir = WORK / "fonts"
    font_dir.mkdir(parents=True, exist_ok=True)
    mapping = {
        "Cinzel.ttf": Path("/usr/share/fonts/truetype/sand-box/google/Cinzel/Cinzel-VariableFont_wght.ttf"),
        "IBMPlexSans.ttf": Path("/usr/share/fonts/truetype/sand-box/google/IBM Plex Sans/IBMPlexSans-VariableFont_wdth,wght.ttf"),
    }
    for name, src in mapping.items():
        dest = font_dir / name
        if not dest.exists():
            shutil.copy2(src, dest)


def main():
    setup_fonts()
    if OUT.exists():
        shutil.rmtree(OUT)
    rec = OUT / "rec"
    rec.mkdir(parents=True)
    portrait_src = BRAND_PORTRAIT if Path(BRAND_PORTRAIT).exists() else PORTRAIT
    # serve official portrait from tools/demo so the overlay can use a same-origin URL
    shutil.copy2(portrait_src, WORK / "portrait.png")
    asset = "/tools/demo/portrait.png"

    markers = {}
    t0 = None

    def mark(name):
        markers[name] = round(time.monotonic() - t0, 3)
        print(f"  mark {name} = {markers[name]:.3f}s", flush=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(
            channel="chrome",
            args=[
                "--disable-infobars",
                "--hide-scrollbars",
                "--autoplay-policy=no-user-gesture-required",
            ],
            ignore_default_args=["--enable-automation"],
        )
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=1,
            record_video_dir=str(rec),
            record_video_size={"width": 1920, "height": 1080},
            service_workers="block",
            color_scheme="dark",
        )
        context.add_init_script(INIT_JS)
        page = context.new_page()
        t0 = time.monotonic()
        mark("page_created")
        page.goto(APP, wait_until="domcontentloaded", timeout=30000)
        page.add_style_tag(content=FONT_FACES + VEIL_CSS)
        page.wait_for_function(
            """() => !!(window.RSS && RSS.views && RSS.views.render && window.cytoscape && window.RSS_BIBLIOTEKA)""",
            timeout=30000,
        )
        page.evaluate("() => RSS.views.render('bibl')")
        page.wait_for_function(
            """() => {
              const cy = window.RSS && RSS.views && RSS.views.getCy && RSS.views.getCy();
              return !!(cy && cy.nodes && cy.nodes().length > 20);
            }""",
            timeout=30000,
        )
        page.wait_for_timeout(900)
        mark("graph_ready")

        page.evaluate(
            """({html, css}) => {
              let st = document.getElementById('rss-demo-style');
              if (!st) {
                st = document.createElement('style');
                st.id = 'rss-demo-style';
                document.head.appendChild(st);
              }
              st.textContent = css;
              const v = document.getElementById('rss-demo-veil') || document.createElement('div');
              v.id = 'rss-demo-veil';
              v.style.opacity = '0';
              v.innerHTML = html;
              document.body.appendChild(v);
              let ptr = document.getElementById('rss-demo-pointer');
              if (!ptr) {
                ptr = document.createElement('div');
                ptr.id = 'rss-demo-pointer';
                document.body.appendChild(ptr);
              }
            }""",
            {"html": TITLE_HTML.replace("ASSET", asset), "css": FONT_FACES + VEIL_CSS},
        )
        page.wait_for_timeout(40)
        page.evaluate("document.getElementById('rss-demo-veil').style.opacity = '1'")
        page.wait_for_timeout(700)
        mark("title_in")
        page.wait_for_timeout(4300)
        mark("title_out_start")
        page.evaluate("document.getElementById('rss-demo-veil').style.opacity = '0'")
        page.wait_for_timeout(850)
        mark("map_visible")

        # --- Biblioteka: zoom, then click Mariana with sources panel ---
        page.evaluate(
            """(id) => {
              const cy = RSS.views.getCy();
              cy.resize();
              cy.fit(undefined, 48);
              window.__rssDemoNode = id;
            }""",
            NODE_ID,
        )
        page.wait_for_timeout(700)
        mark("bibl_zoom_start")
        page.evaluate(
            """async (id) => {
              const cy = RSS.views.getCy();
              const n = cy.$id(id);
              if (!n || n.empty()) throw new Error('missing node ' + id);
              await new Promise((resolve) => {
                cy.animate({
                  zoom: 1.65,
                  center: { eles: n },
                  duration: 6200,
                  easing: 'ease-in-out-cubic',
                  complete: resolve
                });
              });
            }""",
            NODE_ID,
        )
        mark("bibl_zoom_end")
        page.wait_for_timeout(500)

        # move pointer and click
        pos = page.evaluate(
            """(id) => {
              const cy = RSS.views.getCy();
              const n = cy.$id(id);
              const p = n.renderedPosition();
              const box = document.getElementById('cy').getBoundingClientRect();
              return { x: box.left + p.x, y: box.top + p.y };
            }""",
            NODE_ID,
        )
        page.evaluate(
            """(p) => {
              const ptr = document.getElementById('rss-demo-pointer');
              ptr.style.left = p.x + 'px';
              ptr.style.top = p.y + 'px';
              ptr.style.opacity = '1';
            }""",
            pos,
        )
        page.wait_for_timeout(450)
        mark("bibl_click")
        page.evaluate(
            """(id) => {
              const cy = RSS.views.getCy();
              const n = cy.$id(id);
              n.select();
              RSS.views.openNode(n.data('raw'));
              const ptr = document.getElementById('rss-demo-pointer');
              if (ptr) ptr.style.opacity = '0';
            }""",
            NODE_ID,
        )
        page.wait_for_timeout(400)
        # keep the selected node in view after the side panel reflow
        page.evaluate(
            """async (id) => {
              const cy = RSS.views.getCy();
              const n = cy.$id(id);
              cy.resize();
              await new Promise((resolve) => {
                cy.animate({
                  center: { eles: n },
                  zoom: Math.max(cy.zoom(), 1.35),
                  duration: 700,
                  easing: 'ease-out',
                  complete: resolve
                });
              });
            }""",
            NODE_ID,
        )
        page.wait_for_timeout(8500)
        mark("bibl_end")

        # --- Biuro ---
        page.evaluate("() => { if (RSS.closeSheet) RSS.closeSheet(); RSS.goTab('biuro'); }")
        page.wait_for_timeout(5000)
        mark("office_end")

        # --- Artykuły ---
        page.evaluate("() => RSS.goTab('art')")
        page.wait_for_timeout(2800)
        mark("art_list")
        page.evaluate(
            """() => {
              const btn = document.querySelector('#view-art .art-card[data-id="cobe-2026-11-18"]')
                || document.querySelector('#view-art .art-card');
              if (btn) btn.click();
            }"""
        )
        page.wait_for_timeout(4200)
        mark("art_end")

        # --- Filmy ---
        page.evaluate("() => RSS.goTab('vid')")
        page.wait_for_timeout(5000)
        mark("vid_end")

        # --- End card ---
        page.evaluate(
            """(html) => {
              const v = document.getElementById('rss-demo-veil');
              v.innerHTML = html;
              v.style.opacity = '1';
            }""",
            END_HTML.replace("ASSET", asset),
        )
        mark("end_in")
        page.wait_for_timeout(3800)
        mark("end_out")

        page.wait_for_timeout(200)
        context.close()
        browser.close()

    videos = list(rec.glob("*.webm"))
    if not videos:
        raise SystemExit("no video recorded")
    raw = OUT / "raw.webm"
    shutil.move(str(videos[0]), str(raw))
    markers["raw"] = str(raw)
    (OUT / "markers.json").write_text(json.dumps(markers, indent=2))
    print("recorded", raw, "markers", markers)


if __name__ == "__main__":
    main()
