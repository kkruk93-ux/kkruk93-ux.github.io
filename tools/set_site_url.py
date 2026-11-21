#!/usr/bin/env python3
"""Make og:image / og:url / twitter:image / canonical absolute (social previews need absolute URLs).
Usage: python3 tools/set_site_url.py https://USER.github.io/REPO/"""
import sys, re, os
if len(sys.argv) != 2 or not sys.argv[1].startswith("http"):
    sys.exit(__doc__)
base = sys.argv[1].rstrip("/") + "/"
p = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "index.html")
h = open(p, encoding="utf-8").read()
img = base + "assets/img/og-image.png"
h = re.sub(r'(<link rel="canonical" href=")[^"]*(")', rf'\g<1>{base}\2', h)
h = re.sub(r'(<meta property="og:url" content=")[^"]*(")', rf'\g<1>{base}\2', h)
h = re.sub(r'(<meta property="og:image" content=")[^"]*(")', rf'\g<1>{img}\2', h)
h = re.sub(r'(<meta name="twitter:image" content=")[^"]*(")', rf'\g<1>{img}\2', h)
open(p, "w", encoding="utf-8").write(h)
print("index.html updated for", base)
