// Officer Tools hub: one page that leads to every officer-only tool. Admin-only cards stay hidden for officers.
document.addEventListener('rco-auth-ready', async e => {
  const me = e.detail;
  const $ = s => document.querySelector(s);
  if (me.role !== 'officer' && me.role !== 'admin') { $('#of-denied').hidden = false; return; }
  $('#of-app').hidden = false;
  const isAdmin = me.role === 'admin';
  if (isAdmin) {
    $('#of-vote').hidden = false;
    $('#of-ev-title').textContent = 'Events & gallery';
    $('#of-ev-text').textContent = 'Add an event with its flyer and RSVP info (it shows on the Events page and announcement board, then removes itself), and manage the home page photos.'; $('#of-review').hidden = false;
    $('#of-fb-title').textContent = 'Suggestions & tech issues';
    $('#of-fb-text').textContent = 'Ideas and problems sorors sent from the Help page. Tech issues are for admins only.';
  }
  // how many messages are waiting (officers can only count suggestions; the database decides)
  try {
    const { count, error } = await window.rcoAuth.client.from('feedback').select('id', { count: 'exact', head: true }).eq('status', 'new');
    if (!error && count) { const b = $('#of-fb-badge'); b.textContent = count + ' new'; b.hidden = false; }
  } catch (err) { /* the badge is a nicety */ }
});
