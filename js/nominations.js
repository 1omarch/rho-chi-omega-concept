// Officer nominations — live status labels for the key dates
(function () {
  const now = new Date();
  const day = 86400000;

  document.querySelectorAll('[data-start]').forEach(el => {
    const start = new Date(el.dataset.start + 'T00:00:00');
    const end = new Date((el.dataset.end || el.dataset.start) + 'T23:59:59');
    let label;
    let cls = '';

    if (now < start) {
      const days = Math.ceil((start - now) / day);
      label = days === 1 ? 'Upcoming · tomorrow' : `Upcoming · in ${days} days`;
      cls = 'is-soon';
    } else if (now <= end) {
      label = el.dataset.start === (el.dataset.end || el.dataset.start) ? 'Today' : 'Open now';
      cls = 'is-open';
    } else {
      label = el.dataset.done || 'Completed';
    }

    el.textContent = label;
    el.classList.add('nm-status');
    if (cls) el.classList.add(cls);
  });
})();
