// Officer roster: who may sign in to the portal
document.addEventListener('rco-auth-ready', e => {
  const me = e.detail;
  const $ = s => document.querySelector(s);
  const sb = window.rcoAuth.client;
  const isAdmin = me.role === 'admin';
  const isOfficer = isAdmin || me.role === 'officer';

  if (!isOfficer) { $('#roster-denied').hidden = false; $('#roster-app').hidden = true; return; }
  $('#roster-denied').hidden = true;
  $('#roster-app').hidden = false;
  if (!isAdmin) $('#add-role-wrap').hidden = true;

  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v); });
    kids.flat().forEach(k => n.append(k));
    return n;
  };
  const say = (node, msg, ok) => { node.textContent = msg; node.className = 'rost-msg ' + (ok ? 'is-ok' : 'is-bad'); };
  const emailOk = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

  let rows = [];
  let titles = {};

  async function load() {
    const { data, error } = await sb.from('members').select('id,email,full_name,role,active').order('full_name', { ascending: true, nullsFirst: false });
    if (error) { say($('#rost-status'), 'Could not load the roster. Please refresh.', false); return; }
    rows = data;
    const { data: ts } = await sb.from('profiles').select('member_id,title');
    titles = {};
    (ts || []).forEach(t => { titles[t.member_id] = t.title || ''; });
    render();
  }

  function render() {
    const q = $('#rost-q').value.trim().toLowerCase();
    const list = rows.filter(r => !q || (r.full_name || '').toLowerCase().includes(q) || r.email.includes(q));
    const active = rows.filter(r => r.active).length;
    $('#rost-count').textContent = `${rows.length} on the roster · ${active} active`;
    const body = $('#rost-body');
    body.replaceChildren();
    if (!list.length) {
      body.append(el('tr', {}, el('td', { colspan: '5', class: 'rost-empty', text: rows.length ? 'No one matches that search.' : 'No one has been added yet.' })));
      return;
    }
    list.forEach(r => {
      const locked = !isAdmin && r.role !== 'member';
      const self = r.email === me.email.toLowerCase();

      const toggle = el('button', { type: 'button', class: 'rost-btn ' + (r.active ? 'is-on' : ''), text: r.active ? 'Active' : 'Inactive', 'aria-pressed': String(r.active) });
      if (locked || self) { toggle.disabled = true; toggle.title = self ? 'You can’t change your own access' : 'Only an admin can change this one'; }
      toggle.addEventListener('click', async () => {
        toggle.disabled = true;
        const { error } = await sb.from('members').update({ active: !r.active }).eq('id', r.id);
        if (error) say($('#rost-status'), 'That change wasn’t allowed.', false);
        await load();
      });

      let roleCell;
      if (isAdmin && !self) {
        roleCell = el('select', { class: 'rost-role', 'aria-label': 'Role for ' + (r.full_name || r.email) },
          ...['member', 'officer', 'admin'].map(v => el('option', { value: v, text: v[0].toUpperCase() + v.slice(1), selected: v === r.role })));
        roleCell.addEventListener('change', async () => {
          const { error } = await sb.from('members').update({ role: roleCell.value }).eq('id', r.id);
          if (error) say($('#rost-status'), 'That change wasn’t allowed.', false);
          await load();
        });
      } else {
        roleCell = el('span', { class: 'rost-rolepill', text: r.role[0].toUpperCase() + r.role.slice(1) });
      }

      const titleIn = el('input', { type: 'text', class: 'rost-title', maxlength: '80', placeholder: 'Title (optional)', value: titles[r.id] || '', 'aria-label': 'Title for ' + (r.full_name || r.email) });
      titleIn.addEventListener('change', async () => {
        const v = titleIn.value.trim();
        const { error } = await sb.from('profiles').upsert({ member_id: r.id, title: v || null }, { onConflict: 'member_id' });
        if (error) say($('#rost-status'), 'The title wasn\u2019t saved.', false); else { titles[r.id] = v; say($('#rost-status'), 'Title saved.', true); }
      });

      body.append(el('tr', { class: r.active ? '' : 'is-off' },
        el('td', { text: r.full_name || '—' }),
        el('td', { class: 'rost-email', text: r.email }),
        el('td', {}, titleIn),
        el('td', {}, roleCell),
        el('td', {}, toggle)));
    });
  }

  $('#rost-q').addEventListener('input', render);

  $('#add-form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const out = $('#add-msg');
    const email = $('#add-email').value.trim().toLowerCase();
    const name = $('#add-name').value.trim();
    const role = isAdmin ? $('#add-role').value : 'member';
    if (!emailOk(email)) { say(out, 'Please enter a valid email address.', false); return; }
    const { error } = await sb.from('members').insert({ email, full_name: name || null, role });
    if (error) { say(out, error.code === '23505' ? 'That email is already on the roster.' : 'That wasn’t allowed.', false); return; }
    say(out, `Added ${name || email}.`, true);
    ev.target.reset();
    await load();
  });

  $('#bulk-form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const out = $('#bulk-msg');
    const lines = $('#bulk-text').value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const seen = new Set(); const good = []; const bad = [];
    lines.forEach(l => {
      const m = l.match(/^([^\s,;\t]+@[^\s,;\t]+)[\s,;\t]*(.*)$/);
      const email = m && m[1].toLowerCase();
      if (!m || !emailOk(email)) { bad.push(l); return; }
      if (seen.has(email)) return;
      seen.add(email);
      good.push({ email, full_name: m[2].trim() || null, role: 'member' });
    });
    if (!good.length) { say(out, 'No valid lines found. Use one per line: email, Full Name.', false); return; }
    const { error } = await sb.from('members').upsert(good, { onConflict: 'email', ignoreDuplicates: true });
    if (error) { say(out, 'That wasn’t allowed.', false); return; }
    say(out, `Added ${good.length} (anyone already on the roster was skipped).` + (bad.length ? ` ${bad.length} line${bad.length > 1 ? 's' : ''} had no valid email and ${bad.length > 1 ? 'were' : 'was'} left out.` : ''), true);
    $('#bulk-text').value = '';
    await load();
  });

  load();
});
