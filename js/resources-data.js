// Resources — content mirrors the live portal's inventory.
window.RCO_RESOURCES = {
  // links open the live chapter portal (login-protected), scrolled to and highlighting the item
  portal: {
    docs: 'https://www.aka-rco.org/documents-and-forms',
    finance: 'https://www.aka-rco.org/financialdocuments',
    dues: 'https://www.aka-rco.org/membership-dues'
  },
  thisYear: [
    { title: 'Chapter Meeting Presentations', kind: 'Resource' },
    { find: '2026 Officers', title: '2026 Officers & 2026-27 Committee Chairman', kind: 'Resource' },
    { find: 'Committee SignUp Form', title: 'Committee Sign-Up Form', kind: 'Form' },
    { title: '2026 Awards Committee', kind: 'Resource' }
  ],

  forms: [
    { label: 'Request something', items: [
      { find: 'Graphics/Flyer Request Form', title: 'Graphics / Flyer Request Form', kind: 'Form' },
      { find: 'Event/Meeting Request Form', title: 'Event / Meeting Request Form', kind: 'Form' },
      { title: 'Evaluation Survey Request Form', kind: 'Form' },
      { title: 'Newsletter Form', kind: 'Form' },
      { title: 'Calhoun Room Request', kind: 'Form' }
    ]},
    { label: 'Money', items: [
      { find: 'Voucher - Google Form', title: 'Voucher (Google Form with electronic approval, Excel, or PDF)', kind: 'Form' },
      { title: 'Budget Expense Log', kind: 'Form' }
    ]},
    { label: 'Reports & records', items: [
      { title: '2024 Event Report Google Form', kind: 'Form' },
      { find: '2023Event Report', title: '2023 Event Report Google Form', kind: 'Form' },
      { title: 'Committee Meeting Report Form', kind: 'Form' },
      { find: 'Sign in Sheet', title: 'Sign-In Sheet', kind: 'Form' },
      { title: 'Incident Response Form', kind: 'Form' }
    ]},
    { label: 'Running for office', items: [
      { title: 'Application Profile for Seeking Office', kind: 'Form' },
      { title: 'Financial Officer Candidate Disclosure Form', kind: 'Form' },
      { find: 'Member-At-Large Submission Form', title: 'Member-at-Large Submission Form', kind: 'Form' }
    ]},
    { label: 'Chapter business', items: [
      { title: 'Proposed Bylaws Amendment Form', kind: 'Form' },
      { title: 'Proposed Standing Rules Form', kind: 'Form' },
      { title: 'Formal Application for Retired Sorors', kind: 'Form' }
    ]},
    { label: 'About you', items: [
      { title: 'Soror Contact Form', kind: 'Form' },
      { find: 'Soror Owned Business Input Form', title: 'Soror-Owned Business Input Form', kind: 'Form' },
      { title: 'Soror Squad Sign Up', kind: 'Form' }
    ]}
  ],

  governing: [
    { label: 'Bylaws, rules & plans', items: [
      { title: 'Chapter Bylaws', note: 'Approved 11/10/2025', kind: 'Document' },
      { title: 'Standing Rules', note: 'Approved 04/11/2026', kind: 'Document' },
      { title: 'Strategic Plan', note: 'Approved 03/08/2021', kind: 'Document' },
      { title: 'Risk Management Plan', note: 'Approved 03/14/2022', kind: 'Document' },
      { find: 'Chapter Disaster and Recovery Plan', title: 'Chapter Disaster & Recovery Plan', kind: 'Document' },
      { find: 'Chapter and Foundation Memorandum', title: 'Chapter & Foundation Memorandum of Understanding', note: 'Approved 02/09/2026', kind: 'Document' }
    ]},
    { label: 'Standards & transitions', items: [
      { title: 'Standards', kind: 'Document' },
      { title: 'Process and Results', kind: 'Document' },
      { find: 'Transition Document PDF', title: 'Transition Document', kind: 'Document' }
    ]}
  ],

  more: [
    { label: 'Chapter resources', items: [
      { title: 'Charter Member Directory', kind: 'Resource' },
      { title: 'Chapter Handbook', kind: 'Resource' },
      { title: 'Committee Chairman Toolkit', kind: 'Resource' },
      { title: 'End of the Year Reports', kind: 'Resource' },
      { title: 'AKA Conference Delegate Reports', kind: 'Resource' },
      { title: 'Workshop Presentations', kind: 'Resource' },
      { title: 'Reflections Newsletters', kind: 'Resource' },
      { title: 'External Audit Reports', kind: 'Resource' },
      { title: 'Virtual Backgrounds', kind: 'Resource' },
      { title: 'Logos', kind: 'Resource' },
      { title: 'Chapter Cookbook', kind: 'Resource' },
      { title: 'NPHC Addresses', kind: 'Resource' }
    ]},
    { label: 'Committee resources (live data)', items: [
      { title: 'Completed Event Report Spreadsheet', kind: 'Sheet' },
      { title: 'Contact Information Spreadsheet', kind: 'Sheet' },
      { title: '2026 Committee Sign Up Spreadsheet', kind: 'Sheet' },
      { title: '2026-2030 Program Initiatives Sign Up Spreadsheet', kind: 'Sheet' },
      { title: 'Soror Squad Sign Up', kind: 'Sheet' },
      { find: 'Soror Owned Business Spreadsheet', title: 'Soror-Owned Business Spreadsheet', kind: 'Sheet' }
    ]},
    { label: 'Corporate Office resources', items: [
      { find: 'Pinky Trademark', title: 'Pinky Trademark Guidance', kind: 'Resource' },
      { title: 'Insurance Form', kind: 'Form' },
      { title: 'AKA University Presentations', kind: 'Resource' },
      { title: 'AKA Branding Guidance', kind: 'Resource' },
      { title: 'Membership Experience Requirements', kind: 'Resource' }
    ]}
  ],

  finance: {
    budgets: [
      { page: 'finance', find: 'Approved 2026 Operations and Fundraiser Budgets', title: 'Approved 2026 Operations & Fundraiser Budgets', kind: 'Budget' },
      { page: 'finance', find: 'Approved 2025 Operations and Fundraiser Budgets', title: 'Approved 2025 Operations & Fundraiser Budgets', kind: 'Budget' },
      { page: 'finance', find: 'Approved 2024 Operations and Fundraiser Budgets', title: 'Approved 2024 Operations & Fundraiser Budgets', kind: 'Budget' }
    ],
    // preparedBy mirrors how the chapter files each report today
    reportTypes: [
      { id: 'pg-summary', find: 'PG Summary',    label: 'PG Summary',                     preparedBy: 'Pecunious Grammateus', funds: ['Operations & Fundraisers'] },
      { id: 'cash-receipts', find: 'Cash Receipts', label: 'Cash Receipts Report & Journal', preparedBy: 'Pecunious Grammateus', funds: ['Operations', 'Fundraisers'] },
      { id: 'transmittal', find: 'Transmittal',   label: 'Transmittal Reports',            preparedBy: 'Pecunious Grammateus', funds: ['Operations', 'Fundraisers'] },
      { id: 'balance', find: 'Balance Sheet',       label: 'Balance Sheet',                  preparedBy: 'Tamiouchos',           funds: ['All Accounts'] },
      { id: 'disbursement', find: 'Cash Disbursement',  label: 'Cash Disbursement',              preparedBy: 'Tamiouchos',           funds: ['Operations', 'Fundraisers'] },
      { id: 'budget-actual', find: 'Budget to Actual', label: 'Budget to Actual',               preparedBy: 'Tamiouchos',           funds: ['Operations', 'Fundraisers'] },
      { id: 'reconciliation', find: 'Reconciliation',label: 'Reconciliation',                 preparedBy: 'Tamiouchos',           funds: ['Operations', 'Fundraisers', 'Savings'] }
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
