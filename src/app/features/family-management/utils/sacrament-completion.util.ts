import { FamilyMember } from '@core/models/family.model';

export type SacramentFormType = 'baptism' | 'first_communion' | 'confirmation' | 'marriage';

export interface SacramentTypeLike {
  code: string;
}

export function resolveCanonicalSacrament(code: string): SacramentFormType | null {
  if (!code) {
    return null;
  }
  const normalized = code.trim().toLowerCase();
  switch (normalized) {
    case 'baptism':
      return 'baptism';
    case 'first_communion':
    case 'first holy communion':
    case 'eucharist':
    case 'eucharist (first holy communion)':
    case 'holy communion':
    case 'eucharist (holy communion)':
      return 'first_communion';
    case 'confirmation':
      return 'confirmation';
    case 'marriage':
    case 'matrimony':
    case 'matrimony (marriage)':
      return 'marriage';
    default:
      return null;
  }
}

export function isSacramentCompleted(
  member: FamilyMember | null | undefined,
  code: string
): boolean {
  if (!member) {
    return false;
  }
  const canonical = resolveCanonicalSacrament(code);
  switch (canonical) {
    case 'baptism':
      return !!member.baptism_date;
    case 'first_communion':
      return !!member.first_communion_date;
    case 'confirmation':
      return !!member.confirmation_date;
    case 'marriage':
      return !!member.marriage_date;
    default:
      return false;
  }
}

export function countCompletedSacraments(
  member: FamilyMember | null | undefined,
  sacramentTypes: SacramentTypeLike[]
): number {
  if (!member || sacramentTypes.length === 0) {
    return 0;
  }
  return sacramentTypes.reduce(
    (count, type) => (isSacramentCompleted(member, type.code) ? count + 1 : count),
    0
  );
}
