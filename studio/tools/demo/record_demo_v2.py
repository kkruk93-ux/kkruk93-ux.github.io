#!/usr/bin/env python3
"""Record v2 product demo: every public tab, Biblioteka longest, no token."""
from __future__ import annotations

import json
import shutil
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

# Import title overlay assets/helpers from v1 module text
import importlib.util

SPEC = Path("/workspace/rovihere/rovi-shadow-studio/tools/demo/record_demo.py")
mod = importlib.util.spec_from_file_location("rss_demo_v1", SPEC)
v1 = importlib.util.module_from_spec(mod)
mod.loader.exec_module(v1)

APP = "http://127.0.0.1:8765/#biuro"
NODE_ID = "sprawa:mariana-film-great-falls-montana-sierpie"
OUT = Path("/tmp/rss-demo-v2")
WORK = Path("/workspace/rovihere/rovi-shadow-studio/tools/demo")


def main():
    v1.setup_fonts()
    if OUT.exists():
        shutil.rmtree(OUT)
    rec = OUT / "rec"
    rec.mkdir(parents=True)
    portrait_src = v1.BRAND_PORTRAIT if Path(v1.BRAND_PORTRAIT).exists() else v1.PORTRAIT
    shutil.copy2(portrait_src, WORK / "portrait.png")
    asset = "/tools/demo/portrait.png"

    markers = {}
    t0 = None

    def mark(name):
        markers[name] = round(time.monotonic() - t0, 3)
        print(f"  mark {name} = {markers[name]:.3f}s", flush=True)

    def show_veil(page, html, opacity="1"):
        page.evaluate(
            """({html, css, opacity}) => {
              let st = document.getElementById('rss-demo-style');
              if (!st) {
                st = document.createElement('style');
                st.id = 'rss-demo-style';
                document.head.appendChild(st);
              }
              st.textContent = css;
              let v = document.getElementById('rss-demo-veil');
              if (!v) {
                v = document.createElement('div');
                v.id = 'rss-demo-veil';
                document.body.appendChild(v);
              }
              if (html) v.innerHTML = html;
              v.style.opacity = opacity;
              if (!document.getElementById('rss-demo-pointer')) {
                const ptr = document.createElement('div');
                ptr.id = 'rss-demo-pointer';
                document.body.appendChild(ptr);
              }
            }""",
            {"html": html, "css": v1.FONT_FACES + v1.VEIL_CSS, "opacity": opacity},
        )

    with sync_playwright() as p:
        browser = p.chromium.launch(
            channel="chrome",
            args=["--disable-infobars", "--hide-scrollbars", "--autoplay-policy=no-user-gesture-required"],
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
        context.add_init_script(v1.INIT_JS)
        page = context.new_page()
        t0 = time.monotonic()
        mark("page_created")
        page.goto(APP, wait_until="domcontentloaded", timeout=30000)
        page.add_style_tag(content=v1.FONT_FACES + v1.VEIL_CSS)
        page.wait_for_function(
            """() => !!(window.RSS && RSS.goTab && RSS.views && RSS.views.render && window.cytoscape && document.getElementById('floor'))""",
            timeout=30000,
        )
        # Prefetch Biblioteka under the veil so the first cut to the map is ready later
        page.evaluate("() => { RSS.views.render('bibl'); }")
        page.wait_for_timeout(400)
        mark("app_ready")

        show_veil(page, v1.TITLE_HTML.replace("ASSET", asset), "0")
        page.wait_for_timeout(40)
        page.evaluate("document.getElementById('rss-demo-veil').style.opacity = '1'")
        page.wait_for_timeout(700)
        mark("title_in")
        page.wait_for_timeout(5000)
        mark("title_out_start")
        page.evaluate("document.getElementById('rss-demo-veil').style.opacity = '0'")
        page.wait_for_timeout(850)
        mark("biuro_in")
        # Full office: gabinet, sala, teams already in default fit
        page.wait_for_timeout(11000)
        mark("biuro_out")

        # --- Biblioteka (longest) ---
        page.evaluate("() => { if (RSS.closeSheet) RSS.closeSheet(); RSS.goTab('bibl'); }")
        page.evaluate("() => RSS.views.render('bibl')")
        page.wait_for_function(
            """() => {
              const cy = window.RSS && RSS.views && RSS.views.getCy && RSS.views.getCy();
              return !!(cy && cy.nodes && cy.nodes().length > 20);
            }""",
            timeout=30000,
        )
        page.evaluate(
            """(id) => {
              const cy = RSS.views.getCy();
              cy.resize();
              cy.fit(undefined, 48);
            }""",
            NODE_ID,
        )
        page.wait_for_timeout(800)
        mark("bibl_in")
        page.wait_for_timeout(1200)
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
                  duration: 6500,
                  easing: 'ease-in-out-cubic',
                  complete: resolve
                });
              });
            }""",
            NODE_ID,
        )
        mark("bibl_zoom_end")
        page.wait_for_timeout(400)
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
        page.wait_for_timeout(400)
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
        page.wait_for_timeout(350)
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
        page.wait_for_timeout(10000)
        mark("bibl_out")

        def tab_hold(tab, name, ms, close=True):
            page.evaluate(
                """(t) => { if (window.RSS.closeSheet) RSS.closeSheet(); RSS.goTab(t); }""",
                tab,
            )
            page.wait_for_timeout(450)
            mark(name + "_in")
            page.wait_for_timeout(ms)
            mark(name + "_out")

        # Articles: list, then published COBE reader
        page.evaluate("() => { if (RSS.closeSheet) RSS.closeSheet(); RSS.goTab('art'); }")
        page.wait_for_timeout(400)
        mark("art_list_in")
        page.wait_for_timeout(3500)
        page.evaluate(
            """() => {
              const btn = document.querySelector('#view-art .art-card[data-id="cobe-2026-11-18"]')
                || document.querySelector('#view-art .art-card');
              if (btn) btn.click();
            }"""
        )
        mark("art_cobe")
        page.wait_for_timeout(8000)
        mark("art_out")

        tab_hold("vid", "vid", 8000)
        tab_hold("org", "org", 9000)
        tab_hold("kal", "kal", 8000)
        tab_hold("zar", "zar", 8000)
        tab_hold("kan", "kan", 7000)

        # Settings / Szef-Łącze — public, empty token, do not type, do not click "Pokaż"
        page.evaluate("() => { if (RSS.closeSheet) RSS.closeSheet(); RSS.goTab('settings'); }")
        page.wait_for_timeout(400)
        mark("settings_in")
        page.wait_for_timeout(7000)
        mark("settings_out")

        show_veil(page, v1.END_HTML.replace("ASSET", asset), "1")
        mark("end_in")
        page.wait_for_timeout(4200)
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
    print("recorded", raw, "duration_marks", markers.get("end_out"), "markers", markers)


if __name__ == "__main__":
    main()
