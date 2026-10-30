"""Extract the hero video into WebP frame sequences for the scroll-driven canvas.

Requires: pip install imageio-ffmpeg
Usage:    python scripts/extract_hero_frames.py
"""
import os
import shutil
import subprocess

import imageio_ffmpeg

SOURCE = 'assets/video/noolen-video.mp4'
OUT_ROOT = 'assets/frames'
SETS = {
    'desktop': {'width': 1920, 'quality': 72},
    'mobile': {'width': 1280, 'quality': 68},
}

ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()

for name, opts in SETS.items():
    out_dir = os.path.join(OUT_ROOT, name)
    shutil.rmtree(out_dir, ignore_errors=True)
    os.makedirs(out_dir)

    subprocess.run([
        ffmpeg, '-hide_banner', '-loglevel', 'error',
        '-i', SOURCE,
        '-an',
        '-vf', f"scale={opts['width']}:-2:flags=lanczos",
        '-c:v', 'libwebp',
        '-quality', str(opts['quality']),
        '-compression_level', '6',
        '-start_number', '1',
        os.path.join(out_dir, 'frame_%04d.webp'),
    ], check=True)

    files = sorted(os.listdir(out_dir))
    total = sum(os.path.getsize(os.path.join(out_dir, f)) for f in files)
    print(f'{name}: {len(files)} frames, {total / 1024 / 1024:.1f} MB')
