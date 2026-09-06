export type StewardshipWorkspaceId = 'leadership' | 'collect' | 'families' | 'projects' | 'configure';

export interface StewardshipNavLink {
  path: string;
  label: string;
  exact?: boolean;
  description?: string;
}

export interface StewardshipWorkspace {
  id: StewardshipWorkspaceId;
  label: string;
  hint: string;
  links: StewardshipNavLink[];
}

export const STEWARDSHIP_WORKSPACES: StewardshipWorkspace[] = [
  {
    id: 'leadership',
    label: 'Leadership',
    hint: 'Health & decisions',
    links: [
      { path: '/donations', label: 'Dashboard', exact: true, description: 'Financial Operations Center' },
      { path: '/donations/collection-health', label: 'Collection Health', description: 'Score breakdown and issues' },
      { path: '/donations/expenses', label: 'Disbursements', description: 'Parish expense register' },
      { path: '/donations/reports', label: 'Reports', description: 'Exports and leadership reports' },
      { path: '/donations/notifications', label: 'Notifications', description: 'Outreach and reminders' }
    ]
  },
  {
    id: 'collect',
    label: 'Collect',
    hint: 'Payments & receipts',
    links: [
      { path: '/donations/collection-day', label: 'Collection Day', description: 'Live collection workspace' },
      { path: '/donations/payments', label: 'Payment Register', description: 'All recorded payments' },
      { path: '/donations/register', label: "Today's Register", description: 'Today’s collection log' },
      { path: '/donations/receipts', label: 'Receipts', description: 'Receipt hub and printing' }
    ]
  },
  {
    id: 'families',
    label: 'Families',
    hint: 'Outstanding & directory',
    links: [
      { path: '/families', label: 'Family Directory', description: 'Browse parish families' },
      { path: '/donations/dues', label: 'Outstanding Contributions', description: 'Overdue and open balances' },
      { path: '/donations/donors', label: 'Donors', description: 'Contributor directory' }
    ]
  },
  {
    id: 'projects',
    label: 'Projects',
    hint: 'Funding progress',
    links: [
      { path: '/donations/projects', label: 'Projects', description: 'Active funding campaigns' },
      { path: '/donations/campaigns', label: 'Campaigns', description: 'Special appeals' },
      { path: '/donations/project-installments', label: 'Installments', description: 'Project installment tracking' }
    ]
  },
  {
    id: 'configure',
    label: 'Configure',
    hint: 'Plans & settings',
    links: [
      { path: '/donations/plans', label: 'Contribution Plans', description: 'Mandatory and voluntary plans' },
      { path: '/donations/categories', label: 'Categories', description: 'Contribution categories' },
      { path: '/donations/recurring', label: 'Recurring', description: 'Recurring schedules' },
      { path: '/donations/approvals', label: 'Approvals', description: 'Refund and correction approvals' },
      { path: '/donations/history', label: 'History', description: 'Historical transactions' },
      { path: '/donations/settings', label: 'Settings', description: 'Stewardship configuration' }
    ]
  }
];

export function resolveStewardshipWorkspace(path: string): StewardshipWorkspaceId {
  if (matchesAny(path, ['/donations/payments', '/donations/register', '/donations/receipts', '/donations/collection-day'])) {
    return 'collect';
  }
  if (matchesAny(path, ['/donations/dues', '/donations/donors', '/families'])) {
    return 'families';
  }
  if (matchesAny(path, ['/donations/projects', '/donations/campaigns', '/donations/project-installments'])) {
    return 'projects';
  }
  if (matchesAny(path, [
    '/donations/plans',
    '/donations/categories',
    '/donations/recurring',
    '/donations/approvals',
    '/donations/history',
    '/donations/settings'
  ])) {
    return 'configure';
  }
  return 'leadership';
}

function matchesAny(url: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => url === prefix || url.startsWith(`${prefix}/`) || url.startsWith(`${prefix}?`));
}
