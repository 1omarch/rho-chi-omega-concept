// Resources — content mirrors the live portal's inventory. An item with a url opens that file directly;
// an item without one opens the protected chapter portal instead (used for anything with member addresses,
// contact lists, audit/financial reports, or live spreadsheets).
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
      { find: 'Graphics/Flyer Request Form', url: 'https://docs.google.com/forms/d/e/1FAIpQLSfIcwbOUnZbL2HMbNlZHbbIRuNSLc1SjxRBXnyz0KshP8LfLg/viewform', title: 'Graphics / Flyer Request Form', kind: 'Form' },
      { find: 'Event/Meeting Request Form', url: 'https://docs.google.com/forms/d/e/1FAIpQLSfkUceTg6_DHebOCNSY-Bt1XGboP-IBamiLCDxYuXyxmM2zEg/viewform', title: 'Event / Meeting Request Form', kind: 'Form' },
      { url: 'https://docs.google.com/forms/d/e/1FAIpQLSdueZR0266o7TF3DUlvIuBfHa9SwnTi0aB_RKRTh4rmpbngfA/viewform', title: 'Evaluation Survey Request Form', kind: 'Form' },
      { url: 'https://4fd973a7-fc30-495e-b4e3-e934741a51fe.filesusr.com/ugd/58ddb8_70a9d150d96146eab910dbc5588cef64.doc?dn=newsletter%20format.doc', title: 'Newsletter Form', kind: 'Form' },
      { url: 'https://docs.google.com/forms/d/e/1FAIpQLScKdd5rLNz-uMIdZqteZNSgloSsMNLHBlCyH3Lv9pWTwAll0A/viewform', title: 'Calhoun Room Request', kind: 'Form' }
    ]},
    { label: 'Money', items: [
      { find: 'Voucher - Google Form', url: 'https://docs.google.com/forms/d/e/1FAIpQLSfexqB2lcQm63g_BEEk_YMKqDiJek1RMEJ76pc-UlwF4FmPiA/viewform', title: 'Voucher (Google Form with electronic approval)', kind: 'Form' },
      { url: 'https://4fd973a7-fc30-495e-b4e3-e934741a51fe.filesusr.com/ugd/64b0cb_c05ea0c40ec64dd2b6ff7f30ba82d50e.xlsx?dn=Rho%20Chi%20Omega%20Voucher%20May19.xlsx', title: 'Voucher (Excel)', kind: 'Form' },
      { url: 'https://4fd973a7-fc30-495e-b4e3-e934741a51fe.filesusr.com/ugd/64b0cb_f306ae72199a47cd90422c9fa624bafe.pdf', title: 'Voucher (PDF)', kind: 'Form' },
      { url: 'https://4fd973a7-fc30-495e-b4e3-e934741a51fe.filesusr.com/ugd/64b0cb_6d67ad541f3b43548f5e77d1c81648fc.docx?dn=Budget%20expenses%20form.docx', title: 'Budget Expense Log', kind: 'Form' }
    ]},
    { label: 'Reports & records', items: [
      { url: 'https://docs.google.com/forms/d/e/1FAIpQLScVeli3j42wQQ155DmPhme4XEANYudPjIvAFD49xVzwufDG8A/viewform', title: '2024 Event Report Google Form', kind: 'Form' },
      { find: '2023Event Report', url: 'https://docs.google.com/forms/d/e/1FAIpQLSc5GnGENQD_V02V6ajOY9z0dR1JIxU2DfTwGkJp4cCo_mGBCw/viewform', title: '2023 Event Report Google Form', kind: 'Form' },
      { url: 'https://4fd973a7-fc30-495e-b4e3-e934741a51fe.filesusr.com/ugd/58ddb8_2bf673e86dd847919974914252bf4e99.doc?dn=Committee%20Meeting%20Report%20form.doc', title: 'Committee Meeting Report Form', kind: 'Form' },
      { find: 'Sign in Sheet', url: 'https://docs.google.com/document/d/18POc0awsQ_2-sqzL4mN29hwGdJyo59ga/copy', title: 'Sign-In Sheet', kind: 'Form' },
      { url: 'https://4fd973a7-fc30-495e-b4e3-e934741a51fe.filesusr.com/ugd/58ddb8_61259058c8b449fa8c7988b514ffe81c.docx?dn=27%20Jan%2021%20Rho%20Chi%20Omega%20Incident%20Form.docx', title: 'Incident Response Form', kind: 'Form' }
    ]},
    { label: 'Running for office', items: [
      { url: 'https://4fd973a7-fc30-495e-b4e3-e934741a51fe.filesusr.com/ugd/64b0cb_2d54e8e0922944ef91a4e72a37712e1b.pdf', title: 'Application Profile for Seeking Office', kind: 'Form' },
      { url: 'https://4fd973a7-fc30-495e-b4e3-e934741a51fe.filesusr.com/ugd/58ddb8_d8c8c6a3a64a41f2ae36076d24673d0e.pdf', title: 'Financial Officer Candidate Disclosure Form', kind: 'Form' },
      { find: 'Member-At-Large Submission Form', url: 'https://4fd973a7-fc30-495e-b4e3-e934741a51fe.filesusr.com/ugd/58ddb8_d27a76eccde942b4961a150362139271.pdf', title: 'Member-at-Large Submission Form', kind: 'Form' }
    ]},
    { label: 'Chapter business', items: [
      { url: 'https://4fd973a7-fc30-495e-b4e3-e934741a51fe.filesusr.com/ugd/64b0cb_1c572b577c9344d89fffdb56a7b03ca5.pdf', title: 'Proposed Bylaws Amendment Form', kind: 'Form' },
      { url: 'https://4fd973a7-fc30-495e-b4e3-e934741a51fe.filesusr.com/ugd/64b0cb_aa9edebaeeca4629bf890277985fcf50.pdf', title: 'Proposed Standing Rules Form', kind: 'Form' },
      { url: 'https://4fd973a7-fc30-495e-b4e3-e934741a51fe.filesusr.com/ugd/52a162_ed2209c1a314404fb1f86d64683b0751.pdf', title: 'Formal Application for Retired Sorors', kind: 'Form' }
    ]},
    { label: 'About you', items: [
      { url: 'https://docs.google.com/forms/d/e/1FAIpQLSdP4tWQEcQTkChNg35cWIp5RbzPyjrGngRllhf303CFv70dzw/viewform', title: 'Soror Contact Form', kind: 'Form' },
      { find: 'Soror Owned Business Input Form', url: 'https://docs.google.com/forms/d/e/1FAIpQLSdtno4tKaMz7DNXk93nfKT7sPv4nAP2nN_sQ4HHXBzcEqylmA/viewform', title: 'Soror-Owned Business Input Form', kind: 'Form' },
      { url: 'https://docs.google.com/forms/d/e/1FAIpQLSe4EpDdIelJ-n9koaRPGQQJ5sb3JErOH2PSb7cCZ_pZiP6gSg/viewform', title: 'Soror Squad Sign Up', kind: 'Form' }
    ]}
  ],

  governing: [
    { label: 'Bylaws, rules & plans', items: [
      { url: 'https://4fd973a7-fc30-495e-b4e3-e934741a51fe.filesusr.com/ugd/52a162_9dd33f7a44f440149f97c3784a6e5e5d.pdf', title: 'Chapter Bylaws', note: 'Approved 11/10/2025', kind: 'Document' },
      { url: 'https://4fd973a7-fc30-495e-b4e3-e934741a51fe.filesusr.com/ugd/52a162_37b28fb7575a440e95378977a8382d3f.pdf', title: 'Standing Rules', note: 'Approved 04/11/2026', kind: 'Document' },
      { url: 'https://4fd973a7-fc30-495e-b4e3-e934741a51fe.filesusr.com/ugd/64b0cb_7c1b62186cc14a53a824812483bc04f1.pdf', title: 'Strategic Plan', note: 'Approved 03/08/2021', kind: 'Document' },
      { url: 'https://4fd973a7-fc30-495e-b4e3-e934741a51fe.filesusr.com/ugd/58ddb8_638190f2419f455ca70644c95ae304b6.pdf', title: 'Risk Management Plan', note: 'Approved 03/14/2022', kind: 'Document' },
      { find: 'Chapter Disaster and Recovery Plan', url: 'https://4fd973a7-fc30-495e-b4e3-e934741a51fe.filesusr.com/ugd/64b0cb_df63d2126a4f4d86aa530480d722b9c4.pdf', title: 'Chapter Disaster & Recovery Plan', kind: 'Document' },
      { find: 'Chapter and Foundation Memorandum', url: 'https://4fd973a7-fc30-495e-b4e3-e934741a51fe.filesusr.com/ugd/52a162_8e796c6169d746aca1a16a3bfd09bafc.pdf', title: 'Chapter & Foundation Memorandum of Understanding', note: 'Approved 02/09/2026', kind: 'Document' }
    ]},
    { label: 'Standards', items: [
      { title: 'Process and Results', kind: 'Document' },
      { find: 'Transition Document PDF', url: 'https://4fd973a7-fc30-495e-b4e3-e934741a51fe.filesusr.com/ugd/58ddb8_57e0bea1d39e4cb190fa9f7f92663228.pdf', title: 'Transition Document', kind: 'Document' }
    ]}
  ],

  more: [
    { label: 'Chapter resources', items: [
      { title: 'Charter Member Directory', kind: 'Resource' },
      { title: 'Chapter Handbook', kind: 'Resource' },
      { url: 'https://4fd973a7-fc30-495e-b4e3-e934741a51fe.filesusr.com/ugd/58ddb8_7b01918c989945a089b1deb175e9e598.pdf', title: 'Committee Chairman Toolkit', kind: 'Resource' },
      { title: 'End of the Year Reports', kind: 'Resource' },
      { title: 'AKA Conference Delegate Reports', kind: 'Resource' },
      { url: 'https://www.aka-rco.org/workshop-presentations', title: 'Workshop Presentations', kind: 'Resource' },
      { url: 'https://www.aka-rco.org/reflections', title: 'Reflections Newsletters', kind: 'Resource' },
      { title: 'External Audit Reports', kind: 'Resource' },
      { url: 'https://photos.app.goo.gl/ZgQuP3Z3o4uhJjRC7', title: 'Virtual Backgrounds', kind: 'Resource' },
      { url: 'https://www.dropbox.com/sh/w8ehkctd1rjz2th/AACDRJU37VHQULEwN4PblZVGa?dl=0', title: 'Logos', kind: 'Resource' },
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
      { find: 'Pinky Trademark', url: 'https://4fd973a7-fc30-495e-b4e3-e934741a51fe.filesusr.com/ugd/64b0cb_c380453d379e49718b54e25b1a4c8347.pdf', title: 'Pinky Trademark Guidance', kind: 'Resource' },
      { url: 'https://4fd973a7-fc30-495e-b4e3-e934741a51fe.filesusr.com/ugd/64b0cb_ad87911565314845bc17b8b1a4c8ce1c.pdf', title: 'Insurance Form', kind: 'Form' },
      { url: 'https://akawebnet.aka1908.net/eWeb/DynamicPage.aspx?webcode=akauniversitytracks&Site=AKA', title: 'AKA University Presentations', kind: 'Resource' },
      { url: 'https://4fd973a7-fc30-495e-b4e3-e934741a51fe.filesusr.com/ugd/54fcf8_5ac289455d1e48018f08f77f8b64aeda.pdf', title: 'AKA Branding Guidance', kind: 'Resource' },
      { url: 'https://4fd973a7-fc30-495e-b4e3-e934741a51fe.filesusr.com/ugd/52a162_b569f4b80b7643d89bb8248db9e7b940.pdf', title: 'Membership Experience Requirements', kind: 'Resource' }
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
