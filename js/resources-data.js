// Resources — content mirrors the live portal's inventory. href "#" marks a link still to be connected.
window.RCO_RESOURCES = {
  thisYear: [
    { title: 'Chapter Meeting Presentations', kind: 'Resource', href: '#' },
    { title: '2026 Officers & 2026-27 Committee Chairman', kind: 'Resource', href: '#' },
    { title: 'Committee Sign-Up Form', kind: 'Form', href: '#' },
    { title: '2026 Awards Committee', kind: 'Resource', href: '#' }
  ],

  forms: [
    { label: 'Request something', items: [
      { title: 'Graphics / Flyer Request Form', kind: 'Form', href: '#' },
      { title: 'Event / Meeting Request Form', kind: 'Form', href: '#' },
      { title: 'Evaluation Survey Request Form', kind: 'Form', href: '#' },
      { title: 'Newsletter Form', kind: 'Form', href: '#' },
      { title: 'Calhoun Room Request', kind: 'Form', href: '#' }
    ]},
    { label: 'Money', items: [
      { title: 'Voucher (Google Form with electronic approval, Excel, or PDF)', kind: 'Form', href: '#' },
      { title: 'Budget Expense Log', kind: 'Form', href: '#' }
    ]},
    { label: 'Reports & records', items: [
      { title: '2024 Event Report Google Form', kind: 'Form', href: '#' },
      { title: '2023 Event Report Google Form', kind: 'Form', href: '#' },
      { title: 'Committee Meeting Report Form', kind: 'Form', href: '#' },
      { title: 'Sign-In Sheet', kind: 'Form', href: '#' },
      { title: 'Incident Response Form', kind: 'Form', href: '#' }
    ]},
    { label: 'Running for office', items: [
      { title: 'Application Profile for Seeking Office', kind: 'Form', href: '#' },
      { title: 'Financial Officer Candidate Disclosure Form', kind: 'Form', href: '#' },
      { title: 'Member-at-Large Submission Form', kind: 'Form', href: '#' }
    ]},
    { label: 'Chapter business', items: [
      { title: 'Proposed Bylaws Amendment Form', kind: 'Form', href: '#' },
      { title: 'Proposed Standing Rules Form', kind: 'Form', href: '#' },
      { title: 'Formal Application for Retired Sorors', kind: 'Form', href: '#' }
    ]},
    { label: 'About you', items: [
      { title: 'Soror Contact Form', kind: 'Form', href: '#' },
      { title: 'Soror-Owned Business Input Form', kind: 'Form', href: '#' },
      { title: 'Soror Squad Sign Up', kind: 'Form', href: '#' }
    ]}
  ],

  governing: [
    { label: 'Bylaws, rules & plans', items: [
      { title: 'Chapter Bylaws', note: 'Approved 11/10/2025', kind: 'Document', href: '#' },
      { title: 'Standing Rules', note: 'Approved 04/11/2026', kind: 'Document', href: '#' },
      { title: 'Strategic Plan', note: 'Approved 03/08/2021', kind: 'Document', href: '#' },
      { title: 'Risk Management Plan', note: 'Approved 03/14/2022', kind: 'Document', href: '#' },
      { title: 'Chapter Disaster & Recovery Plan', kind: 'Document', href: '#' },
      { title: 'Chapter & Foundation Memorandum of Understanding', note: 'Approved 02/09/2026', kind: 'Document', href: '#' }
    ]},
    { label: 'Standards & transitions', items: [
      { title: 'Standards', kind: 'Document', href: '#' },
      { title: 'Process and Results', kind: 'Document', href: '#' },
      { title: 'Transition Document', kind: 'Document', href: '#' }
    ]}
  ],

  more: [
    { label: 'Chapter resources', items: [
      { title: 'Charter Member Directory', kind: 'Resource', href: '#' },
      { title: 'Chapter Handbook', kind: 'Resource', href: '#' },
      { title: 'Committee Chairman Toolkit', kind: 'Resource', href: '#' },
      { title: 'End of the Year Reports', kind: 'Resource', href: '#' },
      { title: 'AKA Conference Delegate Reports', kind: 'Resource', href: '#' },
      { title: 'Workshop Presentations', kind: 'Resource', href: '#' },
      { title: 'Reflections Newsletters', kind: 'Resource', href: '#' },
      { title: 'External Audit Reports', kind: 'Resource', href: '#' },
      { title: 'Virtual Backgrounds', kind: 'Resource', href: '#' },
      { title: 'Logos', kind: 'Resource', href: '#' },
      { title: 'Chapter Cookbook', kind: 'Resource', href: '#' },
      { title: 'NPHC Addresses', kind: 'Resource', href: '#' }
    ]},
    { label: 'Committee resources (live data)', items: [
      { title: 'Completed Event Report Spreadsheet', kind: 'Sheet', href: '#' },
      { title: 'Contact Information Spreadsheet', kind: 'Sheet', href: '#' },
      { title: '2026 Committee Sign Up Spreadsheet', kind: 'Sheet', href: '#' },
      { title: '2026-2030 Program Initiatives Sign Up Spreadsheet', kind: 'Sheet', href: '#' },
      { title: 'Soror Squad Sign Up', kind: 'Sheet', href: '#' },
      { title: 'Soror-Owned Business Spreadsheet', kind: 'Sheet', href: '#' }
    ]},
    { label: 'Corporate Office resources', items: [
      { title: 'Pinky Trademark Guidance', kind: 'Resource', href: '#' },
      { title: 'Insurance Form', kind: 'Form', href: '#' },
      { title: 'AKA University Presentations', kind: 'Resource', href: '#' },
      { title: 'AKA Branding Guidance', kind: 'Resource', href: '#' },
      { title: 'Membership Experience Requirements', kind: 'Resource', href: '#' }
    ]}
  ],

  finance: {
    budgets: [
      { title: 'Approved 2026 Operations & Fundraiser Budgets', kind: 'Budget', href: '#' },
      { title: 'Approved 2025 Operations & Fundraiser Budgets', kind: 'Budget', href: '#' },
      { title: 'Approved 2024 Operations & Fundraiser Budgets', kind: 'Budget', href: '#' }
    ],
    // preparedBy mirrors how the chapter files each report today
    reportTypes: [
      { id: 'pg-summary',    label: 'PG Summary',                     preparedBy: 'Pecunious Grammateus', funds: ['Operations & Fundraisers'] },
      { id: 'cash-receipts', label: 'Cash Receipts Report & Journal', preparedBy: 'Pecunious Grammateus', funds: ['Operations', 'Fundraisers'] },
      { id: 'transmittal',   label: 'Transmittal Reports',            preparedBy: 'Pecunious Grammateus', funds: ['Operations', 'Fundraisers'] },
      { id: 'balance',       label: 'Balance Sheet',                  preparedBy: 'Tamiouchos',           funds: ['All Accounts'] },
      { id: 'disbursement',  label: 'Cash Disbursement',              preparedBy: 'Tamiouchos',           funds: ['Operations', 'Fundraisers'] },
      { id: 'budget-actual', label: 'Budget to Actual',               preparedBy: 'Tamiouchos',           funds: ['Operations', 'Fundraisers'] },
      { id: 'reconciliation',label: 'Reconciliation',                 preparedBy: 'Tamiouchos',           funds: ['Operations', 'Fundraisers', 'Savings'] }
    ],
    firstYear: 2015,
    latestShortcuts: ['pg-summary', 'balance', 'budget-actual']
  },

  dues: {
    memberTypes: ['Regular', 'Retired', 'Regular Life', 'Retired Life', 'Reactivated / Transfer'],
    // 1 = an amount applies (shown masked on this public preview), 0 = not applicable
    rows: [
      ['Local Dues', 1, 1, 1, 1, 1],
      ['AKA Assessment', 1, 1, 1, 1, 0],
      ['P2K Foundation Dues', 1, 1, 1, 1, 1],
      ['Per Capita', 1, 1, 0, 0, 0],
      ['EAF', 1, 1, 1, 1, 1],
      ['Documents', 1, 0, 0, 0, 1],
      ['Total', 1, 1, 1, 1, 1]
    ]
  }
};
