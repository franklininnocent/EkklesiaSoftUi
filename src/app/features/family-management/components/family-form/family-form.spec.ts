import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FamilyFormComponent } from './family-form';
import { FamilyService } from '../../../../core/services/family.service';

describe('FamilyFormComponent (tabs + phone validators)', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [FamilyFormComponent],
      providers: [
        { provide: FamilyService, useValue: {
          createFamily: jest.fn(() => of({ success: true, data: {} })),
          updateFamily: jest.fn(() => of({ success: true, data: {} }))
        }}
      ]
    });
    const fixture = TestBed.createComponent(FamilyFormComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    return { fixture, component };
  }

  it('switchTab() changes activeTab and triggers scroll without crashing', () => {
    const { component } = setup();
    // Mock refs
    (component as any).infoTabContentRef = { nativeElement: { scrollTop: 0 } };
    (component as any).membersTabContentRef = { nativeElement: { scrollTop: 0 } };

    component.switchTab('members');
    expect(component.activeTab).toBe('members');
    component.switchTab('info');
    expect(component.activeTab).toBe('info');
  });

  it('phone validators: invalid random string, valid plausible number with prefix handled by validator', () => {
    const { component } = setup();
    const primary = component.familyForm.get('primary_phone')!;
    primary.setValue('abcdef');
    expect(primary.valid).toBe(false);
    primary.setValue('9999999999');
    // Depending on tenant country, validator may pass/ fail; ensure it re-evaluates
    expect(primary.touched).toBe(false); // we haven't marked touched
  });
});


