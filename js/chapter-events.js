// Events added by an admin (Officer Tools > Events & flyers) show up here:
//   * Portal Home: as a slide on the announcement board
//   * Events Registration: as an event card (with the soror's "Add to my list" button, handled by events-track.js)
// Both hide an event the day after its date. Data comes from supabase/events.sql.
(function () {
  const onHome = !!document.querySelector('[data-ann]');
  const grid = document.querySelector('.reg-grid');
  if (!onHome && !grid) return;

  // events-track.js waits for this, so the new cards get their "Add to my list" button too
  let done; window.rcoEventsLoaded = new Promise(r => { done = r; });

  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v); });
    kids.flat().forEach(k => { if (k != null && k !== '') n.append(k); });
    return n;
  };
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const clock = hm => { const [h, m] = hm.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; return (h % 12 || 12) + (m ? ':' + String(m).padStart(2, '0') : ':00') + ' ' + ap; };
  function whenText(e) {
    const [y, m, d] = e.event_date.split('-').map(Number);
    const day = `${DAYS[new Date(y, m - 1, d).getDay()]}, ${MONTHS[m - 1]} ${d}, ${y}`;
    if (!e.start_time) return day;
    return day + ' · ' + clock(e.start_time) + (e.end_time ? ' – ' + clock(e.end_time) : '');
  }
  const mapUrl = loc => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(loc);

  document.addEventListener('rco-auth-ready', async () => {
    try {
      const sb = window.rcoAuth.client;
      const t = new Date(); const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
      const { data, error } = await sb.from('chapter_events').select('*').gte('event_date', today).order('event_date', { ascending: true }).order('start_time', { ascending: true, nullsFirst: true });
      if (error || !data || !data.length) return;
      const flyerUrl = e => e.flyer_path ? sb.storage.from('event-flyers').getPublicUrl(e.flyer_path).data.publicUrl : null;
      const calAttrs = e => {
        const a = { 'data-expires': e.event_date, 'data-cal-start': e.start_time ? `${e.event_date}T${e.start_time}` : e.event_date };
        if (e.end_time && e.start_time) a['data-cal-end'] = `${e.event_date}T${e.end_time}`;
        if (e.location) a['data-cal-where'] = e.location;
        return a;
      };

      /* ---- Events Registration: cards ---- */
      if (grid) {
        data.forEach(e => {
          const url = flyerUrl(e);
          const body = el('div', { class: 'rc-body' },
            el('span', { class: 'rc-date', text: whenText(e) }),
            el('h3', { text: e.title }),
            e.description ? el('p', { text: e.description }) : null,
            e.location ? el('p', { class: 'rc-where', text: '📍 ' + e.location }) : null,
            e.price_text ? el('p', { class: 'rc-price', text: e.price_text }) : null,
            (e.rsvp_text || e.rsvp_url) ? el('div', { class: 'rc-rsvp' },
              el('strong', { text: 'RSVP' }),
              e.rsvp_text ? el('span', { text: e.rsvp_text }) : null,
              e.rsvp_url ? el('a', { class: 'btn btn-ivy btn-sm', href: e.rsvp_url, target: '_blank', rel: 'noopener', text: 'RSVP / Register' }) : null) : null,
            e.location ? el('a', { class: 'btn btn-ghost btn-sm', href: mapUrl(e.location), target: '_blank', rel: 'noopener', text: 'Directions' }) : null);
          const card = el('div', { class: 'reg-card', 'data-live': e.id, ...calAttrs(e) },
            url ? el('a', { class: 'rc-photo is-flyer is-tall', href: url, target: '_blank', rel: 'noopener', 'aria-label': 'Open the ' + e.title + ' flyer full size' },
              el('img', { src: url, alt: 'Flyer for ' + e.title + '. ' + whenText(e) + (e.location ? ', ' + e.location : '') + '.' })) : null,
            body);
          grid.prepend(card);
        });
        // put every card (yours and the built-in ones) in date order
        Array.from(grid.children).sort((a, b) => String(a.dataset.expires || '9999').localeCompare(String(b.dataset.expires || '9999')))
          .forEach(c => grid.append(c));
        const empty = document.getElementById('events-empty'); if (empty) empty.hidden = true;
      }

      /* ---- Portal Home: announcement slides ---- */
      if (onHome && window.rcoAnnouncements && window.rcoAnnouncements.add) {
        data.forEach(e => {
          const url = flyerUrl(e);
          const facts = el('ul', { class: 'ann-facts' }, el('li', { text: whenText(e) }), e.location ? el('li', { text: e.location }) : null,
            e.price_text ? el('li', { text: e.price_text }) : null, e.rsvp_text ? el('li', { text: 'RSVP: ' + e.rsvp_text }) : null);
          const actions = el('div', { class: 'ann-actions' },
            e.rsvp_url ? el('a', { class: 'btn btn-ivy btn-caps', href: e.rsvp_url, target: '_blank', rel: 'noopener', text: 'RSVP / Register' }) : null,
            e.location ? el('a', { class: e.rsvp_url ? 'btn btn-ghost btn-caps' : 'btn btn-ivy btn-caps', href: mapUrl(e.location), target: '_blank', rel: 'noopener', text: 'Directions' }) : null,
            url ? el('a', { class: 'btn btn-ghost btn-caps', href: url, target: '_blank', rel: 'noopener', text: 'View the Flyer' }) : null,
            el('a', { class: 'btn btn-ghost btn-caps', href: 'portal-events.html', text: 'Events page' }));
          const visual = url
            ? el('div', { class: 'ann-visual v-flyer' }, el('a', { class: 'ann-flyer-btn', href: url, target: '_blank', rel: 'noopener', 'aria-label': 'View the ' + e.title + ' flyer' },
                el('img', { src: url, alt: 'Flyer for ' + e.title + '. ' + whenText(e) + '.' })))
            : el('div', { class: 'ann-visual v-save', 'aria-hidden': 'true' }, el('img', { src: 'images/single-ivy-leaf-tight.png', alt: '' }),
                el('p', { class: 'script', text: 'Save the date' }), el('p', { class: 'sub', text: whenText(e).split(' · ')[0] }));
          const slide = el('article', { class: 'ann-slide', 'data-live': e.id, 'data-cal-title': e.title, 'data-cal-note': e.description || '', ...calAttrs(e) },
            el('div', { class: 'ann-copy' }, el('span', { class: 'ann-tag', text: 'Chapter event' }), el('h3', { text: e.title }),
              e.description ? el('p', { text: e.description }) : null, facts, actions),
            visual);
          window.rcoAnnouncements.add(slide);
        });
      }
    } catch (err) { /* the built-in events still show */ }
    finally { done(); }
  });
})();
