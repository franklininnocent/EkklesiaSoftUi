import { FamilyMember } from '@core/models/family.model';
export type HierarchyGroupKey =
  | 'head'
  | 'spouse'
  | 'children'
  | 'parents'
  | 'grandparents'
  | 'relatives';

export type NavigatorFilterKey = 'active' | 'incomplete';

export interface NavMemberViewModel {
  member: FamilyMember;
  memberIndex: number;
  displayName: string;
  relationshipLabel: string;
  relationshipBadgeClass: string;
  membershipStatusLabel: string;
  membershipStatusClass: string;
  isHead: boolean;
  avatarUrl: string | null;
  avatarInitial: string;
  hasMissingInfo: boolean;
}

export interface HierarchyGroupViewModel {
  key: HierarchyGroupKey;
  label: string;
  members: NavMemberViewModel[];
  defaultExpanded: boolean;
}

export interface FamilySummaryViewModel {
  familyName: string;
  familyCode: string;
  familyStatus: string;
  parishName: string;
  memberCount: number;
  familyAddress: string | null;
  bccName: string;
  bccCode: string | null;
}

export type NavRowType = 'group-header' | 'member';

export interface NavGroupHeaderRow {
  type: 'group-header';
  groupKey: HierarchyGroupKey;
  label: string;
  memberCount: number;
  expanded: boolean;
}

export interface NavMemberRow {
  type: 'member';
  vm: NavMemberViewModel;
}

export type NavFlatRow = NavGroupHeaderRow | NavMemberRow;
