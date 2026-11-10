// Portal colors: Pink & Green is the chapter's chosen look, for everyone.
// (Other options are still on file. Add ?theme=garden, ?theme=gold or ?theme=classic to a portal address to compare;
// that only affects the page you are looking at and shows a small Colors bar.)
(function () {
  const THEMES = [['classic', 'Classic'], ['pink', 'Pink & Green'], ['garden', 'Garden'], ['gold', 'Blush & Gold']];
  const DEFAULT = 'pink';
  const valid = n => THEMES.some(t => t[0] === n);
  let current = DEFAULT, previewing = false;
  try { localStorage.removeItem('rco-theme-preview'); } catch (e) { /* storage unavailable */ }
  try {
    const q = new URLSearchParams(location.search).get('theme');
    if (q && valid(q)) { current = q === 'classic' ? '' : q; previewing = true; }
  } catch (e) { /* ignore */ }
  const apply = n => { if (n) document.documentElement.setAttribute('data-theme', n); else document.documentElement.removeAttribute('data-theme'); };
  apply(current);

  function bar() {
    if (!previewing || document.getElementById('rco-themebar')) return;
    const style = document.createElement('style');
    style.textContent = `#rco-themebar{position:fixed;left:14px;bottom:54px;z-index:2100;display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;max-width:calc(100vw - 28px);background:#fff;border:2px solid #ecd9a8;border-radius:16px;padding:.5rem .7rem;box-shadow:0 14px 28px -12px rgba(8,25,18,.5);font:700 13px 'Public Sans',system-ui,sans-serif;color:#123524}
      #rco-themebar button{font:inherit;border:1.5px solid rgba(18,53,36,.25);background:#fff;color:#123524;border-radius:999px;padding:.4em .9em;cursor:pointer}
      #rco-themebar button[aria-pressed="true"]{background:#123524;color:#faf6ee;border-color:#123524}
      #rco-themebar .done{border:0;background:none;text-decoration:underline;color:#6b5a5a}`;
    document.head.append(style);
    const b = document.createElement('div'); b.id = 'rco-themebar'; b.setAttribute('role', 'group'); b.setAttribute('aria-label', 'Preview portal colors');
    const label = document.createElement('span'); label.textContent = 'Colors:'; b.append(label);
    THEMES.forEach(([id, name]) => {
      const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = name;
      btn.setAttribute('aria-pressed', String((id === 'classic' ? '' : id) === current));
      btn.addEventListener('click', () => {
        current = id === 'classic' ? '' : id; apply(current);
        b.querySelectorAll('button[aria-pressed]').forEach(x => x.setAttribute('aria-pressed', String(x === btn)));
      });
      b.append(btn);
    });
    const done = document.createElement('button'); done.type = 'button'; done.className = 'done'; done.textContent = 'Done';
    done.addEventListener('click', () => { apply(DEFAULT); b.remove(); });
    b.append(done);
    document.body.append(b);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bar); else bar();
})();
