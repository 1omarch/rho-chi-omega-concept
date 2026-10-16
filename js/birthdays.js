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
  const today = data.filter(b => b.days_away === 0);
  const soon = data.filter(b => b.days_away > 0);
  const when = b => b.days_away === 0 ? 'Today' : b.days_away === 1 ? 'Tomorrow' : `${MONTHS[b.birth_month - 1]} ${b.birth_day}`;

  const facts = el('ul', { class: 'ann-facts' });
  [...today, ...soon].slice(0, 8).forEach(b => facts.append(el('li', { text: `${b.full_name} \u00b7 ${when(b)}` })));
  const more = data.length - 8;

  const slide = el('article', { class: 'ann-slide', 'data-birthdays': '' },
    el('div', { class: 'ann-copy' },
      el('span', { class: 'ann-tag' }, today.length ? 'Happy birthday' : 'Birthdays this week'),
      el('h3', { text: today.length ? (today.length === 1 ? `Happy Birthday, ${today[0].full_name.split(' ')[0]}!` : 'Happy Birthday, sorors!') : 'Celebrating our sorors' }),
      el('p', { text: today.length ? 'Send her some love today, and celebrate the sorors with birthdays coming up.' : 'Birthdays coming up in the chapter this week.' }),
      facts,
      more > 0 ? el('p', { class: 'ann-more', text: `and ${more} more this week` }) : ''),
    el('div', { class: 'ann-visual v-save', 'aria-hidden': 'true' },
      el('div', {},
        el('img', { src: 'images/single-ivy-leaf-tight.png', alt: '' }),
        el('p', { class: 'script', text: today.length ? 'Happy Birthday' : 'Birthdays' }),
        el('p', { class: 'sub', text: 'Rho Chi Omega' }))));
  window.rcoAnnouncements.addFirst(slide);
});
