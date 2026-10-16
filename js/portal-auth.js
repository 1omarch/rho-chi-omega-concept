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
      const initials = m.name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
      const avatar = el('a', { class: 'auth-avatar', href: 'portal-profile.html', title: 'My profile', 'aria-label': 'My profile', text: initials });
      const badge = el('span', { class: 'auth-badge', 'aria-live': 'polite', hidden: true });
      header.append(el('div', { class: 'auth-who' }, el('span', { class: 'auth-avatar-wrap' }, avatar, badge), el('a', { class: 'auth-name', href: 'portal-profile.html', title: 'My profile', text: m.name }), out));
      loadAvatar(avatar, m);
      startInbox(badge, avatar);
      sweepFiles();
    }
    const tabBar = document.querySelector('.portal-tabs .container');
    if (tabBar && !tabBar.querySelector('[href="portal-profile.html"]')) {
      const mine = el('a', { href: 'portal-profile.html', text: 'My Profile' });
      if (location.pathname.endsWith('portal-profile.html')) mine.classList.add('is-active');
      tabBar.append(mine);
    }
    if (m.role === 'admin') {
      const bar = document.querySelector('.portal-tabs .container');
      if (bar && !bar.querySelector('[href="portal-message-review.html"]')) {
        const a = el('a', { href: 'portal-message-review.html', text: 'Message review' });
        if (location.pathname.endsWith('portal-message-review.html')) a.classList.add('is-active');
        bar.append(a);
      }
    }
    if (m.role === 'officer' || m.role === 'admin') {
      const galleryBar = document.querySelector('.portal-tabs .container');
      if (galleryBar && !galleryBar.querySelector('[href="portal-gallery.html"]')) {
        const g = el('a', { href: 'portal-gallery.html', text: 'Gallery' });
        if (location.pathname.endsWith('portal-gallery.html')) g.classList.add('is-active');
        galleryBar.append(g);
      }
      const tabs = document.querySelector('.portal-tabs .container');
      if (tabs && !tabs.querySelector('[href="portal-roster.html"]')) {
        const a = el('a', { href: 'portal-roster.html', text: 'Roster' });
        if (location.pathname.endsWith('portal-roster.html')) a.classList.add('is-active');
        tabs.append(a);
      }
    }
    document.dispatchEvent(new CustomEvent('rco-auth-ready', { detail: m }));
  }

  // small picture beside the name: her personal picture, else her directory photo, else her initials
  function showAvatar(node, url) {
    const im = new Image();
    im.onload = () => { node.style.backgroundImage = `url("${url}")`; node.textContent = ''; node.classList.add('has-photo'); };
    im.src = url;
  }
  async function loadAvatar(node, m) {
    document.addEventListener('rco-avatar-changed', e => { if (e.detail && e.detail.url) showAvatar(node, e.detail.url); });
    try {
      const c = JSON.parse(sessionStorage.getItem('rco-avatar') || 'null');
      if (c && c.email === m.email && c.exp > Date.now()) { showAvatar(node, c.url); return; }
    } catch (e) { /* storage unavailable */ }
    try {
      const sb = state.client;
      const { data: id } = await sb.rpc('my_member_id');
      if (!id) return;
      let path = null;
      const { data: p } = await sb.from('profiles').select('photo_file').eq('member_id', id).maybeSingle();
      if (p && p.photo_file) path = p.photo_file;
      if (!path) {
        const { data: d } = await sb.from('directory').select('photo_file').eq('member_id', id).not('photo_file', 'is', null).limit(1);
        if (d && d[0]) path = 'directory/' + d[0].photo_file;
      }
      if (!path) {
        const { data: d } = await sb.from('directory').select('photo_file').ilike('display_name', m.name).not('photo_file', 'is', null).limit(1);
        if (d && d[0]) path = 'directory/' + d[0].photo_file;
      }
      if (!path) return;
      const { data: s } = await sb.storage.from('portal-files').createSignedUrl(path, 3600);
      if (!s || !s.signedUrl) return;
      showAvatar(node, s.signedUrl);
      try { sessionStorage.setItem('rco-avatar', JSON.stringify({ email: m.email, url: s.signedUrl, exp: Date.now() + 50 * 60 * 1000 })); } catch (e) { /* ignore */ }
    } catch (e) { /* initials stay */ }
  }

  // unread messages: a red number on the profile picture, updated live and every minute
  async function startInbox(badge, avatar) {
    const sb = state.client;
    async function refresh() {
      const { data, error } = await sb.rpc('unread_total');
      if (error) return;
      const n = Number(data) || 0;
      badge.hidden = n === 0;
      badge.textContent = n > 9 ? '9+' : String(n);
      document.dispatchEvent(new CustomEvent('rco-unread', { detail: n }));
      avatar.href = n ? 'portal-profile.html#messages' : 'portal-profile.html';
      avatar.title = n ? `My profile (${n} unread message${n === 1 ? '' : 's'})` : 'My profile';
      const tab = document.getElementById('pf-badge');
      if (tab) { tab.hidden = n === 0; tab.textContent = n > 9 ? '9+' : String(n); }
    }
    await refresh();
    document.addEventListener('rco-inbox-refresh', refresh);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    setInterval(() => { if (!document.hidden) refresh(); }, 60000);
    sb.channel('inbox-badge').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, refresh).subscribe();
  }

  // attachments whose message was destroyed are removed from storage the next time anyone opens the portal
  async function sweepFiles() {
    try {
      const last = Number(sessionStorage.getItem('rco-sweep') || 0);
      if (Date.now() - last < 30 * 60 * 1000) return;
      sessionStorage.setItem('rco-sweep', String(Date.now()));
    } catch (e) { /* storage unavailable */ }
    try {
      const sb = state.client;
      const { data, error } = await sb.from('storage_purge_queue').select('path').limit(25);
      if (error || !data || !data.length) return;
      const paths = data.map(r => r.path);
      await sb.storage.from('message-files').remove(paths);
      await sb.from('storage_purge_queue').delete().in('path', paths);
    } catch (e) { /* try again next time */ }
  }

  async function signOut() {
    try { sessionStorage.removeItem('rco-avatar'); } catch (e) { /* ignore */ }
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
