// Chapter announcements carousel
(function () {
  const root = document.querySelector('[data-ann]');
  if (!root) return;

  const track = root.querySelector('.ann-track');

  // a slide with data-expires="YYYY-MM-DD" disappears the day after that date
  const today = new Date(); today.setHours(0, 0, 0, 0);
  track.querySelectorAll('.ann-slide[data-expires]').forEach(sl => {
    const [y, m, d] = sl.dataset.expires.split('-').map(Number);
    if (new Date(y, m - 1, d) < today) sl.remove();
  });
  let slides = Array.from(track.querySelectorAll('.ann-slide'));
  if (!slides.length) root.hidden = true;
  const dotsWrap = root.querySelector('.ann-dots');
  const prev = root.querySelector('[data-ann-prev]');
  const next = root.querySelector('[data-ann-next]');
  const toggle = root.querySelector('[data-ann-toggle]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ICON_PAUSE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
  const ICON_PLAY = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';

  let index = 0;
  let userPaused = reduceMotion;
  let hovering = false;
  let focusing = false;
  let ticking = false;

  let dots = [];
  function buildSlides() {
    slides = Array.from(track.querySelectorAll('.ann-slide'));
    dotsWrap.replaceChildren();
    slides.forEach((slide, i) => {
      slide.setAttribute('role', 'group');
      slide.setAttribute('aria-roledescription', 'slide');
      slide.setAttribute('aria-label', `${i + 1} of ${slides.length}`);
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'ann-dot';
      dot.setAttribute('aria-label', `Show announcement ${i + 1} of ${slides.length}`);
      dot.addEventListener('click', () => { pause(); go(i); });
      dotsWrap.appendChild(dot);
    });
    dots = Array.from(dotsWrap.children);
  }

  function setActive(i) {
    index = i;
    dots.forEach((d, k) => {
      d.classList.toggle('is-on', k === i);
      d.setAttribute('aria-current', k === i ? 'true' : 'false');
    });
    slides.forEach((s, k) => s.toggleAttribute('inert', k !== i));
  }

  function go(i) {
    const n = (i + slides.length) % slides.length;
    track.scrollTo({ left: n * track.clientWidth, behavior: reduceMotion ? 'auto' : 'smooth' });
    setActive(n);
  }

  function renderToggle() {
    toggle.innerHTML = userPaused ? ICON_PLAY : ICON_PAUSE;
    toggle.setAttribute('aria-label', userPaused ? 'Start automatic rotation' : 'Pause automatic rotation');
    track.setAttribute('aria-live', userPaused ? 'polite' : 'off');
  }
  function pause() { if (!userPaused) { userPaused = true; renderToggle(); } }

  prev.addEventListener('click', () => { pause(); go(index - 1); });
  next.addEventListener('click', () => { pause(); go(index + 1); });
  toggle.addEventListener('click', () => { userPaused = !userPaused; renderToggle(); });

  track.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const i = Math.round(track.scrollLeft / track.clientWidth);
      if (i !== index && i >= 0 && i < slides.length) setActive(i);
    });
  }, { passive: true });

  root.addEventListener('mouseenter', () => { hovering = true; });
  root.addEventListener('mouseleave', () => { hovering = false; });
  root.addEventListener('focusin', () => { focusing = true; });
  root.addEventListener('focusout', () => { focusing = false; });
  window.addEventListener('resize', () => { track.scrollLeft = index * track.clientWidth; });

  setInterval(() => {
    if (userPaused || hovering || focusing || document.hidden) return;
    go(index + 1);
  }, 7000);

  buildSlides();
  setActive(0);
  renderToggle();

  // other scripts (like birthdays) can put a slide first once their data arrives
  window.rcoAnnouncements = {
    addFirst(slide) {
      track.prepend(slide);
      root.hidden = false;
      buildSlides();
      track.scrollLeft = 0;
      setActive(0);
    }
  };
})();
