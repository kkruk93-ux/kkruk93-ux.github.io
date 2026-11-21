#!/usr/bin/env python3
"""OG image 1200x630 from the Blue Mold brand code (concept B). Dev-only."""
import sys, os
sys.path.insert(0, os.environ.get("BRAND_SRC", "/workspace/rovihere/branding/src"))
from common import P, svg
from b_scene import scene_defs, earth, stars, spores, colony, rovi_group
import subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
W, H = 1200, 630
uid = "og"
rd, rg = rovi_group("ogr", 640, 22, 0.6)
defs = scene_defs(uid) + rd + (f'<radialGradient id="sp{uid}" cx="82%" cy="58%" r="90%"><stop offset="0" stop-color="#12465E"/>'
        f'<stop offset=".4" stop-color="#0A1F30"/><stop offset="1" stop-color="#03060B"/></radialGradient>')
strut = "M 0 0 L 96 0 L 60 630 L 0 630 Z"
x0 = 128
body = f'''
<rect width="{W}" height="{H}" fill="url(#sp{uid})"/>
{stars(0, 0, W, H, 120, 5)}
{earth(1420, 960, 760, uid)}
{rg}
{spores(16, 6, (120, 40, 1180, 600), uid)}
<path d="{strut}" fill="url(#hull{uid})"/><path d="M 96 0 L 60 630" stroke="#2A3D52" stroke-width="5"/>
{colony(92, 40, 30, 6, 150, 31, uid, patch=55, spread=35)}{colony(64, 600, -40, 6, 150, 32, uid, patch=55, spread=35)}
<g font-family="IBM Plex Mono">
  <text x="{x0+3}" y="214" font-weight="500" font-size="21" letter-spacing="4.6" fill="{P["glow"]}">ROVI ON EARTH FILES · BLUE MOLD MUSIC</text>
  <text x="{x0}" y="352" font-family="Big Shoulders Display" font-weight="800" font-size="158" letter-spacing="5.5" fill="{P["bone"]}">ROVI HERE</text>
  <rect x="{x0+3}" y="384" width="66" height="4" fill="{P["mold2"]}"/>
  <text x="{x0+86}" y="394" font-size="30" letter-spacing="1.5" fill="#C8D6E2">the file or nothing.</text>
  <text x="{x0+3}" y="470" font-size="16" letter-spacing="5" fill="#6E8597">STEP ONTO THE BRIDGE OF THE BLUE MOLD</text>
</g>'''
out = os.path.join(ROOT, "assets/img/og-image")
open(out + ".svg", "w").write(svg(W, H, body, defs))
subprocess.run(["rsvg-convert", out + ".svg", "-o", out + ".png"], check=True)
os.remove(out + ".svg")
from PIL import Image  # 256-colour quantize: ~3x smaller, no visible loss
Image.open(out + ".png").convert("RGB").quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(out + ".png", optimize=True)
print("ok", out + ".png")
