import { Family, FamilyMember } from '@core/models/family.model';
import {
  HierarchyGroupKey,
  HierarchyGroupViewModel,
  NavMemberViewModel
} from '../models/family-navigator.model';
import {
  computeMemberProfileCompletion,
  getMemberDisplayName,
  memberHasMissingInfo
} from './profile-completion.util';
import { SacramentTypeLike } from './sacrament-completion.util';

const GROUP_ORDER: { key: HierarchyGroupKey; label: string }[] = [
  { key: 'head', label: 'Family Head' },
  { key: 'spouse', label: 'Spouse' },
  { key: 'children', label: 'Children' },
  { key: 'parents', label: 'Parents' },
  { key: 'grandparents', label: 'Grandparents' },
  { key: 'relatives', label: 'Other Relatives' }
];

const RELATIONSHIP_GROUP_MAP: Record<string, HierarchyGroupKey> = {
  self: 'head',
  head: 'head',
  'head of family': 'head',
  spouse: 'spouse',
  son: 'children',
  daughter: 'children',
  grandson: 'children',
  granddaughter: 'children',
  father: 'parents',
  mother: 'parents',
  grandfather: 'grandparents',
  grandmother: 'grandparents',
  brother: 'relatives',
  sister: 'relatives',
  uncle: 'relatives',
  aunt: 'relatives',
  nephew: 'relatives',
  niece: 'relatives',
  cousin: 'relatives',
  other: 'relatives'
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  self: 'Head of Family',
  head: 'Head of Family',
  spouse: 'Spouse',
  son: 'Son',
  daughter: 'Daughter',
  father: 'Parent',
  mother: 'Parent',
  grandfather: 'Grandparent',
  grandmother: 'Grandparent',
  grandson: 'Grandchild',
  granddaughter: 'Grandchild',
  brother: 'Relative',
  sister: 'Relative',
  uncle: 'Relative',
  aunt: 'Relative',
  nephew: 'Relative',
  niece: 'Relative',
  cousin: 'Relative',
  other: 'Relative'
};

const BADGE_CLASS_MAP: Record<HierarchyGroupKey, string> = {
  head: 'badge-head',
  spouse: 'badge-spouse',
  children: 'badge-child',
  parents: 'badge-parent',
  grandparents: 'badge-grandparent',
  relatives: 'badge-relative'
};

export function getRelationshipGroupKey(
  relationship: string | undefined,
  isHead: boolean
): HierarchyGroupKey {
  if (isHead) {
    return 'head';
  }
  const rel = String(relationship || 'other').toLowerCase().trim();
  return RELATIONSHIP_GROUP_MAP[rel] ?? 'relatives';
}

export function getRelationshipLabel(
  relationship: string | undefined,
  isHead: boolean
): string {
  if (isHead) {
    return 'Head of Family';
  }
  const rel = String(relationship || 'other').toLowerCase().trim();
  return RELATIONSHIP_LABELS[rel] ?? 'Relative';
}

export function getMembershipStatusLabel(status: FamilyMember['status']): string {
  switch (status) {
    case 'migrated':
      return 'Transferred';
    case 'deceased':
      return 'Deceased';
    case 'inactive':
      return 'Inactive';
    case 'active':
    default:
      return 'Active';
  }
}

export function getMembershipStatusClass(status: FamilyMember['status']): string {
  return `status-${status || 'active'}`;
}

export function buildNavMemberViewModel(
  member: FamilyMember,
  memberIndex: number,
  isHead: boolean,
  avatarUrl: string | null,
  sacramentTypes: SacramentTypeLike[]
): NavMemberViewModel {
  const completion = computeMemberProfileCompletion(member, sacramentTypes);
  const displayName = getMemberDisplayName(member);
  const groupKey = getRelationshipGroupKey(member.relationship_to_head, isHead);

  return {
    member,
    memberIndex,
    displayName,
    relationshipLabel: getRelationshipLabel(member.relationship_to_head, isHead),
    relationshipBadgeClass: BADGE_CLASS_MAP[groupKey],
    membershipStatusLabel: getMembershipStatusLabel(member.status),
    membershipStatusClass: getMembershipStatusClass(member.status),
    isHead,
    avatarUrl,
    avatarInitial: (displayName.charAt(0) || 'U').toUpperCase(),
    hasMissingInfo: memberHasMissingInfo(completion)
  };
}

function sortMembers(a: NavMemberViewModel, b: NavMemberViewModel): number {
  const statusOrder = (m: NavMemberViewModel) =>
    m.member.status === 'active' ? 0 : 1;
  const diff = statusOrder(a) - statusOrder(b);
  if (diff !== 0) {
    return diff;
  }
  return a.displayName.localeCompare(b.displayName);
}

export function buildHierarchyGroups(
  family: Family,
  headMemberId: string | null,
  headImageUrl: string | null,
  sacramentTypes: SacramentTypeLike[],
  memberFilter?: (vm: NavMemberViewModel) => boolean
): HierarchyGroupViewModel[] {
  const members = family.members ?? [];
  const totalCount = members.length;
  const collapseRelatives = totalCount > 10;

  const buckets = new Map<HierarchyGroupKey, NavMemberViewModel[]>();
  for (const g of GROUP_ORDER) {
    buckets.set(g.key, []);
  }

  members.forEach((member, memberIndex) => {
    const isHead = !!headMemberId && member.id === headMemberId;
    const vm = buildNavMemberViewModel(
      member,
      memberIndex,
      isHead,
      isHead ? headImageUrl : null,
      sacramentTypes
    );
    if (memberFilter && !memberFilter(vm)) {
      return;
    }
    const groupKey = getRelationshipGroupKey(member.relationship_to_head, isHead);
    buckets.get(groupKey)!.push(vm);
  });

  return GROUP_ORDER.map(({ key, label }) => {
    const groupMembers = (buckets.get(key) ?? []).sort(sortMembers);
    let defaultExpanded = true;
    if (key === 'relatives' && collapseRelatives) {
      defaultExpanded = false;
    }
    if (totalCount > 10 && key === 'grandparents') {
      defaultExpanded = false;
    }
    return {
      key,
      label,
      members: groupMembers,
      defaultExpanded
    };
  }).filter((g) => g.members.length > 0);
}

export function matchesMemberSearch(
  vm: NavMemberViewModel,
  query: string,
  familyCode: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  return (
    vm.displayName.toLowerCase().includes(q) ||
    vm.relationshipLabel.toLowerCase().includes(q) ||
    vm.member.id.toLowerCase().includes(q) ||
    familyCode.toLowerCase().includes(q)
  );
}

export function applyNavigatorFilters(
  vm: NavMemberViewModel,
  filters: Set<string>
): boolean {
  if (filters.size === 0) {
    return true;
  }
  if (filters.has('active') && vm.member.status !== 'active') {
    return false;
  }
  if (filters.has('incomplete') && !vm.hasMissingInfo) {
    return false;
  }
  return true;
}
