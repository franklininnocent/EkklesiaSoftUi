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
});
