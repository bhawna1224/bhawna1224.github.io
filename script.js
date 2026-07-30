// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

// Scroll-reveal for cards and timeline items
const revealTargets = document.querySelectorAll('.card, .timeline-item');

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  revealTargets.forEach((el) => observer.observe(el));
} else {
  // Fallback: just show everything
  revealTargets.forEach((el) => el.classList.add('is-visible'));
}

// Warn (in console only) if resume.pdf placeholder hasn't been replaced
const resumeLink = document.getElementById('resumeLink');
if (resumeLink) {
  resumeLink.addEventListener('click', (e) => {
    // no-op — left for the site owner to replace resume.pdf with a real file
  });
}
