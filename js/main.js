// Rho Chi Omega — Pearls & Ivy concept — interactions
document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('.site-header');
  const body = document.body;

  /* ---------- header solidify on scroll ---------- */
  const onScroll = () => {
    if (window.scrollY > 60) header.classList.add('is-solid');
    else header.classList.remove('is-solid');
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- full-screen menu overlay ---------- */
  const menuToggle = document.querySelector('.menu-toggle');
  const menuOverlay = document.querySelector('.menu-overlay');
  const menuClose = document.querySelector('.menu-close');

  function openMenu() {
    menuOverlay.classList.add('is-open');
    body.classList.add('menu-open');
    menuToggle.setAttribute('aria-expanded', 'true');
    const firstLink = menuOverlay.querySelector('a');
    if (firstLink) firstLink.focus();
  }
  function closeMenu() {
    menuOverlay.classList.remove('is-open');
    body.classList.remove('menu-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.focus();
  }
  if (menuToggle && menuOverlay) {
    menuToggle.addEventListener('click', openMenu);
    menuClose.addEventListener('click', closeMenu);
    menuOverlay.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && menuOverlay.classList.contains('is-open')) closeMenu();
    });
  }

  /* ---------- modal "pop-out windows" ---------- */
  let lastTrigger = null;
  const backdrops = document.querySelectorAll('.modal-backdrop');

  function openModal(id, trigger) {
    const backdrop = document.getElementById(id);
    if (!backdrop) return;
    lastTrigger = trigger || null;
    // populate any dynamic slots from data-fill-* attributes on the trigger
    // (lets several cards share one modal template, e.g. officers, targets, gallery tiles)
    if (trigger) {
      Array.from(trigger.attributes).forEach(attr => {
        if (!attr.name.startsWith('data-fill-')) return;
        const slot = attr.name.replace('data-fill-', '');
        if (slot === 'photo') return; // handled separately below (needs an <img>, not text)
        const slotEl = backdrop.querySelector(`[data-slot="${slot}"]`);
        if (slotEl) slotEl.textContent = attr.value;
      });

      // gallery lightbox: swap the placeholder emoji for a real photo when one is provided
      const figure = backdrop.querySelector('[data-slot="figure"]');
      const note = backdrop.querySelector('[data-slot="note"]');
      if (figure) {
        const photoSrc = trigger.dataset.fillPhoto;
        if (photoSrc) {
          figure.innerHTML = `<img src="${photoSrc}" alt="" style="width:100%;height:100%;object-fit:cover;">`;
          if (note) note.style.display = 'none';
        } else {
          figure.textContent = '🌿';
          if (note) note.style.display = '';
        }
      }
    }
    backdrop.classList.add('is-open');
    body.classList.add('modal-open');
    const closeBtn = backdrop.querySelector('.modal-close');
    if (closeBtn) closeBtn.focus();
  }
  function closeModal(backdrop) {
    backdrop.classList.remove('is-open');
    body.classList.remove('modal-open');
    if (lastTrigger) lastTrigger.focus();
  }

  document.querySelectorAll('[data-modal-open]').forEach(trigger => {
    trigger.addEventListener('click', () => openModal(trigger.dataset.modalOpen, trigger));
    trigger.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openModal(trigger.dataset.modalOpen, trigger);
      }
    });
  });

  backdrops.forEach(backdrop => {
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) closeModal(backdrop);
    });
    backdrop.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => closeModal(backdrop));
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const openBackdrop = document.querySelector('.modal-backdrop.is-open');
    if (openBackdrop) closeModal(openBackdrop);
  });

  /* ---------- reveal on scroll ---------- */
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('is-visible'));
  }

  /* ---------- ivy spine active node ---------- */
  const nodes = document.querySelectorAll('.ivy-spine .node');
  if (nodes.length && 'IntersectionObserver' in window) {
    const targets = Array.from(nodes).map(n => document.getElementById(n.dataset.target)).filter(Boolean);
    const spineIo = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const idx = targets.indexOf(entry.target);
        if (idx === -1) return;
        nodes[idx].classList.toggle('is-active', entry.isIntersecting);
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    targets.forEach(t => spineIo.observe(t));
  }

  /* ---------- footer year ---------- */
  const yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});
