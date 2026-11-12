// Quick votes: everyone votes Yes or No; admins start/close/delete votes and watch the live count.
// The database (supabase/polls.sql) keeps votes anonymous and allows one vote per soror.
document.addEventListener('rco-auth-ready', async e => {
  const me = e.detail;
  const $ = s => document.querySelector(s);
  const isAdmin = me.role === 'admin';
  $('#pl-app').hidden = false;
  const sb = window.rcoAuth.client;
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v); });
    kids.flat().forEach(k => { if (k != null) n.append(k); });
    return n;
  };
  const when = iso => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  let polls = [];
  let busy = false;                       // pause refreshing while a button press is being handled
  const errors = {};                      // poll id -> message under its buttons

  /* ---------- admin: start a vote ---------- */
  if (isAdmin) {
    const form = $('#pl-form'); form.hidden = false;
    const q = $('#pl-q'), msg = $('#pl-msg');
    const say = (t, ok) => { msg.textContent = t || ''; msg.className = 'rost-msg ' + (ok ? 'is-ok' : 'is-bad'); };
    ['Do we approve the minutes?', 'Do we approve this motion?', 'Do we adjourn the meeting?', 'Are you in favor?'].forEach(t => {
      const c = el('button', { type: 'button', class: 'pl-chip', text: t });
      c.addEventListener('click', () => { q.value = t; q.focus(); });
      $('#pl-presets').append(c);
    });
    const { data: myId } = await sb.rpc('my_member_id');
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const text = q.value.trim();
      if (!text) { say('Please type the question first.'); return; }
      const btn = $('#pl-start'); btn.disabled = true; say('Starting…', true);
      const { error } = await sb.from('polls').insert({ question: text, created_by: myId });
      if (error) { say('The vote could not be started. Has the polls SQL been run (supabase/polls.sql)?'); btn.disabled = false; return; }
      let note = 'Vote started. Sorors will see it now.';
      if ($('#pl-notify').checked) {
        try {
          const ins = await sb.from('notifications').insert({ title: 'Vote now', body: text.slice(0, 240), audience: 'all', url: 'portal-profile.html#votes', created_by: myId });
          if (!ins.error) await sb.functions.invoke('send-reminders', { body: {} });
        } catch (err) { note = 'Vote started. (The phone notification could not be sent, but the vote shows on every open portal page.)'; }
      }
      q.value = ''; say(note, true); btn.disabled = false;
      load();
    });
  }

  /* ---------- cards ---------- */
  function tally(p) {
    const y = p.yes_count || 0, n = p.no_count || 0, t = y + n;
    return el('div', {},
      el('div', { class: 'pl-tally' },
        el('div', { class: 'y' }, el('b', { text: String(y) }), el('span', { text: 'Yes' })),
        el('div', { class: 'n' }, el('b', { text: String(n) }), el('span', { text: 'No' })),
        el('div', {}, el('b', { text: String(t) }), el('span', { text: 'Voted' }))),
      el('div', { class: 'pl-bar', 'aria-hidden': 'true' }, el('i', { class: 'y', style: 'width:' + (t ? (y / t * 100) : 0) + '%' }), el('i', { class: 'n', style: 'width:' + (t ? (n / t * 100) : 0) + '%' })));
  }

  async function vote(p, choice, btns) {
    busy = true; btns.forEach(b => { b.disabled = true; }); delete errors[p.id];
    const { error } = await sb.rpc('cast_vote', { p_poll: p.id, p_choice: choice });
    busy = false;
    if (error) {
      errors[p.id] = /already voted/i.test(error.message) ? 'You have already voted on this question.' : /closed/i.test(error.message) ? 'Voting on this question is closed.' : 'Your vote could not be counted. Please try again.';
    }
    await load();
  }

  async function setClosed(p) {
    const { error } = await sb.from('polls').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', p.id);
    if (error) errors[p.id] = 'That could not be closed. Please try again.';
    await load();
  }
  async function remove(p) {
    const { error } = await sb.from('polls').delete().eq('id', p.id);
    if (error) errors[p.id] = 'That could not be deleted. Please try again.';
    await load();
  }

  function card(p) {
    const kids = [el('p', { class: 'pl-q', text: p.question }), el('p', { class: 'pl-when', text: 'Started ' + when(p.created_at) })];
    if (p.is_open) {
      if (!p.i_voted) {
        const yes = el('button', { type: 'button', class: 'pl-btn yes', text: 'Yes' });
        const no = el('button', { type: 'button', class: 'pl-btn no', text: 'No' });
        yes.addEventListener('click', () => vote(p, 'yes', [yes, no]));
        no.addEventListener('click', () => vote(p, 'no', [yes, no]));
        kids.push(el('div', { class: 'pl-btns' }, yes, no));
      } else {
        kids.push(el('p', { class: 'pl-note', text: '✓ Your vote is counted.' + (isAdmin ? '' : ' Results appear here when voting closes.') }));
      }
      if (isAdmin) kids.push(tally(p));
    } else {
      kids.push(tally(p));
    }
    if (errors[p.id]) kids.push(el('p', { class: 'pl-err', text: errors[p.id] }));

    if (isAdmin) {
      const act = el('div', { class: 'pl-admin' });
      if (p.is_open) {
        const close = el('button', { type: 'button', class: 'btn btn-ivy btn-sm', text: 'Close voting & show results' });
        close.addEventListener('click', () => setClosed(p));
        act.append(close);
      }
      const del = el('button', { type: 'button', class: 'pl-del', text: 'Delete' });
      del.addEventListener('click', () => {
        busy = true;
        act.replaceChildren(el('span', { class: 'pl-note', text: 'Delete this vote and its results for good?' }));
        const yes = el('button', { type: 'button', class: 'btn btn-ivy btn-sm', text: 'Yes, delete' });
        const no = el('button', { type: 'button', class: 'pl-del', text: 'Keep' });
        yes.addEventListener('click', () => { busy = false; remove(p); });
        no.addEventListener('click', () => { busy = false; render(); });
        act.append(yes, no);
      });
      act.append(del);
      kids.push(act);
    }
    return el('article', { class: 'pl-card' + (p.is_open ? '' : ' is-closed') }, kids);
  }

  function render() {
    const open = polls.filter(p => p.is_open), done = polls.filter(p => !p.is_open);
    $('#pl-open-h').hidden = !open.length; $('#pl-done-h').hidden = !done.length;
    $('#pl-empty').hidden = !!polls.length;
    $('#pl-open').replaceChildren(...open.map(card));
    $('#pl-done').replaceChildren(...done.map(card));
  }

  async function load() {
    const { data, error } = await sb.rpc('my_polls');
    if (error) { $('#pl-empty').hidden = false; $('#pl-empty').textContent = 'Votes could not be loaded. Has the polls SQL been run (supabase/polls.sql)?'; return; }
    polls = data || [];
    const owed = polls.filter(p => p.is_open && !p.i_voted).length;      // red number on the Quick votes tab
    const badge = document.getElementById('pf-votes-badge');
    if (badge) { badge.hidden = owed === 0; badge.textContent = String(owed); }
    render();
  }

  await load();
  // live: admins see the count move every few seconds; everyone else checks for new questions
  // live: while the Quick votes tab is open, admins see the count move every 3 seconds (sorors every 8); otherwise just a slow check for the red number
  const tabShown = () => { const r = document.getElementById('vote-app'); return !r || !r.hidden; };
  (function tick() {
    if (!document.hidden && !busy) load();
    setTimeout(tick, tabShown() ? (isAdmin ? 3000 : 8000) : 30000);
  })();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !busy) load(); });
  document.addEventListener('rco-tab', ev => { if (ev.detail === 'votes') load(); });
});
