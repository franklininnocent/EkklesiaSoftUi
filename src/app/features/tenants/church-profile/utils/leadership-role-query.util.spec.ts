import { LeadershipRoleOption } from '@core/models/church/leadership-governance.model';
import { LeadershipAssignment } from '@core/models/church/leadership-governance.model';
import {
  findExactRoleMatch,
  groupLeadershipRoles,
  guessLeadershipRoleCategory,
  isParishClergyAssignment,
  isPrimaryParishClergyRoleTitle,
  normalizeLeadershipRoleTitle,
  partitionParishClergyAssignments,
  shouldShowCreateRoleAction,
} from './leadership-role-query.util';

const roles: LeadershipRoleOption[] = [
  {
    id: '1',
    title: 'Pastor',
    category: 'PARISH_CLERGY',
    category_label: 'Parish Clergy',
    hierarchical_level: 2,
    allows_concurrent: false,
    is_canonical_mandate: false,
    is_global: true,
  },
  {
    id: '2',
    title: 'Youth Coordinator',
    category: 'OTHER',
    category_label: 'Other',
    hierarchical_level: 4,
    allows_concurrent: true,
    is_canonical_mandate: false,
    is_global: false,
  },
];

describe('leadership-role-query.util', () => {
  it('normalizes case and whitespace', () => {
    expect(normalizeLeadershipRoleTitle('  Pastor   ')).toBe('pastor');
  });

  it('groups system and tenant roles', () => {
    const groups = groupLeadershipRoles(roles);
    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe('SYSTEM ROLES');
    expect(groups[1].label).toBe('MY CHURCH ROLES');
  });

  it('hides create action on exact match', () => {
    expect(shouldShowCreateRoleAction(roles, 'pastor', true)).toBe(false);
    expect(findExactRoleMatch(roles, 'PASTOR')?.title).toBe('Pastor');
  });

  it('shows create action on partial match only', () => {
    expect(shouldShowCreateRoleAction(roles, 'Parish', true)).toBe(true);
  });

  it('hides create action without permission', () => {
    expect(shouldShowCreateRoleAction(roles, 'Associate Parish Priest', false)).toBe(false);
  });

  it('guesses governance categories from role titles', () => {
    expect(guessLeadershipRoleCategory('Parish Priest')).toBe('PARISH_CLERGY');
    expect(guessLeadershipRoleCategory('Finance Council Chair')).toBe('PARISH_COUNCIL');
    expect(guessLeadershipRoleCategory('Youth Coordinator')).toBe('MINISTRY_PIOUS');
    expect(guessLeadershipRoleCategory('Parish Secretary')).toBe('OTHER');
  });

  it('classifies parish priest as primary and joint parish priest as supporting', () => {
    expect(isPrimaryParishClergyRoleTitle('Parish Priest')).toBe(true);
    expect(isPrimaryParishClergyRoleTitle('Joint Parish Priest')).toBe(false);
  });

  it('treats clergy-like custom roles in OTHER category as parish clergy', () => {
    const assignment = {
      status: 'active' as const,
      role: {
        title: 'Parish Priest',
        category: 'OTHER' as const,
      },
    };

    expect(isParishClergyAssignment(assignment)).toBe(true);
  });

  it('partitions parish priest and joint parish priest for profile display', () => {
    const assignments: LeadershipAssignment[] = [
      {
        id: 'joint',
        tenant_id: 1,
        church_profile_id: 1,
        person_id: 'andrew',
        person: { id: 'andrew', full_name: 'Rev.Fr. Andrew Kosmos' },
        role_id: 'joint-role',
        role: {
          id: 'joint-role',
          title: 'Joint Parish Priest',
          category: 'OTHER',
          category_label: 'Other',
          hierarchical_level: 4,
          allows_concurrent: true,
        },
        start_date: '2026-09-18',
        status: 'active',
      },
      {
        id: 'primary',
        tenant_id: 1,
        church_profile_id: 1,
        person_id: 'alex',
        person: { id: 'alex', full_name: 'Rev.Fr. Alex Peter' },
        role_id: 'priest-role',
        role: {
          id: 'priest-role',
          title: 'Parish Priest',
          category: 'OTHER',
          category_label: 'Other',
          hierarchical_level: 4,
          allows_concurrent: false,
        },
        start_date: '2026-09-18',
        status: 'active',
      },
    ];

    const { primary, others } = partitionParishClergyAssignments(assignments);

    expect(primary?.person?.full_name).toBe('Rev.Fr. Alex Peter');
    expect(others.map((row) => row.person?.full_name)).toEqual(['Rev.Fr. Andrew Kosmos']);
  });
});
