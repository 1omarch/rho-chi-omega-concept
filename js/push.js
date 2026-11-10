// App-style notifications: turn them on or off for this device.
window.rcoPush = (function () {
  const PUBLIC_KEY = 'BB_7PHBJ9of7ZPDHm0Cr5APse0yV_iA3VD6zTtrrGKM_m2pH5R6HYx1-YF8tFUK5WCJcDRjzDPUCrxcm_XYMnQc';
  const toBytes = b64 => { const pad = '='.repeat((4 - (b64.length % 4)) % 4); const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, c => c.charCodeAt(0)); };
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  async function current() {
    if (!supported) return null;
    const reg = await navigator.serviceWorker.getRegistration('sw.js') || await navigator.serviceWorker.getRegistration();
    return reg ? reg.pushManager.getSubscription() : null;
  }
  async function state() {
    const sub = supported ? await current() : null;
    return { supported, ios, standalone, permission: supported ? Notification.permission : 'unsupported', subscribed: !!sub && Notification.permission === 'granted' };
  }
  async function enable(sb, memberId) {
    if (!supported) return { ok: false, reason: 'unsupported' };
    const reg = await navigator.serviceWorker.register('sw.js');
    await navigator.serviceWorker.ready;
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, reason: 'denied' };
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(PUBLIC_KEY) });
    const j = sub.toJSON();
    await sb.from('push_subscriptions').delete().eq('endpoint', j.endpoint);
    const { error } = await sb.from('push_subscriptions').insert({ member_id: memberId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 200) });
    if (error) return { ok: false, reason: 'save' };
    return { ok: true };
  }
  async function disable(sb) {
    const sub = await current();
    if (sub) { await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); }
    return { ok: true };
  }
  return { state, enable, disable };
})();
