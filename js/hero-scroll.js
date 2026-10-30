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

const setupFallbackVideo = () => {
  document.body.classList.add('video-fallback');
};

const loadHeroVideo = () => {
  if (!heroVideo) return;

  const videoPath = 'assets/video/Noolen-hero.mp4';
  const source = document.createElement('source');
  source.src = videoPath;
  source.type = 'video/mp4';
  heroVideo.appendChild(source);
  heroVideo.addEventListener('error', setupFallbackVideo, { once: true });

  if (!window.gsap || !window.ScrollTrigger || !scrollFilm) return;

  const initScrollVideo = () => {
    const duration = heroVideo.duration || 10;

    gsap.registerPlugin(ScrollTrigger);

    gsap.to(copyOne, {
      opacity: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: scrollFilm,
        start: 'top top',
        end: '+=35%',
        scrub: true,
      },
    });

    gsap.to(copyOne, {
      opacity: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: scrollFilm,
        start: '+=25% center',
        end: '+=20% center',
        scrub: true,
      },
    });

    gsap.to(copyTwo, {
      opacity: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: scrollFilm,
        start: '+=45% center',
        end: '+=20% center',
        scrub: true,
      },
    });

    gsap.to(copyTwo, {
      opacity: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: scrollFilm,
        start: '+=65% center',
        end: '+=18% center',
        scrub: true,
      },
    });

    gsap.to(heroVideo, {
      currentTime: duration,
      ease: 'none',
      scrollTrigger: {
        trigger: scrollFilm,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
      },
    });
  };

  if (heroVideo.readyState >= 1) {
    initScrollVideo();
  } else {
    heroVideo.addEventListener('loadedmetadata', initScrollVideo, { once: true });
  }
};

if (window.gsap && window.ScrollTrigger && scrollFilm && copyOne && copyTwo) {
  const fallbackCopy = () => {
    gsap.set(copyOne, { opacity: 1 });
    gsap.set(copyTwo, { opacity: 0.8 });
  };

  loadHeroVideo();

  if (!heroVideo || !heroVideo.querySelector('source')) {
    fallbackCopy();
  }
} else {
  loadHeroVideo();
}
