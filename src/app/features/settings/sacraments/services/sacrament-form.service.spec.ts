import { SacramentFormService } from './sacrament-form.service';
import { Sacrament } from '../models/sacrament.model';
import { SacramentParticipantDraft } from '../models/sacrament-definition.model';

describe('SacramentFormService marriage witnesses', () => {
  const service = new SacramentFormService();

  it('builds an external witness payload without person, family, or date of birth', () => {
    const draft: SacramentParticipantDraft = {
      role: 'witness',
      source: 'external',
      external_full_name: 'Pat Witness',
      external_address: '12 Oak Lane',
      external_gender: 'female',
      external_contact_number: '5550100',
      external_date_of_birth: '1980-01-01',
    };

    const rows = service.buildMarriageParticipants({
      bride: {
        role: 'bride',
        source: 'external',
        external_full_name: 'Jane Bride',
        external_date_of_birth: '1990-01-01',
        external_gender: 'female',
      },
      groom: {
        role: 'groom',
        source: 'external',
        external_full_name: 'John Groom',
        external_date_of_birth: '1988-02-02',
        external_gender: 'male',
      },
      brideAffiliation: { affiliation_type: 'home_parish' },
      groomAffiliation: { affiliation_type: 'home_parish' },
      witnesses: [draft],
      minister: {
        role: 'minister',
        source: 'external',
        external_full_name: 'Fr. Thomas',
      },
      formData: {},
    });

    const witness = rows.find((row) => row.role === 'witness');
    expect(witness).toEqual(expect.objectContaining({
      role: 'witness',
      source: 'external',
      external_full_name: 'Pat Witness',
      external_address: '12 Oak Lane',
      external_gender: 'female',
      external_contact_number: '5550100',
    }));
    expect(witness?.family_member_id).toBeUndefined();
    expect(witness?.person_id).toBeUndefined();
    expect(witness?.external_date_of_birth).toBeUndefined();
  });

  it('hydrates witness drafts from the sacramental snapshot', () => {
    const sacrament = {
      participants: [
        {
          role: 'witness',
          source: 'external',
          sort_order: 0,
          external_full_name: 'Pat Witness',
          external_gender: 'female',
          external_address: '12 Oak Lane',
          external_contact_number: '5550100',
          snapshot_json: {
            full_name: 'Pat Witness',
            gender: 'female',
            address: '12 Oak Lane',
            contact_number: '5550100',
          },
        },
      ],
    } as Sacrament;

    const drafts = service.hydrateMarriageDrafts(sacrament, {
      marriage_bride_full_name: 'Jane Bride',
      marriage_groom_full_name: 'John Groom',
      minister_name: 'Fr. Thomas',
    });

    expect(drafts.witnesses).toEqual([expect.objectContaining({
      role: 'witness',
      source: 'external',
      external_full_name: 'Pat Witness',
      external_address: '12 Oak Lane',
      external_gender: 'female',
      external_contact_number: '5550100',
    })]);
    expect(drafts.witnesses[0].external_date_of_birth).toBeUndefined();
  });
});
