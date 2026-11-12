// Help page: Suggestion box and Tech issue box. Typed text or a recorded voice note.
// Signed-in sorors see the forms; everyone else keeps the email option already written in the page.
// Suggestions go to officers and admins; tech issues go to admins only (enforced in the database, supabase/feedback.sql).
(function () {
  const cfg = window.RCO_SUPABASE, lib = window.supabase;
  const cards = document.querySelectorAll('.fb-card[data-kind]');
  if (!cfg || !lib || !cards.length) return;

  const MAX = 2000;
  const sb = lib.createClient(cfg.url, cfg.anonKey, {
    auth: { flowType: 'implicit', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });

  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === 'text') n.textContent = v; else if (v === true) n.setAttribute(k, ''); else if (v !== false && v != null) n.setAttribute(k, v);
    });
    kids.flat().forEach(c => { if (c != null) n.append(c); });
    return n;
  }

  // a short, plain description of the phone/computer, so the administrator can reproduce a problem
  function deviceInfo() {
    const ua = navigator.userAgent || '';
    const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : 'Unknown device';
    const browser = /Edg\//.test(ua) ? 'Edge' : /(CriOS|Chrome)\//.test(ua) ? 'Chrome' : /(FxiOS|Firefox)\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Unknown browser';
    const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    const v = (document.querySelector('link[href*="styles.css?v="]') || {}).href || '';
    const ver = (v.match(/\?v=(\d+)/) || [])[1] || '?';
    return [os, browser, standalone ? 'opened from the Home Screen icon' : 'opened in the browser',
      screen.width + 'x' + screen.height, 'site ' + ver, ua].join(' | ').slice(0, 400);
  }

  async function getMe() {
    const { data } = await sb.auth.getSession();
    const email = data && data.session && data.session.user && data.session.user.email;
    if (!email) return null;
    const { data: row } = await sb.from('members').select('id, full_name, active').eq('email', email.toLowerCase()).maybeSingle();
    return row && row.active ? row : null;
  }

  function build(card, me) {
    const kind = card.dataset.kind;
    const slot = card.querySelector('.fb-slot');
    const isTech = kind === 'tech';
    const sentTo = isTech ? 'the website administrator' : 'the chapter officers';

    const ta = el('textarea', {
      rows: 5, maxlength: MAX, id: 'fb-' + kind, 'aria-label': isTech ? 'Describe the problem' : 'Your idea',
      placeholder: isTech ? 'What happened? What were you trying to do, and what did you see?' : 'What would make things better?'
    });
    const count = el('span', { class: 'fb-count', text: '0 / ' + MAX });
    ta.addEventListener('input', () => { count.textContent = ta.value.length + ' / ' + MAX; });

    // voice note
    let rec = null, voice = null, tickLabel;
    const micBtn = el('button', { type: 'button', class: 'fb-mic' }, '\u{1F3A4} Record a voice note');
    const recBar = el('div', { class: 'fb-rec', hidden: true, role: 'status' }, el('span', { class: 'fb-rec-dot' }),
      tickLabel = el('span', { class: 'fb-rec-time', text: '0:00' }), el('span', { text: 'Recording… speak now' }));
    const stopBtn = el('button', { type: 'button', class: 'btn btn-ivy' }, 'Stop');
    const cancelBtn = el('button', { type: 'button', class: 'fb-link' }, 'Cancel');
    recBar.append(stopBtn, cancelBtn);
    const clip = el('div', { class: 'fb-clip', hidden: true });
    const status = el('p', { class: 'fb-status', role: 'status', 'aria-live': 'polite' });
    const say = (t, ok) => { status.textContent = t || ''; status.classList.toggle('is-ok', !!ok); status.classList.toggle('is-err', !!t && !ok); };

    const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    function showClip(result) {
      if (voice && voice.url) URL.revokeObjectURL(voice.url);
      voice = { blob: result.blob, url: URL.createObjectURL(result.blob), seconds: result.seconds };
      clip.replaceChildren(el('audio', { controls: true, src: voice.url, preload: 'metadata' }),
        el('span', { class: 'fb-clip-len', text: fmt(result.seconds) }));
      const drop = el('button', { type: 'button', class: 'fb-link', text: 'Remove' });
      drop.addEventListener('click', clearVoice);
      clip.append(drop);
      clip.hidden = false; micBtn.hidden = true;
    }
    function clearVoice() {
      if (voice && voice.url) URL.revokeObjectURL(voice.url);
      voice = null; clip.hidden = true; clip.replaceChildren(); micBtn.hidden = false;
    }
    function finished(result) {
      recBar.hidden = true; rec = null;
      if (!result || result.seconds < 0.5) { say('That was too short. Tap the microphone and try again.'); micBtn.hidden = false; return; }
      if (result.peak < 0.005) { say('We could not hear anything. Check that the microphone is on and try again.'); micBtn.hidden = false; return; }
      say(''); showClip(result);
    }
    micBtn.addEventListener('click', async () => {
      say('');
      if (!window.rcoVoice || !rcoVoice.supported) { say('Voice notes are not available in this browser. Please type your message instead.'); return; }
      try {
        micBtn.disabled = true;
        rec = await rcoVoice.start(secs => { tickLabel.textContent = fmt(secs); }, result => { say('That is the 2-minute limit.', true); finished(result); });
        micBtn.hidden = true; recBar.hidden = false;
      } catch (err) {
        say(err && err.name === 'NotAllowedError' ? 'The microphone is blocked. Allow it for this website in your phone’s settings, or type your message.' : 'Could not start the microphone. Please type your message instead.');
      } finally { micBtn.disabled = false; }
    });
    stopBtn.addEventListener('click', () => { if (rec) finished(rec.stop()); });
    cancelBtn.addEventListener('click', () => { if (rec) { rec.cancel(); rec = null; } recBar.hidden = true; micBtn.hidden = false; });

    // tech issues share the device details by default
    const share = isTech
      ? el('label', { class: 'fb-check' }, el('input', { type: 'checkbox', checked: true }), el('span', { text: 'Include details about my phone or computer (helps the administrator fix it)' }))
      : null;

    const send = el('button', { type: 'button', class: 'btn btn-ivy fb-send' }, isTech ? 'Send tech issue' : 'Send suggestion');
    send.addEventListener('click', async () => {
      const text = ta.value.trim();
      if (!text && !voice) { say('Please type a message or record a voice note first.'); return; }
      if (rec) { say('Tap Stop on the recording first.'); return; }
      send.disabled = true; say('Sending…', true);
      let path = null;
      try {
        if (voice) {
          path = me.id + '/' + kind + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.wav';
          const up = await sb.storage.from('feedback-voice').upload(path, voice.blob, { contentType: 'audio/wav', upsert: false });
          if (up.error) throw up.error;
        }
        const row = { member_id: me.id, kind, body: text, voice_path: path, device: isTech && share && share.querySelector('input').checked ? deviceInfo() : null };
        const { error } = await sb.from('feedback').insert(row);
        if (error) { if (path) sb.storage.from('feedback-voice').remove([path]); throw error; }
        ta.value = ''; count.textContent = '0 / ' + MAX; clearVoice();
        say('Thank you! Your ' + (isTech ? 'tech issue' : 'suggestion') + ' was sent to ' + sentTo + '.', true);
      } catch (err) {
        const msg = String((err && err.message) || '');
        say(/several messages today/i.test(msg) ? msg : 'Sorry, that did not send. Please try again, or email RhoChiOmega1908@gmail.com.');
      } finally { send.disabled = false; }
    });

    slot.replaceChildren(...[
      el('label', { class: 'fb-label', for: 'fb-' + kind, text: isTech ? 'Describe the problem' : 'Your idea' }),
      ta, el('div', { class: 'fb-row' }, count),
      el('div', { class: 'fb-voice' }, micBtn, recBar, clip),
      share, send, status,
      el('p', { class: 'fb-small', text: 'Sent as ' + me.full_name + '. Only ' + (isTech ? 'the website administrator' : 'chapter officers') + ' can read it.' })
    ].filter(Boolean));
  }

  (async function init() {
    let me = null;
    try { me = await getMe(); } catch (e) { /* stay on the email option */ }
    if (!me) return;
    cards.forEach(c => build(c, me));
  })();
})();
