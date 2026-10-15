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
  let cards = [];

  async function load() {
    const { data, error } = await sb.from('members').select('id,email,full_name,role,active').order('full_name', { ascending: true, nullsFirst: false });
    if (error) { say($('#rost-status'), 'Could not load the roster. Please refresh.', false); return; }
    rows = data;
    const { data: ts } = await sb.from('profiles').select('member_id,title');
    titles = {};
    (ts || []).forEach(t => { titles[t.member_id] = t.title || ''; });
    const { data: cs } = await sb.from('directory').select('id,display_name,member_id').order('display_name', { ascending: true });
    cards = cs || [];
    render();
  }

  function render() {
    const q = $('#rost-q').value.trim().toLowerCase();
    const list = rows.filter(r => !q || (r.full_name || '').toLowerCase().includes(q) || r.email.includes(q));
    const active = rows.filter(r => r.active).length;
    const linked = rows.filter(r => cards.some(c => c.member_id === r.id)).length;
    $('#rost-count').textContent = `${rows.length} on the roster · ${active} active · ${linked} linked to a directory card`;
    const body = $('#rost-body');
    body.replaceChildren();
    if (!list.length) {
      body.append(el('tr', {}, el('td', { colspan: '6', class: 'rost-empty', text: rows.length ? 'No one matches that search.' : 'No one has been added yet.' })));
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

      const nameIn = el('input', { type: 'text', class: 'rost-title rost-name', maxlength: '120', placeholder: 'Full name', value: r.full_name || '', 'aria-label': 'Full name for ' + r.email });
      if (locked) nameIn.disabled = true;
      nameIn.addEventListener('change', async () => {
        const { error } = await sb.from('members').update({ full_name: nameIn.value.trim() || null }).eq('id', r.id);
        if (error) say($('#rost-status'), 'The name wasn’t saved.', false); else say($('#rost-status'), 'Name saved.', true);
        await load();
      });

      const mine = cards.find(c => c.member_id === r.id);
      const cardSel = el('select', { class: 'rost-role rost-card-sel', 'aria-label': 'Directory card for ' + (r.full_name || r.email) },
        el('option', { value: '', text: 'Not linked' }),
        ...cards.filter(c => !c.member_id || c.member_id === r.id).map(c => el('option', { value: c.id, text: c.display_name })));
      if (mine) cardSel.value = mine.id;
      cardSel.addEventListener('change', async () => {
        if (mine) await sb.from('directory').update({ member_id: null }).eq('id', mine.id);
        if (cardSel.value) {
          const { error } = await sb.from('directory').update({ member_id: r.id }).eq('id', cardSel.value);
          if (error) say($('#rost-status'), 'That card couldn’t be linked.', false); else say($('#rost-status'), 'Directory card linked.', true);
        } else say($('#rost-status'), 'Directory card unlinked.', true);
        await load();
      });

      body.append(el('tr', { class: r.active ? '' : 'is-off' },
        el('td', {}, nameIn),
        el('td', { class: 'rost-email', text: r.email }),
        el('td', {}, titleIn),
        el('td', {}, cardSel),
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

  // load a CSV or text file straight into the box
  $('#bulk-file').addEventListener('change', async ev => {
    const f = ev.target.files[0];
    if (!f) return;
    $('#bulk-text').value = await f.text();
    say($('#bulk-msg'), `Loaded ${f.name}. Check the lines, then click Add all.`, true);
    ev.target.value = '';
  });

  $('#bulk-form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const out = $('#bulk-msg');
    const lines = $('#bulk-text').value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length && !lines[0].includes('@')) lines.shift(); // a header row such as "email, name, title"
    const seen = new Set(); const good = []; const bad = [];
    lines.forEach(l => {
      const cells = l.split(/\t|,|;/).map(c => c.trim().replace(/^"|"$/g, ''));
      const email = (cells[0] || '').toLowerCase();
      if (!emailOk(email)) { bad.push(l); return; }
      if (seen.has(email)) return;
      seen.add(email);
      good.push({ email, full_name: cells[1] || null, title: cells[2] || null, role: 'member' });
    });
    if (!good.length) { say(out, 'No valid lines found. Use one per line: email, Full Name, Title (optional).', false); return; }
    const { error } = await sb.from('members').upsert(good.map(g => ({ email: g.email, full_name: g.full_name, role: g.role })), { onConflict: 'email', ignoreDuplicates: true });
    if (error) { say(out, 'That wasn’t allowed.', false); return; }

    const withTitles = good.filter(g => g.title);
    if (withTitles.length) {
      const { data: ids } = await sb.from('members').select('id,email').in('email', withTitles.map(g => g.email));
      const byEmail = {};
      (ids || []).forEach(i => { byEmail[i.email] = i.id; });
      const rowsT = withTitles.filter(g => byEmail[g.email]).map(g => ({ member_id: byEmail[g.email], title: g.title }));
      if (rowsT.length) await sb.from('profiles').upsert(rowsT, { onConflict: 'member_id' });
    }
    say(out, `Added ${good.length} (anyone already on the roster was skipped).` + (bad.length ? ` ${bad.length} line${bad.length > 1 ? 's' : ''} had no valid email and ${bad.length > 1 ? 'were' : 'was'} left out.` : ''), true);
    $('#bulk-text').value = '';
    await load();
  });

  load();
});
