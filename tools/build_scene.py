#!/usr/bin/env python3
"""Generates the inline SVG art of the bridge (Rovi + Shadow, Earth, mold, stations)
and injects it into ../index.html between <!-- SCENE:START --> and <!-- SCENE:END -->.
Dev-only: the generated markup is committed, GitHub Pages needs no build step.
Reuses the Blue Mold brand drawing code from /workspace/rovihere/branding/src."""
import sys, os, re, math, random
BRAND_SRC = os.environ.get("BRAND_SRC", "/workspace/rovihere/branding/src")
sys.path.insert(0, BRAND_SRC)
from common import P, SHIP                      # noqa: E402
from rovi_profile import rovi_profile            # noqa: E402
from rovi_front import RAVEN, RAVEN_WING         # noqa: E402
from b_scene import veins                        # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
W, H = 240, 300   # station local box

def f(v): return f"{v:.1f}".rstrip("0").rstrip(".")

# ---------------------------------------------------------------- defs
DEFS = f'''
<linearGradient id="gDeskFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#132232"/><stop offset="1" stop-color="#060A10"/></linearGradient>
<linearGradient id="gDeskTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1B2C3E"/><stop offset="1" stop-color="#22374C"/></linearGradient>
<linearGradient id="gBezel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#16273A"/><stop offset="1" stop-color="#090F17"/></linearGradient>
<radialGradient id="gScreen" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#0B3340"/><stop offset="1" stop-color="#030C12"/></radialGradient>
<radialGradient id="gGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#5CE6F2" stop-opacity=".55"/><stop offset=".45" stop-color="#2BB3C4" stop-opacity=".18"/><stop offset="1" stop-color="#1E7F94" stop-opacity="0"/></radialGradient>
<radialGradient id="gGlowSoft" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#2BB3C4" stop-opacity=".35"/><stop offset="1" stop-color="#1E7F94" stop-opacity="0"/></radialGradient>
<radialGradient id="gAmber" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFC46B" stop-opacity=".8"/><stop offset="1" stop-color="#FF9A3C" stop-opacity="0"/></radialGradient>
<linearGradient id="gSweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5CE6F2" stop-opacity="0"/><stop offset="1" stop-color="#5CE6F2" stop-opacity=".55"/></linearGradient>
<linearGradient id="gHolo" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#5CE6F2" stop-opacity=".42"/><stop offset=".7" stop-color="#2BB3C4" stop-opacity=".08"/><stop offset="1" stop-color="#2BB3C4" stop-opacity="0"/></linearGradient>
<pattern id="pHazard" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="16" height="16" fill="#151C24"/><rect width="8" height="16" fill="#C98A2E"/></pattern>
<radialGradient id="gEarth" cx="22%" cy="10%" r="95%"><stop offset="0" stop-color="#2A86A3"/><stop offset=".35" stop-color="#0F3A55"/><stop offset="1" stop-color="#030810"/></radialGradient>
<radialGradient id="gEarthAtm" cx="50%" cy="50%" r="50%"><stop offset=".9" stop-color="#6FDDEB" stop-opacity="0"/><stop offset=".955" stop-color="#6FDDEB" stop-opacity=".35"/><stop offset="1" stop-color="#6FDDEB" stop-opacity="0"/></radialGradient>
<clipPath id="cEarth"><circle r="1000"/></clipPath>
<linearGradient id="gHull" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#111C29"/><stop offset="1" stop-color="#060A10"/></linearGradient>
<linearGradient id="gWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0C1622"/><stop offset="1" stop-color="#04070C"/></linearGradient>
<filter id="veinglowM" x="-0.3" y="-0.3" width="1.6" height="1.6" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="4"/></filter>
'''

# ---------------------------------------------------------------- earth (centred at 0,0, r=1000)
def earth():
    rnd = random.Random(7)
    s = ['<g id="earth">',
         '<circle r="1060" fill="url(#gEarthAtm)"/>',
         '<circle r="1000" fill="url(#gEarth)"/>',
         '<g clip-path="url(#cEarth)"><g class="earth-spin">']
    # cloud bands + city lights distributed all around so the slow spin stays seamless
    s.append('<g fill="none" stroke="#CFEFF5" stroke-linecap="round" opacity=".09">')
    for i in range(46):
        rr = rnd.uniform(780, 990); a0 = rnd.uniform(0, 360); a1 = a0 + rnd.uniform(8, 26)
        x0, y0 = rr*math.cos(math.radians(a0)), rr*math.sin(math.radians(a0))
        x1, y1 = rr*math.cos(math.radians(a1)), rr*math.sin(math.radians(a1))
        s.append(f'<path d="M {x0:.0f} {y0:.0f} A {rr:.0f} {rr:.0f} 0 0 1 {x1:.0f} {y1:.0f}" stroke-width="{rnd.uniform(4,13):.0f}"/>')
    s.append('</g><g fill="#F3C98B">')
    for i in range(220):
        rr = rnd.uniform(850, 990); a = rnd.uniform(0, 360)
        s.append(f'<circle cx="{rr*math.cos(math.radians(a)):.0f}" cy="{rr*math.sin(math.radians(a)):.0f}" r="{rnd.uniform(.9,2.3):.1f}" opacity="{rnd.uniform(.25,.7):.2f}"/>')
    s.append('</g></g>')
    # day side lighting overlay (fixed, top-left light) so the spin reads as rotation under the light
    s.append('<circle r="1000" fill="url(#gEarth)" opacity=".35"/></g>')
    s.append('<circle r="999" fill="none" stroke="#D5FBFF" stroke-width="3.5" opacity=".9"/>')
    s.append('</g>')
    return "".join(s)


def moon():
    rnd = random.Random(5)
    craters = "".join(f'<circle cx="{rnd.uniform(-30,30):.0f}" cy="{rnd.uniform(-30,30):.0f}" r="{rnd.uniform(3,9):.1f}" fill="#4F5F70" opacity="{rnd.uniform(.25,.5):.2f}"/>' for _ in range(9))
    br = "M -84 -60 V -84 H -60 M 60 -84 H 84 V -60 M 84 60 V 84 H 60 M -60 84 H -84 V 60"
    return f'''<g id="moon">
<radialGradient id="gMoon" cx="30%" cy="28%" r="80%"><stop offset="0" stop-color="#C7D3DE"/><stop offset=".55" stop-color="#6F8193"/><stop offset="1" stop-color="#1A2633"/></radialGradient>
<clipPath id="cMoon"><circle r="46"/></clipPath>
<circle r="58" fill="url(#gGlowSoft)" opacity=".6"/>
<circle r="46" fill="url(#gMoon)"/><g clip-path="url(#cMoon)">{craters}<circle cx="22" cy="18" r="52" fill="#05080F" opacity=".45"/></g>
<g class="reticle"><path d="{br}" fill="none" stroke="{P["glow"]}" stroke-width="2.5" opacity=".75"/></g>
<path d="M 84 0 H 150 L 168 -18 H 300" fill="none" stroke="{P["glow"]}" stroke-width="1.5" opacity=".5"/>
<text x="176" y="-26" class="svgmono" font-size="15" letter-spacing="3" fill="{P["ice"]}" opacity=".85">LUNA · TRACKED</text>
<text x="176" y="2" class="svgmono" font-size="12" letter-spacing="2" fill="{P["mold2"]}" opacity=".8">DIST 384 400 KM</text>
<text class="led svgmono" style="--t:2s" x="176" y="22" font-size="12" letter-spacing="2" fill="{P["mold2"]}" opacity=".8">NO RESIDENTS DETECTED</text>
</g>'''

# ---------------------------------------------------------------- mold colonies (centred at 0,0)
def colony(seed, ang, n=7, L=170, patch=70, spread=38, scale=1.15):
    rnd = random.Random(seed)
    starts = [(rnd.uniform(-patch*.35, patch*.35), rnd.uniform(-patch*.35, patch*.35), ang + rnd.uniform(-spread, spread), L*rnd.uniform(.45, 1.0)) for _ in range(n)]
    blobs = "".join(f'<circle cx="{rnd.uniform(-patch*.4, patch*.4):.0f}" cy="{rnd.uniform(-patch*.4, patch*.4):.0f}" r="{patch*rnd.uniform(.6,1.1):.0f}" fill="url(#gGlowSoft)"/>' for _ in range(3))
    v = veins(seed, starts, "M", scale=scale)
    return f'<g class="mold-blobs">{blobs}</g><g class="mold-veins">{v}</g>'

COLONIES = {  # id: (seed, growth angle) — placed on window corners by JS
    "moldTL": (71, 40), "moldBL": (72, -42), "moldTR": (73, 140), "moldBR": (74, -138), "moldMid": (75, -90),
}

# ---------------------------------------------------------------- Rovi + Shadow
RAISED_WING = ("M 800 700 C 790 640 760 580 700 512 L 690 548 L 655 530 L 664 568 L 626 560 L 642 598 L 604 600 "
               "L 630 632 L 596 646 L 636 668 L 610 690 C 660 720 720 760 776 790 Z")
def rovi():
    d, g = rovi_profile("R", raven=False)
    sh = f'''
<g id="shadow" class="shadow" transform="translate(292 812) scale(-0.98 0.98) translate(-780 -834)">
  <g class="sh-bob">
    <path d="{RAVEN}" fill="#05070B" stroke="#8FE6F0" stroke-width="3.5" stroke-linejoin="round" stroke-opacity=".75"/>
    <path class="sh-wing" d="{RAVEN_WING}" fill="#0E1520"/>
    <path class="sh-wing" d="M 772 700 C 764 730 760 770 764 806" stroke="{P["mold2"]}" stroke-width="2.5" fill="none" opacity=".8"/>
    <g class="sh-wing-up"><path d="{RAISED_WING}" fill="#0B121B" stroke="#8FE6F0" stroke-width="3" stroke-linejoin="round" stroke-opacity=".8"/>
      <path d="M 770 720 C 740 660 712 600 690 560 M 750 740 C 700 700 660 670 630 640" stroke="{P["mold2"]}" stroke-width="2.5" fill="none" opacity=".7"/></g>
    <g class="sh-eye">
      <circle class="sh-eyeglow" cx="818" cy="602" r="30" fill="url(#gGlow)"/>
      <circle cx="818" cy="602" r="8.5" fill="{P["glow"]}"/>
      <circle cx="820" cy="600" r="3" fill="#ffffff"/>
    </g>
  </g>
</g>'''
    return d, f'<g class="rovi-body">{g}</g>{sh}'

# ---------------------------------------------------------------- stations
def brackets(w=W, h=H, pad=6, L=22):
    x0, y0, x1, y1 = -pad, 6, w + pad, h + pad
    p = (f"M {x0} {y0+L} V {y0} H {x0+L} M {x1-L} {y0} H {x1} V {y0+L} "
         f"M {x1} {y1-L} V {y1} H {x1-L} M {x0+L} {y1} H {x0} V {y1-L}")
    return f'<path class="hl" d="{p}" fill="none" stroke="{P["glow"]}" stroke-width="3"/>'

def desk(cargo=False, leds=5, seed=1):
    rnd = random.Random(seed)
    s = [f'<ellipse class="spill" cx="120" cy="190" rx="130" ry="26" fill="url(#gGlowSoft)"/>',
         '<path d="M 14 176 L 226 176 L 240 196 L 0 196 Z" fill="url(#gDeskTop)"/>',
         '<path d="M 0 196 L 240 196 L 232 300 L 8 300 Z" fill="url(#gDeskFront)"/>']
    if cargo:
        s.append('<path d="M 0 196 L 240 196 L 239 208 L 1 208 Z" fill="url(#pHazard)" opacity=".85"/>')
    s.append(f'<path class="edge" d="M 0 196 L 240 196" stroke="{P["mold2"]}" stroke-width="2" opacity=".55"/>')
    s.append('<path d="M 14 176 L 226 176" stroke="#35506B" stroke-width="1.5"/>')
    # led row
    for i in range(leds):
        col = rnd.choice([P["glow"], P["glow"], P["mold2"], "#FFB14A"])
        s.append(f'<rect class="led" style="--d:{rnd.uniform(0,3):.2f}s;--t:{rnd.uniform(1.2,3.6):.2f}s" x="{22+i*14}" y="{218 if not cargo else 222}" width="8" height="4" rx="1" fill="{col}"/>')
    # label plate (text is an HTML chip on top) + vents
    s.append('<rect x="22" y="238" width="196" height="26" rx="3" fill="#08101A" stroke="#22374C" stroke-width="1.5"/>')
    s.append('<path d="M 30 276 H 210 M 34 284 H 206 M 38 292 H 202" stroke="#0D1621" stroke-width="3"/>')
    s.append(f'<circle cx="208" cy="220" r="3" fill="{P["glow"]}" class="led" style="--d:.4s;--t:2.2s"/>')
    return "".join(s)

def screen_lines(seed, x, y, w, rows, gap=9, h=3.5):
    rnd = random.Random(seed); out = []
    for i in range(rows):
        lw = rnd.uniform(.25, 1) * w
        op = rnd.uniform(.35, .85)
        out.append(f'<rect x="{x}" y="{y+i*gap:.1f}" width="{lw:.0f}" height="{h}" rx="1" fill="{P["glow"]}" opacity="{op:.2f}"/>')
    return "".join(out)

def st_log():
    lines = screen_lines(11, 50, 66, 136, 16)
    return f'''{desk(seed=2)}
<rect x="110" y="150" width="20" height="28" fill="#0C1520"/>
<path d="M 26 34 L 214 34 L 206 158 L 34 158 Z" fill="url(#gBezel)" stroke="#2A3F55" stroke-width="3"/>
<path d="M 38 46 L 202 46 L 196 146 L 44 146 Z" fill="url(#gScreen)"/>
<clipPath id="cLog"><path d="M 38 60 L 202 60 L 196 146 L 44 146 Z"/></clipPath>
<g clip-path="url(#cLog)"><g class="scroll">{lines}<g transform="translate(0 144)">{lines}</g></g></g>
<path d="M 38 46 L 202 46 L 201 60 L 39 60 Z" fill="#0A2530"/>
<text x="46" y="57" class="svgmono" font-size="9" fill="{P["glow"]}" letter-spacing="1.5">CAPTAIN'S LOG</text>
<rect class="cursor" x="180" y="50" width="7" height="8" fill="{P["glow"]}"/>
<path d="M 38 46 L 202 46 L 196 146 L 44 146 Z" fill="none" stroke="#5CE6F2" stroke-opacity=".25"/>
<path d="M 30 186 H 100 M 30 190 H 90" stroke="#2E4660" stroke-width="2"/>'''

def st_comms():
    rings = "".join(f'<circle r="{r}" fill="none" stroke="{P["mold2"]}" stroke-opacity=".35"/>' for r in (20, 40, 60))
    blips = "".join(f'<circle class="blip" style="--d:{d}s" cx="{x}" cy="{y}" r="3" fill="{P["ice"]}"/>' for x, y, d in ((24, -30, 0), (-38, 18, 1.4), (12, 40, 2.6), (-20, -44, 3.3)))
    return f'''{desk(seed=3)}
<rect x="210" y="40" width="5" height="138" fill="#1A2838"/>
<path d="M 200 70 H 226 M 204 96 H 222" stroke="#2A3F55" stroke-width="3"/>
<circle class="beacon" cx="212.5" cy="36" r="5" fill="#FF6B5C"/>
<circle class="beacon-glow" cx="212.5" cy="36" r="16" fill="url(#gAmber)"/>
<path d="M 108 168 L 132 168 L 128 150 L 112 150 Z" fill="#0C1520"/>
<circle cx="110" cy="92" r="74" fill="url(#gBezel)" stroke="#2A3F55" stroke-width="4"/>
<g transform="translate(110 92)">
  <circle r="62" fill="url(#gScreen)"/>{rings}
  <path d="M -62 0 H 62 M 0 -62 V 62" stroke="{P["mold2"]}" stroke-opacity=".3"/>
  <g class="sweep"><path d="M 0 0 L 62 0 A 62 62 0 0 0 53.7 -31 Z" fill="url(#gSweep)"/><path d="M 0 0 L 62 0" stroke="{P["ice"]}" stroke-width="1.5"/></g>
  {blips}
  <circle r="62" fill="none" stroke="#5CE6F2" stroke-opacity=".3"/>
</g>
<g class="bars" transform="translate(28 168)">{"".join(f'<rect class="sig" style="--d:{i*0.18:.2f}s" x="{i*8}" y="{-6-i*4}" width="5" height="{6+i*4}" fill="{P["glow"]}"/>' for i in range(4))}</g>'''

def st_files():
    return f'''{desk(seed=4)}
<rect x="100" y="150" width="40" height="28" fill="#0C1520"/>
<path d="M 18 44 L 222 44 L 216 158 L 24 158 Z" fill="url(#gBezel)" stroke="#2A3F55" stroke-width="3"/>
<path d="M 30 56 L 210 56 L 205 146 L 35 146 Z" fill="url(#gScreen)"/>
<g stroke="{P["mold2"]}" stroke-opacity=".18">{"".join(f'<path d="M {x} 56 V 146"/>' for x in range(50, 210, 20))}{"".join(f'<path d="M 30 {y} H 210"/>' for y in range(66, 146, 20))}</g>
<g class="ufo">
  <ellipse cx="120" cy="104" rx="38" ry="9" fill="none" stroke="{P["ice"]}" stroke-width="2"/>
  <path d="M 98 101 C 102 84 138 84 142 101" fill="none" stroke="{P["ice"]}" stroke-width="2"/>
  <path d="M 84 104 H 156" stroke="{P["glow"]}" stroke-opacity=".5"/>
  <circle class="led" style="--d:0s;--t:.9s" cx="104" cy="106" r="2" fill="{P["glow"]}"/><circle class="led" style="--d:.3s;--t:.9s" cx="120" cy="108" r="2" fill="{P["glow"]}"/><circle class="led" style="--d:.6s;--t:.9s" cx="136" cy="106" r="2" fill="{P["glow"]}"/>
</g>
<path class="trackbox" d="M 78 76 h 12 M 78 76 v 12 M 162 76 h -12 M 162 76 v 12 M 78 128 h 12 M 78 128 v -12 M 162 128 h -12 M 162 128 v -12" stroke="#FF8A5C" stroke-width="2" fill="none"/>
<text x="38" y="68" class="svgmono" font-size="9" fill="{P["glow"]}" letter-spacing="1.5">FILE #006</text>
<text x="38" y="141" class="svgmono" font-size="8" fill="{P["mold2"]}" letter-spacing="1">OBSERVED · 1947</text>
<rect class="classified" x="146" y="132" width="56" height="12" fill="none" stroke="#FF6B5C" stroke-width="1.5"/>
<text class="classified svgmono" x="174" y="141" text-anchor="middle" font-size="7.5" font-family="IBM Plex Mono" fill="#FF6B5C" letter-spacing="1">CLASSIFIED</text>
<path d="M 156 176 L 168 162 L 222 162 L 226 176 Z" fill="#1A2838"/><path d="M 160 168 L 220 168" stroke="#C9A35E" stroke-width="2" opacity=".6"/>'''

def st_crew():
    nodes = "".join(f'<circle cx="{86*math.cos(math.radians(a)):.1f}" cy="{86*math.sin(math.radians(a)):.1f}" r="9" fill="{P["ice"]}" fill-opacity=".85"/>' for a in range(0, 360, 60))
    nodes2 = "".join(f'<path d="M 0 0 L {86*math.cos(math.radians(a)):.1f} {86*math.sin(math.radians(a)):.1f}" stroke="{P["glow"]}" stroke-opacity=".35" stroke-width="2"/>' for a in range(0, 360, 60))
    return f'''{desk(seed=5)}
<path class="holo-cone" d="M 66 170 L 174 170 L 214 30 L 26 30 Z" fill="url(#gHolo)"/>
<g class="holo">
  <g transform="translate(120 104) scale(1 .3)"><circle r="86" fill="none" stroke="{P["glow"]}" stroke-width="3" stroke-opacity=".7"/><circle r="50" fill="none" stroke="{P["mold2"]}" stroke-width="2" stroke-opacity=".5"/><g class="spin">{nodes2}{nodes}</g></g>
  <g transform="translate(92 62) scale(.72)"><path d="{SHIP}" fill="{P["ice"]}" fill-opacity=".8"/></g>
  <path d="M 120 104 V 150" stroke="{P["glow"]}" stroke-opacity=".35" stroke-dasharray="3 4"/>
</g>
<ellipse cx="120" cy="172" rx="62" ry="10" fill="#0E1B2B" stroke="{P["mold2"]}" stroke-width="2"/>
<ellipse class="led" style="--d:0s;--t:2.4s" cx="120" cy="171" rx="40" ry="5" fill="{P["glow"]}" opacity=".6"/>'''

def st_music():
    rnd = random.Random(9)
    bars = "".join(f'<rect class="eq" style="--d:-{rnd.uniform(0,1.5):.2f}s;--t:{rnd.uniform(.55,1.25):.2f}s;--h:{.25+.7*abs(math.sin(i*1.7)):.2f}" x="{40+i*11}" y="40" width="7" height="58" fill="{P["glow"]}" opacity="{.55+.4*rnd.random():.2f}"/>' for i in range(15))
    knobs = "".join(f'<circle cx="{40+i*32}" cy="134" r="8" fill="#0A0F17" stroke="#3A5670" stroke-width="2"/><path d="M {40+i*32} 134 l {5*math.cos(rnd.uniform(0,6)):.1f} {5*math.sin(rnd.uniform(0,6)):.1f}" stroke="{P["glow"]}" stroke-width="2"/>' for i in range(6))
    faders = "".join(f'<rect x="{46+i*30}" y="150" width="4" height="22" fill="#05080D"/><rect class="fader" style="--d:-{rnd.uniform(0,4):.2f}s" x="{41+i*30}" y="{154+rnd.uniform(0,10):.0f}" width="14" height="6" rx="1" fill="#9FB3C4"/>' for i in range(6))
    return f'''{desk(seed=6)}
<path d="M 24 20 L 216 20 L 214 108 L 26 108 Z" fill="url(#gBezel)" stroke="#2A3F55" stroke-width="3"/>
<rect x="34" y="28" width="172" height="74" fill="url(#gScreen)"/>
<g class="eqwrap">{bars}</g>
<text x="38" y="38" class="svgmono" font-size="8" fill="{P["ice"]}" letter-spacing="1.5">BLUE MOLD // AUDIO</text>
<path d="M 14 116 L 226 116 L 234 178 L 6 178 Z" fill="url(#gBezel)" stroke="#2A3F55" stroke-width="2"/>
{knobs}{faders}'''

def st_merch():
    return f'''{desk(cargo=True, seed=7)}
<path d="M 30 70 L 196 70 L 196 178 L 30 178 Z" fill="#111C28" stroke="#2C4057" stroke-width="3"/>
<path d="M 30 92 H 196 M 30 156 H 196" stroke="#2C4057" stroke-width="2"/>
<rect x="30" y="98" width="166" height="14" fill="url(#pHazard)" opacity=".75"/>
<text x="113" y="140" text-anchor="middle" font-family="Big Shoulders Display" font-weight="800" font-size="26" letter-spacing="3" fill="#2E4660">RH-03</text>
<path d="M 70 26 L 158 26 L 158 70 L 70 70 Z" fill="#0F1925" stroke="#2C4057" stroke-width="3"/>
<path d="M 70 40 H 158" stroke="#2C4057" stroke-width="2"/>
<text x="114" y="61" text-anchor="middle" class="svgmono" font-size="9" fill="#C98A2E" letter-spacing="2">SEALED</text>
<path d="M 200 178 L 200 120 L 228 120 L 228 178 Z" fill="#0F1925" stroke="#2C4057" stroke-width="2"/>
<rect class="led" style="--d:0s;--t:1.6s" x="207" y="128" width="14" height="5" fill="#FFB14A"/>
<rect class="led" style="--d:.8s;--t:1.6s" x="207" y="138" width="14" height="5" fill="#FFB14A"/>
<circle class="beacon amber" cx="114" cy="16" r="6" fill="#FFB14A"/>
<circle class="beacon-glow" cx="114" cy="16" r="20" fill="url(#gAmber)"/>'''

STATIONS = [("log", st_log), ("comms", st_comms), ("files", st_files), ("crew", st_crew), ("music", st_music), ("merch", st_merch)]

def build():
    rd, rg = rovi()
    parts = [f'<defs>{DEFS}{rd}</defs>']
    parts.append(f'<g id="L-earth">{moon()}{earth()}</g>')
    parts.append('<g id="L-glow"></g>')  # JS: backlight
    parts.append('<g id="L-hull"></g>')  # JS: walls + window frame
    parts.append('<g id="L-mold">' + "".join(f'<g id="{k}" class="mold" style="--md:{i*1.3:.1f}s">{colony(*v)}</g>' for i, (k, v) in enumerate(COLONIES.items())) + '</g>')
    parts.append(f'<g id="L-rovi"><g id="rovi">{rg}<rect class="hit" id="hit-rovi" x="330" y="150" width="500" height="560" fill="transparent"/><circle class="hit" id="hit-shadow" cx="250" cy="600" r="70" fill="transparent"/></g></g>')
    parts.append('<g id="L-spores"></g>')
    st = []
    for i, (sid, fn) in enumerate(STATIONS):
        st.append(f'<g id="st-{sid}" class="station" data-station="{sid}">{fn()}{brackets()}<rect class="hit" x="0" y="10" width="{W}" height="{H-10}" fill="transparent"/></g>')
    parts.append('<g id="L-stations">' + "".join(st) + '</g>')
    svg = "\n".join(parts)
    svg = re.sub(r"\s+\n", "\n", svg)
    return svg

if __name__ == "__main__":
    svg = build()
    idx = os.path.join(ROOT, "index.html")
    html = open(idx).read()
    new = re.sub(r"(<!-- SCENE:START -->).*?(<!-- SCENE:END -->)", lambda m: m.group(1) + "\n" + svg + "\n" + m.group(2), html, flags=re.S)
    open(idx, "w").write(new)
    print("scene injected:", len(svg), "bytes")
