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


  // decoration: roses and pink sparkles (static artwork)
  const ROSE = '<svg class="bd-rose" viewBox="0 0 200 200" aria-hidden="true"><defs><radialGradient id="bdPetal" cx="50%" cy="38%" r="68%"><stop offset="0" stop-color="#ffd9d4"/><stop offset=".55" stop-color="#f08aa0"/><stop offset="1" stop-color="#c2415f"/></radialGradient><radialGradient id="bdPetal2" cx="50%" cy="40%" r="65%"><stop offset="0" stop-color="#ffe6e0"/><stop offset=".6" stop-color="#f4a0b0"/><stop offset="1" stop-color="#d4506c"/></radialGradient></defs><g transform="translate(100 100)"><g fill="url(#bdPetal)" stroke="#b03a58" stroke-opacity=".35" stroke-width="1">' +
    [0, 72, 144, 216, 288].map(a => `<ellipse rx="44" ry="66" cy="-34" transform="rotate(${a})"/>`).join('') +
    '</g><g fill="url(#bdPetal2)" stroke="#b03a58" stroke-opacity=".4" stroke-width="1">' +
    [36, 108, 180, 252, 324].map(a => `<ellipse rx="30" ry="46" cy="-22" transform="rotate(${a})"/>`).join('') +
    '</g><circle r="24" fill="url(#bdPetal)" stroke="#b03a58" stroke-opacity=".5"/><path d="M-9 -2c0-9 18-9 18 0 0 9-12 11-14 4" fill="none" stroke="#a8324f" stroke-width="2.4" stroke-linecap="round"/></g></svg>';
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0l2.1 8.9L23 12l-8.9 2.1L12 24l-2.1-8.9L1 12l8.9-2.1L12 0z"/></svg>';
  const sparkle = (x, y, size, delay) => { const n = el('span', { class: 'bd-spark' }); n.style.cssText = `left:${x}%;top:${y}%;width:${size}px;height:${size}px;animation-delay:${delay}s`; n.insertAdjacentHTML('beforeend', STAR); return n; };
  const decor = () => {
    const d = el('div', { class: 'bd-decor' });
    d.insertAdjacentHTML('beforeend', ROSE + ROSE.replace('class="bd-rose"', 'class="bd-rose is-b"').replace(/bdPetal2?/g, m => m + 'B'));
    [[12, 14, 18, 0], [82, 10, 24, .6], [90, 46, 14, 1.2], [8, 58, 20, 1.8], [70, 72, 16, .3], [30, 8, 12, 2.2], [52, 90, 18, 1.5], [18, 84, 14, 2.6]].forEach(a => d.append(sparkle(...a)));
    return d;
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
    el('div', { class: 'ann-visual v-save v-bday', 'aria-hidden': 'true' },
      decor(),
      el('div', { class: 'bd-center' },
        today.length
          ? el('div', { class: 'bd-faces' }, today.slice(0, 4).map(b => face(b, today.length > 2 ? 'is-md' : 'is-lg')))
          : el('img', { src: 'images/single-ivy-leaf-tight.png', alt: '' }),
        el('p', { class: 'script', text: today.length ? 'Happy Birthday' : 'Birthdays' }),
        el('p', { class: 'sub', text: 'Rho Chi Omega' }))));
  window.rcoAnnouncements.addFirst(slide);
});
