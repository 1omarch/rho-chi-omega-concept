// Events Registration: "Add to my list" records an RSVP on the soror's profile and offers add-to-calendar links.
document.addEventListener('rco-auth-ready', async () => {
  if (window.rcoEventsLoaded) await window.rcoEventsLoaded;       // cards an admin added (chapter-events.js) are on the page by now
  const cards = Array.from(document.querySelectorAll('.reg-card'));
  if (!cards.length) return;
  const sb = window.rcoAuth.client;
  const { data: myId } = await sb.rpc('my_member_id');
  if (!myId) return;
  const first = await sb.from('member_activity').select('id,title').eq('member_id', myId).eq('kind', 'rsvp');
  if (first.error) return;                       // the tracker is not set up yet: leave the cards as they are
  const mine = new Map((first.data || []).map(r => [r.title, r.id]));

  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v); });
    kids.flat().forEach(k => n.append(k));
    return n;
  };

  cards.forEach(card => {
    const title = (card.querySelector('h3') || {}).textContent;
    if (!title) return;
    const date = card.dataset.expires || null;      // events carry their date here
    const body = card.querySelector('.rc-body');
    const box = el('div', { class: 'rc-track' });
    body.append(box);

    function draw() {
      box.replaceChildren();
      if (mine.has(title)) {
        box.append(el('span', { class: 'rc-on', text: '✓ On my list' }));
        if (date && window.rcoCal) {
          const ev = { title: title.startsWith('Chapter Cardigan') ? 'Chapter Cardigan order deadline' : title, start: card.dataset.calStart || date, end: card.dataset.calEnd || undefined, where: card.dataset.calWhere || undefined };
          box.append(el('a', { class: 'rc-cal', href: window.rcoCal.googleEvent(ev), target: '_blank', rel: 'noopener', text: 'Add to Google Calendar' }),
                     el('a', { class: 'rc-cal', href: window.rcoCal.icsEvent(ev), download: 'event.ics', text: 'Apple / Outlook' }));
        }
        const rm = el('button', { type: 'button', class: 'rc-rm', text: 'Remove' });
        rm.addEventListener('click', async () => { const id = mine.get(title); const { error } = await sb.from('member_activity').delete().eq('id', id); if (!error) { mine.delete(title); draw(); } });
        box.append(rm);
      } else {
        const add = el('button', { type: 'button', class: 'rc-add', text: 'Add to my list' });
        add.addEventListener('click', async () => {
          add.disabled = true;
          const { data, error } = await sb.from('member_activity').insert({ member_id: myId, kind: 'rsvp', title, event_date: date }).select('id').single();
          if (error) { add.disabled = false; return; }
          mine.set(title, data.id); draw();
        });
        box.append(add);
      }
    }
    draw();
  });
});
