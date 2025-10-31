import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { TenantManagerComponent } from './tenant-manager';
import { TenantService } from '@core/services/tenant.service';
import { ToastService } from '@core/services/toast.service';
import { AuthService } from '@core/services/auth.service';

describe('TenantManagerComponent', () => {
  let component: TenantManagerComponent;
  let fixture: ComponentFixture<TenantManagerComponent>;
  let tenantService: any;

  beforeEach(async () => {
    tenantService = { listTenants: jest.fn() } as unknown as TenantService;

    await TestBed.configureTestingModule({
      imports: [TenantManagerComponent],
      providers: [
        { provide: TenantService, useValue: tenantService },
        { provide: ToastService, useValue: { success: () => {}, error: () => {} } },
        { provide: AuthService, useValue: { isAuthenticated: () => true, currentUser: {} } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TenantManagerComponent);
    component = fixture.componentInstance;
  });

  it('loads tenants successfully and populates list', () => {
    const tenants = [
      { id: 1, name: 'T1', active: 1 },
      { id: 2, name: 'T2', active: 0 }
    ] as any[];
    (tenantService.listTenants as any).mockReturnValue(of({ success: true, data: tenants, pagination: { total: 2 } }));

    component.loadTenants();

    expect(component.loading).toBe(false);
    expect(component.error).toBeNull();
    expect(component.allTenants.length).toBe(2);
    expect(component.totalTenants).toBe(2);
    expect(component.tenants.length).toBeGreaterThan(0); // after pagination
  });

  it('sets error on load failure', () => {
    (tenantService.listTenants as any).mockReturnValue(throwError(() => ({ message: 'boom' })));

    component.loadTenants();

    expect(component.loading).toBe(false);
    expect(component.error).toBe('boom');
  });

  it('retryLoad triggers loadTenants', () => {
    const spy = jest.spyOn(component, 'loadTenants').mockImplementation(() => {});
    component.retryLoad();
    expect(spy).toHaveBeenCalled();
  });

  it('open/close modal toggles flag', () => {
    component.openCreateModal();
    expect(component.showCreateModal).toBe(true);
    component.closeCreateModal();
    expect(component.showCreateModal).toBe(false);
  });
});
