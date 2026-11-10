// "Add to calendar" helpers: a Google Calendar link and a downloadable .ics file (Apple, Outlook and others).
window.rcoCal = (function () {
  const ymd = iso => iso.replace(/-/g, '');
  const nextDay = iso => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + 1)); return t.toISOString().slice(0, 10); };
  return {
    google(title, iso, note) {
      if (!iso) return null;
      const u = new URL('https://calendar.google.com/calendar/render');
      u.searchParams.set('action', 'TEMPLATE');
      u.searchParams.set('text', title);
      u.searchParams.set('dates', `${ymd(iso)}/${ymd(nextDay(iso))}`);
      if (note) u.searchParams.set('details', note);
      return u.toString();
    },
    icsHref(title, iso, note) {
      if (!iso) return null;
      const esc = s => String(s || '').replace(/[\;,]/g, m => '\\' + m).replace(/\r?\n/g, '\\n');
      const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rho Chi Omega//Portal//EN', 'BEGIN:VEVENT',
        `UID:${ymd(iso)}-${Math.abs(Array.from(title).reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7))}@rho-chi-omega`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]|\.\d+/g, '')}`,
        `DTSTART;VALUE=DATE:${ymd(iso)}`, `DTEND;VALUE=DATE:${ymd(nextDay(iso))}`,
        `SUMMARY:${esc(title)}`, note ? `DESCRIPTION:${esc(note)}` : '', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
      return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(body);
    }
  };
})();
