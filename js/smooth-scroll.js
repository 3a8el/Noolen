const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (window.Lenis && !prefersReducedMotion) {
  const lenis = new Lenis({
    lerp: 0.09,
    wheelMultiplier: 1
  });

  // Drive Lenis from GSAP's ticker so ScrollTrigger reads the same scroll position every frame.
  if (window.gsap && window.ScrollTrigger) {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    const raf = (time) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }
}
