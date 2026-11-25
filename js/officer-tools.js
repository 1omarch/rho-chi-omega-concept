// Officer Tools hub: one page that leads to the tools. Each officer sees only the cards an admin turned on for her (see Officer access).
document.addEventListener('rco-auth-ready', async e => {
  const me = e.detail;
  const $ = s => document.querySelector(s);
  if (me.role !== 'officer' && me.role !== 'admin') { $('#of-denied').hidden = false; return; }
  $('#of-app').hidden = false;
  const isAdmin = me.role === 'admin';
  const show = (id, on) => { const n = $(id); if (n) n.hidden = !on; };
  const ev = me.can('events'), gal = me.can('gallery'), sug = me.can('suggestions');

  show('#of-roster', me.can('roster'));
  show('#of-events', ev || gal);
  show('#of-fb', sug || isAdmin);
  show('#of-vote', me.can('meeting'));
  show('#of-review', isAdmin);
  show('#of-access', isAdmin);
  if (me.title || isAdmin) { const j = $('#of-job'); j.textContent = 'Your role: ' + (me.title || 'Admin (Co-Owner)'); j.hidden = false; }

  if (ev && gal) {
    $('#of-ev-title').textContent = 'Events & gallery';
    $('#of-ev-text').textContent = 'Add an event with its flyer and RSVP info (it shows on the Events page and announcement board, then removes itself), and manage the home page photos.';
  } else if (ev) {
    $('#of-ev-title').textContent = 'Events & flyers';
    $('#of-ev-text').textContent = 'Add an event with its flyer and RSVP info. It shows on the Events page and announcement board, then removes itself.';
  } else {
    $('#of-ev-title').textContent = 'Gallery';
    $('#of-ev-text').textContent = 'Add, caption and reorder the photos on the public home page.';
  }
  if (isAdmin) {
    $('#of-fb-title').textContent = 'Suggestions & tech issues';
    $('#of-fb-text').textContent = 'Ideas and problems sorors sent from the Help page. Tech issues are for admins only.';
  }
  if (!document.querySelector('.of-card:not([hidden])')) $('#of-none').hidden = false;

  // how many messages are waiting (the database decides what she may count)
  if (sug || isAdmin) {
    try {
      const { count, error } = await window.rcoAuth.client.from('feedback').select('id', { count: 'exact', head: true }).eq('status', 'new');
      if (!error && count) { const b = $('#of-fb-badge'); b.textContent = count + ' new'; b.hidden = false; }
    } catch (err) { /* the badge is a nicety */ }
  }
});
