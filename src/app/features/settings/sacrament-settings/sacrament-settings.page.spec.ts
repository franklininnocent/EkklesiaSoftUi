import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { SacramentSettingsPage } from './sacrament-settings.page';
import { SacramentSettingsService } from './sacrament-settings.service';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { TenantSacramentSetting } from './sacrament-settings.model';

describe('SacramentSettingsPage', () => {
  const rows: TenantSacramentSetting[] = [
    {
      id: 1,
      sacrament_type_id: 10,
      code: 'BAPTISM',
      name: 'Baptism',
      description: 'Initiation',
      category: 'initiation',
      is_active: true,
    },
    {
      id: 2,
      sacrament_type_id: 11,
      code: 'MARRIAGE',
      name: 'Matrimony',
      description: 'Service',
      category: 'service',
      is_active: false,
    },
  ];

  const apiStub = {
    list: jest.fn().mockReturnValue(of({ success: true, data: rows })),
    update: jest.fn().mockReturnValue(of({ success: true, data: { ...rows[0], is_active: false } })),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SacramentSettingsPage],
      providers: [
        provideRouter([]),
        { provide: SacramentSettingsService, useValue: apiStub },
        {
          provide: AuthService,
          useValue: {
            isTenantAdmin: () => false,
            hasPermission: (name: string) =>
              name === 'sacraments.settings.view' || name === 'sacraments.settings.manage',
          },
        },
        { provide: ToastService, useValue: { success: jest.fn(), error: jest.fn() } },
      ],
    });
  });

  it('renders sacrament definitions and status, never register records', () => {
    const fixture = TestBed.createComponent(SacramentSettingsPage);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Sacraments Settings');
    expect(text).toContain('Baptism');
    expect(text).toContain('Matrimony');
    expect(text).toContain('Active');
    expect(text).toContain('Inactive');
    expect(text).toContain('configuring availability');
    expect(text).not.toContain('recipient');
    expect(text).not.toContain('registry');
  });

  it('asks for confirmation before deactivating', () => {
    const fixture = TestBed.createComponent(SacramentSettingsPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;

    const checkbox = fixture.debugElement.query(By.css('input[type="checkbox"]'));
    checkbox.nativeElement.checked = false;
    checkbox.triggerEventHandler('change', { target: checkbox.nativeElement });
    fixture.detectChanges();

    expect(page.confirmOpen).toBe(true);
    expect(page.pendingDeactivate?.name).toBe('Baptism');
    expect(apiStub.update).not.toHaveBeenCalled();
  });
});
