import { FamilyMember } from '@core/models/family.model';

export function getMemberParentDisplayName(
  member: FamilyMember,
  side: 'father' | 'mother',
): string | null {
  if (side === 'father') {
    return (
      member.display_father_name ??
      member.father_name ??
      member.person?.father_name ??
      null
    );
  }

  return (
    member.display_mother_name ??
    member.mother_name ??
    member.person?.mother_name ??
    null
  );
}

export function getMemberParentPersonId(
  member: FamilyMember,
  side: 'father' | 'mother',
): string | null {
  const personId =
    side === 'father'
      ? member.father_person_id ?? member.person?.father_person_id ?? null
      : member.mother_person_id ?? member.person?.mother_person_id ?? null;

  return personId ? String(personId).trim() : null;
}

export function isMemberParentLinked(
  member: FamilyMember,
  side: 'father' | 'mother',
): boolean {
  return !!getMemberParentPersonId(member, side);
}

export function findFamilyMemberIndexByPersonId(
  members: FamilyMember[] | null | undefined,
  personId: string,
): number | null {
  if (!members?.length || !personId) {
    return null;
  }

  const target = personId.trim();
  const index = members.findIndex(
    (row) =>
      String(row.person_id ?? '').trim() === target ||
      String(row.person?.id ?? '').trim() === target,
  );

  return index >= 0 ? index : null;
}
