// Officer access (admins only): choose which tools each officer can use, like Wix "Roles & Permissions".
// The database (supabase/access.sql) enforces all of this; this page only edits the roster columns.
document.addEventListener('rco-auth-ready', async e => {
  const me = e.detail;
  const $ = s => document.querySelector(s);
  if (me.role !== 'admin') { $('#ac-denied').hidden = false; return; }
  $('#ac-app').hidden = false;
  const sb = window.rcoAuth.client;
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v); });
    kids.flat().forEach(k => { if (k != null) n.append(k); });
    return n;
  };

  const TOOLS = window.RCO_TOOLS;
  const PRESETS = window.RCO_JOBS;
  const ALL = TOOLS.map(t => t[0]);
  const toolName = k => (TOOLS.find(t => t[0] === k) || [k, k])[1];
  const CUSTOM = '__custom';

  let people = [], sorors = [];
  const status = $('#ac-status');
  const say = (t, ok) => { status.textContent = t || ''; status.className = 'rost-msg ' + (ok ? 'is-ok' : 'is-bad'); };
  const since = iso => iso ? new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'before access settings were added';

  async function load() {
    const { data, error } = await sb.from('members').select('id,email,full_name,role,active,access_title,access_areas,access_updated_at').order('full_name', { ascending: true, nullsFirst: false });
    if (error) { say(/access_/.test(error.message) ? 'Run supabase/access.sql in Supabase first (see the Handover Guide).' : 'Could not load the list. Please refresh.'); return; }
    const rows = data || [];
    people = rows.filter(r => r.active && (r.role === 'officer' || r.role === 'admin'))
      .sort((a, b) => (a.role === b.role ? 0 : a.role === 'admin' ? -1 : 1) || String(a.full_name || a.email).localeCompare(String(b.full_name || b.email)));
    sorors = rows.filter(r => r.active && r.role === 'member');
    draw(); fillPick();
  }

  function chips(p) {
    if (p.role === 'admin') return [el('span', { class: 'ac-chip is-all', text: 'Everything' })];
    const a = (p.access_areas || []).filter(k => ALL.includes(k));
    return a.length ? a.map(k => el('span', { class: 'ac-chip', text: toolName(k) })) : [el('span', { class: 'ac-chip is-none', text: 'No tools yet' })];
  }

  function draw() {
    $('#ac-count').textContent = people.length + (people.length === 1 ? ' person' : ' people');
    const list = $('#ac-people'); list.replaceChildren();
    people.forEach(p => list.append(card(p)));
    if (!people.length) list.append(el('li', { class: 'rost-empty', text: 'Nobody has officer access yet.' }));
  }

  function card(p) {
    const name = p.full_name || p.email;
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
    const title = p.access_title || (p.role === 'admin' ? 'Admin (Co-Owner)' : 'Officer');
    const change = el('button', { type: 'button', class: 'ac-btn', text: 'Change', 'aria-expanded': 'false' });
    const self = p.email === me.email;
    const row = el('div', { class: 'ac-row' },
      el('span', { class: 'ac-av', 'aria-hidden': 'true', text: initials }),
      el('div', {}, el('span', { class: 'ac-name', text: name + (self ? ' (you)' : '') }), el('span', { class: 'ac-mail', text: p.email })),
      el('div', {}, el('span', { class: 'ac-title', text: title }), el('div', { class: 'ac-chips' }, chips(p)), el('span', { class: 'ac-since', text: 'Since: ' + since(p.access_updated_at) })),
      change);
    const li = el('li', { class: 'ac-person' }, row);
    let editor = null;
    change.addEventListener('click', () => {
      if (editor) { editor.remove(); editor = null; change.setAttribute('aria-expanded', 'false'); change.textContent = 'Change'; return; }
      editor = edit(p, self, () => { editor = null; });
      li.append(editor); change.setAttribute('aria-expanded', 'true'); change.textContent = 'Close';
    });
    return li;
  }

  function edit(p, self, closed) {
    const level = el('select', { id: 'lv-' + p.id }, el('option', { value: 'officer', text: 'Officer: only the tools ticked below' }), el('option', { value: 'admin', text: 'Admin: everything, and can manage access' }));
    level.value = p.role; if (self) level.disabled = true;
    const job = el('select', { id: 'jb-' + p.id });
    job.append(el('option', { value: '', text: 'No job name' }));
    Object.keys(PRESETS).forEach(j => job.append(el('option', { value: j, text: j })));
    job.append(el('option', { value: CUSTOM, text: 'Other (type a job)' }));
    const custom = el('input', { type: 'text', maxlength: '60', placeholder: 'For example: Parliamentarian', 'aria-label': 'Job name' });
    const t = p.access_title || '';
    if (t && PRESETS[t]) job.value = t; else if (t) { job.value = CUSTOM; custom.value = t; } else job.value = '';
    custom.hidden = job.value !== CUSTOM;
    const boxes = {};
    const grid = el('div', { class: 'ac-tools' });
    TOOLS.forEach(([k, label, help]) => {
      const cb = el('input', { type: 'checkbox', id: `cb-${p.id}-${k}` });
      cb.checked = p.role === 'admin' || (p.access_areas || []).includes(k);
      boxes[k] = cb;
      grid.append(el('label', { class: 'ac-tool', for: cb.id }, cb, el('span', {}, el('strong', { text: label }), el('small', { text: help }))));
    });
    const lock = () => { const a = level.value === 'admin'; Object.values(boxes).forEach(b => { b.disabled = a; if (a) b.checked = true; }); grid.classList.toggle('is-locked', a); };
    lock();
    level.addEventListener('change', () => { if (level.value === 'officer') Object.entries(boxes).forEach(([k, b]) => { b.checked = (p.access_areas || []).includes(k); }); lock(); });
    job.addEventListener('change', () => {
      custom.hidden = job.value !== CUSTOM;
      if (PRESETS[job.value] && level.value === 'officer') Object.entries(boxes).forEach(([k, b]) => { b.checked = PRESETS[job.value].includes(k); });
    });
    const msg = el('p', { class: 'rost-msg', role: 'status' });
    const save = el('button', { type: 'button', class: 'btn btn-ivy btn-sm', text: 'Save changes' });
    const remove = el('button', { type: 'button', class: 'ac-btn is-danger', text: 'Remove officer access' });
    if (self) remove.hidden = true;
    save.addEventListener('click', async () => {
      const admin = level.value === 'admin';
      const title = job.value === CUSTOM ? custom.value.trim() : job.value;
      const areas = ALL.filter(k => boxes[k].checked);
      save.disabled = true; msg.textContent = 'Saving…'; msg.className = 'rost-msg';
      const { error } = await sb.from('members').update({ role: admin ? 'admin' : 'officer', access_title: title || null, access_areas: areas }).eq('id', p.id);
      save.disabled = false;
      if (error) { msg.textContent = friendly(error); msg.className = 'rost-msg is-bad'; return; }
      say('Saved. ' + (p.full_name || p.email) + ' will see the change the next time she opens or refreshes the app.', true);
      closed(); await load();
    });
    remove.addEventListener('click', async () => {
      if (!confirm('Take officer access away from ' + (p.full_name || p.email) + '? She stays on the roster as a soror and can still sign in.')) return;
      const { error } = await sb.from('members').update({ role: 'member', access_title: null }).eq('id', p.id);
      if (error) { msg.textContent = friendly(error); msg.className = 'rost-msg is-bad'; return; }
      say('Officer access removed.', true); closed(); await load();
    });
    return el('div', { class: 'ac-edit' },
      el('label', { class: 'ac-lab', for: level.id, text: 'Level' }), level,
      el('label', { class: 'ac-lab', for: job.id, text: 'Job' }), job, custom,
      el('span', { class: 'ac-lab', text: 'Tools she can use' }), grid,
      el('div', { class: 'ac-actions' }, save, remove), msg);
  }

  const friendly = err => /at least one active admin/i.test(err.message) ? 'There must always be at least one admin, so this change was not made.'
    : /only admins/i.test(err.message) ? 'Only admins can change access.' : 'Could not save. Please try again.';

  /* ---------- give a soror access ---------- */
  const pick = $('#ac-pick'), find = $('#ac-find'), preset = $('#ac-preset'), addMsg = $('#ac-add-msg');
  Object.keys(PRESETS).forEach(j => preset.append(el('option', { value: j, text: j })));
  function fillPick() {
    const q = find.value.trim().toLowerCase();
    const list = sorors.filter(s => !q || (s.full_name || '').toLowerCase().includes(q) || s.email.includes(q)).slice(0, 80);
    pick.replaceChildren(...list.map(s => el('option', { value: s.id, text: (s.full_name || s.email) })));
    if (!list.length) pick.append(el('option', { value: '', text: 'No match' }));
  }
  find.addEventListener('input', fillPick);
  $('#ac-add').addEventListener('submit', async ev => {
    ev.preventDefault();
    if (!pick.value) { addMsg.textContent = 'Choose a soror first.'; addMsg.className = 'rost-msg is-bad'; return; }
    const { error } = await sb.from('members').update({ role: 'officer', access_title: preset.value, access_areas: PRESETS[preset.value] }).eq('id', pick.value);
    if (error) { addMsg.textContent = friendly(error); addMsg.className = 'rost-msg is-bad'; return; }
    addMsg.textContent = 'Added. Press Change beside her name to adjust her tools.'; addMsg.className = 'rost-msg is-ok';
    find.value = ''; await load();
  });

  const legend = $('#ac-legend');
  TOOLS.forEach(([, label, help]) => legend.append(el('dt', { text: label }), el('dd', { text: help })));

  await load();
});
