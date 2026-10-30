"""Cut the product photos out of their grey-white backgrounds for the hero product slides.

Each garment is trimmed to its outline and saved as a transparent WebP, so the page can
place it on the hero's cream at the same size as the polo in the video's last frame.

Requires: pip install "rembg[cpu]"
Usage:    python scripts/prepare_products.py "D:/Noolen Material/Noolen/Products/Logo Edited Products"
"""
import os
import sys

from PIL import Image
from rembg import new_session, remove

SOURCE_DIR = sys.argv[1]
OUT_DIR = 'assets/products'
HEIGHT = 1400  # tall enough for a sharp garment on a 2x phone screen

PRODUCTS = {
    'polo': 'Noolen_Polo_Brown.png',
    'dress-shirt': 'Noolen_Dress_Shirt_White.png',
    'blazer': 'Noolen_Blazer_Brown.png',
    'school-uniform': 'Noolen_School_Uniform_Set.png',
    'coverall': 'Noolen_Coverall_Black_Maroon.png',
}

os.makedirs(OUT_DIR, exist_ok=True)
session = new_session('isnet-general-use')

for slug, filename in PRODUCTS.items():
    photo = Image.open(os.path.join(SOURCE_DIR, filename)).convert('RGB')
    cutout = remove(photo, session=session, post_process_mask=True)

    # Trim to the garment, ignoring faint matte haze.
    bounds = cutout.getchannel('A').point(lambda value: 255 if value > 24 else 0).getbbox()
    cutout = cutout.crop(bounds)
    cutout = cutout.resize((round(cutout.width * HEIGHT / cutout.height), HEIGHT), Image.LANCZOS)

    out = os.path.join(OUT_DIR, f'{slug}.webp')
    cutout.save(out, 'WEBP', quality=86, method=6)
    print(f'{out}: {cutout.width}x{cutout.height}, {os.path.getsize(out) / 1024:.0f} KB')
