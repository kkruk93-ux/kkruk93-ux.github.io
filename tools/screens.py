#!/usr/bin/env python3
"""Headless screenshots for QA. Usage: python3 tools/screens.py [outdir] [base_url]"""
import sys, asyncio, os
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "_screens"
BASE = sys.argv[2] if len(sys.argv) > 2 else "http://127.0.0.1:8765/"
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
SHOTS = [
    ("desktop_1280x800", 1280, 800, None, False),
    ("desktop_1280x800_hover", 1280, 800, "hover:comms", False),
    ("desktop_1280x800_log", 1280, 800, "open:log", False),
    ("desktop_1280x800_comms", 1280, 800, "open:comms", False),
    ("desktop_1280x800_crew", 1280, 800, "open:crew", False),
    ("desktop_1280x800_files", 1280, 800, "open:files", False),
    ("desktop_1280x800_music", 1280, 800, "open:music", False),
    ("desktop_1280x800_merch", 1280, 800, "open:merch", False),
    ("desktop_1280x800_rovi", 1280, 800, "open:rovi", False),
    ("desktop_1280x800_shadow", 1280, 800, "click:shadow", False),
    ("desktop_1920x1080", 1920, 1080, None, False),
    ("mobile_390x844", 390, 844, None, True),
    ("mobile_390x844_log", 390, 844, "open:log", True),
    ("mobile_390x844_comms", 390, 844, "open:comms", True),
    ("tablet_768x1024", 768, 1024, None, True),
]
async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        errs = []
        for name, w, h, action, mobile in SHOTS:
            if len(sys.argv) > 3 and sys.argv[3] not in name: continue
            ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile)
            pg = await ctx.new_page()
            pg.on("console", lambda m, n=name: errs.append(f"{n}: {m.type}: {m.text}") if m.type in ("error", "warning") else None)
            pg.on("pageerror", lambda e, n=name: errs.append(f"{n}: pageerror: {e}"))
            await pg.goto(BASE, wait_until="networkidle")
            await pg.wait_for_timeout(1600)
            if action:
                kind, arg = action.split(":")
                sel = f'.hotspot[data-station="{arg}"]'
                if kind == "hover": await pg.hover(sel)
                elif kind in ("open", "click"): await pg.click(sel)
                await pg.wait_for_timeout(1500)
            await pg.screenshot(path=f"{OUT}/{name}.png")
            await ctx.close()
        await b.close()
        print("\n".join(errs) or "no console errors")
asyncio.run(main())
