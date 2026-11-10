// Committees page: upcoming committee meetings. Chairs and officers add them; the committee is reminded
// a day before and an hour before, and everyone can add a meeting to her calendar.
document.addEventListener('rco-auth-ready', async e => {
  const root = document.getElementById('mt-root');
  if (!root) return;
  const me = e.detail;
  const sb = window.rcoAuth.client;
  const TZ = 'America/Chicago';
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v); });
    kids.flat(Infinity).forEach(k => n.append(k));
    return n;
  };
  const isOfficer = me.role === 'officer' || me.role === 'admin';
  const { data: myId } = await sb.rpc('my_member_id');

  const first = await sb.from('committee_meetings').select('*').gte('starts_at', new Date(Date.now() - 864e5).toISOString()).order('starts_at').limit(80);
  if (first.error) { root.replaceChildren(el('p', { class: 'ld-note', text: 'Committee meetings are not available yet.' })); return; }
  let meetings = first.data || [];
  const [mine, lead] = await Promise.all([
    sb.from('member_committees').select('committee,role').eq('member_id', myId),
    sb.from('portal_content').select('data').eq('key', 'leadership').maybeSingle()
  ]);
  const myCommittees = new Set((mine.data || []).map(r => r.committee));
  const chaired = (mine.data || []).filter(r => r.role === 'Chair' || r.role === 'Co-Chair').map(r => r.committee);
  const allNames = Array.from(new Set((((lead.data && lead.data.data) || {}).groups || []).flatMap(g => (g.rows || []).map(r => r[0])))).sort((a, b) => a.localeCompare(b));
  const canAdd = isOfficer || chaired.length > 0;
  const addable = isOfficer ? allNames : chaired;
  let showAll = false;

  const central = iso => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(iso)).map(x => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
  };
  const when = iso => new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

  function render() {
    const list = meetings.filter(m => showAll || myCommittees.has(m.committee) || chaired.includes(m.committee));
    const items = list.map(m => {
      const start = central(m.starts_at);
      const endHour = String((parseInt(start.slice(11, 13), 10) + 1) % 24).padStart(2, '0');
      const ev = { title: `${m.committee}: ${m.title}`, start, end: start.slice(0, 11) + endHour + start.slice(13), where: m.location || undefined, note: m.notes || undefined };
      const canEdit = isOfficer || chaired.includes(m.committee);
      const links = [];
      if (window.rcoCal) {
        links.push(el('a', { class: 'iv-link', href: window.rcoCal.googleEvent(ev), target: '_blank', rel: 'noopener', text: 'Add to Google Calendar' }),
                   el('a', { class: 'iv-link', href: window.rcoCal.icsEvent(ev), download: 'meeting.ics', text: 'Apple / Outlook' }));
      }
      const row = el('li', { class: 'mt-row' + (myCommittees.has(m.committee) ? ' is-mine' : '') },
        el('div', {}, el('strong', { text: m.committee }), el('span', { class: 'mt-title', text: m.title }), el('span', { class: 'iv-note', text: when(m.starts_at) + (m.location ? ' · ' + m.location : '') }),
          m.notes ? el('span', { class: 'iv-note', text: m.notes }) : '', el('div', { class: 'iv-links' }, links)));
      if (canEdit) {
        const x = el('button', { type: 'button', class: 'iv-x', text: 'Cancel meeting' });
        let armed = false;
        x.addEventListener('click', async () => {
          if (!armed) { armed = true; x.textContent = 'Tap again to cancel'; setTimeout(() => { armed = false; x.textContent = 'Cancel meeting'; }, 4000); return; }
          await sb.from('committee_meetings').delete().eq('id', m.id); meetings = meetings.filter(y => y.id !== m.id); render();
        });
        row.append(x);
      }
      return row;
    });

    const toggle = el('div', { class: 'mt-filter', role: 'group', 'aria-label': 'Which meetings' },
      ...[['My committees', false], ['All committees', true]].map(([t, v]) => { const b = el('button', { type: 'button', class: 'dir-chip', 'aria-pressed': String(showAll === v), text: t }); b.addEventListener('click', () => { showAll = v; render(); }); return b; }));

    const kids = [toggle, items.length ? el('ul', { class: 'mt-list' }, items) : el('p', { class: 'ld-note', text: showAll ? 'No upcoming committee meetings yet.' : 'No upcoming meetings for your committees. Add a committee on your profile to see its meetings here.' })];

    if (canAdd) {
      const wrap = el('div', { class: 'iv-addwrap' });
      const btn = el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Schedule a meeting' });
      btn.addEventListener('click', () => {
        if (wrap.querySelector('form')) { wrap.querySelector('form').remove(); return; }
        const sel = el('select', { class: 'pf-input' }, el('option', { value: '', text: 'Choose a committee' }), ...addable.map(n => el('option', { value: n, text: n })));
        const title = el('input', { class: 'pf-input', type: 'text', maxlength: '120', value: 'Committee meeting' });
        const date = el('input', { class: 'pf-input', type: 'date' });
        const time = el('input', { class: 'pf-input', type: 'time', value: '18:00' });
        const where = el('input', { class: 'pf-input', type: 'text', maxlength: '200', placeholder: 'Zoom link or address (optional)' });
        const notes = el('input', { class: 'pf-input', type: 'text', maxlength: '500', placeholder: 'Agenda or notes (optional)' });
        const msg = el('p', { class: 'iv-msg', role: 'status' });
        const f = el('form', { class: 'iv-form', novalidate: true },
          ...[['Committee', sel], ['What', title], ['Date', date], ['Time (Central)', time], ['Where', where], ['Notes', notes]].map(([l, i]) => el('label', { class: 'iv-field' }, el('span', { text: l }), i)),
          el('p', { class: 'iv-sub', text: 'Everyone on the committee is reminded a day before and an hour before.' }),
          el('div', { class: 'iv-actions' }, el('button', { type: 'submit', class: 'btn btn-ivy btn-sm', text: 'Add meeting' })), msg);
        f.addEventListener('submit', async ev => {
          ev.preventDefault();
          if (!sel.value || !title.value.trim() || !date.value || !time.value) { msg.textContent = 'Please choose a committee, a date and a time.'; return; }
          const at = new Date(`${date.value}T${time.value}`);
          if (isNaN(at)) { msg.textContent = 'That date or time is not valid.'; return; }
          const { data, error } = await sb.from('committee_meetings').insert({ committee: sel.value, title: title.value.trim(), starts_at: at.toISOString(), location: where.value.trim() || null, notes: notes.value.trim() || null, created_by: myId }).select('*').single();
          if (error) { msg.textContent = 'The meeting could not be added. Only chairs and officers can schedule meetings.'; return; }
          meetings = [...meetings, data].sort((a, b) => a.starts_at.localeCompare(b.starts_at)); showAll = showAll || !myCommittees.has(data.committee); render();
        });
        wrap.append(f);
      });
      wrap.append(btn);
      kids.push(wrap);
    }
    root.replaceChildren(...kids);
  }
  render();
});
