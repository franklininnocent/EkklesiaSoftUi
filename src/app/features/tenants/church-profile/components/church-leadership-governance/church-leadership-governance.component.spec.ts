import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { ChurchLeadershipGovernanceComponent } from './church-leadership-governance.component';
import { ChurchLeadershipGovernanceService } from '@core/services/church/church-leadership-governance.service';
import { ChurchLeadershipService } from '@core/services/church/church-leadership.service';
import { ParishPersonService, ParishPerson } from '@features/settings/sacraments/services/person.service';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';

class GovernanceServiceMock {
  getCurrent = jest.fn(() =>
    of({
      success: true,
      data: { groups: [], assignments: [] },
    }),
  );
  getHistory = jest.fn(() =>
    of({
      success: true,
      data: [],
      pagination: { current_page: 1, last_page: 1, per_page: 15, total: 0 },
    }),
  );
  listRoles = jest.fn(() =>
    of({
      success: true,
      data: [
        {
          id: 'role-pastor-uuid',
          title: 'Pastor',
          category: 'PARISH_CLERGY',
          category_label: 'Parish Clergy',
          hierarchical_level: 1,
          allows_concurrent: false,
          is_canonical_mandate: true,
          is_global: true,
        },
      ],
    }),
  );
  assign = jest.fn(() => of({ success: true, data: { id: 'assignment-1' } }));
  updateAssignment = jest.fn(() => of({ success: true, data: { id: 'assignment-1' } }));
  uploadAssignmentPhoto = jest.fn(() => of({ success: true }));
  handover = jest.fn(() => of({ success: true, data: { outgoing: { id: 'out-1' }, incoming: { id: 'in-1' } } }));
  terminate = jest.fn(() => of({ success: true, data: { id: 'assignment-1', status: 'completed' } }));
}

const mockPerson: ParishPerson = {
  id: 'person-uuid',
  tenant_id: 1,
  first_name: 'Anto',
  last_name: 'Leader',
  full_name_display: 'Rev.Fr.Anto Leader',
};

describe('ChurchLeadershipGovernanceComponent add leader modal', () => {
  let component: ChurchLeadershipGovernanceComponent;
  let fixture: ComponentFixture<ChurchLeadershipGovernanceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChurchLeadershipGovernanceComponent],
      providers: [
        { provide: ChurchLeadershipGovernanceService, useClass: GovernanceServiceMock },
        { provide: ChurchLeadershipService, useValue: { resolveLeaderPhotoUrl: jest.fn() } },
        { provide: ParishPersonService, useValue: { search: jest.fn(() => of({ success: true, data: [mockPerson] })) } },
        { provide: AuthService, useValue: {} },
        { provide: ToastService, useValue: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChurchLeadershipGovernanceComponent);
    component = fixture.componentInstance;
    component.canEdit = true;
    component.ngOnInit();
    fixture.detectChanges();
  });

  it('enables Add Leader whenever the modal is open and not saving', () => {
    component.openAssignModal();
    fixture.detectChanges();

    const submitButton: HTMLButtonElement | null = fixture.nativeElement.querySelector(
      '.clg-assign-modal button[type="submit"]',
    );
    expect(submitButton?.disabled).toBe(false);
    expect(component.canSubmitAssign).toBe(false);

    component.selectPerson(mockPerson);
    component.assignForm.patchValue({ role_id: 'role-pastor-uuid' });
    fixture.detectChanges();

    expect(component.canSubmitAssign).toBe(true);
    expect(submitButton?.disabled).toBe(false);
  });

  it('does not treat the form as ready when only role is selected without a name', () => {
    component.openAssignModal();
    component.assignForm.patchValue({ role_id: 'role-pastor-uuid' });
    fixture.detectChanges();

    expect(component.canSubmitAssign).toBe(false);
  });

  it('adds a leader when the name is typed and matches a search result', fakeAsync(() => {
    const api = TestBed.inject(ChurchLeadershipGovernanceService) as unknown as GovernanceServiceMock;
    component.openAssignModal();
    component.personQuery = 'Anto Leader';
    component.assignForm.patchValue({ role_id: 'role-pastor-uuid' });
    component.submitAssign();
    tick();

    expect(component.selectedPerson?.id).toBe('person-uuid');
    expect(api.assign).toHaveBeenCalledWith(
      expect.objectContaining({
        is_external: false,
        person_id: 'person-uuid',
        role_id: 'role-pastor-uuid',
      }),
    );
  }));

  it('creates a leader from a typed name when no parish person matches', fakeAsync(() => {
    const api = TestBed.inject(ChurchLeadershipGovernanceService) as unknown as GovernanceServiceMock;
    const personService = TestBed.inject(ParishPersonService) as unknown as { search: jest.Mock };
    personService.search.mockReturnValueOnce(of({ success: true, data: [] }));

    component.openAssignModal();
    component.personQuery = 'Visiting Priest';
    component.assignForm.patchValue({ role_id: 'role-pastor-uuid' });
    component.submitAssign();
    tick();

    expect(api.assign).toHaveBeenCalledWith(
      expect.objectContaining({
        is_external: true,
        first_name: 'Visiting',
        last_name: 'Priest',
        role_id: 'role-pastor-uuid',
      }),
    );
  }));

  it('opens edit modal and saves leader changes', fakeAsync(() => {
    const api = TestBed.inject(ChurchLeadershipGovernanceService) as unknown as GovernanceServiceMock;
    const assignment = {
      id: 'assignment-edit-1',
      tenant_id: 1,
      church_profile_id: 1,
      person_id: 'person-uuid',
      person: {
        id: 'person-uuid',
        full_name: 'Rev.Fr.Anto Leader',
        first_name: 'Anto',
        last_name: 'Leader',
      },
      role_id: 'role-pastor-uuid',
      role: {
        id: 'role-pastor-uuid',
        title: 'Pastor',
        category: 'PARISH_CLERGY',
        category_label: 'Parish Clergy',
        hierarchical_level: 1,
        allows_concurrent: false,
      },
      start_date: '2025-10-28',
      status: 'active',
    };

    component.openEditModal(assignment as never);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.clg-edit-modal')).toBeTruthy();

    component.editForm.patchValue({
      first_name: 'Anto',
      last_name: 'Leader Updated',
      role_id: 'role-pastor-uuid',
      start_date: '2025-10-28',
    });
    component.submitEdit();
    tick();

    expect(api.updateAssignment).toHaveBeenCalledWith(
      'assignment-edit-1',
      expect.objectContaining({
        first_name: 'Anto',
        last_name: 'Leader Updated',
        role_id: 'role-pastor-uuid',
        start_date: '2025-10-28',
      }),
    );
  }));

  it('submits terminate modal for active assignment', fakeAsync(() => {
    const api = TestBed.inject(ChurchLeadershipGovernanceService) as unknown as GovernanceServiceMock;
    const assignment = {
      id: 'assignment-terminate-1',
      tenant_id: 1,
      church_profile_id: 1,
      person_id: 'person-uuid',
      person: { id: 'person-uuid', full_name: 'Anto Leader', first_name: 'Anto', last_name: 'Leader' },
      role_id: 'role-pastor-uuid',
      role: {
        id: 'role-pastor-uuid',
        title: 'Pastor',
        category: 'PARISH_CLERGY',
        category_label: 'Parish Clergy',
        hierarchical_level: 1,
        allows_concurrent: false,
      },
      start_date: '2025-01-01',
      status: 'active',
    };

    component.openTerminateModal(assignment as never);
    component.terminateForm.patchValue({
      end_date: '2026-08-31',
      exit_reason_code: 'completed',
      exit_reason_note: 'End of term',
    });
    component.submitTerminate();
    tick();

    expect(api.terminate).toHaveBeenCalledWith('assignment-terminate-1', {
      end_date: '2026-08-31',
      exit_reason_code: 'completed',
      exit_reason_note: 'End of term',
    });
  }));

  it('does not open assign modal when canEdit is false', () => {
    component.canEdit = false;
    component.openAssignModal();
    expect(component.showAssignModal).toBe(false);
  });
});
