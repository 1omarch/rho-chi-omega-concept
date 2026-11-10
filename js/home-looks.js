// Home page colors. Emerald Spring is the default (set on the <html> tag in index.html).
// To compare, add ?look=today, ?look=bright, ?look=pinkgreen, ?look=blush or ?look=spring to the home page address.
// Only the page you are looking at changes, and a small "Colors" bar lets you flip between them. Nothing is saved.
(function () {
  const LOOKS = [['today', 'Today'], ['bright', 'Brighter whites'], ['pinkgreen', 'Fresh Pink & Green'], ['blush', 'Raspberry & Blush'], ['spring', 'Soft Spring'], ['blend', 'Emerald Spring (blend)']];
  const THEME_COLOR = { today: '#123524', bright: '#123524', pinkgreen: '#0f6b3f', blush: '#8f2452', spring: '#2a6a49', blend: '#1f5a3d' };
  let q = null;
  const DEFAULT_LOOK = 'blend';
  try { q = new URLSearchParams(location.search).get('look'); } catch (e) { /* ignore */ }
  if (!q || !LOOKS.some(l => l[0] === q) || q === DEFAULT_LOOK) return;
  const root = document.documentElement;
  function apply(id) {
    if (id === 'today') root.removeAttribute('data-look'); else root.setAttribute('data-look', id);
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', THEME_COLOR[id]);
  }
  apply(q);
  function bar() {
    const b = document.createElement('div'); b.id = 'rco-lookbar'; b.setAttribute('role', 'group'); b.setAttribute('aria-label', 'Preview home page colors');
    const label = document.createElement('div'); label.className = 'lb-label'; label.textContent = 'Try a color look'; b.append(label);
    LOOKS.forEach(([id, name]) => {
      const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = name; btn.setAttribute('aria-pressed', String(id === q));
      btn.addEventListener('click', () => { q = id; apply(id); b.querySelectorAll('button[aria-pressed]').forEach(x => x.setAttribute('aria-pressed', String(x === btn))); });
      b.append(btn);
    });
    const done = document.createElement('button'); done.type = 'button'; done.className = 'done'; done.textContent = 'Close'; done.addEventListener('click', () => { b.remove(); document.body.classList.remove('has-lookbar'); });
    b.append(done); document.body.append(b); document.body.classList.add('has-lookbar');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bar); else bar();
})();
