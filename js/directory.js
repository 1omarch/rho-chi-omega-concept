// Rho Chi Omega Member Portal: Directory search/render + pop-out
// Names come from the members-only Supabase table "directory"; photos from the private "portal-files" bucket.
document.addEventListener('rco-auth-ready', async () => {
  const grid = document.getElementById('dir-grid');
  const search = document.getElementById('dir-search');
  const countEl = document.getElementById('dir-count');
  const emptyEl = document.getElementById('dir-empty');
  if (!grid) return;

  const sb = window.rcoAuth.client;
  const placeholder = 'images/single-ivy-leaf-tight.png';

  const { data, error } = await sb.from('directory')
    .select('display_name, photo_file')
    .order('last_name', { ascending: true }).order('first_name', { ascending: true });
  if (error) { countEl.textContent = 'The directory could not be loaded. Please refresh.'; return; }

  // one batch request for every photo link (valid for an hour)
  const files = data.filter(r => r.photo_file).map(r => 'directory/' + r.photo_file);
  const urls = {};
  if (files.length) {
    const { data: signed } = await sb.storage.from('portal-files').createSignedUrls(files, 3600);
    (signed || []).forEach(s => { if (s.signedUrl) urls[s.path] = s.signedUrl; });
  }

  const DIRECTORY = data.map(r => {
    const photo = r.photo_file && urls['directory/' + r.photo_file];
    return { display: r.display_name, photo: photo || placeholder, hasPhoto: !!photo };
  });

  function makeCard(person, idx) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dir-card';
    btn.dataset.idx = idx;

    const wrap = document.createElement('div');
    wrap.className = 'dc-photo' + (person.hasPhoto ? '' : ' no-photo');
    const img = document.createElement('img');
    img.src = person.photo;
    img.alt = '';
    img.loading = 'lazy';
    img.addEventListener('error', () => { wrap.classList.add('no-photo'); img.src = placeholder; }, { once: true });
    wrap.append(img);

    const name = document.createElement('div');
    name.className = 'dc-name';
    name.textContent = person.display;

    btn.append(wrap, name);
    return btn;
  }

  let currentList = DIRECTORY;

  function render(list) {
    currentList = list;
    grid.replaceChildren(...list.map(makeCard));
    countEl.textContent = `${list.length} soror${list.length === 1 ? '' : 's'}`;
    emptyEl.classList.toggle('is-visible', list.length === 0);
  }

  render(DIRECTORY);

  if (search) {
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      render(q ? DIRECTORY.filter(p => p.display.toLowerCase().includes(q)) : DIRECTORY);
    });
  }

  /* ---------- soror pop-out ---------- */
  const modal = document.getElementById('modal-soror');
  const modalPhoto = document.getElementById('soror-photo');
  const modalPhotoWrap = document.getElementById('soror-photo-wrap');
  const modalName = document.getElementById('soror-name');

  function openSoror(person) {
    if (!modal) return;
    modalPhoto.src = person.photo;
    modalPhoto.alt = person.display;
    modalPhoto.style.objectFit = person.hasPhoto ? 'cover' : 'contain';
    modalPhotoWrap.style.padding = person.hasPhoto ? '0' : '2.2rem';
    modalName.textContent = person.display;
    modal.classList.add('is-open');
    document.body.classList.add('modal-open');
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) closeBtn.focus();
  }

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.dir-card');
    if (!card) return;
    const person = currentList[Number(card.dataset.idx)];
    if (person) openSoror(person);
  });
});
