// Portal home: a birthday slide on the announcement board when sorors have birthdays today or this week
document.addEventListener('rco-auth-ready', async () => {
  if (!window.rcoAnnouncements) return;
  const sb = window.rcoAuth.client;
  const now = new Date();
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const { data, error } = await sb.rpc('upcoming_birthdays', { on_date: iso, days: 7 });
  if (error || !data || !data.length) return;

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v); });
    kids.flat().forEach(k => n.append(k));
    return n;
  };
  // official directory photos for these sorors (linked card first, exact name as a fallback)
  const ids = new Set(data.map(b => b.member_id));
  const names = new Set(data.map(b => (b.full_name || '').trim().toLowerCase()));
  const photoOf = {};
  try {
    const { data: cards } = await sb.from('directory').select('display_name,photo_file,member_id').not('photo_file', 'is', null);
    const hits = (cards || []).filter(c => ids.has(c.member_id) || (!c.member_id && names.has((c.display_name || '').trim().toLowerCase())));
    if (hits.length) {
      const { data: signed } = await sb.storage.from('portal-files').createSignedUrls(hits.map(c => 'directory/' + c.photo_file), 3600);
      const byPath = {}; (signed || []).forEach(x => { if (x.signedUrl) byPath[x.path] = x.signedUrl; });
      hits.forEach(c => {
        const url = byPath['directory/' + c.photo_file]; if (!url) return;
        photoOf[c.member_id || ('n:' + c.display_name.trim().toLowerCase())] = url;
      });
    }
  } catch (err) { /* names only */ }
  const urlFor = b => photoOf[b.member_id] || photoOf['n:' + (b.full_name || '').trim().toLowerCase()] || null;
  const initials = n => (n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const face = (b, cls) => {
    const u = urlFor(b);
    const n = el('span', { class: 'bd-face ' + cls, title: b.full_name }, u ? '' : initials(b.full_name));
    if (u) n.style.backgroundImage = `url("${u}")`;
    return n;
  };

  const today = data.filter(b => b.days_away === 0);
  const soon = data.filter(b => b.days_away > 0);
  const when = b => b.days_away === 0 ? 'Today' : b.days_away === 1 ? 'Tomorrow' : `${MONTHS[b.birth_month - 1]} ${b.birth_day}`;

  const facts = el('ul', { class: 'ann-facts' });
  [...today, ...soon].slice(0, 6).forEach(b => facts.append(el('li', { class: 'bd-li' }, face(b, 'is-sm'), `${b.full_name} \u00b7 ${when(b)}`)));
  const more = data.length - 6;

  const slide = el('article', { class: 'ann-slide', 'data-birthdays': '' },
    el('div', { class: 'ann-copy' },
      el('span', { class: 'ann-tag' }, today.length ? 'Happy birthday' : 'Birthdays this week'),
      el('h3', { text: today.length ? (today.length === 1 ? `Happy Birthday, ${today[0].full_name.split(' ')[0]}!` : 'Happy Birthday, sorors!') : 'Celebrating our sorors' }),
      el('p', { text: today.length ? 'Send some love today, and celebrate the sorors with birthdays coming up.' : 'Birthdays coming up in the chapter this week.' }),
      facts,
      more > 0 ? el('p', { class: 'ann-more', text: `and ${more} more this week` }) : ''),
    el('div', { class: 'ann-visual v-save', 'aria-hidden': 'true' },
      el('div', {},
        today.length
          ? el('div', { class: 'bd-faces' }, today.slice(0, 4).map(b => face(b, today.length > 2 ? 'is-md' : 'is-lg')))
          : el('img', { src: 'images/single-ivy-leaf-tight.png', alt: '' }),
        el('p', { class: 'script', text: today.length ? 'Happy Birthday' : 'Birthdays' }),
        el('p', { class: 'sub', text: 'Rho Chi Omega' }))));
  window.rcoAnnouncements.addFirst(slide);
});
