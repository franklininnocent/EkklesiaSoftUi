import { FamilyMember } from '@core/models/family.model';
import { resolveMarriageSpouseDisplayName } from './marriage-spouse-display.util';

function member(overrides: Partial<FamilyMember>): FamilyMember {
  return {
    id: '1',
    family_id: 'f1',
    first_name: 'Deepa',
    last_name: 'Sunil George',
    relationship_to_head: 'spouse',
    status: 'active',
    ...overrides
  } as FamilyMember;
}

describe('resolveMarriageSpouseDisplayName', () => {
  it('returns the stored spouse when the current member is the bride', () => {
    expect(
      resolveMarriageSpouseDisplayName(
        member({
          full_name: 'Deepa Sunil George',
          marriage_spouse_name: 'Antony George',
          marriage_bride_full_name: 'Deepa Sunil George',
          marriage_groom_full_name: 'Antony George'
        })
      )
    ).toBe('Antony George');
  });

  it('returns the stored spouse when the current member is the groom', () => {
    expect(
      resolveMarriageSpouseDisplayName(
        member({
          first_name: 'Antony',
          last_name: 'George',
          full_name: 'Antony George',
          marriage_spouse_name: 'Deepa Sunil George',
          marriage_bride_full_name: 'Deepa Sunil George',
          marriage_groom_full_name: 'Antony George'
        })
      )
    ).toBe('Deepa Sunil George');
  });

  it('derives the other party when spouse is missing and the member is the bride', () => {
    expect(
      resolveMarriageSpouseDisplayName(
        member({
          full_name: 'Deepa Sunil George',
          marriage_bride_full_name: 'Deepa Sunil George',
          marriage_groom_full_name: 'Antony George'
        })
      )
    ).toBe('Antony George');
  });

  it('derives the other party when spouse is missing and the member is the groom', () => {
    expect(
      resolveMarriageSpouseDisplayName(
        member({
          first_name: 'Antony',
          last_name: 'George',
          full_name: 'Antony George',
          marriage_bride_full_name: 'Deepa Sunil George',
          marriage_groom_full_name: 'Antony George'
        })
      )
    ).toBe('Deepa Sunil George');
  });

  it('does not treat the current member as their own spouse', () => {
    expect(
      resolveMarriageSpouseDisplayName(
        member({
          full_name: 'Deepa Sunil George',
          marriage_spouse_name: 'Deepa Sunil George',
          marriage_bride_full_name: 'Deepa Sunil George',
          marriage_groom_full_name: 'Antony George'
        })
      )
    ).toBe('Antony George');
  });

  it('prefers the linked household spouse over stored names', () => {
    expect(
      resolveMarriageSpouseDisplayName(
        member({
          full_name: 'Deepa Sunil George',
          linked_spouse_name: 'Antony George',
          marriage_spouse_name: 'Deepa Sunil George',
          marriage_bride_full_name: 'Deepa Sunil George',
          marriage_groom_full_name: 'Someone Else'
        })
      )
    ).toBe('Antony George');
  });
});
