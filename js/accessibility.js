// "Larger text" button on every page: Normal, Large, Extra large. The choice is remembered on that device.
(function () {
  const LEVELS = [
    { name: 'Normal', size: '' },
    { name: 'Large', size: '112.5%' },
    { name: 'Extra large', size: '128%' }
  ];
  const KEY = 'rco-text-size';
  let level = 0;
  try { level = Math.max(0, Math.min(LEVELS.length - 1, parseInt(localStorage.getItem(KEY) || '0', 10) || 0)); } catch (e) { /* storage unavailable */ }
  const apply = () => { document.documentElement.style.fontSize = LEVELS[level].size; };
  apply();

  function build() {
    if (document.getElementById('rco-textsize')) return;
    const style = document.createElement('style');
    style.textContent = `
      #rco-textsize { position: fixed; right: 14px; bottom: 54px; z-index: 2100; display: inline-flex; align-items: center; gap: .5rem;
        background: #123524; color: #faf6ee; border: 2px solid #ecd9a8; border-radius: 999px; padding: .55rem 1rem;
        font: 800 15px/1 'Public Sans', system-ui, sans-serif; letter-spacing: .02em; cursor: pointer;
        box-shadow: 0 14px 28px -12px rgba(8,25,18,.6); }
      #rco-textsize:hover { background: #1f5138; }
      #rco-textsize:focus-visible { outline: 3px solid #f2917e; outline-offset: 3px; }
      #rco-textsize .big { font-size: 20px; font-family: 'Fraunces', Georgia, serif; line-height: .8; }
      #rco-textsize .lvl { font-weight: 600; opacity: .85; font-size: 13px; }
      @media print { #rco-textsize { display: none; } }`;
    document.head.append(style);
    const b = document.createElement('button');
    b.type = 'button'; b.id = 'rco-textsize';
    const render = () => {
      b.replaceChildren();
      const big = document.createElement('span'); big.className = 'big'; big.textContent = 'A+';
      const label = document.createElement('span'); label.textContent = 'Text size';
      const lvl = document.createElement('span'); lvl.className = 'lvl'; lvl.textContent = LEVELS[level].name;
      b.append(big, label, lvl);
      b.setAttribute('aria-label', `Text size: ${LEVELS[level].name}. Press to make the text a different size.`);
    };
    b.addEventListener('click', () => {
      level = (level + 1) % LEVELS.length;
      try { localStorage.setItem(KEY, String(level)); } catch (e) { /* ignore */ }
      apply(); render();
    });
    render();
    document.body.append(b);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
