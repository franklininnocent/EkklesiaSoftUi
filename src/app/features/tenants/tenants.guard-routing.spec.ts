import { Component, ChangeDetectionStrategy } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, RouterModule } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { tenantAdminGuard } from '@core/guards/tenant-admin.guard';
import { TENANTS_ROUTES } from './tenants.routes';

@Component({ selector: 'app-dummy', template: '<router-outlet></router-outlet>', changeDetection: ChangeDetectionStrategy.Eager,
 standalone: true })
class DummyShell {}

describe('Router + tenantAdminGuard integration for Tenants', () => {
  let router: Router;
  let storeSelectSpy: jest.SpyInstance;

  beforeEach(async () => {
    const storeSpy = {
      select: jest.fn()
    } as unknown as Store;

    await TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([
          {
            path: '',
            component: DummyShell,
            children: [
              {
                path: 'tenants',
                canActivate: [tenantAdminGuard],
                children: TENANTS_ROUTES
              }
            ]
          },
          { path: 'dashboard', component: DummyShell },
          { path: 'auth/login', component: DummyShell }
        ]),
        RouterModule,
        DummyShell
      ],
      declarations: [],
      providers: [{ provide: Store, useValue: storeSpy }]
    }).compileComponents();

    router = TestBed.inject(Router);
    await router.navigateByUrl('/');

    const store = TestBed.inject(Store);
    storeSelectSpy = jest.spyOn(store, 'select');
  });

  it('allows navigation for SuperAdmin', async () => {
    storeSelectSpy.mockReturnValue(of({ id: 1, role_name: 'SuperAdmin' } as any));
    const ok = await router.navigateByUrl('/tenants');
    expect(ok).toBe(true);
  });

  it('redirects tenant user to /dashboard', async () => {
    storeSelectSpy.mockReturnValue(of({ id: 2, role_name: 'TenantUser' } as any));
    const ok = await router.navigateByUrl('/tenants');
    expect(ok).toBe(false);
  });

  it('redirects missing user to /auth/login', async () => {
    storeSelectSpy.mockReturnValue(of(null));
    const ok = await router.navigateByUrl('/tenants');
    expect(ok).toBe(false);
  });
});


