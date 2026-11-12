// Suggestions and tech issues sent from the Help page.
// Officers see suggestions; admins see suggestions AND tech issues. (The database enforces this, not just this page.)
document.addEventListener('rco-auth-ready', async e => {
  const me = e.detail;
  const $ = s => document.querySelector(s);
  const isOfficer = me.role === 'officer' || me.role === 'admin';
  const isAdmin = me.role === 'admin';
  if (!isOfficer) { $('#fb-denied').hidden = false; $('#fb-app').hidden = true; return; }
  $('#fb-app').hidden = false;

  const sb = window.rcoAuth.client;
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v); });
    kids.flat().forEach(k => { if (k != null) n.append(k); });
    return n;
  };
  const say = (msg, ok) => { const m = $('#fb-msg'); m.textContent = msg || ''; m.className = 'rost-msg ' + (ok ? 'is-ok' : 'is-bad'); };

  let rows = [];
  let kind = 'suggestion';           // suggestion | tech
  let state = 'new';                 // new | done | all

  function chips(box, items, current, onPick) {
    box.replaceChildren(...items.map(([val, label, n]) => {
      const b = el('button', { type: 'button', class: 'fa-chip' + (val === current ? ' is-on' : ''), role: 'tab', 'aria-selected': val === current ? 'true' : 'false' },
        label, n != null ? el('span', { class: 'fa-n', text: String(n) }) : null);
      b.addEventListener('click', () => onPick(val));
      return b;
    }));
  }

  function renderFilters() {
    const ofKind = rows.filter(r => r.kind === kind);
    const kinds = [['suggestion', 'Suggestions', rows.filter(r => r.kind === 'suggestion' && r.status === 'new').length]];
    if (isAdmin) kinds.push(['tech', 'Tech issues', rows.filter(r => r.kind === 'tech' && r.status === 'new').length]);
    chips($('#fb-kinds'), kinds, kind, v => { kind = v; render(); });
    chips($('#fb-states'), [['new', 'New', ofKind.filter(r => r.status === 'new').length], ['done', 'Done', ofKind.filter(r => r.status === 'done').length], ['all', 'All', ofKind.length]],
      state, v => { state = v; render(); });
  }

  const fmtDate = iso => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  async function addVoice(slot, path) {
    slot.append(el('p', { class: 'fa-loading', text: 'Loading voice note…' }));
    const { data, error } = await sb.storage.from('feedback-voice').createSignedUrl(path, 3600);
    slot.replaceChildren();
    if (error || !data) { slot.append(el('p', { class: 'fa-err', text: 'The voice note could not be loaded.' })); return; }
    slot.append(el('audio', { controls: true, preload: 'none', src: data.signedUrl }));
  }

  async function addImage(slot, path) {
    const { data, error } = await sb.storage.from('feedback-voice').createSignedUrl(path, 3600);
    if (error || !data) { slot.append(el('p', { class: 'fa-err', text: 'The screenshot could not be loaded.' })); return; }
    slot.append(el('a', { href: data.signedUrl, target: '_blank', rel: 'noopener', title: 'Open full size' }, el('img', { class: 'fa-shot', src: data.signedUrl, alt: 'Screenshot sent with this message' })));
  }

  async function setStatus(r, status) {
    const { error } = await sb.from('feedback').update({ status }).eq('id', r.id);
    if (error) { say('That could not be saved. Please try again.', false); return; }
    r.status = status; say('', true); render();
  }

  async function remove(r) {
    const { error } = await sb.from('feedback').delete().eq('id', r.id);
    if (error) { say('That could not be deleted. Please try again.', false); return; }
    rows = rows.filter(x => x.id !== r.id); say('Deleted for good.', true); render();
  }

  function card(r) {
    const who = r.members ? r.members.full_name : 'A former member';
    const voiceSlot = el('div', { class: 'fa-voice' });
    const kids = [
      el('div', { class: 'fa-head' },
        el('strong', { text: who }), r.members && r.members.email ? el('a', { href: 'mailto:' + r.members.email, text: r.members.email }) : null,
        el('span', { class: 'fa-date', text: fmtDate(r.created_at) }),
        r.status === 'done' ? el('span', { class: 'fa-done', text: 'Done' }) : null)
    ];
    if (r.body) kids.push(el('p', { class: 'fa-body', text: r.body }));
    if (r.voice_path) { kids.push(voiceSlot); addVoice(voiceSlot, r.voice_path); }
    if (r.image_path) { const shotSlot = el('div', { class: 'fa-voice' }); kids.push(shotSlot); addImage(shotSlot, r.image_path); }
    if (r.device) kids.push(el('details', { class: 'fa-device' }, el('summary', { text: 'Phone / computer details' }), el('p', { text: r.device })));

    const act = el('div', { class: 'fa-actions' });
    const toggle = el('button', { type: 'button', class: 'btn btn-ivy btn-sm', text: r.status === 'done' ? 'Reopen' : 'Mark done' });
    toggle.addEventListener('click', () => setStatus(r, r.status === 'done' ? 'new' : 'done'));
    const del = el('button', { type: 'button', class: 'fa-del', text: 'Delete' });
    del.addEventListener('click', () => {
      act.replaceChildren(el('span', { class: 'fa-ask', text: 'Delete this for good?' }));
      const yes = el('button', { type: 'button', class: 'btn btn-ivy btn-sm', text: 'Yes, delete' });
      const no = el('button', { type: 'button', class: 'fa-del', text: 'Keep' });
      yes.addEventListener('click', () => remove(r)); no.addEventListener('click', render);
      act.append(yes, no);
    });
    act.append(toggle, del);
    kids.push(act);
    return el('article', { class: 'fa-card' + (r.status === 'new' ? ' is-new' : '') }, kids);
  }

  function render() {
    renderFilters();
    const list = rows.filter(r => r.kind === kind && (state === 'all' || r.status === state));
    const box = $('#fb-list');
    if (!list.length) {
      box.replaceChildren(el('p', { class: 'fa-empty', text: state === 'new' ? 'Nothing new right now.' : 'Nothing here yet.' }));
      return;
    }
    box.replaceChildren(...list.map(card));
  }

  async function load() {
    const { data, error } = await sb.from('feedback')
      .select('id, kind, body, device, voice_path, image_path, status, created_at, members(full_name, email)')
      .order('created_at', { ascending: false }).limit(300);
    if (error) { say('Messages could not be loaded. Has the feedback SQL been run (supabase/feedback.sql)?', false); return; }
    rows = data || [];
    render();
  }
  load();
});
