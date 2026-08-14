// Rho Chi Omega — Pearls & Ivy concept — interactions
document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('.site-header');
  const body = document.body;

  /* ---------- header solidify on scroll ---------- */
  // .site-header only exists on the public one-page site; portal pages use
  // .portal-header (always solid) and skip this entirely.
  if (header) {
    const onScroll = () => {
      if (window.scrollY > 60) header.classList.add('is-solid');
      else header.classList.remove('is-solid');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

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
          figure.innerHTML = '<img src="images/single-ivy-leaf-tight.png" alt="" style="width:55%;height:55%;object-fit:contain;">';
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
    // stop any video inside so it doesn't keep playing (and playing audio) off-screen
    backdrop.querySelectorAll('video').forEach(v => v.pause());
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

  /* ---------- carousels (gallery, ivies beyond the wall) ---------- */
  // each nav button names its carousel: data-carousel-prev="gallery-carousel"
  document.querySelectorAll('[data-carousel-prev], [data-carousel-next]').forEach(btn => {
    const id = btn.dataset.carouselPrev || btn.dataset.carouselNext;
    const track = document.getElementById(id);
    if (!track) return;
    const dir = ('carouselPrev' in btn.dataset) ? -1 : 1;
    const step = () => (track.querySelector('.slide, .ibw-card')?.getBoundingClientRect().width + 18) || 300;
    btn.addEventListener('click', () => track.scrollBy({ left: dir * step(), behavior: 'smooth' }));
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

  /* ---------- countdown (Emerald Fundraiser) ---------- */
  document.querySelectorAll('[data-countdown]').forEach(box => {
    const target = new Date(box.dataset.countdown).getTime();
    const numD = box.querySelector('[data-cd="d"]');
    const numH = box.querySelector('[data-cd="h"]');
    const numM = box.querySelector('[data-cd="m"]');
    const numS = box.querySelector('[data-cd="s"]');
    const pad = n => String(Math.max(n, 0)).padStart(2, '0');
    function tick() {
      const diff = target - Date.now();
      if (diff <= 0) {
        [numD, numH, numM, numS].forEach(el => el && (el.textContent = '00'));
        clearInterval(timer);
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (numD) numD.textContent = pad(d);
      if (numH) numH.textContent = pad(h);
      if (numM) numM.textContent = pad(m);
      if (numS) numS.textContent = pad(s);
    }
    tick();
    const timer = setInterval(tick, 1000);
  });

  /* ---------- welcome promo popup (Emerald Fundraiser) ---------- */
  const promo = document.getElementById('modal-welcome-promo');
  if (promo) {
    const alreadySeen = sessionStorage.getItem('rco-promo-seen');
    if (!alreadySeen) {
      setTimeout(() => {
        promo.classList.add('is-open');
        body.classList.add('modal-open');
        sessionStorage.setItem('rco-promo-seen', '1');
      }, 1200);
    }
    const learnMore = promo.querySelector('[data-promo-learn-more]');
    if (learnMore) {
      learnMore.addEventListener('click', () => {
        promo.classList.remove('is-open');
        body.classList.remove('modal-open');
        document.getElementById('events')?.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }
});
