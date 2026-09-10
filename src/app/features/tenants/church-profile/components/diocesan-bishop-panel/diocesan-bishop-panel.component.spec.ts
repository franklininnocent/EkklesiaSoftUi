import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { DiocesanBishopPanelComponent } from './diocesan-bishop-panel.component';
import { AuthService } from '@core/services/auth.service';
import { ChurchBishopUpdateService, ChurchProfileService } from '@core/services/church';
import { ToastService } from '@core/services';
import {
  BishopUpdateRequestItem,
  DiocesanLeadership,
} from '@core/models/ecclesiastical';

describe('DiocesanBishopPanelComponent', () => {
  let fixture: ComponentFixture<DiocesanBishopPanelComponent>;
  let component: DiocesanBishopPanelComponent;

  const leadership: DiocesanLeadership = {
    diocese_id: 1,
    diocese_name: 'Kuzhithurai',
    leadership_state: 'active',
    last_verified_at: '2026-01-01T00:00:00Z',
    ordinary: {
      appointment_id: 'appt-1',
      bishop_id: 10,
      bishop_name: 'Most Rev. Dr. Albert Anasthas',
      title: 'Most Rev. Dr.',
      effective_date: '2024-01-13',
      canonical_role: 'diocesan_bishop',
      is_current: true,
    },
    current_appointments: [],
  };

  const requestItem: BishopUpdateRequestItem = {
    id: 'req-1',
    tenant_id: 1,
    diocese_id: 1,
    request_type: 'correct_information',
    proposed_bishop_data: { full_name: 'Most Rev. Dr. Albert Anasthas' },
    status: 'submitted',
    submitted_at: '2026-02-01T10:00:00Z',
    version: 1,
    submitted_by_user: { id: 5, name: 'Parish Admin' },
  };

  const authService = {
    hasTenantPermission: jest.fn().mockReturnValue(true),
  };

  const churchProfileService = {
    getDiocesanLeadership: jest.fn().mockReturnValue(of({ success: true, data: leadership })),
  };

  const bishopUpdateService = {
    list: jest.fn().mockReturnValue(of({
      success: true,
      data: { data: [requestItem], total: 1, current_page: 1, last_page: 1, per_page: 20 },
    })),
    get: jest.fn().mockReturnValue(of({ success: true, data: requestItem })),
  };

  const toastService = {
    error: jest.fn(),
    success: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    authService.hasTenantPermission.mockReturnValue(true);

    await TestBed.configureTestingModule({
      imports: [DiocesanBishopPanelComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: ChurchProfileService, useValue: churchProfileService },
        { provide: ChurchBishopUpdateService, useValue: bishopUpdateService },
        { provide: ToastService, useValue: toastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DiocesanBishopPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders authoritative bishop record', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Kuzhithurai');
    expect(text).toContain('Most Rev. Dr. Albert Anasthas');
    expect(text).toContain('Managed centrally by Ekklesia Admin');
    expect(text).toContain('In office');
  });

  it('shows suggestion workflow table for users with view_own_requests', () => {
    expect(fixture.nativeElement.textContent).toContain('Your Bishop Suggestions');
    expect(fixture.nativeElement.textContent).toContain('Parish Admin');
    expect(fixture.nativeElement.textContent).toContain('Pending');
  });

  it('opens suggestion wizard from primary action', () => {
    const button = fixture.nativeElement.querySelector(
      'button.cf-btn-primary',
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    expect(component.showWizard).toBe(true);
  });

  it('handles missing diocese linkage gracefully', () => {
    churchProfileService.getDiocesanLeadership.mockReturnValueOnce(throwError(() => new HttpErrorResponse({
      error: { message: 'Your church must be linked to a diocese before submitting bishop updates.' },
      status: 422,
    })));

    component.loadLeadership();
    fixture.detectChanges();

    expect(component.noDioceseLinked).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Diocese not linked');
  });

  it('denies access when user lacks bishop permissions', async () => {
    authService.hasTenantPermission.mockReturnValue(false);

    const deniedFixture = TestBed.createComponent(DiocesanBishopPanelComponent);
    deniedFixture.detectChanges();

    expect(deniedFixture.nativeElement.textContent).toContain(
      'You do not have permission to view diocesan bishop information.',
    );
  });

  it('formats review statuses for enterprise display', () => {
    expect(component.formatStatus('under_review')).toBe('Under review');
    expect(component.formatStatus('approved')).toBe('Approved');
    expect(component.formatStatus('rejected')).toBe('Rejected');
  });
});
