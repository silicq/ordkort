/* Reminders to review, worked out on the device only: nothing about your cards or your habits goes anywhere.
   The page writes a small plan (when cards fall due, the hour you chose, whether you studied today) into the
   browser's own cache, where the service worker can read it. A notification then comes from the page while it is
   open in a tab, or from the service worker waking up by itself (Periodic Background Sync: the site installed as
   an app in Chrome or Edge). An installed app also shows how many cards are due on its icon. There is no push
   service and no server in this. */
(() => {
  const A = window.App;
  const CACHE = 'ordkort-remind', KEY = '/__remind';
  const TAG = 'ordkort-remind';
  const supported = () => 'Notification' in window && 'serviceWorker' in navigator && 'caches' in window;
  const on = () => !!A.store.settings?.remind?.on;
  const hour = () => { const x = A.store.settings?.remind?.hour; return Number.isInteger(x) && x >= 0 && x < 24 ? x : 19; };

  // when the cards of every language pair fall due
  function dueTimes() {
    const out = [];
    try {
      for (const p of Object.values(A.store.allPairs || {})) {
        for (const c of Object.values(p.cards || {})) if (c.box > 0 && !c.sus && c.due) out.push(c.due);
      }
    } catch { /* nothing to plan */ }
    return out.sort((a, b) => a - b).slice(0, 20000);
  }

  async function read() {
    try { const r = await (await caches.open(CACHE)).match(KEY); return r ? await r.json() : null; } catch { return null; }
  }
  async function write(plan) {
    try { await (await caches.open(CACHE)).put(KEY, new Response(JSON.stringify(plan), { headers: { 'Content-Type': 'application/json' } })); } catch { /* no cache */ }
  }

  // the plan, refreshed a little after every change
  let timer = null;
  function update() {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const old = await read();
      const due = dueTimes();
      const studied = A.store.today().rev > 0 ? A.store.dayKey() : old?.studied || '';
      await write({ on: on() && Notification.permission === 'granted', hour: hour(), due, studied, shown: old?.shown || '',
        title: A.t('remind.title'), body: A.t('remind.body') });
      badge(due);
    }, 3000);
  }
  function badge(due) {
    if (!navigator.setAppBadge) return;
    const n = on() ? due.filter((t) => t <= Date.now()).length : 0;
    (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
  }

  // while the site is open in a tab that is not being looked at: the same check the service worker makes
  async function check() {
    if (!on() || Notification.permission !== 'granted' || !document.hidden) return;
    const plan = await read();
    const day = A.store.dayKey();
    if (!plan || new Date().getHours() < plan.hour || plan.studied === day || plan.shown === day) return;
    const n = plan.due.filter((t) => t <= Date.now()).length;
    if (!n) return;
    await write({ ...plan, shown: day });
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification(plan.title.replace('{n}', n), { body: plan.body, icon: '/icons/icon-192.png', tag: TAG, data: '/#/' });
  }

  // turning reminders on asks for the permission to notify, and for the worker to wake up by itself when it can
  async function enable() {
    if (!supported()) return 'unsupported';
    const p = await Notification.requestPermission();
    if (p !== 'granted') return 'denied';
    try {
      const reg = await navigator.serviceWorker.ready;
      const st = await navigator.permissions?.query({ name: 'periodic-background-sync' }).catch(() => null);
      if (reg.periodicSync && st?.state === 'granted') { await reg.periodicSync.register(TAG, { minInterval: 6 * 36e5 }); update(); return 'background'; }
    } catch { /* not installed as an app */ }
    update();
    return 'tab';
  }
  async function disable() {
    try { const reg = await navigator.serviceWorker.ready; await reg.periodicSync?.unregister(TAG); } catch { /* none */ }
    update();
  }

  function start() {
    if (!supported() || A.framed) return;
    A.store.onChange(update);
    update();
    setInterval(check, 10 * 60e3);
    document.addEventListener('visibilitychange', () => { if (document.hidden) setTimeout(check, 1000); });
  }

  A.remind = { start, enable, disable, supported, update, _test: { dueTimes, check } };
})();
