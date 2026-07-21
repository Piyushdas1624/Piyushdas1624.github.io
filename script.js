/* ==========================================================================
   Piyush Das Portfolio — JavaScript
   Scroll reveal, sticky nav, reduced-motion support
   ========================================================================== */

(function () {
  'use strict';

  // ── Respect prefers-reduced-motion ────────────────────────────────
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Sticky nav scroll behaviour ───────────────────────────────────
  const nav = document.getElementById('main-nav');

  if (nav) {
    const handleNavScroll = () => {
      if (window.scrollY > 20) {
        nav.classList.add('scrolled');
      } else {
        nav.classList.remove('scrolled');
      }
    };

    window.addEventListener('scroll', handleNavScroll, { passive: true });
    handleNavScroll(); // run once on load
  }

  // ── Scroll reveal with IntersectionObserver ───────────────────────
  if (!prefersReducedMotion) {
    const revealElements = document.querySelectorAll('.reveal');

    if (revealElements.length > 0) {
      const revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
              revealObserver.unobserve(entry.target);
            }
          });
        },
        {
          root: null,
          rootMargin: '0px 0px -60px 0px',
          threshold: 0.1,
        }
      );

      revealElements.forEach((el) => revealObserver.observe(el));
    }
  } else {
    // If reduced motion is preferred, just show everything immediately
    document.querySelectorAll('.reveal').forEach((el) => {
      el.classList.add('visible');
    });
  }

  // ── Smooth anchor links ────────────────────────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const offset = 80; // nav height + buffer
        const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  // ── Hero scroll hint — fade out on scroll ─────────────────────────
  const heroScroll = document.querySelector('.hero-scroll');
  if (heroScroll) {
    window.addEventListener('scroll', () => {
      const opacity = Math.max(0, 1 - window.scrollY / 200);
      heroScroll.style.opacity = opacity;
    }, { passive: true });
  }

})();
