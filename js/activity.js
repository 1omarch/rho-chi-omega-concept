// My Involvement: positions and honors, committees, RSVPs, and purchases & donations (private to the soror).
document.addEventListener('rco-auth-ready', async e => {
  const host = document.getElementById('pf-activity');
  if (!host) return;
  const me = e.detail;
  const sb = window.rcoAuth.client;
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v); });
    kids.flat(Infinity).forEach(k => n.append(k));
    return n;
  };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtDate = iso => { if (!iso) return 'Date not set'; const [y, m, d] = iso.split('-').map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; };
  const money = n => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  const { data: myId } = await sb.rpc('my_member_id');
  if (!myId) return;
  const [pr, ld, cm, ac] = await Promise.all([
    sb.from('profiles').select('initiation_year,honor,title').eq('member_id', myId).maybeSingle(),
    sb.from('portal_content').select('data').eq('key', 'leadership').maybeSingle(),
    sb.from('member_committees').select('id,committee,role,remind').eq('member_id', myId).order('committee'),
    sb.from('member_activity').select('*').eq('member_id', myId).order('event_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
  ]);
  if (cm.error || ac.error) {
    host.replaceChildren(el('div', { class: 'pf-card' }, el('h3', { text: 'My involvement' }), el('p', { class: 'iv-empty', text: 'Your involvement list is being set up. Please check back soon.' })));
    return;
  }
  let profile = pr.data || {};
  const lead = (ld.data && ld.data.data) || { officers: { rows: [] }, groups: [] };
  let committees = cm.data || [];
  let acts = ac.data || [];

  /* ---------- positions and honors, worked out from what we already know ---------- */
  const mine = norm(me.name);
  const positions = [];
  if (profile.title) positions.push({ text: profile.title, note: 'Set by a chapter officer' });
  (lead.officers.rows || []).forEach(([title, name]) => { if (norm(name) === mine && title !== profile.title) positions.push({ text: title, note: 'Chapter officer' }); });
  const chairing = [];
  (lead.groups || []).forEach(g => (g.rows || []).forEach(([committee, chair, co]) => {
    const split = s => String(s || '').split(/\s*(?:\/|&|\band\b)\s*/i).map(norm);
    if (split(chair).includes(mine)) chairing.push({ committee, role: 'Chair', label: g.label });
    if (split(co).includes(mine)) chairing.push({ committee, role: 'Co-Chair', label: g.label });
  }));
  const HONORS = {
    silver_star: ['Silver Star', '25 years of membership'],
    golden_soror: ['Golden Soror', '50 years of membership'],
    pearl_soror: ['Pearl Soror', '65 years of membership'],
    diamond_soror: ['Diamond Soror', '75 or more years of membership and service (Diamond Star / Diamond Diva)']
  };
  const MILESTONES = [[25, 'silver_star'], [50, 'golden_soror'], [65, 'pearl_soror'], [75, 'diamond_soror']];
  let years = null, honorKey = null;
  function derive() {
    years = profile.initiation_year ? new Date().getFullYear() - profile.initiation_year : null;
    honorKey = null;
    if (profile.honor && profile.honor !== 'none') honorKey = profile.honor;
    else if (!profile.honor && years !== null) { MILESTONES.forEach(([n, k]) => { if (years >= n) honorKey = k; }); }
  }
  derive();

  /* ---------- small building blocks ---------- */
  const section = (title, sub, ...kids) => el('section', { class: 'iv-sec' }, el('h4', { text: title }), sub ? el('p', { class: 'iv-sub', text: sub }) : '', kids);
  const empty = t => el('p', { class: 'iv-empty', text: t });
  const field = (label, input) => el('label', { class: 'iv-field' }, el('span', { text: label }), input);
  const input = (attrs) => el('input', Object.assign({ class: 'pf-input' }, attrs));
  function remindToggle(on, label, onChange) {
    const box = el('input', { type: 'checkbox' });
    box.checked = on;
    box.addEventListener('change', () => onChange(box.checked));
    return el('label', { class: 'iv-remind' }, box, ' ' + label);
  }
  function removeBtn(onRemove) {
    const b = el('button', { type: 'button', class: 'iv-x', text: 'Remove' });
    let armed = false;
    b.addEventListener('click', async () => {
      if (!armed) { armed = true; b.textContent = 'Tap again to remove'; setTimeout(() => { armed = false; b.textContent = 'Remove'; }, 4000); return; }
      b.disabled = true; await onRemove();
    });
    return b;
  }
  function toggleForm(label, makeForm) {
    const wrap = el('div', { class: 'iv-addwrap' });
    const btn = el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: label });
    btn.addEventListener('click', () => { if (wrap.querySelector('form')) { wrap.querySelector('form').remove(); return; } wrap.append(makeForm(() => wrap.querySelector('form') && wrap.querySelector('form').remove())); });
    wrap.append(btn);
    return wrap;
  }

  /* ---------- 1. positions and honors ---------- */
  function positionsSection() {
    const items = [];
    positions.forEach(p => items.push(el('li', { class: 'iv-row' }, el('div', {}, el('strong', { text: p.text }), el('span', { class: 'iv-note', text: p.note })))));
    chairing.forEach(c => items.push(el('li', { class: 'iv-row' }, el('div', {}, el('strong', { text: `${c.role}: ${c.committee}` }), el('span', { class: 'iv-note', text: c.label })))));
    const kids = [];
    if (honorKey) kids.push(el('div', { class: 'iv-honor' }, el('span', { class: 'iv-star', 'aria-hidden': 'true', text: '★' }), el('div', {}, el('strong', { text: HONORS[honorKey][0] }), el('span', { class: 'iv-note', text: HONORS[honorKey][1] }))));
    if (years !== null && years >= 0) {
      kids.push(el('p', { class: 'iv-years', text: `Years of membership: ${years === 0 ? 'less than 1 (initiated this year)' : years}` }));
      const next = MILESTONES.find(([n]) => years < n);
      if (next) kids.push(el('p', { class: 'iv-sub', text: `Next honor: ${HONORS[next[1]][0]} in ${next[0] - years} year${next[0] - years === 1 ? '' : 's'} (${profile.initiation_year + next[0]}).` }));
    }

    if (years === null) {
      const go = el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Add my year initiated' });
      go.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); const edit = document.getElementById('pf-edit'); if (edit) edit.click(); });
      kids.push(el('p', { class: 'iv-sub', text: 'Add the year you were initiated in your profile details, and we will work out your years of membership and honor.' }), go);
    }
    kids.push(items.length ? el('ul', { class: 'iv-list' }, items) : empty('No positions to show right now. Offices and chair roles appear here automatically.'));
    return section('Positions & honors', 'Worked out from the chapter’s officer and committee lists and your initiation year.', kids);
  }

  /* ---------- 2. committees ---------- */
  function committeesSection() {
    const names = Array.from(new Set((lead.groups || []).flatMap(g => (g.rows || []).map(r => r[0])))).sort((a, b) => a.localeCompare(b));
    const rows = [];
    committees.forEach(c => rows.push(el('li', { class: 'iv-row' }, el('div', {}, el('strong', { text: c.committee }), el('span', { class: 'iv-note', text: c.role }),
      remindToggle(c.remind !== false, 'Remind me before meetings', async on => { await sb.from('member_committees').update({ remind: on }).eq('id', c.id); c.remind = on; })),
      removeBtn(async () => { await sb.from('member_committees').delete().eq('id', c.id); await reload(); }))));
    chairing.filter(c => !committees.some(m => m.committee === c.committee)).forEach(c => rows.push(el('li', { class: 'iv-row' }, el('div', {}, el('strong', { text: c.committee }), el('span', { class: 'iv-note', text: `${c.role} (${c.label})` })))));
    const add = toggleForm('Add a committee', done => {
      const sel = el('select', { class: 'pf-input' }, el('option', { value: '', text: 'Choose a committee' }), ...names.map(n => el('option', { value: n, text: n })), el('option', { value: '__other', text: 'Other (type it below)' }));
      const other = input({ type: 'text', maxlength: '80', placeholder: 'Committee name' });
      const msg = el('p', { class: 'iv-msg', role: 'status' });
      const go = el('button', { type: 'submit', class: 'btn btn-ivy btn-sm', text: 'Add' });
      const f = el('form', { class: 'iv-form', novalidate: true }, field('Committee', sel), field('Or type its name', other), el('div', { class: 'iv-actions' }, go), msg);
      f.addEventListener('submit', async ev => {
        ev.preventDefault();
        const name = sel.value && sel.value !== '__other' ? sel.value : other.value.trim();
        if (!name) { msg.textContent = 'Please choose or type a committee.'; return; }
        const { error } = await sb.from('member_committees').insert({ member_id: myId, committee: name, role: 'Member' });
        if (error) { msg.textContent = error.code === '23505' ? 'That committee is already on your list.' : 'That could not be added.'; return; }
        await reload();
      });
      return f;
    });
    return section('My committees', 'The committees you serve on. Chair roles are added for you.', rows.length ? el('ul', { class: 'iv-list' }, rows) : empty('No committees yet.'), add);
  }

  /* ---------- 3. RSVPs ---------- */
  function rsvpSection() {
    const all = acts.filter(a => a.kind === 'rsvp');
    const coming = all.filter(a => !a.event_date || a.event_date >= today).sort((a, b) => (a.event_date || '9999').localeCompare(b.event_date || '9999'));
    const past = all.filter(a => a.event_date && a.event_date < today);
    const row = (a, upcoming) => {
      const links = [];
      if (upcoming && a.event_date && window.rcoCal) {
        links.push(el('a', { class: 'iv-link', href: window.rcoCal.google(a.title, a.event_date, a.note), target: '_blank', rel: 'noopener', text: 'Add to Google Calendar' }));
        links.push(el('a', { class: 'iv-link', href: window.rcoCal.icsHref(a.title, a.event_date, a.note), download: 'event.ics', text: 'Apple / Outlook (.ics)' }));
      }
      return el('li', { class: 'iv-row' }, el('div', {}, el('strong', { text: a.title }), el('span', { class: 'iv-note', text: fmtDate(a.event_date) + (a.note ? ' · ' + a.note : '') }), links.length ? el('div', { class: 'iv-links' }, links) : '',
        upcoming && a.event_date ? remindToggle(a.remind !== false, 'Remind me (evening before and morning of)', async on => { await sb.from('member_activity').update({ remind: on }).eq('id', a.id); a.remind = on; }) : ''),
        removeBtn(async () => { await sb.from('member_activity').delete().eq('id', a.id); await reload(); }));
    };
    const add = toggleForm('Add an RSVP', () => {
      const title = input({ type: 'text', maxlength: '120', placeholder: 'Event name', required: true });
      const date = input({ type: 'date' });
      const note = input({ type: 'text', maxlength: '300', placeholder: 'Optional note' });
      const msg = el('p', { class: 'iv-msg', role: 'status' });
      const f = el('form', { class: 'iv-form', novalidate: true }, field('Event', title), field('Date', date), field('Note (optional)', note), el('div', { class: 'iv-actions' }, el('button', { type: 'submit', class: 'btn btn-ivy btn-sm', text: 'Add' })), msg);
      f.addEventListener('submit', async ev => {
        ev.preventDefault();
        if (!title.value.trim()) { msg.textContent = 'Please type the event name.'; return; }
        const { error } = await sb.from('member_activity').insert({ member_id: myId, kind: 'rsvp', title: title.value.trim(), event_date: date.value || null, note: note.value.trim() || null });
        if (error) { msg.textContent = 'That could not be added.'; return; }
        await reload();
      });
      return f;
    });
    return section('My RSVPs & events', 'Events you plan to attend. RSVPs you make on the Events page appear here too.',
      coming.length ? [el('h5', { text: 'Coming up' }), el('ul', { class: 'iv-list' }, coming.map(a => row(a, true)))] : empty('No upcoming events yet. Use “Add to my list” on the Events Registration page.'),
      past.length ? [el('h5', { text: 'Past events' }), el('ul', { class: 'iv-list is-past' }, past.slice(0, 8).map(a => row(a, false)))] : '', add);
  }

  /* ---------- 4. purchases and donations ---------- */
  function purchasesSection() {
    const all = acts.filter(a => a.kind !== 'rsvp');
    const total = all.reduce((s, a) => s + (Number(a.amount) || 0), 0);
    const rows = all.map(a => el('li', { class: 'iv-row' },
      el('div', {}, el('strong', { text: a.title }), el('span', { class: 'iv-note', text: `${a.kind === 'donation' ? 'Donation' : 'Purchase'} · ${fmtDate(a.event_date)}${a.note ? ' · ' + a.note : ''}` })),
      el('div', { class: 'iv-amt', text: a.amount != null ? money(a.amount) : '' }),
      removeBtn(async () => { await sb.from('member_activity').delete().eq('id', a.id); await reload(); })));
    const add = toggleForm('Add a purchase or donation', () => {
      const kind = el('select', { class: 'pf-input' }, el('option', { value: 'purchase', text: 'Purchase' }), el('option', { value: 'donation', text: 'Donation' }));
      const title = input({ type: 'text', maxlength: '120', placeholder: 'What was it?' });
      const date = input({ type: 'date' }); date.value = today;
      const amount = input({ type: 'number', min: '0', step: '0.01', inputmode: 'decimal', placeholder: '0.00' });
      const note = input({ type: 'text', maxlength: '300', placeholder: 'Optional note' });
      const msg = el('p', { class: 'iv-msg', role: 'status' });
      const f = el('form', { class: 'iv-form', novalidate: true }, field('Type', kind), field('What', title), field('Date', date), field('Amount ($)', amount), field('Note (optional)', note), el('div', { class: 'iv-actions' }, el('button', { type: 'submit', class: 'btn btn-ivy btn-sm', text: 'Add' })), msg);
      f.addEventListener('submit', async ev => {
        ev.preventDefault();
        if (!title.value.trim()) { msg.textContent = 'Please say what it was.'; return; }
        const amt = amount.value.trim() === '' ? null : Number(amount.value);
        if (amt !== null && (isNaN(amt) || amt < 0)) { msg.textContent = 'Please enter a valid amount.'; return; }
        const { error } = await sb.from('member_activity').insert({ member_id: myId, kind: kind.value, title: title.value.trim(), event_date: date.value || null, amount: amt, note: note.value.trim() || null });
        if (error) { msg.textContent = 'That could not be added.'; return; }
        await reload();
      });
      return f;
    });
    return section('My purchases & donations', 'Your own record, so you can keep up with what you have bought and given. This list is private to you.',
      rows.length ? [el('ul', { class: 'iv-list' }, rows), el('p', { class: 'iv-total', text: `Total recorded: ${money(total)}` })] : empty('Nothing recorded yet.'), add);
  }

  function render() {
    host.replaceChildren(el('div', { class: 'pf-card iv-card' }, el('h3', { text: 'My involvement' }), positionsSection(), committeesSection(), rsvpSection(), purchasesSection()));
  }
  async function reload() {
    const [c, a] = await Promise.all([
      sb.from('member_committees').select('id,committee,role,remind').eq('member_id', myId).order('committee'),
      sb.from('member_activity').select('*').eq('member_id', myId).order('event_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
    ]);
    committees = c.data || []; acts = a.data || [];
    render();
  }
  render();
});
