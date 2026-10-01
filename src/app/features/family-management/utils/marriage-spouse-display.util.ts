import { FamilyMember } from '@core/models/family.model';
import { getMemberDisplayName } from './profile-completion.util';

function normalizeName(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function isSamePerson(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeName(a);
  const right = normalizeName(b);
  return left.length > 0 && left === right;
}

function memberSelfName(member: FamilyMember): string | null {
  const name = getMemberDisplayName(member);
  return name && name !== '—' ? name : null;
}

/**
 * Spouse on a member Marriage card is the other person, never the member
 * currently being viewed (who may be recorded as bride or groom).
 */
export function resolveMarriageSpouseDisplayName(member: FamilyMember): string | null {
  const selfName = memberSelfName(member);
  const linkedSpouse = member.linked_spouse_name?.trim() || '';
  const storedSpouse = member.marriage_spouse_name?.trim() || '';
  const bride = member.marriage_bride_full_name?.trim() || '';
  const groom = member.marriage_groom_full_name?.trim() || '';

  if (linkedSpouse && !(selfName && isSamePerson(linkedSpouse, selfName))) {
    return linkedSpouse;
  }

  const otherParty = resolveOtherPartyName(selfName, member.gender, bride, groom);

  if (storedSpouse && !(selfName && isSamePerson(storedSpouse, selfName))) {
    return storedSpouse;
  }

  if (otherParty) {
    return otherParty;
  }

  return storedSpouse || null;
}

function resolveOtherPartyName(
  selfName: string | null,
  gender: FamilyMember['gender'],
  bride: string,
  groom: string
): string | null {
  if (bride && groom) {
    if (selfName && isSamePerson(selfName, bride)) {
      return groom;
    }
    if (selfName && isSamePerson(selfName, groom)) {
      return bride;
    }
    if (gender === 'female' && groom) {
      return groom;
    }
    if (gender === 'male' && bride) {
      return bride;
    }
  }

  if (bride && selfName && !isSamePerson(selfName, bride)) {
    return bride;
  }
  if (groom && selfName && !isSamePerson(selfName, groom)) {
    return groom;
  }

  return null;
}
