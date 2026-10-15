// Committees page: chapter officers and committee chairmen, loaded from the members-only table after sign-in
document.addEventListener('rco-auth-ready', async () => {
  const root = document.getElementById('ld-root');
  if (!root) return;
  const sb = window.rcoAuth.client;
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v); });
    kids.flat().forEach(k => n.append(k));
    return n;
  };

  const { data, error } = await sb.from('portal_content').select('data').eq('key', 'leadership').maybeSingle();
  if (error || !data) { root.replaceChildren(el('p', { class: 'ld-note', text: 'The list of officers and chairmen could not be loaded. Please refresh.' })); return; }
  const d = data.data;

  const blocks = [];  // { node, text } so search can show and hide pieces
  const add = (node, text) => { blocks.push({ node, text: text.toLowerCase() }); return node; };

  // officers
  const grid = el('div', { class: 'ld-officers' });
  d.officers.rows.forEach(([title, name]) => {
    grid.append(add(el('div', { class: 'ld-officer' }, el('span', { class: 'ld-role', text: title }), el('strong', { text: name })), title + ' ' + name));
  });
  const panel = el('div', { class: 'ld-pan' }, el('span', { class: 'ld-role', text: d.panhellenic.label }), el('strong', { text: d.panhellenic.names.join(' · ') }));
  const parts = [
    el('h3', { class: 'ld-h', text: d.officers.label }), grid,
    add(panel, d.panhellenic.label + ' ' + d.panhellenic.names.join(' '))
  ];

  // committee tables, each in a collapsible group
  const details = d.groups.map((g, gi) => {
    const tbody = el('tbody');
    g.rows.forEach(([c, ch, co]) => tbody.append(add(el('tr', {}, el('th', { scope: 'row', text: c }), el('td', { text: ch }), el('td', { class: co ? '' : 'is-empty', text: co || '—' })), c + ' ' + ch + ' ' + co)));
    const table = el('table', { class: 'ld-table' },
      el('thead', {}, el('tr', {}, el('th', { scope: 'col', text: 'Committee' }), el('th', { scope: 'col', text: 'Chairman' }), el('th', { scope: 'col', text: 'Co-Chairman' }))), tbody);
    const det = el('details', { class: 'ld-group', open: gi === 0 }, el('summary', {}, g.label, el('span', { class: 'ld-count', text: String(g.rows.length) })), el('div', { class: 'rs-table-scroll' }, table));
    return det;
  });

  root.replaceChildren(...parts, el('h3', { class: 'ld-h', text: 'Committee chairmen' }), ...details);

  // search
  const q = document.getElementById('ld-q');
  const empty = document.getElementById('ld-empty');
  if (q) q.addEventListener('input', () => {
    const tokens = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    blocks.forEach(b => { const hit = tokens.every(t => b.text.includes(t)); b.node.hidden = !hit; if (hit) shown++; });
    details.forEach(det => {
      const any = det.querySelector('tbody tr:not([hidden])');
      det.hidden = tokens.length > 0 && !any;
      if (tokens.length) det.open = !!any;
    });
    if (empty) empty.hidden = !tokens.length || shown > 0;
  });
});
