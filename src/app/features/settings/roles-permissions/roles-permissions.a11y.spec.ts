import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AssignPermissionsModalComponent } from './assign-permissions-modal/assign-permissions-modal.component';
import { PermissionsService } from '@core/services/permissions.service';
import { ToastService } from '@core/services/toast.service';
import { AuthService } from '@core/services/auth.service';

describe('Roles & Permissions accessibility', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssignPermissionsModalComponent],
      providers: [
        {
          provide: PermissionsService,
          useValue: {
            getPermissions: jest.fn().mockReturnValue(of({ data: [] })),
            getPermissionsForRole: jest.fn().mockReturnValue(of({ data: [] })),
            bulkAssignToRole: jest.fn().mockReturnValue(of({}))
          }
        },
        {
          provide: ToastService,
          useValue: {
            success: jest.fn(),
            info: jest.fn(),
            warning: jest.fn(),
            error: jest.fn()
          }
        },
        {
          provide: AuthService,
          useValue: {
            isSuperAdmin: jest.fn().mockReturnValue(false)
          }
        }
      ]
    }).compileComponents();
  });

  it('renders modal with dialog semantics and accessible close control', () => {
    const fixture = TestBed.createComponent(AssignPermissionsModalComponent);
    const component = fixture.componentInstance;
    component.show = true;
    component.role = { id: 1, name: 'Administrator' } as any;
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const dialog = host.querySelector('.modal-overlay');
    const closeButton = host.querySelector('.btn-close');

    expect(dialog?.getAttribute('role')).toBe('dialog');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(closeButton?.getAttribute('aria-label')).toBe('Close assign permissions modal');
  });

  it('announces inline and safeguard errors as alerts', () => {
    const fixture = TestBed.createComponent(AssignPermissionsModalComponent);
    const component = fixture.componentInstance;
    component.show = true;
    component.role = null as any;
    component.isLoading = false;
    component.errorMessage = 'Permission load failed';
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const alert = host.querySelector('.error-banner');
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.getAttribute('aria-live')).toBe('polite');
  });
});
