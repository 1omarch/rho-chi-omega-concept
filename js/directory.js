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
    .select('display_name, photo_file, member_id')
    .order('last_name', { ascending: true }).order('first_name', { ascending: true });
  if (error) { countEl.textContent = 'The directory could not be loaded. Please refresh.'; return; }

  // one batch request for every photo link (valid for an hour)
  const files = data.filter(r => r.photo_file).map(r => 'directory/' + r.photo_file);
  const urls = {};
  if (files.length) {
    const { data: signed } = await sb.storage.from('portal-files').createSignedUrls(files, 3600);
    (signed || []).forEach(s => { if (s.signedUrl) urls[s.path] = s.signedUrl; });
  }

  // soror profiles (title, contact details, school, initiation) matched to directory names
  const profiles = {};
  const profilesById = {};
  const { data: plist } = await sb.rpc('get_profiles');
  (plist || []).forEach(p => {
    profilesById[p.member_id] = p;
    if (p.full_name) profiles[p.full_name.trim().toLowerCase()] = p;
  });
  const isComplete = p => !!(p && p.phone && p.address && p.school && p.initiation_year && p.initiated_chapter);
  const ownPics = (plist || []).filter(p => p.photo_file).map(p => p.photo_file);
  const ownUrls = {};
  if (ownPics.length) {
    const { data: signed } = await sb.storage.from('portal-files').createSignedUrls(ownPics, 3600);
    (signed || []).forEach(s => { if (s.signedUrl) ownUrls[s.path] = s.signedUrl; });
  }

  const DIRECTORY = data.map(r => {
    // exact link first; the name match only fills in for cards an officer hasn't linked yet
    const profile = (r.member_id && profilesById[r.member_id]) || (!r.member_id && profiles[r.display_name.trim().toLowerCase()]) || null;
    const photo = (profile && profile.photo_file && ownUrls[profile.photo_file]) || (r.photo_file && urls['directory/' + r.photo_file]);
    const search = [r.display_name, profile && profile.title, profile && profile.school, profile && profile.initiated_chapter,
                    profile && profile.initiation_year].filter(Boolean).join(' ').toLowerCase();
    return { display: r.display_name, photo: photo || placeholder, hasPhoto: !!photo, profile, search,
             title: (profile && profile.title) || '', complete: isComplete(profile) };
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
    if (person.title) {
      const sub = document.createElement('div');
      sub.className = 'dc-sub';
      sub.textContent = person.title;
      btn.append(sub);
    }
    if (person.complete) {
      const dot = document.createElement('span');
      dot.className = 'dc-dot';
      dot.title = 'Profile complete';
      name.append(dot);
    }
    return btn;
  }

  let currentList = DIRECTORY;
  let mode = 'all';

  function render(list) {
    currentList = list;
    grid.replaceChildren(...list.map(makeCard));
    countEl.textContent = `${list.length} soror${list.length === 1 ? '' : 's'}`;
    emptyEl.classList.toggle('is-visible', list.length === 0);
  }

  function apply() {
    const q = search ? search.value.trim().toLowerCase() : '';
    const tokens = q.split(/\s+/).filter(Boolean);
    render(DIRECTORY.filter(p => (mode === 'all' || p.title) && tokens.every(t => p.search.includes(t))));
  }

  apply();
  if (search) search.addEventListener('input', apply);

  document.querySelectorAll('[data-dir-filter]').forEach(b => b.addEventListener('click', () => {
    mode = b.dataset.dirFilter;
    document.querySelectorAll('[data-dir-filter]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    apply();
  }));

  /* ---------- soror pop-out ---------- */
  const modal = document.getElementById('modal-soror');
  const modalPhoto = document.getElementById('soror-photo');
  const modalPhotoWrap = document.getElementById('soror-photo-wrap');
  const modalName = document.getElementById('soror-name');

  const extra = document.getElementById('soror-extra');
  function renderExtra(p) {
    if (!extra) return;
    extra.replaceChildren();
    if (!p) {
      const n = document.createElement('p'); n.className = 'sr-empty'; n.textContent = 'This soror has not set up her portal profile yet.'; extra.append(n); return;
    }
    if (p.title) {
      const b = document.createElement('span'); b.className = 'sr-badge'; b.textContent = p.title; extra.append(b);
    }
    const rows = [
      ['Email', p.contact_email, p.contact_email && 'mailto:' + p.contact_email],
      ['Phone', p.phone, p.phone && 'tel:' + p.phone.replace(/[^\d+]/g, '')],
      ['Home', p.address],
      ['School', p.school],
      ['Initiated', [p.initiation_year, p.initiated_chapter].filter(Boolean).join(' · ')]
    ].filter(r => r[1]);
    if (!rows.length) {
      const n = document.createElement('p'); n.className = 'sr-empty'; n.textContent = 'This soror has not added her details yet.'; extra.append(n); return;
    }
    const dl = document.createElement('dl'); dl.className = 'sr-details';
    rows.forEach(([k, v, href]) => {
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd');
      if (href) { const a = document.createElement('a'); a.href = href; a.textContent = v; dd.append(a); } else dd.textContent = v;
      dl.append(dt, dd);
    });
    extra.append(dl);
  }

  function openSoror(person) {
    if (!modal) return;
    modalPhoto.src = person.photo;
    modalPhoto.alt = person.display;
    modalPhoto.style.objectFit = person.hasPhoto ? 'cover' : 'contain';
    modalPhotoWrap.style.padding = person.hasPhoto ? '0' : '2.2rem';
    modalName.textContent = person.display;
    renderExtra(person.profile);
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
