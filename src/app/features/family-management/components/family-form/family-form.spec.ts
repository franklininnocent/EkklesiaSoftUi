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

  describe('shouldShowInactiveMembersWarning()', () => {
    function addActiveMembers(component: FamilyFormComponent, count = 2): void {
      for (let i = 0; i < count; i++) {
        component.addMember({
          id: `member-${i}`,
          first_name: `Member${i}`,
          last_name: 'Test',
          status: 'active',
          relationship_to_head: i === 0 ? 'self' : 'other'
        });
      }
    }

    it('returns false for active family with active members on load', () => {
      const { component } = setup();
      addActiveMembers(component);
      component.familyForm.patchValue({ status: 'active' });

      expect(component.shouldShowInactiveMembersWarning()).toBe(false);
    });

    it('returns true when user changes status to inactive', () => {
      const { component } = setup();
      addActiveMembers(component);
      const statusControl = component.familyForm.get('status');
      statusControl?.setValue('inactive');
      statusControl?.markAsDirty();

      expect(component.shouldShowInactiveMembersWarning()).toBe(true);
    });

    it('returns false when user changes back to active', () => {
      const { component } = setup();
      addActiveMembers(component);
      const statusControl = component.familyForm.get('status');
      statusControl?.setValue('inactive');
      statusControl?.markAsDirty();
      statusControl?.setValue('active');

      expect(component.shouldShowInactiveMembersWarning()).toBe(false);
    });

    it('returns true when inactive status has hasActiveMembers validation error', () => {
      const { component } = setup();
      addActiveMembers(component);
      const statusControl = component.familyForm.get('status');
      statusControl?.setValue('inactive');
      statusControl?.setErrors({ hasActiveMembers: true });

      expect(component.shouldShowInactiveMembersWarning()).toBe(true);
    });
  });

});
