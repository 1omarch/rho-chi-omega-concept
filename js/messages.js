// Messages: private chats and group chats between sorors, inside My Profile.
document.addEventListener('rco-auth-ready', async e => {
  const root = document.getElementById('msg-app');
  if (!root) return;
  const me = e.detail;
  const sb = window.rcoAuth.client;
  const RETENTION_DAYS = 30;
  const MAX_FILES = 5, MAX_BYTES = 10 * 1024 * 1024;
  const OK_TYPES = /^(image\/(jpeg|png|webp|gif|heic)|application\/(pdf|msword|vnd\.ms-excel|vnd\.ms-powerpoint|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation))|text\/(plain|csv))$/;

  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v); });
    kids.flat().forEach(k => n.append(k));
    return n;
  };
  const fmt = iso => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const bytes = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

  // tabs: Profile | Messages
  const tabProfile = document.getElementById('tab-profile'), tabMessages = document.getElementById('tab-messages');
  const profileView = document.getElementById('pf-view');
  function showTab(name) {
    const msgs = name === 'messages';
    root.hidden = !msgs; profileView.hidden = msgs;
    tabProfile.setAttribute('aria-selected', String(!msgs)); tabMessages.setAttribute('aria-selected', String(msgs));
    history.replaceState(null, '', msgs ? '#messages' + location.search.replace(/^$/, '') : location.pathname);
  }
  tabProfile.addEventListener('click', () => showTab('profile'));
  tabMessages.addEventListener('click', () => showTab('messages'));
  if (location.hash === '#messages' || new URLSearchParams(location.search).get('to')) { root.hidden = false; profileView.hidden = true; tabProfile.setAttribute('aria-selected', 'false'); tabMessages.setAttribute('aria-selected', 'true'); }

  const { data: myId } = await sb.rpc('my_member_id');
  const first = await sb.rpc('list_conversations');
  if (first.error) {
    root.replaceChildren(el('p', { class: 'mg-empty', text: 'Messages are not available yet. Please check back soon.' }));
    return;
  }
  let convos = first.data || [];
  let roster = [];
  let current = null;       // the open conversation
  let showTrash = false;
  let pendingFiles = [];
  let threadMsgs = [];      // messages shown in the open thread (with sender names)

  async function loadRoster() {
    if (roster.length) return roster;
    const { data } = await sb.rpc('get_profiles');
    roster = (data || []).filter(p => p.member_id !== myId && p.full_name).sort((a, b) => a.full_name.localeCompare(b.full_name));
    return roster;
  }

  const nameOf = c => {
    if (c.title) return c.title;
    const others = (c.participants || []).filter(p => p.id !== myId).map(p => p.name);
    if (others.length <= 3) return others.join(', ') || 'Just you';
    return others.slice(0, 2).join(', ') + ` +${others.length - 2}`;
  };

  /* ---------- layout ---------- */
  const listEl = el('ul', { class: 'mg-convos', 'aria-label': 'Conversations' });
  const threadEl = el('section', { class: 'mg-thread', 'aria-live': 'polite' });
  const newBtn = el('button', { type: 'button', class: 'btn btn-ivy btn-sm', text: 'New message' });
  const trashBtn = el('button', { type: 'button', class: 'mg-link', text: 'Trash' });
  const shell = el('div', { class: 'mg-shell' },
    el('aside', { class: 'mg-side' }, el('div', { class: 'mg-side-head' }, newBtn, trashBtn), listEl),
    threadEl);
  root.replaceChildren(shell,
    el('p', { class: 'mg-notice', text: `Messages are permanently deleted ${RETENTION_DAYS} days after they are sent. Use “Email me a copy” to keep one. Chapter administrators can review messages in an emergency.` }));

  function refreshBadge() { document.dispatchEvent(new CustomEvent('rco-inbox-refresh')); }

  /* ---------- conversation list ---------- */
  function renderList() {
    listEl.replaceChildren();
    if (!convos.length) { listEl.append(el('li', { class: 'mg-none', text: 'No messages yet. Start one with New message.' })); return; }
    convos.forEach(c => {
      const b = el('button', { type: 'button', class: 'mg-convo' + (current && current.id === c.id && !showTrash ? ' is-open' : '') + (c.unread ? ' is-unread' : '') },
        el('span', { class: 'mg-convo-top' }, el('strong', { text: nameOf(c) }), el('time', { text: fmt(c.last_message_at) })),
        el('span', { class: 'mg-convo-prev' }, c.is_group ? el('em', { text: 'Group · ' }) : '', c.preview || ''),
        c.unread ? el('span', { class: 'mg-unread', text: String(c.unread) }) : '');
      b.addEventListener('click', () => openConvo(c.id));
      listEl.append(el('li', {}, b));
    });
  }

  async function reloadList() {
    const { data } = await sb.rpc('list_conversations');
    convos = data || [];
    renderList();
    refreshBadge();
  }

  /* ---------- thread ---------- */
  function emptyThread() {
    threadEl.classList.remove('is-open');
    threadEl.replaceChildren(el('div', { class: 'mg-empty' }, el('h3', { text: 'Your messages' }), el('p', { text: 'Choose a conversation, or start a new one. You can message one soror or a whole group, and attach flyers and documents.' })));
  }

  async function openConvo(id) {
    showTrash = false;
    current = convos.find(c => c.id === id) || null;
    if (!current) { emptyThread(); return; }
    pendingFiles = [];
    renderList();
    await loadThread();
    await sb.rpc('mark_read', { cid: id });
    const mine = convos.find(c => c.id === id); if (mine) mine.unread = 0;
    renderList();
    refreshBadge();
  }

  async function loadThread() {
    const cid = current.id;
    const [{ data: msgs }, { data: dels }] = await Promise.all([
      sb.from('messages').select('id,sender_id,body,created_at').eq('conversation_id', cid).order('created_at', { ascending: true }).limit(500),
      sb.from('message_deletions').select('message_id').eq('member_id', myId)
    ]);
    const mids = (msgs || []).map(m => m.id);
    const { data: atts } = mids.length
      ? await sb.from('message_attachments').select('id,message_id,path,file_name,mime_type,size_bytes').in('message_id', mids)
      : { data: [] };
    const hidden = new Set((dels || []).map(d => d.message_id));
    const names = {}; (current.participants || []).forEach(p => { names[p.id] = p.name; });
    const byMsg = {}; (atts || []).forEach(a => { (byMsg[a.message_id] = byMsg[a.message_id] || []).push(a); });
    threadMsgs = (msgs || []).filter(m => !hidden.has(m.id)).map(m => ({ ...m, sender: names[m.sender_id] || 'Former member', mine: m.sender_id === myId, files: byMsg[m.id] || [] }));

    // short-lived links for attachments
    const paths = threadMsgs.flatMap(m => m.files.map(f => f.path));
    const urls = {};
    if (paths.length) {
      const { data: signed } = await sb.storage.from('message-files').createSignedUrls(paths, 3600);
      (signed || []).forEach(s => { if (s.signedUrl) urls[s.path] = s.signedUrl; });
    }
    renderThread(urls);
  }

  function renderThread(urls) {
    const c = current;
    const back = el('button', { type: 'button', class: 'mg-back', 'aria-label': 'Back to conversations', text: '←' });
    back.addEventListener('click', () => { current = null; renderList(); emptyThread(); });
    const people = (c.participants || []).filter(p => p.id !== myId).map(p => p.name).join(', ');
    const copyBtn = el('button', { type: 'button', class: 'mg-link', text: 'Email me a copy' });
    const dlBtn = el('button', { type: 'button', class: 'mg-link', text: 'Download' });
    copyBtn.addEventListener('click', emailCopy);
    dlBtn.addEventListener('click', downloadCopy);
    const tools = [copyBtn, dlBtn];
    if (c.is_group && c.created_by === myId) {
      const add = el('button', { type: 'button', class: 'mg-link', text: 'Add sorors' });
      add.addEventListener('click', () => pickSorors({ title: 'Add sorors to this group', exclude: (c.participants || []).map(p => p.id), onDone: async ids => {
        const { error } = await sb.rpc('add_conversation_members', { cid: c.id, member_ids: ids });
        if (error) return error.message; await reloadList(); current = convos.find(x => x.id === c.id) || current; await loadThread(); return null;
      } }));
      tools.push(add);
    }

    const list = el('div', { class: 'mg-msgs' });
    if (!threadMsgs.length) list.append(el('p', { class: 'mg-none', text: 'No messages in this conversation yet. Say hello.' }));
    let lastDay = '';
    threadMsgs.forEach(m => {
      const day = new Date(m.created_at).toDateString();
      if (day !== lastDay) { list.append(el('div', { class: 'mg-day', text: new Date(m.created_at).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) })); lastDay = day; }
      const bubble = el('div', { class: 'mg-bubble' });
      if (m.body) bubble.append(el('p', { text: m.body }));
      m.files.forEach(f => {
        const url = urls[f.path];
        if (!url) { bubble.append(el('span', { class: 'mg-file is-gone', text: f.file_name + ' (unavailable)' })); return; }
        if ((f.mime_type || '').startsWith('image/') && f.mime_type !== 'image/heic') {
          bubble.append(el('a', { class: 'mg-img', href: url, target: '_blank', rel: 'noopener' }, el('img', { src: url, alt: f.file_name, loading: 'lazy' })));
        } else {
          bubble.append(el('a', { class: 'mg-file', href: url, target: '_blank', rel: 'noopener' }, el('span', { text: '📎 ' + f.file_name }), el('small', { text: f.size_bytes ? bytes(f.size_bytes) : '' })));
        }
      });
      const del = el('button', { type: 'button', class: 'mg-act', text: 'Delete' });
      del.addEventListener('click', async () => {
        const { error } = await sb.from('message_deletions').insert({ message_id: m.id, member_id: myId });
        if (!error) { await loadThread(); await reloadList(); }
      });
      const acts = el('div', { class: 'mg-acts' }, del);
      if (!m.mine) {
        const rep = el('button', { type: 'button', class: 'mg-act', text: 'Report' });
        rep.addEventListener('click', () => reportForm(m, acts));
        acts.append(rep);
      }
      list.append(el('div', { class: 'mg-row' + (m.mine ? ' is-mine' : '') },
        el('div', { class: 'mg-meta' }, m.mine ? 'You' : m.sender, el('time', { text: ' · ' + fmt(m.created_at) })), bubble, acts));
    });

    threadEl.classList.add('is-open');
    threadEl.replaceChildren(
      el('header', { class: 'mg-head' }, back,
        el('div', { class: 'mg-head-txt' }, el('h3', { text: nameOf(c) }), c.is_group ? el('p', { text: `${(c.participants || []).length} sorors: ${people}` }) : ''),
        el('div', { class: 'mg-tools' }, tools)),
      list, composer());
    list.scrollTop = list.scrollHeight;
  }

  function reportForm(m, host) {
    if (host.querySelector('.mg-report')) return;
    const input = el('input', { type: 'text', class: 'mg-input', maxlength: '500', placeholder: 'Why are you reporting this? (optional)', 'aria-label': 'Reason for reporting' });
    const send = el('button', { type: 'button', class: 'btn btn-ivy btn-sm', text: 'Send report' });
    const cancel = el('button', { type: 'button', class: 'mg-link', text: 'Cancel' });
    const box = el('div', { class: 'mg-report' }, input, send, cancel);
    cancel.addEventListener('click', () => box.remove());
    send.addEventListener('click', async () => {
      send.disabled = true;
      const { error } = await sb.rpc('report_message', { mid: m.id, why: input.value.trim() || null });
      box.replaceChildren(el('span', { class: 'mg-ok', text: error ? 'The report could not be sent.' : 'Thank you. Chapter administrators will review this message.' }));
    });
    host.append(box);
    input.focus();
  }

  /* ---------- composer ---------- */
  function composer() {
    const ta = el('textarea', { class: 'mg-input mg-ta', rows: '2', maxlength: '4000', placeholder: 'Write a message…', 'aria-label': 'Message' });
    const fileIn = el('input', { type: 'file', multiple: true, class: 'pf-file', id: 'mg-files', accept: 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv' });
    const attach = el('label', { class: 'mg-link', for: 'mg-files', text: '📎 Attach' });
    const chips = el('div', { class: 'mg-chips' });
    const status = el('p', { class: 'mg-status', role: 'status' });
    const send = el('button', { type: 'button', class: 'btn btn-ivy btn-sm', text: 'Send' });

    function drawChips() {
      chips.replaceChildren(...pendingFiles.map((f, i) => {
        const x = el('button', { type: 'button', class: 'mg-x', 'aria-label': 'Remove ' + f.name, text: '×' });
        x.addEventListener('click', () => { pendingFiles.splice(i, 1); drawChips(); });
        return el('span', { class: 'mg-chip' }, f.name, el('small', { text: ' ' + bytes(f.size) }), x);
      }));
    }
    fileIn.addEventListener('change', () => {
      status.textContent = '';
      Array.from(fileIn.files).forEach(f => {
        if (pendingFiles.length >= MAX_FILES) { status.textContent = `You can attach up to ${MAX_FILES} files.`; return; }
        if (f.size > MAX_BYTES) { status.textContent = `${f.name} is larger than 10 MB.`; return; }
        if (f.type && !OK_TYPES.test(f.type)) { status.textContent = `${f.name} is not a supported file type.`; return; }
        pendingFiles.push(f);
      });
      fileIn.value = ''; drawChips();
    });

    async function doSend() {
      const text = ta.value.trim();
      if (!text && !pendingFiles.length) return;
      send.disabled = true; status.textContent = pendingFiles.length ? 'Sending…' : '';
      const cid = current.id;
      const { data: msg, error } = await sb.from('messages').insert({ conversation_id: cid, sender_id: myId, body: text }).select('id').single();
      if (error) { status.textContent = /quickly/i.test(error.message) ? 'You are sending messages too quickly. Please wait a moment.' : 'Your message could not be sent.'; send.disabled = false; return; }
      let failed = 0;
      for (const f of pendingFiles) {
        const safe = f.name.replace(/[^\w.\- ]+/g, '_').slice(0, 80);
        const path = `${cid}/${crypto.randomUUID()}-${safe}`;
        const up = await sb.storage.from('message-files').upload(path, f, { contentType: f.type || 'application/octet-stream' });
        if (up.error) { failed++; continue; }
        const ins = await sb.from('message_attachments').insert({ message_id: msg.id, path, file_name: f.name.slice(0, 200), mime_type: f.type || null, size_bytes: f.size });
        if (ins.error) failed++;
      }
      pendingFiles = [];
      ta.value = '';
      await loadThread();
      await reloadList();
      const s = threadEl.querySelector('.mg-status'); if (s && failed) s.textContent = `${failed} attachment${failed > 1 ? 's' : ''} could not be uploaded.`;
    }
    send.addEventListener('click', doSend);
    ta.addEventListener('keydown', ev => { if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); doSend(); } });

    return el('div', { class: 'mg-compose' }, chips, ta, el('div', { class: 'mg-compose-row' }, attach, fileIn, el('span', { class: 'mg-hint', text: 'Ctrl/⌘ + Enter to send' }), send), status);
  }

  /* ---------- keep a copy ---------- */
  function threadText() {
    const title = nameOf(current);
    const lines = threadMsgs.map(m => `${m.mine ? 'You' : m.sender}, ${fmt(m.created_at)}:\n${m.body || ''}${m.files.length ? '\n[Attachments: ' + m.files.map(f => f.file_name).join(', ') + ']' : ''}`);
    return `Rho Chi Omega portal messages with ${title}\n\n` + lines.join('\n\n');
  }
  function emailCopy() {
    const text = threadText();
    const body = text.length > 1700 ? '…\n\n' + text.slice(-1700) + '\n\n(Long conversation: only the most recent part is included. Use Download for everything.)' : text;
    location.href = `mailto:${encodeURIComponent(me.email)}?subject=${encodeURIComponent('Rho Chi Omega messages: ' + nameOf(current))}&body=${encodeURIComponent(body)}`;
  }
  function downloadCopy() {
    const url = URL.createObjectURL(new Blob([threadText()], { type: 'text/plain' }));
    const a = el('a', { href: url, download: 'rco-messages-' + nameOf(current).replace(/[^\w]+/g, '-').toLowerCase() + '.txt' });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* ---------- pick sorors (new message / add to group) ---------- */
  async function pickSorors({ title, exclude = [], onDone, allowGroupName = false }) {
    const all = (await loadRoster()).filter(p => !exclude.includes(p.member_id));
    const chosen = new Map();
    const search = el('input', { type: 'search', class: 'mg-input', placeholder: 'Search sorors by name…', 'aria-label': 'Search sorors' });
    const results = el('ul', { class: 'mg-results' });
    const chips = el('div', { class: 'mg-chips' });
    const groupName = allowGroupName ? el('input', { type: 'text', class: 'mg-input', maxlength: '80', placeholder: 'Group name (optional)', 'aria-label': 'Group name' }) : null;
    const msg = el('p', { class: 'mg-status', role: 'status' });
    const go = el('button', { type: 'button', class: 'btn btn-ivy btn-sm', text: 'Continue' });
    const cancel = el('button', { type: 'button', class: 'mg-link', text: 'Cancel' });
    const card = el('div', { class: 'mg-modal-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      el('h3', { text: title }), search, chips, results, groupName || '', msg, el('div', { class: 'mg-compose-row' }, cancel, go));
    const overlay = el('div', { class: 'mg-modal' }, card);
    const close = () => { overlay.remove(); document.removeEventListener('keydown', esc); };
    const esc = ev => { if (ev.key === 'Escape') close(); };
    document.addEventListener('keydown', esc);
    overlay.addEventListener('click', ev => { if (ev.target === overlay) close(); });
    cancel.addEventListener('click', close);

    function draw() {
      const q = search.value.trim().toLowerCase();
      const hits = all.filter(p => !q || p.full_name.toLowerCase().includes(q)).slice(0, 40);
      results.replaceChildren(...hits.map(p => {
        const on = chosen.has(p.member_id);
        const b = el('button', { type: 'button', class: 'mg-pick' + (on ? ' is-on' : ''), 'aria-pressed': String(on), text: (on ? '✓ ' : '') + p.full_name });
        b.addEventListener('click', () => { if (on) chosen.delete(p.member_id); else chosen.set(p.member_id, p.full_name); draw(); });
        return el('li', {}, b);
      }));
      chips.replaceChildren(...Array.from(chosen, ([id, name]) => el('span', { class: 'mg-chip' }, name)));
      go.disabled = chosen.size === 0;
    }
    search.addEventListener('input', draw);
    go.addEventListener('click', async () => {
      go.disabled = true; msg.textContent = '';
      const err = await onDone(Array.from(chosen.keys()), groupName ? groupName.value.trim() : '');
      if (err) { msg.textContent = err; go.disabled = false; } else close();
    });
    document.body.append(overlay);
    draw(); search.focus();
  }

  newBtn.addEventListener('click', () => pickSorors({ title: 'New message', allowGroupName: true, onDone: async (ids, name) => {
    const { data: cid, error } = await sb.rpc('start_conversation', { member_ids: ids, chat_title: name || null });
    if (error) return 'The conversation could not be started.';
    await reloadList(); await openConvo(cid); return null;
  } }));

  /* ---------- trash ---------- */
  trashBtn.addEventListener('click', async () => {
    showTrash = true; current = null; renderList();
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 864e5).toISOString();
    const { data: dels } = await sb.from('message_deletions').select('message_id,deleted_at').eq('member_id', myId).gt('deleted_at', cutoff).order('deleted_at', { ascending: false });
    const ids = (dels || []).map(d => d.message_id);
    let msgs = [];
    if (ids.length) { const r = await sb.from('messages').select('id,conversation_id,sender_id,body,created_at').in('id', ids); msgs = r.data || []; }
    const byId = Object.fromEntries(msgs.map(m => [m.id, m]));
    const rows = (dels || []).filter(d => byId[d.message_id]).map(d => {
      const m = byId[d.message_id];
      const convo = convos.find(c => c.id === m.conversation_id);
      const names = {}; ((convo && convo.participants) || []).forEach(p => { names[p.id] = p.name; });
      const left = Math.max(0, Math.ceil(RETENTION_DAYS - (Date.now() - new Date(d.deleted_at)) / 864e5));
      const restore = el('button', { type: 'button', class: 'mg-act', text: 'Restore' });
      restore.addEventListener('click', async () => {
        const { error } = await sb.from('message_deletions').delete().eq('message_id', d.message_id).eq('member_id', myId);
        if (!error) { await reloadList(); trashBtn.click(); }
      });
      return el('div', { class: 'mg-row' }, el('div', { class: 'mg-meta' }, `${m.sender_id === myId ? 'You' : (names[m.sender_id] || 'Former member')} · ${convo ? nameOf(convo) : 'conversation'} · ${fmt(m.created_at)}`),
        el('div', { class: 'mg-bubble' }, el('p', { text: m.body || '(attachment)' })),
        el('div', { class: 'mg-acts' }, restore, el('span', { class: 'mg-hint', text: `Permanently deleted in ${left} day${left === 1 ? '' : 's'}` })));
    });
    threadEl.classList.add('is-open');
    const back = el('button', { type: 'button', class: 'mg-back', 'aria-label': 'Back to conversations', text: '←' });
    back.addEventListener('click', () => { showTrash = false; renderList(); emptyThread(); });
    threadEl.replaceChildren(el('header', { class: 'mg-head' }, back, el('div', { class: 'mg-head-txt' }, el('h3', { text: 'Trash' }), el('p', { text: `Deleted messages stay here for ${RETENTION_DAYS} days, then are destroyed.` }))),
      el('div', { class: 'mg-msgs' }, rows.length ? rows : el('p', { class: 'mg-none', text: 'Trash is empty.' })));
  });

  /* ---------- live updates ---------- */
  sb.channel('mg-' + myId).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async payload => {
    await reloadList();
    if (current && payload.new && payload.new.conversation_id === current.id && payload.new.sender_id !== myId) { await loadThread(); await sb.rpc('mark_read', { cid: current.id }); await reloadList(); }
  }).subscribe();
  setInterval(() => { if (!document.hidden) reloadList(); }, 60000);

  /* ---------- go ---------- */
  renderList();
  emptyThread();
  // arriving from a directory card: ?to=<member id> opens (or starts) a chat with her
  const to = new URLSearchParams(location.search).get('to');
  if (to) {
    const { data: cid } = await sb.rpc('start_conversation', { member_ids: [to] });
    if (cid) { await reloadList(); await openConvo(cid); }
  }
});
