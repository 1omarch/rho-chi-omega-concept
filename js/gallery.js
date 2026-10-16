// Home page gallery: loads the photos officers manage in the portal (falls back to the built-in five if it can't)
(function () {
  const cfg = window.RCO_SUPABASE;
  const track = document.getElementById('gallery-carousel');
  if (!cfg || !track) return;

  const headers = { apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey };
  fetch(cfg.url + '/rest/v1/gallery_items?select=path,static_url,caption,sub&order=position.asc,created_at.desc&limit=12', { headers })
    .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
    .then(items => {
      if (!Array.isArray(items) || !items.length) return;
      const slides = items.map(it => {
        const src = it.path ? `${cfg.url}/storage/v1/object/public/gallery/${encodeURI(it.path)}` : it.static_url;
        const label = it.sub ? `${it.caption} — ${it.sub}` : it.caption;
        const b = document.createElement('button');
        b.className = 'slide';
        b.dataset.modalOpen = 'modal-gallery';
        b.dataset.fillCaption = it.caption;
        b.dataset.fillSub = it.sub || '';
        b.dataset.fillPhoto = src;
        const img = document.createElement('img');
        img.src = src; img.alt = label; img.loading = 'lazy';
        const cap = document.createElement('span');
        cap.className = 'cap-bar'; cap.textContent = label;
        b.append(img, cap);
        return b;
      });
      track.replaceChildren(...slides);
      track.scrollLeft = 0;
      if (window.rcoBindModals) window.rcoBindModals(track);
    })
    .catch(() => { /* the built-in photos stay */ });
})();
