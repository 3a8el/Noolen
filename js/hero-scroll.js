const heroVideo = document.getElementById('heroVideo');
const scrollFilm = document.querySelector('.scroll-film');

const wireHeroScroll = () => {
  if (!heroVideo || !scrollFilm || !window.gsap || !window.ScrollTrigger) return;

  const source = document.createElement('source');
  source.src = 'assets/video/Noolen-hero.mp4';
  source.type = 'video/mp4';
  heroVideo.appendChild(source);

  heroVideo.addEventListener('loadedmetadata', () => {
    gsap.registerPlugin(ScrollTrigger);

    let seekFrame = null;
    let targetTime = 0;
    const seekToTarget = () => {
      if (seekFrame !== null || heroVideo.seeking) return;

      seekFrame = requestAnimationFrame(() => {
        seekFrame = null;
        if (!heroVideo.seeking && Math.abs(heroVideo.currentTime - targetTime) > 0.05) {
          heroVideo.currentTime = targetTime;
        }
      });
    };

    heroVideo.addEventListener('seeked', seekToTarget);

    ScrollTrigger.create({
      trigger: scrollFilm,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => {
        targetTime = self.progress * heroVideo.duration;
        seekToTarget();
      }
    });
  }, { once: true });
};

if (heroVideo) {
  heroVideo.muted = true;
  heroVideo.playsInline = true;
  heroVideo.preload = 'metadata';
}

if (document.readyState === 'complete') {
  wireHeroScroll();
} else {
  window.addEventListener('load', wireHeroScroll, { once: true });
}
