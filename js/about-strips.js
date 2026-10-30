const aboutFeature = document.querySelector('.about-feature');

const wireAboutStrips = () => {
  if (!aboutFeature || !window.gsap || !window.ScrollTrigger) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  gsap.registerPlugin(ScrollTrigger);

  const strips = aboutFeature.querySelectorAll('.about-feature-strips span:not(.is-gap)');
  const copy = aboutFeature.querySelectorAll('.about-feature-copy > *');
  const media = aboutFeature.querySelector('.about-feature-media');

  // Strips run left-to-right beside the panel on desktop, and bottom-to-top above it on phones.
  gsap.matchMedia().add({ desktop: '(min-width: 901px)', mobile: '(max-width: 900px)' }, ({ conditions }) => {
    const scale = conditions.desktop ? 'scaleX' : 'scaleY';
    const drift = conditions.desktop ? 'x' : 'y';

    gsap.timeline({ scrollTrigger: { trigger: aboutFeature, start: 'top 70%' } })
      .from(strips, { [scale]: 0, duration: 1.3, ease: 'expo.out', stagger: 0.07 })
      .from(copy, { y: 28, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.08 }, 0.15);

    // Each strip drifts at its own rate while the section scrolls past, so they read as layers.
    strips.forEach((strip, index) => {
      const distance = ((index % 3) + 1) * 10;
      gsap.fromTo(strip, { [drift]: -distance }, {
        [drift]: distance,
        ease: 'none',
        scrollTrigger: { trigger: aboutFeature, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });

    gsap.fromTo(media, { scale: 1.15 }, {
      scale: 1,
      ease: 'none',
      scrollTrigger: { trigger: aboutFeature, start: 'top bottom', end: 'bottom top', scrub: true }
    });
  });
};

wireAboutStrips();
