// Quick vote pop-up: when an admin starts a yes/no vote, it appears on every open portal page.
// Loaded by portal-auth.js once a soror is signed in. The voting rules live in supabase/polls.sql.
(function () {
  const sb = window.rcoAuth && window.rcoAuth.client;
  if (!sb || window.__rcoPollPopup) return;
  window.__rcoPollPopup = true;
  const onPollsPage = false;

  const css = document.createElement('style');
  css.textContent = `
  .pp-shade{position:fixed;inset:0;z-index:100000;background:rgba(8,25,18,.6);display:flex;align-items:center;justify-content:center;padding:1rem;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
  .pp-shade[hidden]{display:none}
  .pp-card{background:#fff;border-radius:22px;width:min(520px,100%);padding:1.4rem 1.4rem 1.2rem;box-shadow:0 30px 80px rgba(0,0,0,.35);border-top:6px solid #c14760;max-height:92vh;overflow:auto}
  .pp-eyebrow{margin:0 0 .3rem;font-size:.78rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#c14760}
  .pp-q{margin:0 0 1.1rem;font-family:var(--font-display,Georgia,serif);font-size:1.6rem;line-height:1.25;color:#123524}
  .pp-btns{display:grid;grid-template-columns:1fr 1fr;gap:.8rem}
  .pp-btn{font:800 1.6rem/1 var(--font-display,Georgia,serif);padding:1.3rem .4rem;border-radius:16px;border:0;color:#fff;cursor:pointer}
  .pp-btn.yes{background:#1f7a4d}.pp-btn.no{background:#b3304a}.pp-btn[disabled]{opacity:.55}
  .pp-note{margin:.9rem 0 0;font-weight:700;color:#1f5a3d;text-align:center}
  .pp-err{margin:.8rem 0 0;font-weight:700;color:#b3261e;text-align:center}
  .pp-later{display:block;margin:1rem auto 0;background:none;border:0;color:#3f5548;font-weight:600;font-size:.95rem;font-family:inherit;text-decoration:underline;cursor:pointer;padding:.4rem}
  `;
  document.head.append(css);

  const shade = document.createElement('div');
  shade.className = 'pp-shade'; shade.hidden = true;
  shade.setAttribute('role', 'dialog'); shade.setAttribute('aria-modal', 'true'); shade.setAttribute('aria-label', 'Quick vote');
  document.body.append(shade);

  let showing = null, busy = false;
  const dismissed = new Set();
  try { JSON.parse(sessionStorage.getItem('rco-poll-later') || '[]').forEach(id => dismissed.add(id)); } catch (e) { /* storage unavailable */ }
  const remember = () => { try { sessionStorage.setItem('rco-poll-later', JSON.stringify([...dismissed])); } catch (e) { /* ignore */ } };

  function hide() { shade.hidden = true; shade.replaceChildren(); showing = null; }

  function show(p) {
    if (showing === p.id) return;
    showing = p.id;
    const card = document.createElement('div'); card.className = 'pp-card';
    const eyebrow = Object.assign(document.createElement('p'), { className: 'pp-eyebrow', textContent: 'Quick vote' });
    const q = Object.assign(document.createElement('p'), { className: 'pp-q', textContent: p.question });
    const yes = Object.assign(document.createElement('button'), { type: 'button', className: 'pp-btn yes', textContent: 'Yes' });
    const no = Object.assign(document.createElement('button'), { type: 'button', className: 'pp-btn no', textContent: 'No' });
    const row = Object.assign(document.createElement('div'), { className: 'pp-btns' });
    row.append(yes, no);
    const later = Object.assign(document.createElement('button'), { type: 'button', className: 'pp-later', textContent: 'Not now' });
    const msg = document.createElement('p');

    async function cast(choice) {
      busy = true; yes.disabled = no.disabled = true; msg.className = '';
      const { error } = await sb.rpc('cast_vote', { p_poll: p.id, p_choice: choice });
      busy = false;
      if (error && !/already voted|closed|no longer/i.test(error.message)) {
        yes.disabled = no.disabled = false; msg.className = 'pp-err'; msg.textContent = 'Your vote could not be counted. Please try again.'; return;
      }
      row.hidden = true; later.hidden = true; msg.className = 'pp-note';
      msg.textContent = error ? 'You have already voted, or voting has closed.' : '✓ Thank you. Your vote is counted.';
      setTimeout(() => { hide(); check(); }, 1600);
    }
    yes.addEventListener('click', () => cast('yes'));
    no.addEventListener('click', () => cast('no'));
    later.addEventListener('click', () => { dismissed.add(p.id); remember(); hide(); });
    card.append(eyebrow, q, row, msg, later);
    shade.replaceChildren(card); shade.hidden = false;
    yes.focus();
  }

  async function check() {
    const tab = document.getElementById('vote-app');
    if (busy || onPollsPage || (tab && !tab.hidden)) return;
    try {
      const { data, error } = await sb.rpc('my_polls');
      if (error || !data) return;
      const p = data.find(x => x.is_open && !x.i_voted && !dismissed.has(x.id));
      if (p) show(p); else if (showing && !busy) hide();
    } catch (e) { /* try again later */ }
  }

  check();
  setInterval(() => { if (!document.hidden) check(); }, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  try {
    sb.channel('poll-popup').on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, check).subscribe();
  } catch (e) { /* the 20-second check still works */ }
})();
