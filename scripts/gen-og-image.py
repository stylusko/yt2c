#!/usr/bin/env python3
"""Generate OG image (1200x630) matching the ad placeholder design."""

from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1200, 630
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'og-image.png')
LOGO = os.path.join(os.path.dirname(__file__), '..', 'public', 'icon-round.png')

# Korean font
KR_FONT = "/System/Library/Fonts/AppleSDGothicNeo.ttc"
EN_FONT = "/System/Library/Fonts/Helvetica.ttc"

img = Image.new('RGBA', (W, H))
draw = ImageDraw.Draw(img)

# Gradient background (#1e1b4b -> #312e81, 135 degrees)
for y in range(H):
    for x in range(W):
        t = (x / W + y / H) / 2
        r = int(30 + t * (49 - 30))
        g = int(27 + t * (46 - 27))
        b = int(75 + t * (129 - 75))
        draw.point((x, y), fill=(r, g, b, 255))

# Decorative circles
def draw_circle(cx, cy, radius, color):
    for y in range(max(0, cy - radius), min(H, cy + radius)):
        for x in range(max(0, cx - radius), min(W, cx + radius)):
            if (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2:
                bg = img.getpixel((x, y))
                a = color[3] / 255
                nr = int(bg[0] * (1 - a) + color[0] * a)
                ng = int(bg[1] * (1 - a) + color[1] * a)
                nb = int(bg[2] * (1 - a) + color[2] * a)
                draw.point((x, y), fill=(nr, ng, nb, 255))

draw_circle(W - 100, -50, 200, (99, 102, 241, 38))
draw_circle(-50, H + 30, 150, (139, 92, 246, 31))
draw_circle(W // 2 + 300, H // 2, 180, (99, 102, 241, 20))

# App logo
logo = Image.open(LOGO).convert('RGBA')
logo_size = 120
logo = logo.resize((logo_size, logo_size), Image.LANCZOS)
mask = Image.new('L', (logo_size, logo_size), 0)
mask_draw = ImageDraw.Draw(mask)
mask_draw.rounded_rectangle([0, 0, logo_size, logo_size], radius=28, fill=255)
logo.putalpha(mask)
logo_x = (W - logo_size) // 2
logo_y = H // 2 - 150
img.paste(logo, (logo_x, logo_y), logo)

# Fonts
font_large = ImageFont.truetype(EN_FONT, 64)
font_sub = ImageFont.truetype(KR_FONT, 26)
font_desc = ImageFont.truetype(KR_FONT, 20)

# YOUMECA title
text = "YOUMECA"
bbox = draw.textbbox((0, 0), text, font=font_large)
tw = bbox[2] - bbox[0]
draw.text(((W - tw) // 2, H // 2 - 15), text, fill=(255, 255, 255, 255), font=font_large)

# Korean subtitle
sub = "유메카, 유튜브 영상을 카드뉴스로"
bbox2 = draw.textbbox((0, 0), sub, font=font_sub)
tw2 = bbox2[2] - bbox2[0]
draw.text(((W - tw2) // 2, H // 2 + 60), sub, fill=(255, 255, 255, 153), font=font_sub)

# Description
desc = "내가 꿈꾸던 카드뉴스 생성기"
bbox3 = draw.textbbox((0, 0), desc, font=font_desc)
tw3 = bbox3[2] - bbox3[0]
draw.text(((W - tw3) // 2, H // 2 + 100), desc, fill=(255, 255, 255, 100), font=font_desc)

img = img.convert('RGB')
img.save(OUT, 'PNG', optimize=True)
print(f"OG image saved to {OUT} ({os.path.getsize(OUT)} bytes)")
