import { FamilyMember } from '@core/models/family.model';
import { SacramentTypeDto } from '@core/services/sacrament-type-lookup.service';
import { MemberSacramentDetailComponent } from './member-sacrament-detail.component';

function marriageType(): SacramentTypeDto {
  return { id: 4, code: 'marriage', name: 'Marriage' } as SacramentTypeDto;
}

describe('MemberSacramentDetailComponent marriage card', () => {
  it('shows spouse and omits bride and groom fields', () => {
    const component = new MemberSacramentDetailComponent();
    component.sacramentType = marriageType();
    component.member = {
      id: '1',
      family_id: 'f1',
      first_name: 'Deepa',
      last_name: 'Sunil George',
      full_name: 'Deepa Sunil George',
      relationship_to_head: 'spouse',
      status: 'active',
      marriage_date: '2018-05-12',
      marriage_place: 'St Mary Parish',
      marriage_spouse_name: 'Antony George',
      marriage_bride_full_name: 'Deepa Sunil George',
      marriage_groom_full_name: 'Antony George'
    } as FamilyMember;

    const labels = component.displayFields.map((row) => row.label);
    const spouse = component.displayFields.find((row) => row.label === 'Spouse');

    expect(labels).toContain('Date');
    expect(labels).toContain('Location');
    expect(labels).toContain('Spouse');
    expect(labels).not.toContain('Bride');
    expect(labels).not.toContain('Groom');
    expect(spouse?.value).toBe('Antony George');
  });

  it('shows the bride as spouse when viewing the groom', () => {
    const component = new MemberSacramentDetailComponent();
    component.sacramentType = marriageType();
    component.member = {
      id: '2',
      family_id: 'f1',
      first_name: 'Antony',
      last_name: 'George',
      full_name: 'Antony George',
      relationship_to_head: 'self',
      status: 'active',
      marriage_date: '2018-05-12',
      marriage_place: 'St Mary Parish',
      marriage_spouse_name: 'Deepa Sunil George',
      marriage_bride_full_name: 'Deepa Sunil George',
      marriage_groom_full_name: 'Antony George'
    } as FamilyMember;

    expect(component.displayFields.find((row) => row.label === 'Spouse')?.value).toBe(
      'Deepa Sunil George'
    );
    expect(component.displayFields.map((row) => row.label)).not.toContain('Bride');
    expect(component.displayFields.map((row) => row.label)).not.toContain('Groom');
  });

  it('treats overlay from the linked spouse as a completed marriage profile', () => {
    const component = new MemberSacramentDetailComponent();
    component.sacramentType = marriageType();
    component.member = {
      id: '2',
      family_id: 'f1',
      first_name: 'Antony',
      last_name: 'George',
      full_name: 'Antony George',
      relationship_to_head: 'self',
      status: 'active',
      marriage_date: '2013-09-28',
      marriage_place: 'Sacred Heart Church',
      marriage_spouse_name: 'Deepa Sunil George',
      linked_spouse_name: 'Deepa Sunil George',
      marriage_resolved_from_spouse: true
    } as FamilyMember;

    expect(component.profileCompleted).toBe(true);
    expect(component.statusLabel).toBe('On profile');
    expect(component.showNoProfileSummary).toBe(false);
    expect(component.displayFields.find((row) => row.label === 'Spouse')?.value).toBe(
      'Deepa Sunil George'
    );
  });
});
