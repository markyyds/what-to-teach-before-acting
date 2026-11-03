"use strict";
(() => {
  const robot = document.querySelector('.robot-guide');
  const eyes = robot?.querySelector('.bot-eyes');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let waveTimer;
  if (robot) {
    robot.addEventListener('click', () => {
      clearTimeout(waveTimer);
      robot.classList.remove('waving');
      requestAnimationFrame(() => robot.classList.add('waving'));
      waveTimer = setTimeout(() => robot.classList.remove('waving'), 1600);
    });
    robot.addEventListener('pointermove', event => {
      if (reducedMotion.matches || event.pointerType === 'touch') return;
      const rect = robot.getBoundingClientRect();
      eyes.style.translate = `${(event.clientX - rect.left - rect.width / 2) / rect.width * 6}px ${(event.clientY - rect.top - rect.height / 2) / rect.height * 4}px`;
    });
    robot.addEventListener('pointerleave', () => { eyes.style.translate = '0px 0px'; });
  }
  const progress = document.querySelector('.reading-progress');
  let scheduled = false;
  function updateProgress() {
    const available = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${available > 0 ? Math.min(1, scrollY / available) : 0})`;
    scheduled = false;
  }
  addEventListener('scroll', () => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(updateProgress); }
  }, { passive: true });
  addEventListener('resize', updateProgress);
  updateProgress();
  const navLinks = [...document.querySelectorAll('.header nav a[href^="#"]')];
  const observer = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if (!visible.length) return;
    navLinks.forEach(link => {
      if (link.hash === '#' + visible[0].target.id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }, { rootMargin: '-15% 0px -55% 0px' });
  navLinks.forEach(link => { const section = document.querySelector(link.hash); if (section) observer.observe(section); });
})();
