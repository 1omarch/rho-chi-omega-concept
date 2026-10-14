// Loads members-only site content (the Resources catalog) from Supabase once a soror is signed in.
// Items that point at a stored file carry a "file" path; those are swapped for short-lived signed links.
document.addEventListener('rco-auth-ready', async () => {
  const sb = window.rcoAuth.client;
  const { data, error } = await sb.from('portal_content').select('data').eq('key', 'resources').maybeSingle();
  if (error || !data) {
    const note = document.getElementById('rs-note');
    if (note) note.textContent = 'The resources could not be loaded. Please refresh.';
    return;
  }
  const res = data.data;

  const withFiles = [];
  (function walk(o) {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === 'object') {
      if (typeof o.file === 'string') withFiles.push(o);
      Object.values(o).forEach(walk);
    }
  })(res);

  if (withFiles.length) {
    const { data: signed } = await sb.storage.from('portal-files').createSignedUrls(withFiles.map(o => o.file), 3600);
    const urls = {};
    (signed || []).forEach(s => { if (s.signedUrl) urls[s.path] = s.signedUrl; });
    withFiles.forEach(o => { if (urls[o.file]) o.url = urls[o.file]; });
  }

  window.RCO_RESOURCES = res;
  document.dispatchEvent(new CustomEvent('rco-resources-ready'));
});
