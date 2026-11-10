// My Profile: the Notifications card (turn app-style notifications on or off, send yourself a test).
document.addEventListener('rco-auth-ready', async () => {
  const host = document.getElementById('pf-notify');
  if (!host || !window.rcoPush) return;
  const sb = window.rcoAuth.client;
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v); });
    kids.flat(Infinity).forEach(k => n.append(k));
    return n;
  };
  const { data: myId } = await sb.rpc('my_member_id');
  if (!myId) return;

  async function draw(message) {
    const st = await window.rcoPush.state();
    const msg = el('p', { class: 'iv-msg', role: 'status', text: message || '' });
    const kids = [el('h3', { text: 'Notifications' })];
    if (!st.supported || (st.ios && !st.standalone)) {
      kids.push(el('p', { class: 'iv-sub' }, st.ios
        ? 'On an iPhone or iPad, notifications work after you add this site to your Home Screen and open it from there. The Help page shows how, with pictures. '
        : 'This browser cannot show app-style notifications. Try Chrome on Android, or add the site to your phone\u2019s Home Screen. '));
      kids.push(el('a', { class: 'btn btn-ghost btn-sm', href: 'help.html' }, 'Open the Help page'));
    } else if (st.permission === 'denied') {
      kids.push(el('p', { class: 'iv-sub', text: 'Notifications are blocked for this site. To allow them, open your phone or browser settings, find this site, and set Notifications to Allow. Then come back and press the button.' }));
    } else if (st.subscribed) {
      const off = el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Turn off on this device' });
      const test = el('button', { type: 'button', class: 'btn btn-ivy btn-sm', text: 'Send me a test' });
      off.addEventListener('click', async () => { off.disabled = true; await window.rcoPush.disable(sb); draw('Notifications are off on this device.'); });
      test.addEventListener('click', async () => {
        test.disabled = true;
        const ins = await sb.from('notifications').insert({ title: 'Test from Rho Chi Omega', body: 'It works! You will get reminders like this one.', url: 'portal-profile.html', audience: 'member:' + myId, created_by: myId });
        if (ins.error) { msg.textContent = 'The test could not be sent.'; test.disabled = false; return; }
        const mineSubs = await sb.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('member_id', myId);
        const run = await sb.functions.invoke('send-reminders', { body: {} });
        const st = run.data && run.data.stats;
        if (run.error) msg.textContent = 'The test is queued, but the sender could not be reached. (' + (run.error.message || 'error') + ')';
        else if (st && st.sent > 0) msg.textContent = `Sent to ${st.sent} device${st.sent === 1 ? '' : 's'}. It should arrive in a few seconds.`;
        else if (st && st.errors && st.errors.length) msg.textContent = 'Delivery failed: ' + st.errors.join(' | ');
        else msg.textContent = `No device was found to send to (devices saved for you: ${mineSubs.count ?? '?'}). Turn notifications off and on again.`;
        test.disabled = false;
      });
      kids.push(el('p', { class: 'iv-sub', text: '✓ Notifications are on for this device. You will be reminded the evening before and the morning of events on your list, and before your committee meetings.' }), el('div', { class: 'iv-actions' }, test, off));
    } else {
      const on = el('button', { type: 'button', class: 'btn btn-ivy btn-sm', text: 'Turn on notifications' });
      on.addEventListener('click', async () => {
        on.disabled = true;
        const r = await window.rcoPush.enable(sb, myId);
        if (r.ok) draw('Notifications are on.'); else { on.disabled = false; msg.textContent = r.reason === 'denied' ? 'You chose not to allow notifications. You can change that in your settings.' : 'Notifications could not be turned on. Please try again.'; }
      });
      kids.push(el('p', { class: 'iv-sub', text: 'Get a pop-up on your phone, like an app, when an event or committee meeting is coming up. Free, and you can turn it off any time.' }), on);
    }
    kids.push(msg);
    host.replaceChildren(el('div', { class: 'pf-card iv-card' }, ...kids));
  }
  draw();
});
