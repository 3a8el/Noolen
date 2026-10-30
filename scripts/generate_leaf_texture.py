"""Generate the burgundy leaf texture used by the About feature panel.

Squares of slightly different tone (like sheets of metal leaf), soft mottling,
faint seams and a diagonal sheen.

Usage: python scripts/generate_leaf_texture.py
"""
import os
import random

from PIL import Image, ImageChops, ImageDraw, ImageFilter

WIDTH, HEIGHT = 1600, 1100
TILE = 150
BASE = (86, 20, 30)  # a lighter, warmer take on --burgundy (#48020c), so it reads as leaf
OUT = 'assets/textures/leaf-burgundy.webp'

random.seed(7)
os.makedirs(os.path.dirname(OUT), exist_ok=True)

# Leaf sheets: each tile shifts the base tone a little, and is laid slightly offset.
image = Image.new('RGB', (WIDTH, HEIGHT), BASE)
draw = ImageDraw.Draw(image)
for row, y in enumerate(range(-TILE, HEIGHT + TILE, TILE)):
    offset = random.randint(-30, 30) + (TILE // 2 if row % 2 else 0)
    for x in range(-TILE + offset, WIDTH + TILE, TILE):
        shift = random.uniform(0.86, 1.14)
        tone = tuple(min(255, int(channel * shift)) for channel in BASE)
        draw.rectangle([x, y, x + TILE + random.randint(-6, 6), y + TILE + random.randint(-6, 6)], fill=tone)

# Faint seams where sheets overlap.
seams = image.filter(ImageFilter.FIND_EDGES).convert('L').point(lambda value: 255 if value > 4 else 0)
seams = seams.filter(ImageFilter.GaussianBlur(1.2))
image = Image.composite(Image.new('RGB', image.size, (60, 6, 14)), image, seams.point(lambda value: value // 5))
image = image.filter(ImageFilter.GaussianBlur(1.5))

# Large soft mottling, then fine grain.
mottle = Image.effect_noise((WIDTH // 40, HEIGHT // 40), 60).resize((WIDTH, HEIGHT), Image.BICUBIC)
mottle = mottle.filter(ImageFilter.GaussianBlur(18)).convert('RGB')
image = Image.blend(image, ImageChops.soft_light(image, mottle), 0.35)

grain = Image.effect_noise((WIDTH, HEIGHT), 28).convert('RGB')
image = Image.blend(image, ImageChops.soft_light(image, grain), 0.55)

# Diagonal sheen, so it catches light like leaf rather than reading as flat paint.
side = int((WIDTH ** 2 + HEIGHT ** 2) ** 0.5) + 2
sheen = Image.linear_gradient('L').resize((side, side)).rotate(-35, resample=Image.BICUBIC)
sheen = sheen.crop(((side - WIDTH) // 2, (side - HEIGHT) // 2, (side + WIDTH) // 2, (side + HEIGHT) // 2))
sheen = Image.merge('RGB', [sheen.point(lambda value: 100 + value // 4)] * 3)
image = ImageChops.soft_light(image, sheen)

image.save(OUT, 'WEBP', quality=82, method=6)
print(f'{OUT}: {os.path.getsize(OUT) / 1024:.0f} KB')
