import { Family, FamilyMember } from '@core/models/family.model';

/** Global convention: picker label = `{family_code} - {head person name}`. */

type FamilyHeadMemberFields = {
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  full_name?: string | null;
  relationship_to_head: string;
  status?: string;
};

export type FamilyPickerFields = Partial<
  Pick<Family, 'id' | 'family_name'>
> & {
  family_code?: string | null;
  head_of_family?: string | null;
  members?: FamilyHeadMemberFields[];
};

export interface FamilySelectOption {
  value: string;
  label: string;
}

export interface FamilyPickerEnriched extends Family {
  pickerLabel: string;
  pickerSearchText: string;
}

function memberDisplayName(member: FamilyHeadMemberFields): string {
  const full = member.full_name?.trim();
  if (full) {
    return full;
  }
  return [member.first_name, member.middle_name, member.last_name].filter(Boolean).join(' ').trim();
}

function activeHeadMember(family: FamilyPickerFields): FamilyHeadMemberFields | undefined {
  const members = family.members ?? [];
  const headLike = (m: FamilyHeadMemberFields) => {
    const rel = m.relationship_to_head as string;
    return (rel === 'self' || rel === 'head') && (m.status === 'active' || m.status === undefined);
  };
  return members.find(headLike);
}

/** Resolved head person name; no family_name fallback. */
export function resolveFamilyHeadPersonName(family: FamilyPickerFields | null | undefined): string | null {
  if (!family) {
    return null;
  }
  const fromMember = activeHeadMember(family);
  if (fromMember) {
    const name = memberDisplayName(fromMember);
    if (name) {
      return name;
    }
  }
  const head = family.head_of_family?.trim();
  return head || null;
}

/** Table cells and primary head-only labels. */
export function formatFamilyHeadCell(family: FamilyPickerFields | null | undefined): string {
  return resolveFamilyHeadPersonName(family) ?? '—';
}

/** Dropdown / search list primary label: `FAM001 - John Peter`. */
export function formatFamilyPickerLabel(family: FamilyPickerFields | null | undefined): string {
  if (!family) {
    return '—';
  }
  const code = family.family_code?.trim() || '';
  const head = resolveFamilyHeadPersonName(family);
  if (code && head) {
    return `${code} - ${head}`;
  }
  if (code) {
    return `${code} - —`;
  }
  if (head) {
    return head;
  }
  return '—';
}

/** Head-first label: `John Peter - FAM001`. Never falls back to the internal family id. */
export function formatFamilyHeadWithCode(
  family: Pick<FamilyPickerFields, 'family_code' | 'head_of_family' | 'members'> | null | undefined
): string {
  const code = family?.family_code?.trim() || '';
  const head = resolveFamilyHeadPersonName(family);
  if (head && code) {
    return `${head} - ${code}`;
  }
  return head || code || '—';
}

export function familyPickerSearchText(family: FamilyPickerFields | null | undefined): string {
  if (!family) {
    return '';
  }
  const parts = [
    family.family_code,
    resolveFamilyHeadPersonName(family),
    family.head_of_family,
  ];
  const headMember = activeHeadMember(family);
  if (headMember) {
    parts.push(memberDisplayName(headMember));
  }
  return parts.filter(Boolean).join(' ').toLowerCase();
}

export function familyMatchesPickerSearch(family: FamilyPickerFields, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  return familyPickerSearchText(family).includes(q);
}

export function mapFamiliesToSelectOptions(families: Family[]): FamilySelectOption[] {
  return families.map((family) => ({
    value: family.id,
    label: formatFamilyPickerLabel(family),
  }));
}

export function enrichFamilyForPicker(family: Family): FamilyPickerEnriched {
  return {
    ...family,
    pickerLabel: formatFamilyPickerLabel(family),
    pickerSearchText: familyPickerSearchText(family),
  };
}

export function enrichFamiliesForPicker(families: Family[]): FamilyPickerEnriched[] {
  return families.map(enrichFamilyForPicker);
}

/** ng-select searchFn(term, item) for enriched families. */
export function searchEnrichedFamilyPicker(term: string, item: FamilyPickerEnriched): boolean {
  const q = (term || '').trim().toLowerCase();
  if (!q) {
    return true;
  }
  return (item.pickerSearchText || familyPickerSearchText(item)).includes(q);
}
