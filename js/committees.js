// Committee Dashboard — points each link at the live chapter portal
(function () {
  const data = window.RCO_RESOURCES;
  if (!data) return;
  const frag = t => '#:~:text=' + encodeURIComponent(t).replace(/-/g, '%2D');
  document.querySelectorAll('[data-portal]').forEach(a => {
    const [page, find] = a.dataset.portal.split('|');
    a.href = data.portal[page] + (find ? frag(find) : '');
    a.target = '_blank';
    a.rel = 'noopener';
  });
})();
