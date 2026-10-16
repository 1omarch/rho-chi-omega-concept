// Administrator message review: reported messages, lookups, and the review log.
document.addEventListener('rco-auth-ready', async e => {
  const me = e.detail;
  const $ = s => document.querySelector(s);
  if (me.role !== 'admin') { $('#mr-denied').hidden = false; $('#mr-app').hidden = true; return; }
  $('#mr-app').hidden = false;
  const sb = window.rcoAuth.client;
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v); });
    kids.flat().forEach(k => n.append(k));
    return n;
  };
  const fmt = iso => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  async function openThread(cid, label) {
    const { data, error } = await sb.rpc('admin_read_conversation', { cid });
    const box = $('#mr-thread');
    box.hidden = false;
    if (error) { box.replaceChildren(el('p', { class: 'mg-status', text: 'That conversation could not be opened.' })); return; }
    const paths = data.flatMap(m => (m.attachments || []).map(a => a.path));
    const urls = {};
    if (paths.length) {
      const { data: signed } = await sb.storage.from('message-files').createSignedUrls(paths, 600);
      (signed || []).forEach(s => { if (s.signedUrl) urls[s.path] = s.signedUrl; });
    }
    const rows = data.map(m => el('div', { class: 'mg-row' },
      el('div', { class: 'mg-meta' }, m.sender_name, el('time', { text: ' · ' + fmt(m.created_at) })),
      el('div', { class: 'mg-bubble' },
        m.body ? el('p', { text: m.body }) : '',
        (m.attachments || []).map(a => urls[a.path] ? el('a', { class: 'mg-file', href: urls[a.path], target: '_blank', rel: 'noopener', text: '📎 ' + a.name }) : el('span', { class: 'mg-file is-gone', text: a.name + ' (unavailable)' })))));
    box.replaceChildren(el('h3', { class: 'mr-sub', text: label || 'Conversation' }), el('div', { class: 'mg-msgs mr-msgs' }, rows.length ? rows : el('p', { class: 'mg-none', text: 'No messages.' })));
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    loadLog();
  }

  async function loadReports() {
    const { data, error } = await sb.rpc('admin_reports');
    const host = $('#mr-reports');
    if (error) { host.replaceChildren(el('p', { class: 'mg-none', text: 'Reports could not be loaded.' })); return; }
    if (!data.length) { host.replaceChildren(el('p', { class: 'mg-none', text: 'No reported messages.' })); return; }
    host.replaceChildren(...data.map(r => {
      const open = el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Open conversation' });
      open.addEventListener('click', () => openThread(r.conversation_id, 'Reported conversation'));
      const done = el('button', { type: 'button', class: 'btn btn-ivy btn-sm', text: 'Mark handled' });
      done.addEventListener('click', async () => { await sb.rpc('admin_resolve_report', { rid: r.report_id }); await loadReports(); loadLog(); });
      return el('article', { class: 'mr-card' + (r.handled ? ' is-done' : '') },
        el('p', { class: 'mg-meta' }, `Reported by ${r.reporter_name || 'a soror'} · ${fmt(r.reported_at)}`, r.handled ? ' · handled' : ''),
        el('p', { class: 'mr-quote', text: r.body || '(attachment only)' }),
        el('p', { class: 'mg-meta' }, `Sent by ${r.sender_name || 'a soror'} · ${fmt(r.sent_at)}`),
        r.reason ? el('p', { class: 'mr-reason', text: 'Reason: ' + r.reason }) : '',
        el('div', { class: 'mg-compose-row' }, open, r.handled ? '' : done));
    }));
  }

  // look up by soror
  const { data: roster } = await sb.rpc('get_profiles');
  const people = (roster || []).filter(p => p.full_name).sort((a, b) => a.full_name.localeCompare(b.full_name));
  const q = $('#mr-q'), results = $('#mr-results');
  q.addEventListener('input', () => {
    const t = q.value.trim().toLowerCase();
    if (!t) { results.hidden = true; return; }
    const hits = people.filter(p => p.full_name.toLowerCase().includes(t)).slice(0, 12);
    results.hidden = false;
    results.replaceChildren(...hits.map(p => {
      const b = el('button', { type: 'button', class: 'mg-pick', text: p.full_name });
      b.addEventListener('click', async () => {
        results.hidden = true; q.value = p.full_name;
        const { data, error } = await sb.rpc('admin_find_conversations', { mid: p.member_id });
        const host = $('#mr-convos');
        if (error) { host.replaceChildren(el('p', { class: 'mg-none', text: 'Lookup failed.' })); return; }
        if (!data.length) { host.replaceChildren(el('p', { class: 'mg-none', text: `${p.full_name} has no conversations.` })); return; }
        host.replaceChildren(...data.map(c => {
          const names = (c.participants || []).map(x => x.name).join(', ');
          const go = el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Open' });
          go.addEventListener('click', () => openThread(c.id, c.title || names));
          return el('article', { class: 'mr-card' }, el('strong', { text: c.title || names }), el('p', { class: 'mg-meta', text: `${c.is_group ? 'Group' : 'Direct'} · last message ${fmt(c.last_message_at)}` }), go);
        }));
        loadLog();
      });
      return el('li', {}, b);
    }));
  });

  async function loadLog() {
    const { data } = await sb.rpc('admin_review_log');
    $('#mr-log').replaceChildren(...(data || []).map(l => el('tr', {}, el('td', { text: fmt(l.at) }), el('td', { text: l.admin_name || '' }), el('td', { text: l.action }))));
  }

  await loadReports();
  loadLog();
});
