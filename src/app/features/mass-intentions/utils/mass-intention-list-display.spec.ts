import { MassIntentionRecord } from '../services/mass-intentions-api.service';
import {
  formatMassIntentionScheduledDay,
  massIntentionListDescription,
  massIntentionBeneficiaryIdentification,
  massIntentionListMass,
  massIntentionListType,
  massIntentionNeedsCategory,
} from './mass-intention-list-display';

function row(partial: Partial<MassIntentionRecord>): MassIntentionRecord {
  return {
    id: '1',
    status: 'open',
    beneficiary_name: 'Test',
    intention_text: '',
    announce_name: true,
    date_must_be_kept: false,
    ...partial,
  };
}

describe('mass-intention-list-display', () => {
  it('shows category name in intention column when categorized', () => {
    const r = row({
      mass_intention_category_id: 'cat-1',
      intention_text: 'For Students and Education',
      intention_description: 'Details here',
    });
    expect(massIntentionListType(r)).toBe('For Students and Education');
    expect(massIntentionListDescription(r)).toBe('Details here');
  });

  it('shows legacy free text in description when no category', () => {
    const r = row({ intention_text: 'Birthday' });
    expect(massIntentionListType(r)).toBe('—');
    expect(massIntentionListDescription(r)).toBe('Birthday');
    expect(massIntentionNeedsCategory(r)).toBe(true);
  });

  it('formats scheduled day for display', () => {
    expect(formatMassIntentionScheduledDay('2026-10-01')).toBe('1 Oct 2026');
    expect(formatMassIntentionScheduledDay(null)).toBe('—');
  });

  it('includes mass time in register export label', () => {
    const r = row({
      mass_celebration: { id: 'm1', celebrated_on: '2026-10-11', celebrated_at: '06:00' },
    });
    expect(massIntentionListMass(r)).toContain('11 Oct 2026');
    expect(massIntentionListMass(r)).toMatch(/6:00/);
  });

  it('shows BCC or place identification subtitle', () => {
    expect(
      massIntentionBeneficiaryIdentification(
        row({ beneficiary_bcc: { id: 'b1', name: 'St Mary' } })
      )
    ).toBe('BCC · St Mary');
    expect(massIntentionBeneficiaryIdentification(row({ beneficiary_place: 'Kottayam' }))).toBe(
      'Place · Kottayam'
    );
    expect(massIntentionBeneficiaryIdentification(row({}))).toBeNull();
  });
});
