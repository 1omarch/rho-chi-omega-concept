// Committee Dashboard — points each link at the live chapter portal
document.addEventListener('rco-resources-ready', function () {
  const data = window.RCO_RESOURCES;
  if (!data) return;
  const frag = t => '#:~:text=' + encodeURIComponent(t).replace(/-/g, '%2D');
  const direct = {};
  [].concat(data.thisYear, ...data.forms.map(g => g.items), ...data.governing.map(g => g.items), ...data.more.map(g => g.items))
    .forEach(it => { if (it.url) direct[(it.find || it.title).toLowerCase()] = it.url; });
  document.querySelectorAll('[data-portal]').forEach(a => {
    const [page, find] = a.dataset.portal.split('|');
    const url = !a.hasAttribute('data-gated') && find ? direct[find.toLowerCase()] : null;
    a.href = url || (data.portal[page] + (find ? frag(find) : ''));
    a.target = '_blank';
    a.rel = 'noopener';
  });
});
