export interface LeadershipRoleOption {
  value: string;
  label: string;
  description: string;
  icon: string;
  category: LeadershipRoleCategoryId;
}

export type LeadershipRoleCategoryId = 'clergy' | 'administration' | 'finance' | 'ministries' | 'family';

export interface LeadershipRoleCategory {
  id: LeadershipRoleCategoryId;
  label: string;
}

export interface LeadershipTitleOption {
  value: string;
  label: string;
}

export interface LeadershipStatusOption {
  id: string;
  label: string;
  description: string;
  active: number;
  tone: 'success' | 'warning' | 'neutral' | 'info' | 'muted';
}

export const LEADERSHIP_ROLE_CATEGORIES: LeadershipRoleCategory[] = [
  { id: 'clergy', label: 'Clergy' },
  { id: 'administration', label: 'Administration' },
  { id: 'finance', label: 'Finance' },
  { id: 'ministries', label: 'Ministries' },
  { id: 'family', label: 'Family Ministry' }
];

export const LEADERSHIP_ROLE_OPTIONS: LeadershipRoleOption[] = [
  { value: 'Parish Priest', label: 'Parish Priest', description: 'Primary pastoral administrator', icon: '✝', category: 'clergy' },
  { value: 'Assistant Priest', label: 'Assistant Priest', description: 'Supporting parish ministry', icon: '🕊', category: 'clergy' },
  { value: 'Secretary', label: 'Secretary', description: 'Parish administration and records', icon: '📋', category: 'administration' },
  { value: 'Trustee', label: 'Trustee', description: 'Governance and parish trust', icon: '🏛', category: 'administration' },
  { value: 'Finance Committee', label: 'Finance Committee', description: 'Stewardship and finances', icon: '₹', category: 'finance' },
  { value: 'Catechism Head', label: 'Catechism Head', description: 'Faith formation leadership', icon: '📖', category: 'ministries' },
  { value: 'Youth Coordinator', label: 'Youth Coordinator', description: 'Youth ministry programs', icon: '🌱', category: 'ministries' },
  { value: 'Worship Leader', label: 'Worship Leader', description: 'Liturgy and worship', icon: '🎵', category: 'ministries' },
  { value: 'Ministry Leader', label: 'Ministry Leader', description: 'Specialized ministry head', icon: '◆', category: 'ministries' },
  { value: 'Family Unit Coordinator', label: 'Family Unit Coordinator', description: 'Family and BCC coordination', icon: '⌂', category: 'family' }
];

export function findLeadershipRole(value?: string | null): LeadershipRoleOption | undefined {
  if (!value) {
    return undefined;
  }
  return LEADERSHIP_ROLE_OPTIONS.find((role) => role.value === value);
}

export const LEADERSHIP_TITLE_OPTIONS: LeadershipTitleOption[] = [
  { value: 'Rev. Fr.', label: 'Rev. Fr.' },
  { value: 'Rev.', label: 'Rev.' },
  { value: 'Mr.', label: 'Mr.' },
  { value: 'Mrs.', label: 'Mrs.' },
  { value: 'Dr.', label: 'Dr.' },
  { value: 'Bro.', label: 'Bro.' },
  { value: 'Sr.', label: 'Sr.' }
];

export const LEADERSHIP_STATUS_OPTIONS: LeadershipStatusOption[] = [
  { id: 'active', label: 'Active', description: 'Currently serving in this role', active: 1, tone: 'success' },
  { id: 'on_leave', label: 'On Leave', description: 'Temporarily away from duties', active: 1, tone: 'warning' },
  { id: 'transferred', label: 'Transferred', description: 'Moved to another assignment', active: 0, tone: 'info' },
  { id: 'retired', label: 'Retired', description: 'Completed formal service', active: 0, tone: 'neutral' },
  { id: 'former', label: 'Former Leader', description: 'No longer in this position', active: 0, tone: 'muted' }
];
