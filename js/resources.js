// Resources — renders the consolidated page from RCO_RESOURCES
document.addEventListener('rco-resources-ready', function () {
  const data = window.RCO_RESOURCES;
  if (!data) return;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const ICONS = {
    Form: '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="m9 14 2 2 4-4"/>',
    Document: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/>',
    Resource: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    Sheet: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>',
    Budget: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>'
  };
  const icon = (kind, size = 17) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[kind] || ICONS.Document}</svg>`;
  const GATE = '<span class="rs-gate" title="Opens in the chapter portal. Sign in if asked."><svg class="gate" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>';
  const ARROW = '<svg class="go" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  /* ---------- deep links into the live portal ---------- */
  // #:~:text= scrolls the live page to the item and highlights it
  const frag = t => '#:~:text=' + encodeURIComponent(t).replace(/-/g, '%2D');
  const portalLink = (page, find) => data.portal[page] + frag(find);
  const hrefFor = it => it.url || portalLink(it.page || 'docs', it.find || it.title);

  /* ---------- rendering ---------- */
  function itemHTML(it) {
    const text = `${it.title} ${it.note || ''} ${it.kind}`.toLowerCase();
    return `<li class="rs-item" data-text="${esc(text)}"><a class="rs-link" href="${esc(hrefFor(it))}" target="_blank" rel="noopener">
      <span class="ic">${icon(it.kind)}</span>
      <span class="t">${esc(it.title)}${it.note ? `<small>${esc(it.note)}</small>` : ''}</span>
      <span class="rs-kind">${esc(it.kind)}</span>${it.url ? '' : GATE}${ARROW}</a></li>`;
  }
  const listHTML = items => `<ul class="rs-list">${items.map(itemHTML).join('')}</ul>`;
  const cardsHTML = groups => groups.map(g => `<article class="rs-card"><h3>${esc(g.label)}<span>${g.items.length}</span></h3>${listHTML(g.items)}</article>`).join('');

  function renderStatic() {
    $('#year-root').innerHTML = data.thisYear.map(itemHTML).join('');
    $('#forms-root').innerHTML = cardsHTML(data.forms);
    $('#gov-root').innerHTML = cardsHTML(data.governing);
    $('#more-root').innerHTML = cardsHTML(data.more);
    $('#budgets-root').innerHTML = data.finance.budgets.map(itemHTML).join('');

    const head = '<thead><tr><th scope="col">Line item</th>' + data.dues.memberTypes.map(t => `<th scope="col">${esc(t)}</th>`).join('') + '</tr></thead>';
    const rows = data.dues.rows.map(r => '<tr><td>' + esc(r[0]) + '</td>' + r.slice(1).map(v => typeof v === 'number' && v > 1 ? '<td>' + money(v) + '</td>' : v ? '<td>$&bull;&bull;&bull;.&bull;&bull;</td>' : '<td class="na">&mdash;</td>').join('') + '</tr>').join('');
    $('#dues-table').innerHTML = head + '<tbody>' + rows + '</tbody>';

    const c = data.dues.contact, box = $('#dues-contact');
    if (c && box) {
      box.replaceChildren(document.createTextNode(`Questions? ${c.role}: ${c.name}`));
      if (c.phone) {
        const tel = document.createElement('a');
        tel.href = 'tel:' + c.phone.replace(/[^\d+]/g, '');
        tel.textContent = c.phone;
        box.append(document.createElement('br'), tel);
      }
      box.hidden = false;
    }
  }

  /* ---------- search ---------- */
  function setupSearch() {
    const q = $('#rs-q');
    const note = $('#rs-note');
    const empty = $('#rs-empty');
    const baseNote = note.textContent;

    function run() {
      const tokens = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const items = $$('.rs-item');
      let shown = 0;
      items.forEach(li => {
        const hit = tokens.every(t => li.dataset.text.includes(t));
        li.classList.toggle('is-filtered-out', !hit);
        if (hit) shown++;
      });
      $$('.rs-card').forEach(c => c.classList.toggle('is-filtered-out', tokens.length > 0 && !$('.rs-item:not(.is-filtered-out)', c)));
      $$('.rs-section').forEach(sec => {
        const searchable = $('.rs-item', sec);
        const anyShown = $('.rs-item:not(.is-filtered-out)', sec);
        sec.classList.toggle('is-filtered-out', tokens.length > 0 && (!searchable || !anyShown));
      });
      if (tokens.length) {
        note.textContent = shown ? `${shown} ${shown === 1 ? 'result' : 'results'} for “${q.value.trim()}”` : '';
        empty.hidden = shown > 0;
        empty.innerHTML = `Nothing matches <strong>“${esc(q.value.trim())}”</strong>. Try a shorter word, or look for monthly reports in the report finder under Financial Reports.`;
      } else {
        note.textContent = baseNote;
        empty.hidden = true;
      }
    }
    q.addEventListener('input', run);
  }

  /* ---------- finance finder ---------- */
  function setupFinder() {
    const f = data.finance;
    const rep = $('#f-report'), fund = $('#f-fund'), year = $('#f-year'), month = $('#f-month');
    const now = new Date();
    const curYear = now.getFullYear();
    const latest = new Date(curYear, now.getMonth() - 1, 1);
    const latestY = latest.getFullYear(), latestM = latest.getMonth();

    const byOwner = {};
    f.reportTypes.forEach(r => (byOwner[r.preparedBy] = byOwner[r.preparedBy] || []).push(r));
    rep.innerHTML = Object.keys(byOwner).map(o => `<optgroup label="${esc(o)}">${byOwner[o].map(r => `<option value="${r.id}">${esc(r.label)}</option>`).join('')}</optgroup>`).join('');
    year.innerHTML = Array.from({ length: latestY - f.firstYear + 1 }, (_, i) => latestY - i).map(y => `<option>${y}</option>`).join('');

    function fillFunds() {
      const r = f.reportTypes.find(x => x.id === rep.value);
      fund.innerHTML = r.funds.map(x => `<option>${esc(x)}</option>`).join('');
      fund.disabled = r.funds.length === 1;
    }
    function fillMonths(prefer) {
      const y = Number(year.value);
      const last = y === latestY ? latestM : 11;
      const keep = prefer != null ? prefer : Number(month.value);
      month.innerHTML = MONTHS.map((m, i) => `<option value="${i}"${i > last ? ' disabled' : ''}>${m}</option>`).join('');
      month.value = String(keep > last || isNaN(keep) ? last : keep);
    }
    function summary() {
      const r = f.reportTypes.find(x => x.id === rep.value);
      const fundTxt = r.funds.length > 1 || r.funds[0] === 'All Accounts' ? ` · ${fund.value}` : '';
      $('#f-summary').textContent = `${r.label}${fundTxt} · ${MONTHS[Number(month.value)]} ${year.value}`;
      $('#f-by').textContent = `Prepared by the ${r.preparedBy}`;
      $('#f-open').href = portalLink('finance', r.find);
      $('#f-hint').textContent = `Opens the ${r.label} list on the chapter portal. Choose ${MONTHS[Number(month.value)]} ${year.value} there.`;
    }

    rep.addEventListener('change', () => { fillFunds(); summary(); });
    fund.addEventListener('change', summary);
    year.addEventListener('change', () => { fillMonths(); summary(); });
    month.addEventListener('change', summary);

    $('#f-latest').innerHTML = f.latestShortcuts.map(id => {
      const r = f.reportTypes.find(x => x.id === id);
      return `<button type="button" data-latest="${id}">${esc(r.label)} · ${MONTHS[latestM].slice(0, 3)} ${latestY}</button>`;
    }).join('');
    $('#f-latest').addEventListener('click', e => {
      const b = e.target.closest('[data-latest]');
      if (!b) return;
      rep.value = b.dataset.latest; fillFunds();
      year.value = String(latestY); fillMonths(latestM);
      summary();
      $('#f-open').focus({ preventScroll: true });
    });

    fillFunds();
    year.value = String(latestY);
    fillMonths(latestM);
    summary();
  }

  /* ---------- chips and sticky offset ---------- */
  function setupChips() {
    const tabs = $('.portal-tabs');
    if (tabs) document.documentElement.style.setProperty('--tabs-h', tabs.offsetHeight + 'px');
    const links = $$('.rs-chips a');
    const targets = links.map(a => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id));
      });
    }, { rootMargin: '-25% 0px -65% 0px' });
    targets.forEach(t => io.observe(t));
  }

  $$('[data-portal]').forEach(a => {
    const [page, find] = a.dataset.portal.split('|');
    a.href = find ? portalLink(page, find) : data.portal[page];
    a.target = '_blank';
    a.rel = 'noopener';
  });
  renderStatic();
  setupSearch();
  setupFinder();
  setupChips();
});
