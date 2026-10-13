// Events page — removes each event automatically the day after its date
(function () {
  const grid = document.querySelector('.reg-grid');
  if (!grid) return;
  const empty = document.getElementById('events-empty');
  let timer;

  function startOfToday() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function sweep() {
    const today = startOfToday();
    grid.querySelectorAll('[data-expires]').forEach(card => {
      const [y, m, d] = card.dataset.expires.split('-').map(Number);
      if (new Date(y, m - 1, d) < today) card.remove();
    });
    if (empty) empty.hidden = grid.children.length > 0;
    clearTimeout(timer);
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    timer = setTimeout(sweep, nextMidnight - now);
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden) sweep(); });
  sweep();
})();
