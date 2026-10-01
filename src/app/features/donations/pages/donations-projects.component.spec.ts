import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError, EMPTY } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ChurchCurrencyService } from '@core/services/church-currency.service';
import { ToastService } from '@core/services/toast.service';
import { FamilyService } from '@core/services/family.service';
import { DonationsProjectsComponent } from './donations-projects.component';
import { DonationsService } from '../services/donations.service';
import { DonationProject, ProjectDashboard, ProjectInstallmentSchedule } from '../models/donation.model';
import { QuickCollectService } from '../services/quick-collect.service';

describe('DonationsProjectsComponent', () => {
  let fixture: ComponentFixture<DonationsProjectsComponent>;
  let getProjects: jest.Mock;
  let getFamilies: jest.Mock;
  let generateProjectInstallments: jest.Mock;
  let getProjectDashboard: jest.Mock;
  let getProjectFamilyProgress: jest.Mock;
  let toastSuccess: jest.Mock;

  beforeEach(async () => {
    getProjects = jest.fn().mockReturnValue(of({ success: true, data: [] }));
    getProjectDashboard = jest.fn().mockReturnValue(of({ data: null }));
    getProjectFamilyProgress = jest.fn().mockReturnValue(
      of({ success: true, data: { data: [], total: 0, current_page: 1, last_page: 1, per_page: 20 } })
    );
    getFamilies = jest.fn().mockReturnValue(of({ data: [] }));
    generateProjectInstallments = jest.fn().mockReturnValue(of({ success: true, message: 'ok', data: [] }));
    toastSuccess = jest.fn();

    await TestBed.configureTestingModule({
      imports: [DonationsProjectsComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { hasPermission: () => true } },
        { provide: QuickCollectService, useValue: { open: jest.fn() } },
        {
          provide: DonationsService,
          useValue: {
            getProjects,
            getProjectDashboard,
            getProjectFamilyProgress,
            generateProjectInstallments,
            ledgerMutated$: EMPTY,
          },
        },
        { provide: FamilyService, useValue: { getFamilies: getFamilies } },
        { provide: ChurchCurrencyService, useValue: { currencySymbol: () => '$', currencyCode: () => 'USD' } },
        { provide: ToastService, useValue: { success: toastSuccess, warning: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DonationsProjectsComponent);
    fixture.detectChanges();
  });

  it('loads projects once on init and clears the loader on success', () => {
    expect(getProjects).toHaveBeenCalledTimes(1);
    expect(getFamilies).not.toHaveBeenCalled();
    expect(fixture.componentInstance.projectsLoaded).toBe(true);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('Loading projects…');
  });

  it('clears the loader and shows error when projects request fails', () => {
    getProjects.mockReturnValueOnce(throwError(() => ({ message: 'Network error' })));
    fixture.componentInstance.loadProjects();
    fixture.detectChanges();

    expect(fixture.componentInstance.projectsLoaded).toBe(true);
    expect(fixture.componentInstance.projectsLoadError).toBeTruthy();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.cf-loading-block')).toBeFalsy();
  });

  it('renders project identity, money, timeline, progress, and actions', () => {
    const project: DonationProject = {
      id: 'proj-1',
      name: 'Parish Hall Reconstruction and Accessibility Works',
      code: 'HALL-2026',
      assignment_mode: 'uniform',
      description: 'A long description that should stay on one summary line.',
      target_amount: 250000,
      default_family_target: 5000,
      raised_amount: 125000,
      start_date: '2026-01-15',
      end_date: '2026-12-31',
      status: 'active',
      has_funding_target: true,
      collection_percentage: 50,
    };
    getProjects.mockReturnValueOnce(of({ success: true, data: [project] }));
    fixture.componentInstance.loadProjects();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const card = el.querySelector('.project-card');
    expect(card).toBeTruthy();
    expect(card?.textContent).toContain('Parish Hall Reconstruction and Accessibility Works');
    expect(card?.textContent).toContain('HALL-2026');
    expect(card?.textContent).toContain('Active');
    expect(card?.textContent).toContain('Collected');
    expect(card?.textContent).toContain('Family target');
    expect(card?.textContent).toContain('Timeline');
    expect(card?.textContent).toContain('15 Jan 2026');
    expect(card?.textContent).toContain('31 Dec 2026');
    expect(card?.textContent).toContain('50%');
    expect(card?.textContent).toContain('125,000');
    expect(el.querySelector('[aria-label="Edit Parish Hall Reconstruction and Accessibility Works"]')).toBeTruthy();
    expect(el.querySelector('[aria-label="Generate installments for Parish Hall Reconstruction and Accessibility Works"]')).toBeTruthy();
  });

  it('shows family head name and code in the project detail family table', () => {
    const project: DonationProject = {
      id: 'proj-1',
      name: 'Parish Hall',
      code: 'HALL-2026',
      assignment_mode: 'uniform',
      target_amount: 1000,
      default_family_target: 100,
      raised_amount: 0,
      status: 'active',
    };
    const familyId = '9f1c2d3e-0000-4000-8000-000000000001';
    fixture.componentInstance.projects = [project];
    const dashboard: ProjectDashboard = {
      project,
      totals: {
        overall_target: 100,
        family_target_total: 100,
        collected: 0,
        outstanding: 100,
        installment_outstanding: 0,
        collection_percentage: 0,
      },
      families: { enrolled: 1, completed: 0, partial: 0, exempt: 0 },
      family_progress: [],
      installments: { total: 0, paid: 0, pending: 0 },
    };
    getProjectDashboard.mockReturnValue(of({ success: true, data: dashboard }));
    getProjectFamilyProgress.mockReturnValue(of({
      success: true,
      data: {
        data: [
          {
            family_id: familyId,
            family_code: 'FAM001',
            family_name: 'Peter Household',
            head_of_family: 'John Peter',
            bcc_id: null,
            bcc_name: null,
            target_amount: 100,
            amount_collected: 0,
            outstanding_amount: 100,
            completion_percentage: 0,
            status: 'not_started',
          },
        ],
        total: 1,
        current_page: 1,
        last_page: 1,
        per_page: 20,
      },
    }));
    fixture.componentInstance.viewDashboard(project);
    fixture.detectChanges();

    const cell = fixture.nativeElement.querySelector('.project-detail-modal__family') as HTMLElement;
    expect(cell.textContent?.trim()).toBe('John Peter - FAM001');
    expect(cell.getAttribute('title')).toBe('John Peter - FAM001');
    expect(fixture.nativeElement.querySelector('.project-detail-modal')?.textContent).not.toContain(familyId);
  });

  it('reports how many installments were generated', () => {
    const project: DonationProject = {
      id: 'proj-1',
      name: 'Parish Hall',
      code: 'HALL-2026',
      assignment_mode: 'uniform',
      target_amount: 1000,
      default_family_target: 100,
      raised_amount: 0,
      status: 'active',
      has_funding_target: false,
    };
    generateProjectInstallments.mockReturnValue(of({
      success: true,
      message: 'Project installment dues generated successfully.',
      data: [{ id: 'due-1' }, { id: 'due-2' }],
    }));
    fixture.componentInstance.projects = [project];
    fixture.componentInstance.projectsLoaded = true;
    fixture.componentInstance.canManage = true;
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      '[aria-label="Generate installments for Parish Hall"]'
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    expect(generateProjectInstallments).toHaveBeenCalledWith('proj-1', { mode: 'generate' });
    expect(fixture.componentInstance.message).toContain('2 installments generated');
    expect(toastSuccess).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('2 installments generated for Parish Hall.');
  });

  function schedule(partial: Partial<ProjectInstallmentSchedule> & Pick<ProjectInstallmentSchedule, 'state' | 'can_generate' | 'can_regenerate'>): ProjectInstallmentSchedule {
    return {
      active_count: 0,
      pending_count: 0,
      partial_count: 0,
      paid_count: 0,
      waived_count: 0,
      cancelled_count: 0,
      overdue_count: 0,
      families_with_schedule: 0,
      families_with_payments: 0,
      families_regenerable: 0,
      families_missing: 0,
      ...partial,
    };
  }

  function projectWith(installmentSchedule: DonationProject['installment_schedule']): DonationProject {
    return {
      id: 'proj-1',
      name: 'Parish Hall',
      code: 'HALL-2026',
      assignment_mode: 'uniform',
      target_amount: 1000,
      default_family_target: 100,
      raised_amount: 0,
      status: 'active',
      installment_schedule: installmentSchedule,
    };
  }

  it('shows generate when installments have not been created', () => {
    const project = projectWith(schedule({
      state: 'not_generated',
      can_generate: true,
      can_regenerate: false,
      families_missing: 2,
    }));
    fixture.componentInstance.projects = [project];
    fixture.componentInstance.projectsLoaded = true;
    fixture.componentInstance.canManage = true;
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Installments not generated');
    expect(el.querySelector('[aria-label="Generate installments for Parish Hall"]')).toBeTruthy();
    expect(el.querySelector('[aria-label="Regenerate unpaid installments for Parish Hall"]')).toBeFalsy();
    expect(el.querySelector('[aria-label="View installments for Parish Hall"]')).toBeFalsy();
  });

  it('shows regenerate and view after generation when nobody has paid', () => {
    const project = projectWith(schedule({
      state: 'generated',
      can_generate: false,
      can_regenerate: true,
      active_count: 4,
      pending_count: 4,
      families_with_schedule: 2,
      families_regenerable: 2,
    }));
    fixture.componentInstance.projects = [project];
    fixture.componentInstance.projectsLoaded = true;
    fixture.componentInstance.canManage = true;
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Installments generated');
    expect(el.querySelector('[aria-label="Generate installments for Parish Hall"]')).toBeFalsy();
    expect(el.querySelector('[aria-label="Regenerate unpaid installments for Parish Hall"]')).toBeTruthy();
    expect(el.querySelector('[aria-label="View installments for Parish Hall"]')).toBeTruthy();
  });

  it('asks for a reason before replacing unpaid installments', () => {
    const project = projectWith(schedule({
      state: 'generated',
      can_generate: false,
      can_regenerate: true,
      families_regenerable: 1,
      active_count: 2,
    }));
    fixture.componentInstance.projects = [project];
    fixture.componentInstance.projectsLoaded = true;
    fixture.componentInstance.canManage = true;
    fixture.detectChanges();

    (fixture.nativeElement.querySelector(
      '[aria-label="Regenerate unpaid installments for Parish Hall"]'
    ) as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(generateProjectInstallments).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Replace unpaid installments?');
    const confirm = fixture.nativeElement.querySelector('.cf-btn-primary') as HTMLButtonElement | null;
    const reason = fixture.nativeElement.querySelector('#cf-confirm-description') as HTMLTextAreaElement;
    expect(reason).toBeTruthy();
    reason.value = 'short';
    reason.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const regenerateButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find((button) =>
      (button as HTMLButtonElement).textContent?.includes('Regenerate')
    ) as HTMLButtonElement;
    expect(regenerateButton.disabled).toBe(true);
    expect(confirm).toBeTruthy();
  });

  it('regenerates only after the reason is confirmed', () => {
    const project = projectWith(schedule({
      state: 'generated',
      can_generate: false,
      can_regenerate: true,
      families_regenerable: 1,
    }));
    generateProjectInstallments.mockReturnValue(of({
      success: true,
      message: 'Updated the unpaid installment schedule.',
      data: {
        outcome: 'regenerated',
        installments: 2,
        created: 0,
        updated: 2,
        schedule: schedule({
          state: 'generated',
          can_generate: false,
          can_regenerate: true,
          active_count: 2,
        }),
      },
    }));
    fixture.componentInstance.projects = [project];
    fixture.componentInstance.canManage = true;
    fixture.componentInstance.requestRegenerate(project);
    fixture.componentInstance.confirmRegenerate({
      confirmed: true,
      description: 'Parish council shortened the roof campaign.',
    });
    fixture.detectChanges();

    expect(generateProjectInstallments).toHaveBeenCalledWith('proj-1', {
      mode: 'regenerate',
      confirm: true,
      reason: 'Parish council shortened the roof campaign.',
    });
    expect(toastSuccess).toHaveBeenCalled();
    expect(fixture.componentInstance.regenerateProject).toBeNull();
  });

  it('offers view only when every family has a payment', () => {
    const project = projectWith(schedule({
      state: 'payments_recorded',
      can_generate: false,
      can_regenerate: false,
      paid_count: 2,
      families_with_payments: 2,
      families_with_schedule: 2,
      active_count: 2,
    }));
    fixture.componentInstance.projects = [project];
    fixture.componentInstance.projectsLoaded = true;
    fixture.componentInstance.canManage = true;
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Payments recorded');
    expect(el.querySelector('[aria-label="Generate installments for Parish Hall"]')).toBeFalsy();
    expect(el.querySelector('[aria-label="Regenerate unpaid installments for Parish Hall"]')).toBeFalsy();
    expect(el.querySelector('[aria-label="View installments for Parish Hall"]')).toBeTruthy();
  });

  it('can regenerate unpaid families while paid families stay locked', () => {
    const project = projectWith(schedule({
      state: 'payments_recorded',
      can_generate: false,
      can_regenerate: true,
      families_with_payments: 1,
      families_regenerable: 3,
      active_count: 8,
    }));
    fixture.componentInstance.projects = [project];
    fixture.componentInstance.projectsLoaded = true;
    fixture.componentInstance.canManage = true;
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Payments recorded');
    expect(el.querySelector('[aria-label="Regenerate unpaid installments for Parish Hall"]')).toBeTruthy();
    expect(el.querySelector('[aria-label="View installments for Parish Hall"]')).toBeTruthy();
  });
});
