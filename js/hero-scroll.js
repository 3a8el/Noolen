const preloader = document.querySelector('.preloader');
const heroVideo = document.getElementById('heroVideo');
const scrollFilm = document.querySelector('.scroll-film');
const copyOne = document.querySelector('.film-copy-one');
const copyTwo = document.querySelector('.film-copy-two');

if (preloader) {
  window.addEventListener('load', () => {
    setTimeout(() => {
      preloader.classList.add('is-hidden');
    }, 850);
  });
}

const wireHeroScroll = () => {
  if (!heroVideo || !scrollFilm || !copyOne || !copyTwo || !window.gsap || !window.ScrollTrigger) return;

  const source = document.createElement('source');
  source.src = 'assets/video/Noolen-hero.mp4';
  source.type = 'video/mp4';
  heroVideo.appendChild(source);

  heroVideo.addEventListener('loadedmetadata', () => {
    gsap.registerPlugin(ScrollTrigger);

    gsap.set(copyOne, { opacity: 0 });
    gsap.set(copyTwo, { opacity: 0 });

    let seekFrame = null;
    let targetTime = 0;

    ScrollTrigger.create({
      trigger: scrollFilm,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => {
        targetTime = self.progress * heroVideo.duration;
        if (seekFrame !== null) return;

        seekFrame = requestAnimationFrame(() => {
          seekFrame = null;
          if (Math.abs(heroVideo.currentTime - targetTime) > 0.05) {
            heroVideo.currentTime = targetTime;
          }
        });
      }
    });

    gsap.timeline({
      scrollTrigger: {
        trigger: scrollFilm,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
      }
    })
      .to(copyOne, { opacity: 1, duration: 0.1 }, 0.15)
      .to(copyOne, { opacity: 0, duration: 0.1 }, 0.45)
      .to(copyTwo, { opacity: 1, duration: 0.1 }, 0.58)
      .to(copyTwo, { opacity: 0, duration: 0.1 }, 0.88);
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
