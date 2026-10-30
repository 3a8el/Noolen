const heroCanvas = document.getElementById('heroCanvas');
const scrollFilm = document.querySelector('.scroll-film');

// Frames are generated from assets/video/noolen-video.mp4 by scripts/extract_hero_frames.py
const FRAME_COUNT = 233;
const frameSet = window.matchMedia('(max-width: 720px)').matches ? 'mobile' : 'desktop';
const frameSrc = (index) => `assets/frames/${frameSet}/frame_${String(index + 1).padStart(4, '0')}.webp`;

const wireHeroScroll = () => {
  if (!heroCanvas || !scrollFilm || !window.gsap || !window.ScrollTrigger) return;

  gsap.registerPlugin(ScrollTrigger);

  const context = heroCanvas.getContext('2d');
  const frames = new Array(FRAME_COUNT);
  const state = { frame: 0 };
  let drawnFrame = -1;

  // Draw the closest frame that has finished loading, so scrubbing never stalls on the network.
  const nearestLoaded = (index) => {
    for (let offset = 0; offset < FRAME_COUNT; offset += 1) {
      if (frames[index - offset]) return index - offset;
      if (frames[index + offset]) return index + offset;
    }
    return -1;
  };

  const render = (force = false) => {
    const index = nearestLoaded(Math.round(state.frame));
    if (index < 0 || (index === drawnFrame && !force)) return;

    const image = frames[index];
    const { width, height } = heroCanvas;
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;

    context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
    drawnFrame = index;
  };

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    heroCanvas.width = Math.round(heroCanvas.clientWidth * ratio);
    heroCanvas.height = Math.round(heroCanvas.clientHeight * ratio);
    context.imageSmoothingQuality = 'high';
    render(true);
  };

  const loadFrame = (index) => {
    const image = new Image();
    image.src = frameSrc(index);
    return image.decode()
      .then(() => {
        frames[index] = image;
        render();
      })
      .catch(() => {});
  };

  // First frame goes out alone so the hero paints immediately, then the rest stream in.
  loadFrame(0).then(() => {
    for (let index = 1; index < FRAME_COUNT; index += 1) loadFrame(index);
  });

  resize();
  window.addEventListener('resize', resize);

  gsap.to(state, {
    frame: FRAME_COUNT - 1,
    ease: 'none',
    onUpdate: render,
    scrollTrigger: {
      trigger: scrollFilm,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.5
    }
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wireHeroScroll, { once: true });
} else {
  wireHeroScroll();
}
