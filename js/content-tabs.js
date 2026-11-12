// Events & gallery page: two tabs. Admins see both; officers see only the Gallery.
document.addEventListener('rco-auth-ready', e => {
  const me = e.detail, isAdmin = me.role === 'admin';
  const tabs = { events: document.getElementById('ct-tab-events'), gallery: document.getElementById('ct-tab-gallery') };
  const panels = { events: document.getElementById('ct-events'), gallery: document.getElementById('ct-gallery') };
  if (!tabs.events || !tabs.gallery) return;
  function show(name) {
    Object.keys(tabs).forEach(k => { tabs[k].setAttribute('aria-selected', String(k === name)); panels[k].hidden = k !== name; });
    try { history.replaceState(null, '', name === 'gallery' ? '#gallery' : location.pathname); } catch (err) { /* ignore */ }
  }
  tabs.events.addEventListener('click', () => show('events'));
  tabs.gallery.addEventListener('click', () => show('gallery'));
  if (!isAdmin) { tabs.events.hidden = true; panels.events.hidden = true; show('gallery'); return; }
  show(location.hash === '#gallery' ? 'gallery' : 'events');
});
