// Events & flyers (admins): add an event once and it shows on the Events Registration page and the Portal Home announcement board.
// It is hidden the day after the event and permanently deleted 7 days later (supabase/events.sql).
document.addEventListener('rco-auth-ready', async e => {
  const me = e.detail;
  const $ = s => document.querySelector(s);
  if (me.role !== 'admin') { $('#ev-denied').hidden = false; $('#ev-app').hidden = true; return; }
  $('#ev-app').hidden = false;

  const sb = window.rcoAuth.client;
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v); });
    kids.flat().forEach(k => { if (k != null) n.append(k); });
    return n;
  };
  const msg = (t, ok) => { const m = $('#ev-msg'); m.textContent = t || ''; m.className = 'rost-msg ' + (ok ? 'is-ok' : 'is-bad'); };
  const { data: myId } = await sb.rpc('my_member_id');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const niceDate = iso => { const [y, m, d] = iso.split('-').map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; };
  const todayIso = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
  const flyerUrl = p => sb.storage.from('event-flyers').getPublicUrl(p).data.publicUrl;

  const CHAPTER_CAL = 'rhochiomega1908@gmail.com';
  // a Google Calendar link with the event filled in and the chapter calendar pre-selected; the admin just taps Save
  function calUrl(ev) {
    if (!window.rcoCal) return null;
    return window.rcoCal.googleEvent({ title: ev.title, start: ev.start_time ? `${ev.event_date}T${ev.start_time}` : ev.event_date,
      end: ev.start_time && ev.end_time ? `${ev.event_date}T${ev.end_time}` : undefined, where: ev.location || undefined, note: ev.description || undefined, src: CHAPTER_CAL });
  }
  function showCalStep(ev) {
    const box = $('#ev-cal'), href = calUrl(ev);
    if (!href) { box.hidden = true; return; }
    box.replaceChildren(el('strong', { text: 'One more step: put it on the chapter Google Calendar.' }),
      el('div', { text: 'Google opens with everything filled in. Sign in as the chapter account if asked, then tap Save.' }),
      el('a', { class: 'btn btn-ivy btn-sm', href, target: '_blank', rel: 'noopener', text: 'Add to chapter Google Calendar' }));
    box.hidden = false;
  }

  let events = [];
  let editing = null;          // the event being edited, or null when adding
  const f = { title: $('#ev-title'), date: $('#ev-date'), start: $('#ev-start'), end: $('#ev-end'), where: $('#ev-where'), desc: $('#ev-desc'),
    price: $('#ev-price'), url: $('#ev-rsvp-url'), rsvp: $('#ev-rsvp'), file: $('#ev-file') };

  // shrink the flyer to at most 1800 px on the long side, as a JPEG (keeps small print readable)
  async function shrink(file) {
    let w, h, draw;
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      w = bmp.width; h = bmp.height; draw = (ctx, cw, ch) => ctx.drawImage(bmp, 0, 0, cw, ch);
    } catch (err) {
      const url = URL.createObjectURL(file);
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
      w = img.naturalWidth; h = img.naturalHeight; draw = (ctx, cw, ch) => { ctx.drawImage(img, 0, 0, cw, ch); URL.revokeObjectURL(url); };
    }
    const k = Math.min(1, 1800 / Math.max(w, h));
    const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); draw(ctx, c.width, c.height);
    return new Promise((ok, no) => c.toBlob(b => (b ? ok(b) : no(new Error('encode'))), 'image/jpeg', 0.86));
  }

  function resetForm() {
    editing = null; $('#ev-form').reset(); $('#ev-form-h').textContent = 'Add an event'; $('#ev-save').textContent = 'Add event';
    $('#ev-cancel').hidden = true; $('#ev-flyer-now').replaceChildren(); document.querySelector('.ev-check').hidden = false;
  }
  function startEdit(ev) {
    editing = ev; $('#ev-form-h').textContent = 'Change this event'; $('#ev-save').textContent = 'Save changes'; $('#ev-cancel').hidden = false;
    f.title.value = ev.title; f.date.value = ev.event_date; f.start.value = ev.start_time || ''; f.end.value = ev.end_time || '';
    f.where.value = ev.location || ''; f.desc.value = ev.description || ''; f.price.value = ev.price_text || ''; f.url.value = ev.rsvp_url || ''; f.rsvp.value = ev.rsvp_text || '';
    f.file.value = ''; $('#ev-notify').checked = false; document.querySelector('.ev-check').hidden = true;
    $('#ev-flyer-now').replaceChildren(...(ev.flyer_path ? [el('img', { src: flyerUrl(ev.flyer_path), alt: 'Current flyer' }), el('span', { text: 'Current flyer. Choose a new picture only if you want to replace it.' })] : [el('span', { text: 'No flyer yet.' })]));
    msg('', true); $('#ev-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('#ev-cancel').addEventListener('click', () => { resetForm(); msg('', true); });

  $('#ev-form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const title = f.title.value.trim();
    if (!title) { msg('Please type the event name.'); return; }
    if (!f.date.value) { msg('Please choose the date.'); return; }
    if (f.end.value && !f.start.value) { msg('Please add a start time too, or clear the end time.'); return; }
    const url = f.url.value.trim();
    if (url && !/^https?:\/\//i.test(url)) { msg('The RSVP link must start with https://'); return; }
    const btn = $('#ev-save'); btn.disabled = true; msg('Saving…', true);
    let newPath = null;
    try {
      if (f.file.files && f.file.files[0]) {
        const blob = await shrink(f.file.files[0]);
        newPath = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2)) + '.jpg';
        const up = await sb.storage.from('event-flyers').upload(newPath, blob, { contentType: 'image/jpeg', upsert: false });
        if (up.error) throw up.error;
      }
      const row = { title, event_date: f.date.value, start_time: f.start.value || null, end_time: f.end.value || null, location: f.where.value.trim() || null,
        description: f.desc.value.trim() || null, price_text: f.price.value.trim() || null, rsvp_text: f.rsvp.value.trim() || null, rsvp_url: url || null };
      if (newPath) row.flyer_path = newPath;
      let res;
      if (editing) res = await sb.from('chapter_events').update(row).eq('id', editing.id);
      else res = await sb.from('chapter_events').insert({ ...row, created_by: myId });
      if (res.error) { if (newPath) sb.storage.from('event-flyers').remove([newPath]); throw res.error; }
      if (editing && newPath && editing.flyer_path) sb.storage.from('event-flyers').remove([editing.flyer_path]);   // the replaced picture
      const editing_was = !!editing;
      let note = editing ? 'Saved.' : 'Added. It is on the Events Registration page and the announcement board now.';
      if (!editing && $('#ev-notify').checked) {
        try {
          const ins = await sb.from('notifications').insert({ title: 'New event', body: (title + ' · ' + niceDate(row.event_date)).slice(0, 240), audience: 'all', url: 'portal-events.html', created_by: myId });
          if (!ins.error) await sb.functions.invoke('send-reminders', { body: {} });
        } catch (err) { note += ' (The phone notification could not be sent.)'; }
      }
      resetForm(); msg(note, true); $('#ev-cal').hidden = true; if (!editing_was) showCalStep(row); await load();
    } catch (err) {
      msg('That could not be saved. Has the events SQL been run (supabase/events.sql)? Please try again.');
    } finally { btn.disabled = false; }
  });

  function render() {
    const box = $('#ev-list');
    if (!events.length) { box.replaceChildren(el('p', { class: 'ev-empty', text: 'No events yet. Add the first one above.' })); return; }
    box.replaceChildren(...events.map(ev => {
      const past = ev.event_date < todayIso();
      const del = el('button', { type: 'button', class: 'ev-del', text: 'Delete' });
      const edit = el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Change' });
      const calHref = calUrl(ev);
      const btns = el('div', { class: 'ev-btns' }, calHref && !past ? el('a', { class: 'ev-del', style: 'text-decoration:underline;color:var(--ivy,#1f5a3d)', href: calHref, target: '_blank', rel: 'noopener', text: 'Add to chapter calendar' }) : null, edit, del);
      edit.addEventListener('click', () => startEdit(ev));
      del.addEventListener('click', () => {
        const yes = el('button', { type: 'button', class: 'btn btn-ivy btn-sm', text: 'Yes, delete' });
        const no = el('button', { type: 'button', class: 'ev-del', text: 'Keep' });
        btns.replaceChildren(el('span', { class: 'ev-note', text: 'Delete for good?' }), yes, no);
        no.addEventListener('click', render);
        yes.addEventListener('click', async () => {
          yes.disabled = true;
          const { error } = await sb.from('chapter_events').delete().eq('id', ev.id);
          if (error) { msg('That could not be deleted. Please try again.'); render(); return; }
          if (ev.flyer_path) sb.storage.from('event-flyers').remove([ev.flyer_path]);
          if (editing && editing.id === ev.id) resetForm();
          msg('Deleted.', true); load();
        });
      });
      return el('article', { class: 'ev-item' },
        ev.flyer_path ? el('img', { src: flyerUrl(ev.flyer_path), alt: '', loading: 'lazy' }) : el('div', { class: 'ev-ph', 'aria-hidden': 'true', text: '📅' }),
        el('div', { class: 'ev-info' }, el('strong', { text: ev.title }),
          el('span', { text: niceDate(ev.event_date) + (ev.start_time ? ' · ' + ev.start_time : '') + (ev.location ? ' · ' + ev.location : '') }),
          past ? el('span', { class: 'ev-past', text: 'Ended: hidden from sorors' }) : null),
        btns);
    }));
  }

  async function load() {
    const { data, error } = await sb.from('chapter_events').select('*').order('event_date', { ascending: true });
    if (error) { msg('Events could not be loaded. Has the events SQL been run (supabase/events.sql)?'); return; }
    events = data || []; render();
  }
  load();
});
