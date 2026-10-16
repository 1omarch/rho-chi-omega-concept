// Portal home: nudge sorors to finish their profile (hidden once it is complete, or dismissed for this visit)
// Portal home: a small "unread messages" pill, and a nudge to finish your profile
document.addEventListener('rco-auth-ready', async () => {
  const slot = document.getElementById('pf-nudge-slot');
  if (!slot) return;

  const alertEl = document.createElement('a');
  alertEl.className = 'mg-alert'; alertEl.href = 'portal-profile.html#messages'; alertEl.hidden = true;
  const dot = document.createElement('span'); dot.className = 'n';
  const txt = document.createElement('span');
  alertEl.append(dot, txt);
  slot.prepend(alertEl);
  const showUnread = n => {
    alertEl.hidden = !(n > 0);
    dot.textContent = n > 9 ? '9+' : String(n);
    txt.textContent = n === 1 ? 'new message from a soror. Open your inbox' : 'new messages from sorors. Open your inbox';
  };
  document.addEventListener('rco-unread', ev => showUnread(Number(ev.detail) || 0));
  window.rcoAuth.client.rpc('unread_total').then(r => { if (!r.error) showUnread(Number(r.data) || 0); });

  try { if (sessionStorage.getItem('rco-nudge-off')) return; } catch (e) { /* storage unavailable */ }
  const sb = window.rcoAuth.client;
  const { data: id } = await sb.rpc('my_member_id');
  if (!id) return;
  const { data: p, error } = await sb.from('profiles').select('phone,address,school,initiation_year,initiated_chapter,photo_file').eq('member_id', id).maybeSingle();
  if (error) return;
  const missing = ['phone', 'address', 'school', 'initiation_year', 'initiated_chapter'].filter(k => !(p && p[k]));
  if (!missing.length) return;

  const box = document.createElement('div');
  box.className = 'pf-nudge';
  const msg = document.createElement('p');
  const strong = document.createElement('strong');
  strong.textContent = 'Finish your profile. ';
  msg.append(strong, 'Add your details and a picture so sorors can find and reach you in the directory.');
  const go = document.createElement('a');
  go.className = 'btn btn-ivy btn-sm';
  go.href = 'portal-profile.html';
  go.textContent = 'Update my profile';
  const x = document.createElement('button');
  x.type = 'button'; x.className = 'x'; x.setAttribute('aria-label', 'Dismiss'); x.textContent = '×';
  x.addEventListener('click', () => { box.remove(); try { sessionStorage.setItem('rco-nudge-off', '1'); } catch (e) { /* ignore */ } });
  box.append(msg, go, x);
  slot.append(box);
});
