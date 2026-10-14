// Member portal sign-in. Sorors sign in with an emailed link; the roster (Supabase) decides who gets in.
(function () {
  const doc = document.documentElement;
  doc.classList.add('auth-pending');

  const state = { client: null, member: null, session: null, checking: false };
  window.rcoAuth = state;

  const cfg = window.RCO_SUPABASE;
  const lib = window.supabase;

  /* ---------- small helpers ---------- */
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v);
    });
    kids.flat().forEach(k => n.append(k));
    return n;
  };
  const page = () => location.origin + location.pathname;

  /* ---------- the sign-in gate ---------- */
  let gate = null;

  function lock() {
    doc.classList.remove('auth-pending');
    doc.classList.add('auth-locked');
    Array.from(document.body.children).forEach(c => { if (c !== gate && c.tagName !== 'SCRIPT') c.setAttribute('inert', ''); });
  }
  function unlock() {
    doc.classList.remove('auth-pending', 'auth-locked');
    Array.from(document.body.children).forEach(c => c.removeAttribute('inert'));
    if (gate) { gate.remove(); gate = null; }
  }

  function showGate(content) {
    if (!gate) {
      gate = el('div', { class: 'auth-gate', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'auth-title' });
      document.body.append(gate);
    }
    gate.replaceChildren(el('div', { class: 'auth-card' },
      el('img', { class: 'auth-crest', src: 'images/aka-emblem.png', alt: '' }),
      el('p', { class: 'auth-eyebrow', text: 'Rho Chi Omega · Member Portal' }),
      content));
    lock();
    const first = gate.querySelector('input, button');
    if (first) first.focus({ preventScroll: true });
  }

  function viewSignIn(message) {
    const input = el('input', { type: 'email', id: 'auth-email', name: 'email', required: true, autocomplete: 'email', inputmode: 'email', placeholder: 'you@example.com', 'aria-describedby': 'auth-help' });
    const btn = el('button', { type: 'submit', class: 'btn btn-primary auth-btn', text: 'Email me a sign-in link' });
    const note = el('p', { class: 'auth-msg', role: 'alert', text: message || '' });
    const form = el('form', { class: 'auth-form' },
      el('label', { for: 'auth-email', text: 'Your email address' }), input, btn, note);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const email = input.value.trim().toLowerCase();
      if (!email) return;
      btn.disabled = true; btn.textContent = 'Sending…'; note.textContent = '';
      const { error } = await state.client.auth.signInWithOtp({ email, options: { emailRedirectTo: page(), shouldCreateUser: true } });
      if (error) {
        btn.disabled = false; btn.textContent = 'Email me a sign-in link';
        note.textContent = /rate|too many|seconds/i.test(error.message)
          ? 'Too many requests right now. Please wait a minute and try again.'
          : 'We couldn’t send the link. Please check the address and try again.';
        return;
      }
      viewSent(email);
    });
    showGate([
      el('h1', { id: 'auth-title', text: 'Sign in' }),
      el('p', { id: 'auth-help', class: 'auth-help', text: 'Enter the email address the chapter has on file for you. We’ll send you a secure link to sign in. No password needed.' }),
      form
    ]);
  }

  function viewSent(email) {
    const input = el('input', { type: 'text', id: 'auth-code', name: 'code', required: true, autocomplete: 'one-time-code', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '10', placeholder: 'Code from the email', 'aria-describedby': 'auth-help' });
    const btn = el('button', { type: 'submit', class: 'btn btn-primary auth-btn', text: 'Sign in with code' });
    const note = el('p', { class: 'auth-msg', role: 'alert' });
    const form = el('form', { class: 'auth-form' }, el('label', { for: 'auth-code', text: 'Sign-in code' }), input, btn, note);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const token = input.value.replace(/\s+/g, '');
      if (!token) return;
      btn.disabled = true; btn.textContent = 'Checking…'; note.textContent = '';
      const { error } = await state.client.auth.verifyOtp({ email, token, type: 'email' });
      if (error) {
        btn.disabled = false; btn.textContent = 'Sign in with code';
        note.textContent = 'That code didn’t work. It may have expired. Check the digits or request a new one.';
        input.focus();
      }
      // on success, onAuthStateChange takes over and checks the roster
    });
    const again = el('button', { type: 'button', class: 'btn btn-ghost auth-btn', text: 'Use a different email' });
    again.addEventListener('click', () => viewSignIn());
    showGate([
      el('h1', { id: 'auth-title', text: 'Check your email' }),
      el('p', { id: 'auth-help', class: 'auth-help' }, 'We sent a sign-in email to ', el('strong', { text: email }), '. It can take a minute and may land in spam. Open the link in it, or type the code from it below.'),
      form,
      again
    ]);
  }

  function viewNotOnRoster(email) {
    const out = el('button', { type: 'button', class: 'btn btn-ghost auth-btn', text: 'Sign out' });
    out.addEventListener('click', signOut);
    showGate([
      el('h1', { id: 'auth-title', text: 'Not on the roster yet' }),
      el('p', { class: 'auth-help' }, 'You’re signed in as ', el('strong', { text: email }), ', but that address isn’t on the chapter roster. If you think it should be, please contact a chapter officer. They can add you, or tell them which email address to use.'),
      out
    ]);
  }

  function viewError(msg) {
    const retry = el('button', { type: 'button', class: 'btn btn-primary auth-btn', text: 'Try again' });
    retry.addEventListener('click', () => location.reload());
    showGate([
      el('h1', { id: 'auth-title', text: 'Sign-in is unavailable' }),
      el('p', { class: 'auth-help', text: msg || 'We couldn’t reach the sign-in service. Please try again in a moment.' }),
      retry
    ]);
  }

  /* ---------- membership check + reveal ---------- */
  async function checkMembership(session) {
    if (state.checking) return;
    state.checking = true;
    state.session = session;
    try {
      const { data, error } = await state.client.rpc('my_membership');
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) { state.member = null; viewNotOnRoster(session.user.email); return; }
      state.member = { name: row.full_name || session.user.email, role: row.role, email: session.user.email };
      reveal();
    } catch (err) {
      viewError();
    } finally {
      state.checking = false;
    }
  }

  function reveal() {
    unlock();
    const m = state.member;
    const header = document.querySelector('.portal-header .container');
    if (header && !header.querySelector('.auth-who')) {
      const out = el('button', { type: 'button', class: 'auth-out', text: 'Sign out' });
      out.addEventListener('click', signOut);
      header.append(el('div', { class: 'auth-who' }, el('a', { class: 'auth-name', href: 'portal-profile.html', title: 'My profile', text: m.name }), out));
    }
    const tabBar = document.querySelector('.portal-tabs .container');
    if (tabBar && !tabBar.querySelector('[href="portal-profile.html"]')) {
      const mine = el('a', { href: 'portal-profile.html', text: 'My Profile' });
      if (location.pathname.endsWith('portal-profile.html')) mine.classList.add('is-active');
      tabBar.append(mine);
    }
    if (m.role === 'officer' || m.role === 'admin') {
      const tabs = document.querySelector('.portal-tabs .container');
      if (tabs && !tabs.querySelector('[href="portal-roster.html"]')) {
        const a = el('a', { href: 'portal-roster.html', text: 'Roster' });
        if (location.pathname.endsWith('portal-roster.html')) a.classList.add('is-active');
        tabs.append(a);
      }
    }
    document.dispatchEvent(new CustomEvent('rco-auth-ready', { detail: m }));
  }

  async function signOut() {
    await state.client.auth.signOut();
    state.member = null;
    location.href = 'portal.html';
  }

  /* ---------- start ---------- */
  async function start() {
    if (!cfg || !lib) { document.addEventListener('DOMContentLoaded', () => viewError()); return; }
    state.client = lib.createClient(cfg.url, cfg.anonKey, {
      auth: { flowType: 'implicit', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    const ready = () => new Promise(r => (document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', r) : r()));
    await ready();

    state.client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { state.member = null; viewSignIn(); }
      else if (event === 'SIGNED_IN' && session && !state.member && !state.checking) checkMembership(session);
    });

    const { data } = await state.client.auth.getSession();
    if (data.session) checkMembership(data.session);
    else if (!/access_token|refresh_token|error_description/.test(location.hash + location.search)) viewSignIn();
    else {
      // returning from the emailed link: give the library a moment to read it
      setTimeout(async () => {
        const again = await state.client.auth.getSession();
        if (!again.data.session && !state.member && !state.checking) {
          const bad = /error_description|otp_expired|access_denied/.test(location.hash + location.search);
          viewSignIn(bad ? 'That sign-in link has expired or was already used. Please request a new one.' : '');
        }
      }, 2500);
    }
  }
  start();
})();
