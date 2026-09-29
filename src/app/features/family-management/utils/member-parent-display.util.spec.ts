import { FamilyMember } from '@core/models/family.model';
import {
  findFamilyMemberIndexByPersonId,
  getMemberParentDisplayName,
  getMemberParentPersonId,
  isMemberParentLinked,
} from './member-parent-display.util';

describe('member parent display util', () => {
  it('prefers resolved display names from the API', () => {
    const member = {
      display_father_name: 'Adam S Hutchinson',
      father_name: 'Old Father',
      display_mother_name: 'Liza P Olvera',
      mother_name: 'Old Mother',
      person: {
        father_name: 'Snapshot Father',
        mother_name: 'Snapshot Mother',
      },
    } as FamilyMember;

    expect(getMemberParentDisplayName(member, 'father')).toBe('Adam S Hutchinson');
    expect(getMemberParentDisplayName(member, 'mother')).toBe('Liza P Olvera');
  });

  it('returns null when no parent name is available', () => {
    const member = {
      first_name: 'Irene',
      last_name: 'Hutchinson',
    } as FamilyMember;

    expect(getMemberParentDisplayName(member, 'father')).toBeNull();
    expect(getMemberParentDisplayName(member, 'mother')).toBeNull();
  });

  it('detects linked parents by person id only', () => {
    const member = {
      person: {
        father_person_id: 'father-person-id',
        mother_person_id: 'mother-person-id',
      },
    } as FamilyMember;

    expect(isMemberParentLinked(member, 'father')).toBe(true);
    expect(isMemberParentLinked(member, 'mother')).toBe(true);
    expect(getMemberParentPersonId(member, 'father')).toBe('father-person-id');
  });

  it('finds a family member row by linked person id', () => {
    const members = [
      { id: 'member-1', person_id: 'person-1' },
      { id: 'member-2', person: { id: 'person-2' } },
    ] as FamilyMember[];

    expect(findFamilyMemberIndexByPersonId(members, 'person-2')).toBe(1);
    expect(findFamilyMemberIndexByPersonId(members, 'missing')).toBeNull();
  });
});
