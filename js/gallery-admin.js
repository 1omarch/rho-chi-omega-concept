// Gallery manager for officers and admins: add, caption, reorder and permanently delete home page photos (12 at most)
document.addEventListener('rco-auth-ready', async e => {
  const me = e.detail;
  const $ = s => document.querySelector(s);
  const isOfficer = me.role === 'officer' || me.role === 'admin';
  if (!isOfficer) { $('#gl-denied').hidden = false; $('#gl-app').hidden = true; return; }
  $('#gl-app').hidden = false;

  const sb = window.rcoAuth.client;
  const MAX = 12;
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v); });
    kids.flat().forEach(k => n.append(k));
    return n;
  };
  const say = (msg, ok) => { const m = $('#gl-msg'); m.textContent = msg; m.className = 'rost-msg ' + (ok ? 'is-ok' : 'is-bad'); };
  const { data: myId } = await sb.rpc('my_member_id');
  const srcOf = it => it.path ? sb.storage.from('gallery').getPublicUrl(it.path).data.publicUrl : it.static_url;

  let items = [];

  async function load() {
    const { data, error } = await sb.from('gallery_items').select('*').order('position', { ascending: true }).order('created_at', { ascending: false });
    if (error) { say('The gallery could not be loaded. Has the gallery SQL been run?', false); return; }
    items = data || [];
    render();
  }

  // remove the photo file (if it lives in storage) and its row, for good
  async function removeItem(it) {
    if (it.path) {
      const { error } = await sb.storage.from('gallery').remove([it.path]);
      if (error) throw error;
    }
    const { error } = await sb.from('gallery_items').delete().eq('id', it.id);
    if (error) throw error;
  }

  function render() {
    $('#gl-count').textContent = `${items.length} of ${MAX} photos`;
    const grid = $('#gl-grid');
    grid.replaceChildren();
    if (!items.length) { grid.append(el('p', { class: 'mg-none', text: 'No photos yet. Add the first one above.' })); return; }
    items.forEach((it, i) => {
      const cap = el('input', { type: 'text', class: 'pf-input', maxlength: '80', value: it.caption, 'aria-label': 'Caption' });
      const sub = el('input', { type: 'text', class: 'pf-input', maxlength: '120', value: it.sub || '', placeholder: 'Second line', 'aria-label': 'Second line' });
      const save = async () => {
        const c = cap.value.trim();
        if (!c) { cap.value = it.caption; return; }
        const { error } = await sb.from('gallery_items').update({ caption: c, sub: sub.value.trim() || null }).eq('id', it.id);
        if (error) say('That change could not be saved.', false); else { it.caption = c; it.sub = sub.value.trim() || null; say('Saved.', true); }
      };
      cap.addEventListener('change', save); sub.addEventListener('change', save);

      const move = async dir => {
        const other = items[i + dir]; if (!other) return;
        const a = it.position, b = other.position;
        // equal positions would not swap, so renumber the whole list first
        const order = items.map((x, k) => ({ id: x.id, position: k }));
        [order[i].position, order[i + dir].position] = [order[i + dir].position, order[i].position];
        await Promise.all(order.map(o => sb.from('gallery_items').update({ position: o.position }).eq('id', o.id)));
        await load();
      };
      const left = el('button', { type: 'button', class: 'rost-btn', 'aria-label': 'Move earlier', text: '←' });
      const right = el('button', { type: 'button', class: 'rost-btn', 'aria-label': 'Move later', text: '→' });
      left.disabled = i === 0; right.disabled = i === items.length - 1;
      left.addEventListener('click', () => move(-1)); right.addEventListener('click', () => move(1));

      const del = el('button', { type: 'button', class: 'gl-del', text: 'Delete' });
      const card = el('article', { class: 'gl-card' });
      del.addEventListener('click', () => {
        const yes = el('button', { type: 'button', class: 'btn btn-ivy btn-sm', text: 'Delete permanently' });
        const no = el('button', { type: 'button', class: 'mg-link', text: 'Cancel' });
        const box = el('div', { class: 'gl-ask' }, el('span', { text: 'This removes the photo from the site for good.' }), yes, no);
        no.addEventListener('click', () => box.remove());
        yes.addEventListener('click', async () => {
          yes.disabled = true;
          try { await removeItem(it); await load(); say('Photo deleted.', true); } catch (err) { box.replaceChildren(el('span', { class: 'mg-status', text: 'The photo could not be deleted.' })); }
        });
        card.append(box);
      });

      card.append(
        el('div', { class: 'gl-thumb' }, el('img', { src: srcOf(it), alt: it.caption, loading: 'lazy' }), el('span', { class: 'gl-n', text: String(i + 1) })),
        cap, sub,
        el('div', { class: 'gl-row' }, left, right, del));
      grid.append(card);
    });
  }

  // shrink to at most 1600 px on the long side, as a JPEG
  async function shrink(file) {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.85));
  }

  async function addPhoto() {
    const file = $('#gl-file').files[0];
    const caption = $('#gl-caption').value.trim();
    if (!file) { say('Please choose a photo.', false); return; }
    if (!caption) { say('Please write a caption.', false); return; }
    const btn = $('#gl-add'); btn.disabled = true; say('Adding…', true);
    let uploaded = null;
    try {
      const blob = await shrink(file);
      uploaded = `${crypto.randomUUID()}.jpg`;
      const up = await sb.storage.from('gallery').upload(uploaded, blob, { contentType: 'image/jpeg' });
      if (up.error) throw up.error;
      // full? the oldest photo makes room, permanently
      if (items.length >= MAX) {
        const oldest = items.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];
        await removeItem(oldest);
      }
      const first = items.length ? Math.min(...items.map(x => x.position)) - 1 : 0;
      const { error } = await sb.from('gallery_items').insert({ path: uploaded, caption, sub: $('#gl-sub').value.trim() || null, position: first, created_by: myId });
      if (error) throw error;
      $('#gl-form').reset(); $('#gl-confirm').hidden = true;
      await load(); say('Added to the gallery.', true);
    } catch (err) {
      if (uploaded) await sb.storage.from('gallery').remove([uploaded]);
      say(/decode|bitmap|source image/i.test(String(err && err.message)) ? 'That photo type could not be read. Try a JPG or PNG.' : 'The photo could not be added. Please try again.', false);
    } finally { btn.disabled = false; }
  }

  $('#gl-form').addEventListener('submit', ev => {
    ev.preventDefault();
    if (items.length >= MAX) {
      const oldest = items.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];
      const box = $('#gl-confirm');
      const go = el('button', { type: 'button', class: 'btn btn-ivy btn-sm', text: 'Add it and delete the oldest' });
      const no = el('button', { type: 'button', class: 'mg-link', text: 'Cancel' });
      box.replaceChildren(el('span', { text: `The gallery is full. Adding this photo will permanently delete the oldest one, “${oldest.caption}”.` }), go, no);
      box.hidden = false;
      no.addEventListener('click', () => { box.hidden = true; });
      go.addEventListener('click', () => { box.hidden = true; addPhoto(); });
      return;
    }
    addPhoto();
  });

  load();
});
