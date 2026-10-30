from PIL import Image, ImageDraw, ImageFilter, ImageFont
import numpy as np
import os
from imageio import get_writer

width, height = 1280, 720
fps = 30
seconds = 3
font_path = 'C:/Windows/Fonts/arial.ttf'

os.makedirs('assets/video', exist_ok=True)

font = ImageFont.truetype(font_path, 110)
small_font = ImageFont.truetype(font_path, 28)
frames = []

for i in range(fps * seconds):
    t = i / (fps * seconds)
    img = Image.new('RGB', (width, height), '#fcf6dc')
    draw = ImageDraw.Draw(img)

    for x in range(0, width, 18):
        for y in range(0, height, 18):
            if (x + y) % 36 == 0:
                shade = 240 + ((x * 17 + y * 13) % 10)
                draw.rectangle([(x, y), (x + 8, y + 8)], fill=(shade, shade - 10, shade - 25))

    panel = Image.new('RGB', (500, 520), '#f7efe0')
    panel_draw = ImageDraw.Draw(panel)
    for x in range(0, 500, 18):
        panel_draw.line((x, 0, x, 520), fill=(235, 220, 200), width=1)
    for y in range(0, 520, 18):
        panel_draw.line((0, y, 500, y), fill=(230, 215, 200), width=1)

    big = panel.filter(ImageFilter.GaussianBlur(0.2))
    img.paste(big, ((width - big.width) // 2, (height - big.height) // 2 - 16))

    text = 'NOOLEN'
    bbox = draw.textbbox((0, 0), text, font=font)
    x = (width - (bbox[2] - bbox[0])) / 2
    y = (height - (bbox[3] - bbox[1])) / 2 - 25
    draw.text((x, y), text, fill='#311a14', font=font)
    draw.ellipse((int(width * 0.74), int(height * 0.59), int(width * 0.74) + 16, int(height * 0.59) + 16), fill='#311a14')

    tag = 'Identity, tailored.'
    tag_box = draw.textbbox((0, 0), tag, font=small_font)
    tx = (width - (tag_box[2] - tag_box[0])) / 2
    draw.text((tx, height * 0.7), tag, fill='#311a14', font=small_font)

    scale = 1.0 + t * 0.14
    w2 = int(500 * scale)
    h2 = int(520 * scale)
    crop = big.resize((w2, h2), Image.Resampling.LANCZOS)
    paste_x = (width - w2) // 2
    paste_y = (height - h2) // 2 - 10
    img.paste(crop, (paste_x, paste_y))

    frames.append(np.array(img))

video_path = 'assets/video/Noolen-hero.mp4'
with get_writer(video_path, fps=fps, codec='libx264', macro_block_size=None) as writer:
    for frame in frames:
        writer.append_data(frame)

print(f'Created {video_path}')
