// "Add to calendar" helpers: a Google Calendar link and a downloadable .ics file (Apple, Outlook and others).
// The .ics file carries reminders: 9 AM the day before and 9 AM the day of.
window.rcoCal = (function () {
  const pad = n => String(n).padStart(2, '0');
  const ymd = iso => iso.slice(0, 10).replace(/-/g, '');
  const hm = iso => (iso.length > 10 ? iso.slice(11, 16).replace(':', '') + '00' : '');
  const addDays = (iso, n) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; };
  const isTimed = iso => !!iso && iso.length > 10;

  // ev: { title, start: 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM', end?: same shape, where?, note? }
  function range(ev) {
    if (isTimed(ev.start)) {
      const end = ev.end && isTimed(ev.end) ? ev.end : ev.start.slice(0, 11) + String((parseInt(ev.start.slice(11, 13), 10) + 1) % 24).padStart(2, '0') + ev.start.slice(13);
      return { s: `${ymd(ev.start)}T${hm(ev.start)}`, e: `${ymd(end)}T${hm(end)}`, timed: true };
    }
    const lastDay = ev.end ? ev.end.slice(0, 10) : ev.start.slice(0, 10);
    return { s: ymd(ev.start), e: ymd(addDays(lastDay, 1)), timed: false };
  }
  function googleEvent(ev) {
    if (!ev || !ev.start) return null;
    const r = range(ev);
    const u = new URL('https://calendar.google.com/calendar/render');
    u.searchParams.set('action', 'TEMPLATE');
    u.searchParams.set('text', ev.title);
    u.searchParams.set('dates', `${r.s}/${r.e}`);
    if (r.timed) u.searchParams.set('ctz', 'America/Chicago');
    if (ev.where) u.searchParams.set('location', ev.where);
    if (ev.note) u.searchParams.set('details', ev.note);
    return u.toString();
  }
  function icsEvent(ev) {
    if (!ev || !ev.start) return null;
    const r = range(ev);
    const esc = s => String(s || '').replace(/[\;,]/g, m => '\\' + m).replace(/\r?\n/g, '\\n');
    const uid = `${r.s}-${Math.abs(Array.from(ev.title).reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7))}@rho-chi-omega`;
    const alarm = (trigger, text) => ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(text)}`, `TRIGGER:${trigger}`, 'END:VALARM'];
    // all-day events start at midnight, so PT9H is 9 AM that day and -PT15H is 9 AM the day before
    const alarms = r.timed
      ? [...alarm('-P1D', `Tomorrow: ${ev.title}`), ...alarm('-PT1H', `Soon: ${ev.title}`)]
      : [...alarm('-PT15H', `Tomorrow: ${ev.title}`), ...alarm('PT9H', `Today: ${ev.title}`)];
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rho Chi Omega//Portal//EN', 'BEGIN:VEVENT', `UID:${uid}`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]|\.\d+/g, '')}`,
      r.timed ? `DTSTART:${r.s}` : `DTSTART;VALUE=DATE:${r.s}`, r.timed ? `DTEND:${r.e}` : `DTEND;VALUE=DATE:${r.e}`,
      `SUMMARY:${esc(ev.title)}`, ev.where ? `LOCATION:${esc(ev.where)}` : '', ev.note ? `DESCRIPTION:${esc(ev.note)}` : '', ...alarms, 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean);
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(lines.join('\r\n'));
  }
  return {
    googleEvent, icsEvent,
    // older shape: (title, 'YYYY-MM-DD', note)
    google: (title, iso, note) => googleEvent({ title, start: iso, note }),
    icsHref: (title, iso, note) => icsEvent({ title, start: iso, note })
  };
})();
