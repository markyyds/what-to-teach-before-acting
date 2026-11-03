"use strict";
(() => {
  const help = document.getElementById('demo-help');
  const toggle = document.getElementById('demo-help-toggle');
  const start = document.getElementById('demo-help-start');
  const play = document.getElementById('lab-tour');
  const preference = 'vqa4vla:demo-guide:v1';
  let dismissed = false;
  try { dismissed = localStorage.getItem(preference) === 'seen'; } catch {}

  function showHelp(open) {
    updateStart();
    help.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  }
  function rememberDismissal() {
    dismissed = true;
    try { localStorage.setItem(preference, 'seen'); } catch {}
    showHelp(false);
  }
  function dismissHelp() {
    rememberDismissal();
    toggle.focus({ preventScroll: true });
  }
  function updateStart() {
    start.disabled = !document.getElementById('lab-video-0');
    start.textContent = document.getElementById('episode-lab').dataset.interactive === 'true' ? 'Return to interactive video' : '▶ Start interactive video';
  }
  toggle.addEventListener('click', () => {
    if (help.hidden) showHelp(true);
    else rememberDismissal();
  });
  document.getElementById('demo-help-close').addEventListener('click', dismissHelp);
  document.getElementById('demo-help-dismiss').addEventListener('click', dismissHelp);
  play.addEventListener('click', rememberDismissal);
  start.addEventListener('click', () => {
    if (document.getElementById('episode-lab').dataset.interactive === 'true') rememberDismissal();
    else play.click();
    window.dispatchEvent(new Event('episodefocusrequest'));
  });
  help.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); dismissHelp(); }
  });
  window.addEventListener('episodechange', updateStart);
  updateStart();

  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    if (!dismissed) showHelp(true);
    observer.disconnect();
  }, { threshold: 0.35, rootMargin: '-60px 0px 0px' });
  observer.observe(document.querySelector('#episode-lab .lab-bar'));
})();
