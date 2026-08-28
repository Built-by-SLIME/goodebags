#!/usr/bin/env python3
"""Generate 1200x630 social share previews from the square source."""
from PIL import Image, ImageFilter, ImageEnhance

SRC = "SocialShareImageGB.jpeg"
W, H = 1200, 630

img = Image.open(SRC).convert("RGB")
sw, sh = img.size

# ── Trim baked-in black bars (rows whose mean brightness is near-black) ──
gray = img.convert("L")
px = gray.load()
row_has_content = []
for y in range(sh):
    step = 8
    vals = [px[x, y] for x in range(0, sw, step)]
    row_has_content.append(max(vals) > 40)  # any bright pixel = content row
top = next(y for y, c in enumerate(row_has_content) if c)
bottom = next(y for y in range(sh - 1, -1, -1) if row_has_content[y])
# small margin so we don't clip glow edges
top = max(0, top - 6)
bottom = min(sh, bottom + 7)
content = img.crop((0, top, sw, bottom))
cw, ch = content.size
print(f"trimmed content: {cw}x{ch} (y {top}..{bottom})")

# ── Version 1: blurred-fill background, full content centered ──
bg = content.copy()
# scale to fill 1200x630
scale = max(W / cw, H / ch)
bg = bg.resize((round(cw * scale), round(ch * scale)), Image.LANCZOS)
bx = (bg.width - W) // 2
by = (bg.height - H) // 2
bg = bg.crop((bx, by, bx + W, by + H))
bg = bg.filter(ImageFilter.GaussianBlur(40))
bg = ImageEnhance.Brightness(bg).enhance(0.55)  # darken for contrast

fg = content.copy()
fscale = H / ch  # fit height exactly
fg = fg.resize((round(cw * fscale), H), Image.LANCZOS)
v1 = bg.copy()
v1.paste(fg, ((W - fg.width) // 2, 0))
v1.save("social-share-preview-blur.jpg", quality=90)
print(f"blur-fill: fg {fg.width}x{H} on {W}x{H}")

# ── Version 2: straight center crop to 1.905:1, resized ──
target_h = round(cw / (W / H))  # 658
if target_h <= ch:
    cy = (ch - target_h) // 2
    v2src = content.crop((0, cy, cw, cy + target_h))
else:
    v2src = content
v2 = v2src.resize((W, H), Image.LANCZOS)
v2.save("social-share-preview-crop.jpg", quality=90)
print(f"center-crop: kept y {cy}..{cy + target_h} of trimmed content")
