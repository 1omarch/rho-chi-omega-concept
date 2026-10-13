// RCO Rewards — renders the page from RcoRewardsSource
(function () {
  const source = window.RcoRewardsSource;
  if (!source) return;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const fmt = n => Number(n).toLocaleString('en-US');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ICON_PATHS = {
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    heart: '<path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 0 0-7.1 7.1l1.7 1.7L12 21.5l7.1-7.1 1.7-1.7a5 5 0 0 0 0-7.1Z"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    clipboard: '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="m9 14 2 2 4-4"/>',
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    star: '<path d="m12 2 2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    gift: '<path d="M20 12v10H4V12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
    card: '<rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/>',
    ticket: '<path d="M3 8a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a2 2 0 0 0 0 4v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a2 2 0 0 0 0-4z"/><path d="M13 7v10" stroke-dasharray="2 2"/>',
    gem: '<path d="M6 3h12l4 6-10 13L2 9z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>',
    check: '<path d="m20 6-11 11-5-5"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>'
  };
  const icon = (name, size = 22, sw = 1.6) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;

  let program;
  let member;
  let viewKey = 'active';
  let shownBalance = 0;
  let activityFilter = 'all';
  let pendingReward = null;
  let opener = null;
  let toastTimer;

  /* ---------- derived values ---------- */
  function standing() {
    const basis = program.milestoneBasis === 'lifetime' ? (member.lifetimeEarned || 0) : (member.balance || 0);
    const ms = program.milestones.slice().sort((a, b) => a.points - b.points);
    const achieved = ms.filter(m => m.points <= basis);
    return {
      basis,
      ms,
      achieved,
      current: achieved[achieved.length - 1] || null,
      next: ms.find(m => m.points > basis) || null
    };
  }
  const sortedLedger = () => member.ledger.slice().sort((a, b) => b.date.localeCompare(a.date));
  const typeInfo = t => program.activityTypes[t] || { label: 'Activity', icon: 'star' };

  /* ---------- small helpers ---------- */
  function animateNumber(el, from, to, ms) {
    if (!el) return;
    if (reduceMotion || from === to) { el.textContent = fmt(to); return; }
    const start = performance.now();
    const step = now => {
      const p = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(from + (to - from) * eased));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function toast(msg) {
    const el = $('#rw-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-on'), 4200);
  }

  function goTo(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  /* ---------- renderers ---------- */
  function renderNavBalance() {
    const chip = $('#rw-nav-balance');
    if (!chip) return;
    if (member.enrolled) {
      chip.innerHTML = `<span class="rw-bead" aria-hidden="true"></span><span><span class="rw-chip-num">${fmt(member.balance)}</span> Points</span>`;
      chip.setAttribute('aria-label', `Your balance: ${fmt(member.balance)} points`);
    } else {
      chip.innerHTML = '<span class="rw-bead" aria-hidden="true"></span><span>Join RCO Rewards</span>';
      chip.setAttribute('aria-label', 'Join RCO Rewards');
    }
  }

  function renderPoints() {
    const root = $('#points-root');
    if (!member.enrolled) {
      root.innerHTML = `
        <div class="rw-enroll">
          <div class="rw-enroll-copy">
            <p class="eyebrow">RCO Rewards</p>
            <h2 id="points-heading" tabindex="-1">Ready to Start Earning?</h2>
            <p>Join RCO Rewards and start earning points for eligible chapter engagement.</p>
            <p class="rw-private">${icon('lock', 15, 1.8)} Your balance and activity are visible only to you. There is no public leaderboard.</p>
          </div>
          <form class="rw-enroll-form" id="enroll-form" novalidate>
            <label class="rw-check">
              <input type="checkbox" id="enroll-ack">
              <span class="rw-check-box" aria-hidden="true">${icon('check', 14, 3)}</span>
              <span>I have reviewed the RCO Rewards program guidelines.</span>
            </label>
            <p class="rw-fine">The final program guidelines document will be provided by RCO Rewards administration.</p>
            <button type="submit" class="btn btn-primary btn-caps" id="enroll-btn" disabled>Join RCO Rewards</button>
            <p class="rw-fine" id="enroll-hint">Check the box above to enable enrollment.</p>
          </form>
        </div>`;
      return;
    }

    const s = standing();
    const pct = s.next ? Math.min(100, (s.basis / s.next.points) * 100) : 100;
    const barLabel = s.next ? `${fmt(s.basis)} / ${fmt(s.next.points)} Points` : `${fmt(s.basis)} Points`;
    const barNote = s.next
      ? `<strong>${fmt(s.next.points - s.basis)} points</strong> until your next reward level!`
      : 'You have reached every reward level. Thank you for your engagement.';
    const greet = member.ledger.length || member.redemptions.length
      ? `Welcome back, Soror ${esc(member.firstName)}!`
      : `Welcome to RCO Rewards, Soror ${esc(member.firstName)}!`;
    const rows = sortedLedger().slice(0, 5);

    root.innerHTML = `
      <div class="rw-dash">
        <div class="rw-dash-top">
          <div>
            <p class="rw-kicker">My RCO Rewards</p>
            <h2 class="rw-greet" id="points-heading" tabindex="-1">${greet}</h2>
          </div>
          <span class="rw-private is-on-dark">${icon('lock', 15, 1.8)} Private to you. No public leaderboard.</span>
        </div>
        <div class="rw-dash-body">
          <div class="rw-balance">
            <span class="rw-label">Current Balance</span>
            <div class="rw-points"><span class="num" id="balance-num">${fmt(shownBalance)}</span><span class="unit">Points</span></div>
          </div>
          <div class="rw-progress">
            <div class="rw-progress-head"><strong>${barLabel}</strong>${s.next ? `<span>Next: ${esc(s.next.name)}</span>` : ''}</div>
            <div class="rw-bar" role="progressbar" aria-label="Progress toward your next reward level" aria-valuemin="0" aria-valuemax="${s.next ? s.next.points : s.basis}" aria-valuenow="${s.basis}">
              <span class="fill" id="bar-fill" style="width:0%"></span>
            </div>
            <p class="rw-progress-note">${barNote}</p>
          </div>
        </div>
        <div class="rw-dash-actions">
          <button type="button" class="btn btn-primary btn-caps" data-action="go-rewards">Redeem Rewards</button>
          <button type="button" class="btn btn-outline btn-caps" data-action="keep-stacking">Keep Stacking</button>
        </div>
        <p class="rw-stack-note">There is no rush. You are never required to redeem your points right away.</p>
      </div>

      <div class="rw-card rw-activity" id="activity-card">
        <div class="rw-card-head">
          <h3>My Recent Activity</h3>
          ${member.ledger.length ? `<button type="button" class="btn btn-ghost btn-sm btn-caps" data-action="open-activity">View All Point Activity</button>` : ''}
        </div>
        ${rows.length ? `<ul class="rw-ledger">${rows.map(ledgerRow).join('')}</ul>` : `
          <div class="rw-empty">
            <span class="rw-empty-ic">${icon('sparkle', 22)}</span>
            <p><strong>Your first points are waiting.</strong> Activity appears here after you take part in an eligible chapter activity.</p>
          </div>`}
      </div>`;

    const fill = $('#bar-fill');
    requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = pct + '%'; }));
    animateNumber($('#balance-num'), shownBalance, member.balance, 1100);
    shownBalance = member.balance;
  }

  function ledgerRow(e) {
    const t = typeInfo(e.type);
    return `
      <li class="rw-ledger-row">
        <span class="rw-ledger-ic ${e.type === 'bonus' ? 'is-bonus' : ''}">${icon(t.icon, 20)}</span>
        <span class="rw-ledger-main"><span class="t">${esc(e.title)}</span><span class="d">${esc(e.detail || t.label)}</span></span>
        <span class="rw-ledger-side"><span class="p">+${fmt(e.points)} Points</span><span class="dt">${fmtDate(e.date)}</span></span>
      </li>`;
  }

  function renderWays() {
    const cards = program.waysToEarn.filter(w => w.enabled).map(w => `
      <article class="rw-way">
        <span class="rw-way-ic">${icon(w.icon, 24)}</span>
        <h3>${esc(w.title)}</h3>
        <p>${esc(w.text)}</p>
      </article>`).join('');
    const promo = program.bonusPromo.enabled ? `
      <article class="rw-way is-bonus">
        <span class="rw-way-ic">${icon('star', 24)}</span>
        <h3>${esc(program.bonusPromo.title)}</h3>
        <p>${esc(program.bonusPromo.text)}</p>
      </article>` : '';
    $('#ways-root').innerHTML = cards + promo;
  }

  function renderRewards() {
    const live = program.rewards.filter(r => r.active);
    const cards = live.map(r => {
      const soldOut = r.inventory !== null && r.inventory <= 0;
      let foot;
      if (!member.enrolled) {
        foot = `<button type="button" class="btn btn-ghost btn-caps rw-block" data-action="go-join">Join to Redeem</button>`;
      } else if (soldOut) {
        foot = `<div class="rw-need is-out"><span>Currently unavailable</span></div>`;
      } else if (member.balance >= r.cost) {
        foot = `<button type="button" class="btn btn-ivy btn-caps rw-block" data-action="redeem" data-reward="${esc(r.id)}">Redeem</button>`;
      } else {
        const short = r.cost - member.balance;
        foot = `<div class="rw-need"><span>${fmt(short)} more points needed</span><span class="rw-meter" aria-hidden="true"><i style="width:${Math.min(100, (member.balance / r.cost) * 100)}%"></i></span></div>`;
      }
      const stock = r.inventory !== null && r.inventory > 0 && r.inventory <= 10 ? `<span class="rw-stock">${r.inventory} available</span>` : '';
      return `
        <article class="rw-reward tone-${esc(r.tone)}">
          <div class="rw-reward-art"><span class="rw-reward-ic">${icon(r.icon, 30, 1.5)}</span></div>
          <div class="rw-reward-body">
            <h3>${esc(r.name)}</h3>
            <p>${esc(r.description)}</p>
            <div class="rw-cost"><span class="rw-bead" aria-hidden="true"></span><strong>${fmt(r.cost)}</strong> Points ${stock}</div>
            <div class="rw-reward-foot">${foot}</div>
          </div>
        </article>`;
    }).join('');
    $('#rewards-root').innerHTML = cards;

    const bal = $('#market-balance');
    if (bal) bal.innerHTML = member.enrolled ? `Your balance <strong>${fmt(member.balance)} Points</strong>` : '';
  }

  function renderMilestones() {
    const s = standing();
    const n = s.ms.length;
    const step = 100 / n;
    const centers = s.ms.map((_, i) => step * (i + 0.5));
    let pos = 0;
    if (s.achieved.length && s.next) {
      const i = s.achieved.length - 1;
      const frac = (s.basis - s.ms[i].points) / (s.next.points - s.ms[i].points);
      pos = centers[i] + frac * step;
    } else if (s.achieved.length) {
      pos = centers[n - 1];
    }
    const span = centers[n - 1] - centers[0];
    const fillPct = Math.max(0, Math.min(100, ((pos - centers[0]) / span) * 100));

    $('#miles-root').innerHTML = `
      <div class="rw-miles-wrap" style="--n:${n}">
        <div class="rw-thread" aria-hidden="true"><i style="width:${fillPct}%"></i></div>
        <ol class="rw-miles">
          ${s.ms.map(m => {
            const done = m.points <= s.basis;
            const isCurrent = s.current && s.current.id === m.id;
            const isNext = s.next && s.next.id === m.id;
            const cls = [done ? 'is-done' : 'is-upcoming', isCurrent ? 'is-current' : '', isNext ? 'is-next' : ''].join(' ');
            const tag = isCurrent ? '<span class="rw-tag">Your level</span>' : (isNext ? '<span class="rw-tag is-soft">Next up</span>' : '<span class="rw-tag is-blank">&nbsp;</span>');
            return `
              <li class="${cls}">
                <span class="rw-miles-pearl">${done ? icon('check', 18, 2.6) : ''}</span>
                <span class="rw-miles-name">${esc(m.name)}</span>
                <span class="rw-miles-pts">${fmt(m.points)} Points</span>
                ${tag}
              </li>`;
          }).join('')}
        </ol>
      </div>`;
  }

  function renderHistory() {
    const root = $('#history-root');
    const list = member.redemptions;
    if (!list.length) {
      root.innerHTML = `<div class="rw-empty"><span class="rw-empty-ic">${icon('gift', 22)}</span><p><strong>No rewards redeemed yet.</strong> When you redeem a reward, it will be listed here with its status.</p></div>`;
      return;
    }
    root.innerHTML = `<ul class="rw-history">${list.map(r => `
      <li class="rw-history-row">
        <span class="rw-ledger-ic">${icon('gift', 20)}</span>
        <span class="rw-ledger-main"><span class="t">${esc(r.rewardName)}</span><span class="d">${fmt(r.points)} Points &middot; ${fmtDate(r.date)}</span></span>
        <span class="rw-status ${r.status === 'Redeemed' ? 'is-done' : 'is-pending'}">${esc(r.status)}</span>
      </li>`).join('')}</ul>`;
  }

  function renderImpact() {
    const year = program.programYear;
    const stats = program.impactStats.map(st => {
      const value = st.sumPoints
        ? member.ledger.reduce((a, e) => a + e.points, 0)
        : member.ledger.filter(e => st.types.includes(e.type)).length;
      return `
        <div class="rw-stat ${st.sumPoints ? 'is-points' : ''}">
          <span class="num" data-count="${value}">${fmt(value)}</span>
          <span class="lbl">${esc(st.label)}${st.sumPoints ? ` <small>in ${year}</small>` : ''}</span>
        </div>`;
    }).join('');
    $('#impact-root').innerHTML = stats;
    const stage = $('#impact-root');
    if (stage.dataset.seen === '1') return;
    const io = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      stage.dataset.seen = '1';
      $$('.num[data-count]', stage).forEach(el => animateNumber(el, 0, Number(el.dataset.count), 1000));
    }, { threshold: 0.4 });
    io.observe(stage);
  }

  function renderFaq() {
    const root = $('#faq-root');
    if (root.dataset.built === '1') return;
    root.dataset.built = '1';
    root.innerHTML = program.faq.map((f, i) => `
      <div class="rw-faq-item ${i === 0 ? 'is-open' : ''}">
        <h3><button type="button" class="rw-faq-q" id="faq-q-${i}" aria-expanded="${i === 0}" aria-controls="faq-a-${i}" data-action="faq">
          <span>${esc(f.q)}</span><span class="rw-faq-ic">${icon('chevron', 18, 2)}</span>
        </button></h3>
        <div class="rw-faq-a" id="faq-a-${i}" role="region" aria-labelledby="faq-q-${i}">
          <div class="inner">
            ${f.a ? `<p>${esc(f.a)}</p>` : ''}
            ${f.policy ? `<p class="rw-policy"><span>Policy pending</span> ${esc(f.policy)}</p>` : ''}
          </div>
        </div>
      </div>`).join('');
  }

  function renderActivityModal() {
    const chips = $('#activity-filters');
    const list = $('#activity-list');
    const types = Array.from(new Set(member.ledger.map(e => e.type)));
    chips.innerHTML = [['all', 'All']].concat(types.map(t => [t, typeInfo(t).label])).map(([k, label]) =>
      `<button type="button" class="rw-chip ${activityFilter === k ? 'is-on' : ''}" data-action="filter" data-filter="${esc(k)}" aria-pressed="${activityFilter === k}">${esc(label)}</button>`).join('');
    const rows = sortedLedger().filter(e => activityFilter === 'all' || e.type === activityFilter);
    list.innerHTML = rows.length ? rows.map(ledgerRow).join('') : '<li class="rw-empty"><p>No activity yet.</p></li>';
    const total = rows.reduce((a, e) => a + e.points, 0);
    $('#activity-total').textContent = `${rows.length} ${rows.length === 1 ? 'entry' : 'entries'} · ${fmt(total)} points`;
  }

  function renderAll() {
    document.body.dataset.enrolled = member.enrolled ? 'yes' : 'no';
    $$('[data-requires-enrollment]').forEach(el => { el.hidden = !member.enrolled; });
    if (!member.enrolled) shownBalance = 0;
    renderNavBalance();
    renderPoints();
    renderWays();
    renderRewards();
    renderMilestones();
    renderHistory();
    renderImpact();
    renderFaq();
    renderActivityModal();
    $$('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === viewKey)));
  }

  /* ---------- state changes ---------- */
  async function setView(key) {
    viewKey = key;
    member = await source.loadMember(key);
    shownBalance = 0;
    renderAll();
  }

  async function enroll() {
    member = await source.enroll();
    viewKey = 'new';
    shownBalance = 0;
    renderAll();
    toast(`Welcome to RCO Rewards, Soror ${member.firstName}! Your dashboard is ready.`);
    const h = $('#points-heading');
    if (h) h.focus({ preventScroll: true });
    goTo('points');
  }

  function openRedeem(rewardId, trigger) {
    const r = program.rewards.find(x => x.id === rewardId);
    if (!r) return;
    pendingReward = r;
    $('#rd-title').textContent = `Redeem ${r.name}?`;
    $('#rd-icon').innerHTML = icon(r.icon, 30, 1.5);
    $('#rd-cost').textContent = `${fmt(r.cost)} Points`;
    $('#rd-balance').textContent = `${fmt(member.balance)} Points`;
    $('#rd-after').textContent = `${fmt(member.balance - r.cost)} Points`;
    $('#rd-error').textContent = '';
    opener = { action: 'redeem', reward: rewardId };
    $('#open-redeem').click();
  }

  async function confirmRedeem() {
    if (!pendingReward) return;
    const btn = $('#rd-confirm');
    btn.disabled = true;
    try {
      const res = await source.redeem(viewKey, pendingReward.id);
      member = res.member;
      program = await source.loadProgram();
      const name = pendingReward.name;
      pendingReward = null;
      opener = null;
      $('#modal-redeem .modal-close').click();
      renderAll();
      const h = $('#rewards-heading');
      if (h) h.focus({ preventScroll: true });
      toast(`${name} requested. It will show as pending until RCO Rewards administration approves it.`);
    } catch (err) {
      $('#rd-error').textContent = err.message || 'Something went wrong. Please try again.';
    } finally {
      btn.disabled = false;
    }
  }

  /* ---------- events ---------- */
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action], [data-view]');
    if (!el) return;
    if (el.dataset.view) { setView(el.dataset.view); return; }
    switch (el.dataset.action) {
      case 'go-rewards': goTo('rewards'); break;
      case 'go-join': goTo('points'); break;
      case 'keep-stacking':
        toast('Keep stacking. You are never required to redeem your points right away.');
        goTo('earn');
        break;
      case 'redeem': openRedeem(el.dataset.reward, el); break;
      case 'confirm-redeem': confirmRedeem(); break;
      case 'close-modal': {
        const m = el.closest('.modal-backdrop');
        if (m) $('.modal-close', m).click();
        break;
      }
      case 'open-activity':
        activityFilter = 'all';
        renderActivityModal();
        opener = { action: 'open-activity' };
        $('#open-activity').click();
        break;
      case 'filter':
        activityFilter = el.dataset.filter;
        renderActivityModal();
        break;
      case 'faq': {
        const item = el.closest('.rw-faq-item');
        const open = !item.classList.contains('is-open');
        item.classList.toggle('is-open', open);
        el.setAttribute('aria-expanded', String(open));
        break;
      }
    }
  });

  document.addEventListener('change', e => {
    if (e.target.id !== 'enroll-ack') return;
    const on = e.target.checked;
    $('#enroll-btn').disabled = !on;
    $('#enroll-hint').textContent = on ? 'You are ready to join.' : 'Check the box above to enable enrollment.';
  });

  document.addEventListener('submit', e => {
    if (e.target.id !== 'enroll-form') return;
    e.preventDefault();
    if ($('#enroll-ack').checked) enroll();
  });

  // return focus to whatever opened a modal once it closes
  ['modal-redeem', 'modal-activity'].forEach(id => {
    const modal = document.getElementById(id);
    if (!modal) return;
    new MutationObserver(() => {
      if (modal.classList.contains('is-open') || !opener) return;
      const sel = `[data-action="${opener.action}"]` + (opener.reward ? `[data-reward="${opener.reward}"]` : '');
      const target = $(sel) || $('#rewards-heading');
      if (target) target.focus({ preventScroll: true });
      opener = null;
    }).observe(modal, { attributes: true, attributeFilter: ['class'] });
  });

  /* ---------- nav ---------- */
  function setupNav() {
    const tabs = $('.portal-tabs');
    if (tabs) document.documentElement.style.setProperty('--tabs-h', tabs.offsetHeight + 'px');
    const links = $$('.rw-subnav-links a');
    const targets = links.map(a => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id));
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    targets.forEach(t => io.observe(t));
  }

  /* ---------- hero pearl strand ---------- */
  function buildStrand() {
    const svg = $('#strand');
    if (!svg) return;
    const NS = 'http://www.w3.org/2000/svg';
    const P = [[30, 24], [58, 330], [412, 330], [440, 24]];
    const at = t => {
      const u = 1 - t;
      return [0, 1].map(k => u * u * u * P[0][k] + 3 * u * u * t * P[1][k] + 3 * u * t * t * P[2][k] + t * t * t * P[3][k]);
    };
    const count = 27;
    const thread = document.createElementNS(NS, 'path');
    thread.setAttribute('d', `M${P[0]} C${P[1]} ${P[2]} ${P[3]}`);
    thread.setAttribute('class', 'strand-thread');
    svg.appendChild(thread);
    for (let i = 0; i < count; i++) {
      const t = 0.03 + (0.94 * i) / (count - 1);
      const [x, y] = at(t);
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', x.toFixed(1));
      c.setAttribute('cy', y.toFixed(1));
      c.setAttribute('r', (6.5 + 8.5 * Math.sin(Math.PI * t)).toFixed(1));
      c.setAttribute('class', 'strand-pearl');
      c.style.setProperty('--i', i);
      svg.appendChild(c);
    }
  }

  /* ---------- boot ---------- */
  async function boot() {
    program = await source.loadProgram();
    setupNav();
    buildStrand();
    await setView('active');
  }
  boot();
})();
