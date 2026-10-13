// RCO Rewards — placeholder data layer. Replace RcoRewardsSource with real profile, attendance, survey and admin APIs.
(function () {
  const POLICY_TBD = 'Final program policy to be determined by RCO Rewards administration.';

  const program = {
    name: 'RCO Rewards',
    milestoneBasis: 'balance', // 'balance' or 'lifetime'
    programYear: 2026,

    activityTypes: {
      meeting:   { label: 'Chapter Meeting',  icon: 'users' },
      service:   { label: 'Service',          icon: 'heart' },
      program:   { label: 'Program & Event',  icon: 'calendar' },
      survey:    { label: 'Survey',           icon: 'clipboard' },
      committee: { label: 'Committee',        icon: 'briefcase' },
      workshop:  { label: 'Workshop',         icon: 'book' },
      bonus:     { label: 'Bonus Points',     icon: 'star' }
    },

    waysToEarn: [
      { id: 'meetings',  enabled: true, icon: 'users',     title: 'Chapter Meetings',     text: 'Attend eligible chapter meetings and earn points.' },
      { id: 'service',   enabled: true, icon: 'heart',     title: 'Service',              text: 'Participate in approved community service projects.' },
      { id: 'programs',  enabled: true, icon: 'calendar',  title: 'Programs & Events',    text: 'Attend and support chapter programs and special events.' },
      { id: 'surveys',   enabled: true, icon: 'clipboard', title: 'Surveys',              text: 'Share your voice by completing eligible chapter surveys.' },
      { id: 'committees',enabled: true, icon: 'briefcase', title: 'Committees',           text: 'Participate in committees and complete eligible assignments.' },
      { id: 'workshops', enabled: true, icon: 'book',      title: 'Workshops',            text: 'Participate in chapter educational and professional development opportunities.' },
      { id: 'special',   enabled: true, icon: 'sparkle',   title: 'Special Opportunities',text: 'Look out for bonus-point opportunities throughout the year.' }
    ],

    bonusPromo: {
      enabled: true,
      title: 'Bonus Point Opportunities',
      text: 'From time to time, RCO Rewards may offer bonus points, special challenges, and limited-time engagement opportunities.'
    },

    // inventory: null means unlimited; active: false hides a reward from members
    rewards: [
      { id: 'swag',        active: true, inventory: null, tone: 'pink',    icon: 'bag',   name: 'RCO Swag',               cost: 500,  description: 'A chapter keepsake to wear and share.' },
      { id: 'merch',       active: true, inventory: null, tone: 'green',   icon: 'gift',  name: 'Chapter Merchandise',    cost: 750,  description: 'Official chapter merchandise.' },
      { id: 'giftcard',    active: true, inventory: null, tone: 'gold',    icon: 'card',  name: '$25 Gift Card',          cost: 1000, description: 'A little something for yourself.' },
      { id: 'eventcredit', active: true, inventory: null, tone: 'pink',    icon: 'ticket',name: 'Event Registration Credit', cost: 1500, description: 'Credit toward a chapter event registration.' },
      { id: 'premium',     active: true, inventory: 3,    tone: 'emerald', icon: 'gem',   name: 'Premium Reward',         cost: 2500, description: 'Our most exclusive reward tier.' }
    ],

    milestones: [
      { id: 'l1', name: 'Level 1', points: 500 },
      { id: 'l2', name: 'Level 2', points: 1000 },
      { id: 'l3', name: 'Level 3', points: 1500 },
      { id: 'l4', name: 'Level 4', points: 2500 }
    ],

    impactStats: [
      { id: 'service',  label: 'Service Projects',  types: ['service'] },
      { id: 'meetings', label: 'Chapter Meetings',  types: ['meeting'] },
      { id: 'surveys',  label: 'Surveys Completed', types: ['survey'] },
      { id: 'programs', label: 'Programs Attended', types: ['program'] },
      { id: 'points',   label: 'Points Earned',     sumPoints: true }
    ],

    faq: [
      { q: 'What is RCO Rewards?', a: 'RCO Rewards is a voluntary member engagement and recognition program of the Rho Chi Omega Chapter. It recognizes active participation in chapter life, including meetings, service projects, programs, surveys, committee activities, workshops, and other approved engagement opportunities.' },
      { q: 'Who can participate?', a: 'RCO Rewards is designed for members of the Rho Chi Omega Chapter, and participation is voluntary.', policy: POLICY_TBD },
      { q: 'How do I enroll?', a: 'Select Join RCO Rewards on this page and confirm that you have reviewed the program guidelines. Once you join, your personal rewards dashboard unlocks.' },
      { q: 'How do I earn points?', a: 'Take part in eligible chapter activities and approved engagement opportunities. See Ways to Earn for the types of activity that count. Point values can be adjusted by RCO Rewards administration, so check each opportunity for current details.' },
      { q: 'When are points added to my account?', policy: POLICY_TBD },
      { q: 'Do I have to redeem my points?', a: 'No. Redeeming is always your choice. You can redeem your points for an available reward, or keep stacking them toward something bigger.' },
      { q: 'Can I save my points for a larger reward?', a: 'Yes. Points can stack in your account toward the larger rewards in the marketplace. That is what Keep Stacking is for.' },
      { q: 'Do RCO Rewards Points have a cash value?', a: 'No. RCO Rewards Points have no cash value.' },
      { q: 'Can I transfer my points to another member?', policy: POLICY_TBD },
      { q: 'What happens if I’m missing points?', policy: POLICY_TBD },
      { q: 'Do points expire?', policy: POLICY_TBD },
      { q: 'Can point values or available rewards change?', a: 'Yes. Point opportunities, point values, and available rewards may be added, adjusted, or retired by RCO Rewards administration, subject to applicable chapter guidelines and approval.' }
    ]
  };

  // [date, type, title, detail, points] — 2026 sample activity for the placeholder member
  const activityRows = [
    ['2026-10-12', 'meeting',   'Chapter Meeting',           'October Chapter Meeting', 50],
    ['2026-10-03', 'service',   'Community Service Project', 'Fall service day', 75],
    ['2026-09-29', 'committee', 'Committee Participation',   'Committee assignment completed', 50],
    ['2026-09-28', 'survey',    'Member Survey',             'Fall engagement survey', 20],
    ['2026-09-25', 'program',   'Program Attendance',        'A September to ReMembership', 30],
    ['2026-09-18', 'workshop',  'Workshop Attendance',       'Leadership Development Summit II', 40],
    ['2026-09-12', 'meeting',   'Chapter Meeting',           'September Chapter Meeting', 50],
    ['2026-08-29', 'program',   'Program Attendance',        'Chapter program', 30],
    ['2026-08-15', 'service',   'Community Service Project', 'Back-to-school supply drive', 75],
    ['2026-08-08', 'workshop',  'Workshop Attendance',       'Financial wellness workshop', 40],
    ['2026-07-18', 'committee', 'Committee Participation',   'Committee assignment completed', 50],
    ['2026-07-12', 'survey',    'Member Survey',             'Mid-year feedback survey', 20],
    ['2026-06-20', 'service',   'Community Service Project', 'Food pantry volunteer shift', 75],
    ['2026-06-13', 'meeting',   'Chapter Meeting',           'June Chapter Meeting', 50],
    ['2026-06-06', 'bonus',     'Bonus Points',              'Bonus-point opportunity', 50],
    ['2026-05-23', 'program',   'Program Attendance',        'Chapter program', 30],
    ['2026-05-16', 'workshop',  'Workshop Attendance',       'Professional development workshop', 40],
    ['2026-05-09', 'meeting',   'Chapter Meeting',           'May Chapter Meeting', 50],
    ['2026-05-02', 'committee', 'Committee Participation',   'Committee assignment completed', 50],
    ['2026-04-25', 'service',   'Community Service Project', 'Neighborhood mentoring session', 75],
    ['2026-04-11', 'meeting',   'Chapter Meeting',           'April Chapter Meeting', 50],
    ['2026-04-04', 'program',   'Program Attendance',        'Chapter program', 30],
    ['2026-03-30', 'survey',    'Member Survey',             'Chapter programming survey', 20],
    ['2026-03-14', 'meeting',   'Chapter Meeting',           'March Chapter Meeting', 50],
    ['2026-03-07', 'service',   'Community Service Project', 'Spring community clean-up', 75],
    ['2026-02-21', 'committee', 'Committee Participation',   'Committee assignment completed', 50],
    ['2026-02-14', 'meeting',   'Chapter Meeting',           'February Chapter Meeting', 50]
  ];

  const sampleMembers = {
    // enrolled, with a year of history; 1,275 earned in 2026 after 1,750 earned and redeemed in 2025
    active: {
      id: 'sample-active',
      firstName: 'Avery',
      enrolled: true,
      balance: 1275,
      lifetimeEarned: 3025,
      ledger: activityRows.map((r, i) => ({ id: 'a' + i, date: r[0], type: r[1], title: r[2], detail: r[3], points: r[4] })),
      redemptions: [
        { id: 'r2', rewardName: 'Chapter Merchandise', points: 750,  date: '2025-12-06', status: 'Redeemed' },
        { id: 'r1', rewardName: '$25 Gift Card',       points: 1000, date: '2025-10-18', status: 'Redeemed' }
      ]
    },
    // just joined: empty account
    new: {
      id: 'sample-new',
      firstName: 'Avery',
      enrolled: true,
      balance: 0,
      lifetimeEarned: 0,
      ledger: [],
      redemptions: []
    },
    // has not joined yet
    guest: {
      id: 'sample-guest',
      firstName: 'Avery',
      enrolled: false,
      balance: 0,
      lifetimeEarned: 0,
      ledger: [],
      redemptions: []
    }
  };

  const clone = o => JSON.parse(JSON.stringify(o));
  const memberCache = {};

  window.RcoRewardsSource = {
    loadProgram() {
      return Promise.resolve(clone(program));
    },
    loadMember(key) {
      if (!memberCache[key]) memberCache[key] = clone(sampleMembers[key] || sampleMembers.guest);
      return Promise.resolve(memberCache[key]);
    },
    enroll() {
      memberCache.new = clone(sampleMembers.new);
      return Promise.resolve(memberCache.new);
    },
    redeem(key, rewardId) {
      const member = memberCache[key];
      const reward = program.rewards.find(r => r.id === rewardId && r.active);
      if (!member || !reward) return Promise.reject(new Error('That reward is not available.'));
      if (member.balance < reward.cost) return Promise.reject(new Error('Not enough points for this reward.'));
      if (reward.inventory !== null && reward.inventory <= 0) return Promise.reject(new Error('This reward is out of stock.'));
      member.balance -= reward.cost;
      if (reward.inventory !== null) reward.inventory -= 1;
      member.redemptions.unshift({
        id: 'r' + Date.now(),
        rewardName: reward.name,
        points: reward.cost,
        date: new Date().toISOString().slice(0, 10),
        status: 'Pending approval'
      });
      return Promise.resolve({ member, reward });
    }
  };
})();
