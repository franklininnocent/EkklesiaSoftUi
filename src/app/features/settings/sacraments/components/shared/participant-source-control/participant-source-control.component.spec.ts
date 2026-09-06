import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ParticipantSourceControlComponent } from './participant-source-control.component';
import { MemberService } from '@features/members/services/member.service';

describe('ParticipantSourceControlComponent', () => {
  let fixture: ComponentFixture<ParticipantSourceControlComponent>;
  let component: ParticipantSourceControlComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParticipantSourceControlComponent],
      providers: [
        {
          provide: MemberService,
          useValue: { getMembers: () => of({ data: [] }) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ParticipantSourceControlComponent);
    component = fixture.componentInstance;
  });

  it('should collect witness fields without date of birth', () => {
    component.label = 'Witness 1';
    component.role = 'witness';
    component.controlId = 'witness_0';
    component.allowedSources = ['external'];
    component.showDateOfBirth = false;
    component.requireGender = true;
    component.requireAddress = true;
    component.requireContactNumber = true;
    component.value = { role: 'witness', source: 'external' };
    fixture.detectChanges();

    expect(component.showSourceToggle).toBe(false);
    expect(fixture.nativeElement.querySelector('#ext_dob_witness_0')).toBeNull();
    expect(fixture.nativeElement.querySelector('#ext_name_witness_0')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#ext_address_witness_0')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#ext_gender_witness_0')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#ext_contact_witness_0')).toBeTruthy();
  });

  it('should emit external witness payload without date of birth', () => {
    const emitted: unknown[] = [];
    component.valueChange.subscribe((value) => emitted.push(value));
    component.role = 'witness';
    component.allowedSources = ['external'];
    component.showDateOfBirth = false;
    component.requireAddress = true;
    component.requireContactNumber = true;
    component.requireGender = true;
    component.externalName = 'Pat Witness';
    component.externalAddress = '12 Oak Lane';
    component.externalGender = 'female';
    component.externalContactNumber = '5550100';
    component.externalDob = '1980-01-01';
    component.onExternalChange();

    expect(emitted.length).toBe(1);
    expect(emitted[0]).toEqual(expect.objectContaining({
      role: 'witness',
      source: 'external',
      external_full_name: 'Pat Witness',
      external_address: '12 Oak Lane',
      external_gender: 'female',
      external_contact_number: '5550100',
    }));
    expect((emitted[0] as { external_date_of_birth?: string }).external_date_of_birth).toBeUndefined();
  });

  it('shows canonical member date of birth instead of an editable field', () => {
    component.label = 'Bride';
    component.role = 'bride';
    component.requireIdentityFields = true;
    component.allowedSources = ['member', 'external'];
    component.source = 'member';
    component.selectedMember = {
      id: 'member-1',
      family_id: 'family-1',
      first_name: 'Maria',
      last_name: 'Bride',
      full_name: 'Maria Bride',
      date_of_birth: '1998-05-10',
      gender: 'female',
    } as never;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#member_dob_bride')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('1998');
    expect(fixture.nativeElement.textContent).toContain('parish member record');
  });

  it('emits canonical member date of birth for member participants', () => {
    const emitted: unknown[] = [];
    component.valueChange.subscribe((value) => emitted.push(value));
    component.role = 'bride';
    component.requireIdentityFields = true;
    component.onSourceChange('member');
    component.selectMember({
      id: 'member-1',
      family_id: 'family-1',
      first_name: 'Maria',
      last_name: 'Bride',
      full_name: 'Maria Bride',
      date_of_birth: '1998-05-10',
      gender: 'female',
    } as never);

    expect(emitted.at(-1)).toEqual(expect.objectContaining({
      role: 'bride',
      source: 'member',
      family_member_id: 'member-1',
      external_date_of_birth: '1998-05-10',
      external_gender: 'female',
    }));
  });

  it('preserves member date of birth after parent value round-trip', () => {
    component.label = 'Bride';
    component.role = 'bride';
    component.requireIdentityFields = true;
    fixture.componentRef.setInput('value', {
      role: 'bride',
      source: 'member',
      family_member_id: 'member-1',
      display_name: 'Maria Bride',
      external_date_of_birth: '1998-05-10',
      external_gender: 'female',
    });
    fixture.detectChanges();

    expect(component.memberDateOfBirth(component.selectedMember)).toBe('1998-05-10');
    expect(component.memberHasDateOfBirth(component.selectedMember)).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('1998');
    expect(fixture.nativeElement.textContent).not.toContain(
      'This member has no date of birth on file'
    );
  });

  it('uses linked person date of birth when membership row is missing it', () => {
    const emitted: unknown[] = [];
    component.valueChange.subscribe((value) => emitted.push(value));
    component.role = 'bride';
    component.requireIdentityFields = true;
    component.onSourceChange('member');
    component.selectMember({
      id: 'member-1',
      family_id: 'family-1',
      first_name: 'Maria',
      last_name: 'Bride',
      full_name: 'Maria Bride',
      person: { date_of_birth: '1998-05-10', gender: 'female' },
    } as never);

    expect(emitted.at(-1)).toEqual(expect.objectContaining({
      external_date_of_birth: '1998-05-10',
      external_gender: 'female',
    }));
  });

  it('emits resolved parent names for linked parish members', () => {
    const emitted: unknown[] = [];
    component.valueChange.subscribe((value) => emitted.push(value));
    component.role = 'bride';
    component.requireIdentityFields = true;
    component.onSourceChange('member');
    component.selectMember({
      id: 'member-1',
      family_id: 'family-1',
      first_name: 'Olivia',
      last_name: 'Anderson',
      full_name: 'Olivia Anderson',
      date_of_birth: '2003-09-27',
      gender: 'female',
      father_name: 'John Anderson',
      mother_name: 'Mary Anderson',
    } as never);

    expect(emitted.at(-1)).toEqual(expect.objectContaining({
      father_name: 'John Anderson',
      mother_name: 'Mary Anderson',
    }));
  });

  it('displays parent names for selected parish members', () => {
    component.label = 'Bride';
    component.role = 'bride';
    component.requireIdentityFields = true;
    component.source = 'member';
    component.selectedMember = {
      id: 'member-1',
      family_id: 'family-1',
      first_name: 'Olivia',
      last_name: 'Anderson',
      full_name: 'Olivia Anderson',
      date_of_birth: '2003-09-27T00:00:00.000000Z',
      gender: 'female',
      father_name: 'John Anderson',
      mother_name: 'Mary Anderson',
    } as never;
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('John Anderson');
    expect(fixture.nativeElement.textContent).toContain('Mary Anderson');
    expect(fixture.nativeElement.textContent).toContain('2003');
    expect(fixture.nativeElement.textContent).not.toContain('T00:00:00');
  });
});