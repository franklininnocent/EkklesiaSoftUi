import { Family } from '@core/models/family.model';
import {
  formatFamilyHeadCell,
  formatFamilyHeadWithCode,
  formatFamilyPickerLabel,
  familyPickerSearchText,
  resolveFamilyHeadPersonName,
} from './family-display.util';

describe('family-display.util', () => {
  const base: Family = {
    id: 'f1',
    tenant_id: 't1',
    family_code: 'FAM001',
    family_name: 'Ward Household',
    status: 'active',
  };

  it('resolves head from active self member', () => {
    const family: Family = {
      ...base,
      members: [
        {
          id: 'm1',
          family_id: 'f1',
          first_name: 'John',
          last_name: 'Peter',
          relationship_to_head: 'self',
          status: 'active',
        },
      ],
    };
    expect(resolveFamilyHeadPersonName(family)).toBe('John Peter');
    expect(formatFamilyPickerLabel(family)).toBe('FAM001 - John Peter');
    expect(formatFamilyHeadCell(family)).toBe('John Peter');
  });

  it('falls back to head_of_family when no member', () => {
    const family: Family = { ...base, head_of_family: 'Mary Joseph' };
    expect(formatFamilyPickerLabel(family)).toBe('FAM001 - Mary Joseph');
  });

  it('shows em dash when head missing', () => {
    expect(formatFamilyHeadCell(base)).toBe('—');
    expect(formatFamilyPickerLabel(base)).toBe('FAM001 - —');
  });

  it('formats head-first label with family code', () => {
    expect(formatFamilyHeadWithCode({ family_code: 'FAM001', head_of_family: 'John Peter' })).toBe('John Peter - FAM001');
    expect(formatFamilyHeadWithCode({ family_code: ' FAM001 ', head_of_family: ' John Peter ' })).toBe('John Peter - FAM001');
  });

  it('head-first label never falls back to the family id', () => {
    const row = { family_id: 'f1', family_code: null as string | null, head_of_family: null as string | null };
    expect(formatFamilyHeadWithCode({ ...row, family_code: 'FAM001' })).toBe('FAM001');
    expect(formatFamilyHeadWithCode({ ...row, head_of_family: 'John Peter' })).toBe('John Peter');
    expect(formatFamilyHeadWithCode(row)).toBe('—');
    expect(formatFamilyHeadWithCode(null)).toBe('—');
  });

  it('search haystack includes code and head', () => {
    const family: Family = { ...base, head_of_family: 'Thomas David' };
    expect(familyPickerSearchText(family)).toContain('fam001');
    expect(familyPickerSearchText(family)).toContain('thomas');
  });
});
