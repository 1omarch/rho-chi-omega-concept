// Sends app-style (web push) notifications: officer announcements, reminders for each soror's RSVPs
// (the evening before and the morning of), and committee meeting reminders (a day before and an hour before).
// A schedule runs it every 5 minutes. Secrets (set in Supabase, never in the website): VAPID_PUBLIC_KEY,
// VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CRON_SECRET = (Deno.env.get("CRON_SECRET") ?? "").trim().replace(/^["']+|["']+$/g, "").trim();
const TZ = "America/Chicago";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret" };

type Payload = { title: string; body: string; url: string };
// what happened during this run, returned to the caller so problems are visible
let stats = { pending: 0, recipients: 0, active: 0, devices: 0, sent: 0, errors: [] as string[] };

// today's date and hour in Central Time
function central(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false })
    .formatToParts(d).map((x) => [x.type, x.value]));
  const date = `${p.year}-${p.month}-${p.day}`;
  const hour = parseInt(p.hour, 10) % 24;
  return { date, hour };
}
function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

async function alreadySent(key: string) {
  const { data } = await sb.from("reminder_log").select("key").eq("key", key).maybeSingle();
  return !!data;
}
async function markSent(key: string) { await sb.from("reminder_log").upsert({ key }); }

// send one payload to every device of the given members
async function pushTo(memberIds: string[], payload: Payload) {
  stats.recipients += memberIds.length;
  if (!memberIds.length) return 0;
  const { data: members, error: mErr } = await sb.from("members").select("id").in("id", memberIds).eq("active", true);
  if (mErr) stats.errors.push("members lookup: " + mErr.message);
  const ids = (members ?? []).map((m) => m.id);
  stats.active += ids.length;
  if (!ids.length) return 0;
  const { data: subs, error: sErr } = await sb.from("push_subscriptions").select("id,endpoint,p256dh,auth").in("member_id", ids);
  if (sErr) stats.errors.push("device lookup: " + sErr.message);
  stats.devices += (subs ?? []).length;
  let sent = 0;
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 12 });
      sent++; stats.sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      const host = (() => { try { return new URL(s.endpoint).host; } catch { return "?"; } })();
      stats.errors.push(`${host} answered ${code ?? "?"}: ${String((e as { body?: string; message?: string }).body ?? (e as Error).message ?? e).slice(0, 160)}`);
      if (code === 404 || code === 410) await sb.from("push_subscriptions").delete().eq("id", s.id);   // that device turned notifications off
    }
  }));
  return sent;
}

async function membersFor(audience: string): Promise<string[]> {
  if (audience === "all") { const { data } = await sb.from("members").select("id").eq("active", true); return (data ?? []).map((m) => m.id); }
  if (audience.startsWith("member:")) return [audience.slice(7)];
  if (audience.startsWith("committee:")) {
    const { data } = await sb.from("member_committees").select("member_id").eq("committee", audience.slice(10));
    return (data ?? []).map((m) => m.member_id);
  }
  return [];
}

async function sendPendingNotifications() {
  const { data, error: nErr } = await sb.from("notifications").select("*").is("sent_at", null).order("created_at").limit(50);
  if (nErr) stats.errors.push("notifications lookup: " + nErr.message);
  stats.pending = (data ?? []).length;
  let n = 0;
  for (const note of data ?? []) {
    n += await pushTo(await membersFor(note.audience), { title: note.title, body: note.body, url: note.url || "portal.html" });
    await sb.from("notifications").update({ sent_at: new Date().toISOString() }).eq("id", note.id);
  }
  return n;
}

async function activityReminders() {
  const { date, hour } = central();
  let n = 0;
  const wanted: Array<[string, string, string]> = [];          // [event date, key suffix, wording]
  if (hour >= 8) wanted.push([date, "d0", "Today"]);
  if (hour >= 18) wanted.push([addDays(date, 1), "d1", "Tomorrow"]);
  for (const [eventDate, suffix, when] of wanted) {
    const { data } = await sb.from("member_activity").select("id,member_id,title").eq("kind", "rsvp").eq("remind", true).eq("event_date", eventDate);
    for (const a of data ?? []) {
      const key = `act:${a.id}:${suffix}`;
      if (await alreadySent(key)) continue;
      n += await pushTo([a.member_id], { title: `${when}: ${a.title}`, body: "You are on the list for this event.", url: "portal-profile.html" });
      await markSent(key);
    }
  }
  return n;
}

async function meetingReminders() {
  const now = Date.now();
  const { data } = await sb.from("committee_meetings").select("*").gte("starts_at", new Date(now).toISOString()).lte("starts_at", new Date(now + 25 * 3600e3).toISOString());
  let n = 0;
  for (const m of data ?? []) {
    const until = new Date(m.starts_at).getTime() - now;
    const when = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(m.starts_at));
    const steps: Array<[string, boolean]> = [["d1", until <= 24 * 3600e3], ["h1", until <= 3600e3]];
    for (const [suffix, due] of steps) {
      const key = `mtg:${m.id}:${suffix}`;
      if (!due || await alreadySent(key)) continue;
      const { data: people } = await sb.from("member_committees").select("member_id").eq("committee", m.committee).eq("remind", true);
      n += await pushTo((people ?? []).map((p) => p.member_id), {
        title: `${m.committee} meeting ${suffix === "h1" ? "starts in about an hour" : "is coming up"}`,
        body: `${m.title}, ${when}${m.location ? " at " + m.location : ""}`, url: "portal-committees.html#meetings",
      });
      await markSent(key);
    }
  }
  return n;
}

// Housekeeping: remove message attachment files from storage.
//  1. files queued when their message was destroyed (30 days after it was sent), and
//  2. files that no message points to any more (for example a failed send). Needs supabase/retention.sql.
async function purgeFiles() {
  const { data: queued, error: qErr } = await sb.from("storage_purge_queue").select("path").limit(200);
  if (qErr) { stats.errors.push("file queue: " + qErr.message); return { removed: 0 }; }
  const paths = (queued ?? []).map((r: { path: string }) => r.path);
  const { data: orphans, error: oErr } = await sb.rpc("orphan_message_files");
  if (oErr) stats.errors.push("orphan files: " + oErr.message);
  const extra = ((orphans ?? []) as { name: string }[]).map((r) => r.name);
  const all = [...new Set([...paths, ...extra])];
  if (!all.length) return { removed: 0 };
  const { error: rErr } = await sb.storage.from("message-files").remove(all);
  if (rErr) { stats.errors.push("removing files: " + rErr.message); return { removed: 0 }; }
  if (paths.length) await sb.from("storage_purge_queue").delete().in("path", paths);
  return { removed: all.length };
}

let ready = false;
// secrets can arrive with a stray space, line break or quote marks: clean them up
const secret = (k: string) => (Deno.env.get(k) ?? "").trim().replace(/^["']+|["']+$/g, "").trim();
function setup() {
  if (ready) return;
  const missing = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT", "CRON_SECRET"].filter((k) => !secret(k));
  if (missing.length) throw new Error("These secrets are missing in Supabase: " + missing.join(", "));
  const pub = secret("VAPID_PUBLIC_KEY"), priv = secret("VAPID_PRIVATE_KEY");
  if (pub.length !== 87 || priv.length !== 43 || !/^[A-Za-z0-9_-]+$/.test(pub + priv)) {
    throw new Error(`The keys look wrong. VAPID_PUBLIC_KEY has ${pub.length} characters (should be 87) and VAPID_PRIVATE_KEY has ${priv.length} (should be 43).`);
  }
  webpush.setVapidDetails(secret("VAPID_SUBJECT"), pub, priv);
  ready = true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try { setup(); } catch (e) { return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } }); }
  const isCron = CRON_SECRET !== "" && req.headers.get("x-cron-secret") === CRON_SECRET;
  try {
    stats = { pending: 0, recipients: 0, active: 0, devices: 0, sent: 0, errors: [] };
    const out: Record<string, unknown> = { announcements: await sendPendingNotifications() };
    if (isCron) { out.activity = await activityReminders(); out.meetings = await meetingReminders(); out.files = await purgeFiles(); }   // the schedule also does reminders
    out.stats = stats;
    return new Response(JSON.stringify(out), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
