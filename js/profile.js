// My Profile: view and edit your own details; the directory shows everyone's.
document.addEventListener('rco-auth-ready', async e => {
  const me = e.detail;
  const sb = window.rcoAuth.client;
  const $ = s => document.querySelector(s);
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v); });
    kids.flat().forEach(k => n.append(k));
    return n;
  };
  const placeholder = 'images/single-ivy-leaf-tight.png';
  const isOfficer = me.role === 'officer' || me.role === 'admin';

  const { data: myId } = await sb.rpc('my_member_id');
  if (!myId) { $('#pf-status').textContent = 'We could not find your roster entry.'; return; }

  let profile = {};
  let avatarUrl = placeholder;
  let hasPhoto = false;

  async function load() {
    const { data, error } = await sb.from('profiles').select('*').eq('member_id', myId).maybeSingle();
    if (error) { $('#pf-status').textContent = 'Your profile could not be loaded. Please refresh.'; return false; }
    profile = data || {};
    // picture: her own upload first, otherwise the directory photo that matches her name
    let path = profile.photo_file || null;
    if (!path) {
      const { data: d } = await sb.from('directory').select('photo_file').ilike('display_name', me.name).not('photo_file', 'is', null).limit(1);
      if (d && d[0]) path = 'directory/' + d[0].photo_file;
    }
    avatarUrl = placeholder; hasPhoto = false;
    if (path) {
      const { data: s } = await sb.storage.from('portal-files').createSignedUrl(path, 3600);
      if (s && s.signedUrl) { avatarUrl = s.signedUrl; hasPhoto = true; }
    }
    return true;
  }

  const val = v => (v === null || v === undefined || v === '' ? null : String(v));

  function row(label, value, href) {
    const v = val(value);
    const dd = el('dd', { class: v ? '' : 'is-empty' });
    if (v && href) dd.append(el('a', { href, text: v })); else dd.textContent = v || 'Not added yet';
    return [el('dt', { text: label }), dd];
  }

  function renderView() {
    const wrap = $('#pf-view');
    wrap.replaceChildren();
    const email = val(profile.contact_email) || me.email;
    const img = el('img', { src: avatarUrl, alt: '' });
    const av = el('div', { class: 'pf-avatar' + (hasPhoto ? '' : ' no-photo') }, img);
    wrap.append(
      el('div', { class: 'pf-card pf-top' },
        av,
        el('div', { class: 'pf-id' },
          el('p', { class: 'pf-eyebrow', text: 'My profile' }),
          el('h2', { text: me.name }),
          val(profile.title) ? el('span', { class: 'pf-title', text: profile.title }) : el('span', { class: 'pf-title is-empty', text: 'Member' }),
          el('button', { type: 'button', class: 'btn btn-ivy btn-sm', id: 'pf-edit', text: 'Edit my profile' }))),
      el('div', { class: 'pf-card' },
        el('h3', { text: 'Details' }),
        el('dl', { class: 'pf-list' },
          row('Email', email, 'mailto:' + email),
          row('Phone', profile.phone, profile.phone ? 'tel:' + profile.phone.replace(/[^\d+]/g, '') : null),
          row('Home address', profile.address),
          row('School', profile.school),
          row('Year initiated', profile.initiation_year),
          row('Chapter initiated', profile.initiated_chapter)),
        el('p', { class: 'pf-note', text: 'Sorors on the chapter roster can see these details in the directory.' })),
      el('div', { class: 'pf-card pf-dues' },
        el('h3', { text: 'Dues & payments' }),
        el('p', { text: 'Your dues, payments and balance will appear here once the chapter turns this on. Only you and the chapter treasurer will be able to see them.' })));
    $('#pf-edit').addEventListener('click', renderEdit);
  }

  function field(label, id, value, attrs = {}) {
    const input = el(attrs.tag || 'input', Object.assign({ id, name: id, class: 'pf-input' }, attrs.tag ? {} : { type: attrs.type || 'text' }, attrs.extra || {}));
    if (attrs.tag === 'textarea') input.value = value || ''; else input.value = value == null ? '' : value;
    return el('div', { class: 'pf-field' }, el('label', { for: id, text: label }), input);
  }

  function renderEdit() {
    const wrap = $('#pf-view');
    wrap.replaceChildren();
    const msg = el('p', { class: 'pf-msg', role: 'status' });
    const photoInput = el('input', { type: 'file', accept: 'image/*', id: 'pf-photo', class: 'pf-file' });
    const pic = el('img', { src: avatarUrl, alt: '' });
    const av = el('div', { class: 'pf-avatar' + (hasPhoto ? '' : ' no-photo') }, pic);

    photoInput.addEventListener('change', async () => {
      const f = photoInput.files[0];
      if (!f) return;
      if (!/^image\//.test(f.type)) { msg.textContent = 'Please choose a picture file.'; msg.className = 'pf-msg is-bad'; return; }
      msg.textContent = 'Uploading your picture…'; msg.className = 'pf-msg';
      try {
        const blob = await squareJpeg(f, 600);
        const path = `profiles/${myId}/avatar.jpg`;
        const up = await sb.storage.from('portal-files').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
        if (up.error) throw up.error;
        const { error } = await sb.from('profiles').upsert({ member_id: myId, photo_file: path }, { onConflict: 'member_id' });
        if (error) throw error;
        const { data: s } = await sb.storage.from('portal-files').createSignedUrl(path, 3600);
        if (s && s.signedUrl) { pic.src = s.signedUrl; av.classList.remove('no-photo'); avatarUrl = s.signedUrl; hasPhoto = true; profile.photo_file = path; }
        msg.textContent = 'Picture updated.'; msg.className = 'pf-msg is-ok';
      } catch (err) {
        msg.textContent = 'The picture could not be uploaded. Please try a different image.'; msg.className = 'pf-msg is-bad';
      }
    });

    const form = el('form', { class: 'pf-card pf-form', novalidate: true },
      el('h3', { text: 'Edit my profile' }),
      el('div', { class: 'pf-photo-row' }, av, el('div', {}, el('label', { for: 'pf-photo', class: 'btn btn-ghost btn-sm', text: 'Change picture' }), photoInput, el('p', { class: 'pf-note', text: 'This is your personal picture, shown on your profile page. The directory keeps your official chapter photo.' }))),
      el('div', { class: 'pf-field' }, el('label', { text: 'Title or position' }),
        isOfficer ? el('input', { id: 'f-title', class: 'pf-input', type: 'text', maxlength: '80', value: profile.title || '' })
                  : el('p', { class: 'pf-readonly', text: profile.title || 'Titles are set by a chapter officer.' })),
      field('Email', 'f-email', profile.contact_email || me.email, { type: 'email', extra: { maxlength: '160', autocomplete: 'email' } }),
      field('Phone', 'f-phone', profile.phone, { type: 'tel', extra: { maxlength: '40', autocomplete: 'tel' } }),
      field('Home address', 'f-address', profile.address, { tag: 'textarea', extra: { rows: '2', maxlength: '240', autocomplete: 'street-address' } }),
      field('School', 'f-school', profile.school, { extra: { maxlength: '120' } }),
      el('div', { class: 'pf-two' },
        field('Year initiated', 'f-year', profile.initiation_year, { type: 'number', extra: { min: '1908', max: '2100', inputmode: 'numeric' } }),
        field('Chapter initiated', 'f-chapter', profile.initiated_chapter, { extra: { maxlength: '120' } })),
      el('p', { class: 'pf-note', text: 'Everything here is visible to sorors on the chapter roster, including your home address. Only add what you are comfortable sharing.' }),
      el('div', { class: 'pf-actions' },
        el('button', { type: 'submit', class: 'btn btn-ivy btn-sm', text: 'Save' }),
        el('button', { type: 'button', class: 'btn btn-ghost btn-sm', id: 'pf-cancel', text: 'Cancel' })),
      msg);
    wrap.append(form);

    $('#pf-cancel').addEventListener('click', renderView);
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const t = id => { const v = $(id).value.trim(); return v === '' ? null : v; };
      const year = t('#f-year');
      const row = { member_id: myId, contact_email: t('#f-email'), phone: t('#f-phone'), address: t('#f-address'), school: t('#f-school'), initiation_year: year ? parseInt(year, 10) : null, initiated_chapter: t('#f-chapter') };
      if (isOfficer) row.title = t('#f-title');
      if (row.initiation_year !== null && (isNaN(row.initiation_year) || row.initiation_year < 1908 || row.initiation_year > 2100)) { msg.textContent = 'Please enter a valid year, such as 2008.'; msg.className = 'pf-msg is-bad'; return; }
      msg.textContent = 'Saving…'; msg.className = 'pf-msg';
      const { error } = await sb.from('profiles').upsert(row, { onConflict: 'member_id' });
      if (error) { msg.textContent = 'Your changes could not be saved. Please check the fields and try again.'; msg.className = 'pf-msg is-bad'; return; }
      await load();
      renderView();
      const ok = $('#pf-status'); ok.textContent = 'Profile saved.'; ok.className = 'pf-status is-ok';
    });
  }

  // center-crop to a square and shrink, so uploads stay small
  function squareJpeg(file, size) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => {
        const s = Math.min(im.naturalWidth, im.naturalHeight);
        const c = document.createElement('canvas');
        c.width = c.height = Math.min(size, s);
        c.getContext('2d').drawImage(im, (im.naturalWidth - s) / 2, (im.naturalHeight - s) / 2, s, s, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b => b ? resolve(b) : reject(new Error('encode')), 'image/jpeg', 0.88);
      };
      im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load')); };
      im.src = url;
    });
  }

  if (await load()) renderView();
});
