// Roster page extras for officers: set committee chairs from the chairmen list, and send a notification.
document.addEventListener('rco-auth-ready', async e => {
  const me = e.detail;
  const hostChairs = document.getElementById('rt-chairs'), hostNote = document.getElementById('rt-notify');
  if (!hostChairs || !hostNote) return;
  if (!(me.role === 'officer' || me.role === 'admin')) return;
  const sb = window.rcoAuth.client;
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v); });
    kids.flat(Infinity).forEach(k => n.append(k));
    return n;
  };
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const { data: myId } = await sb.rpc('my_member_id');
  const ld = await sb.from('portal_content').select('data').eq('key', 'leadership').maybeSingle();
  const lead = (ld.data && ld.data.data) || { groups: [] };
  const committees = Array.from(new Set((lead.groups || []).flatMap(g => (g.rows || []).map(r => r[0])))).sort((a, b) => a.localeCompare(b));

  /* ---- chairs ---- */
  const chairMsg = el('p', { class: 'rost-msg', role: 'status' });
  const chairBtn = el('button', { type: 'button', class: 'btn btn-ivy btn-sm', text: 'Set chairs from the chairmen list' });
  chairBtn.addEventListener('click', async () => {
    chairBtn.disabled = true; chairMsg.className = 'rost-msg'; chairMsg.textContent = 'Working…';
    const { data: members, error } = await sb.from('members').select('id,full_name').eq('active', true);
    if (error) { chairMsg.textContent = 'Could not read the roster.'; chairBtn.disabled = false; return; }
    const byName = new Map(); const dup = new Set();
    (members || []).forEach(m => { const k = norm(m.full_name); if (!k) return; if (byName.has(k)) dup.add(k); byName.set(k, m.id); });
    const want = new Map(); const unmatched = new Set();
    (lead.groups || []).forEach(g => (g.rows || []).forEach(([committee, chair, co]) => {
      [[chair, 'Chair'], [co, 'Co-Chair']].forEach(([names, role]) => {
        String(names || '').split(/\s*(?:\/|&|\band\b)\s*/i).map(s => s.trim()).filter(Boolean).forEach(n => {
          const id = byName.get(norm(n));
          if (!id || dup.has(norm(n))) { unmatched.add(n); return; }
          const key = id + '|' + committee;
          if (!want.has(key) || role === 'Chair') want.set(key, { member_id: id, committee, role });
        });
      });
    }));
    const { data: have } = await sb.from('member_committees').select('id,member_id,committee,role');
    const haveMap = new Map((have || []).map(r => [r.member_id + '|' + r.committee, r]));
    let added = 0;
    for (const [key, w] of want) {
      const ex = haveMap.get(key);
      if (ex && ex.role === w.role) continue;
      if (ex) await sb.from('member_committees').delete().eq('id', ex.id);
      const { error: e2 } = await sb.from('member_committees').insert(w);
      if (!e2) added++;
    }
    const miss = Array.from(unmatched);
    chairMsg.textContent = `Done. ${added} chair role${added === 1 ? '' : 's'} added or updated.` + (miss.length ? ` Not on the roster (or spelled differently): ${miss.slice(0, 14).join(', ')}${miss.length > 14 ? ' and ' + (miss.length - 14) + ' more' : ''}.` : '');
    chairMsg.className = 'rost-msg is-ok'; chairBtn.disabled = false;
  });
  hostChairs.replaceChildren(el('h2', { text: 'Committee chairs' }),
    el('p', { class: 'gl-note', text: 'Chairs and co-chairs can schedule meetings for their committee. This reads the chairmen list and gives each chair on the roster her chair role. Names are matched by spelling, so a chair is skipped if her roster name differs.' }), chairBtn, chairMsg);

  /* ---- notification ---- */
  const title = el('input', { class: 'pf-input', type: 'text', maxlength: '80', placeholder: 'Short title' });
  const body = el('input', { class: 'pf-input', type: 'text', maxlength: '240', placeholder: 'Your message' });
  const aud = el('select', { class: 'pf-input' }, el('option', { value: 'all', text: 'Everyone on the roster' }), ...committees.map(c => el('option', { value: 'committee:' + c, text: c + ' committee' })));
  const noteMsg = el('p', { class: 'rost-msg', role: 'status' });
  const send = el('button', { type: 'submit', class: 'btn btn-ivy btn-sm', text: 'Send notification' });
  const form = el('form', { novalidate: true, class: 'rt-form' },
    ...[['Title', title], ['Message', body], ['Send to', aud]].map(([l, i]) => el('label', { class: 'iv-field' }, el('span', { text: l }), i)), send, noteMsg);
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    if (!title.value.trim() || !body.value.trim()) { noteMsg.className = 'rost-msg is-bad'; noteMsg.textContent = 'Please write a title and a message.'; return; }
    send.disabled = true; noteMsg.className = 'rost-msg'; noteMsg.textContent = 'Sending…';
    const ins = await sb.from('notifications').insert({ title: title.value.trim(), body: body.value.trim(), audience: aud.value, url: 'portal.html', created_by: myId });
    if (ins.error) { noteMsg.className = 'rost-msg is-bad'; noteMsg.textContent = 'That could not be sent.'; send.disabled = false; return; }
    const run = await sb.functions.invoke('send-reminders', { body: {} });
    noteMsg.className = 'rost-msg is-ok';
    noteMsg.textContent = run.error ? 'Saved. It will go out within 5 minutes once notifications are switched on at the chapter.' : `Sent to ${run.data && run.data.announcements != null ? run.data.announcements : 0} device${run.data && run.data.announcements === 1 ? '' : 's'}.`;
    title.value = ''; body.value = ''; send.disabled = false;
  });
  hostNote.replaceChildren(el('h2', { text: 'Send a notification' }),
    el('p', { class: 'gl-note', text: 'A pop-up on the phones of sorors who turned notifications on. Use it for urgent news, not routine announcements.' }), form);
});
