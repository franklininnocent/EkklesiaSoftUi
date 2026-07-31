import { Component, ChangeDetectionStrategy } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, RouterModule } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { SETTINGS_ROUTES } from './settings.routes';
import { rbacGuard } from '@core/guards/rbac.guard';
import { AuthService } from '@core/services/auth.service';
import { of } from 'rxjs';

@Component({
  selector: 'app-dummy-shell',
  template: '<router-outlet></router-outlet>',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
class DummyShellComponent {}

describe('SETTINGS_ROUTES + rbacGuard integration', () => {
  it('registers rbacGuard on roles-permissions route', () => {
    const rolesRoute = SETTINGS_ROUTES.find(route => route.path === 'roles-permissions');
    expect(rolesRoute?.canActivate).toContain(rbacGuard);
  });

  it('allows navigation to roles-permissions for tenant admin', async () => {
    const authServiceMock = {
      currentUser$: of({ id: 10, tenant_id: 5 }),
      isSuperAdmin: jest.fn().mockReturnValue(false),
      isEkklesiaAdmin: jest.fn().mockReturnValue(false),
      isTenantAdmin: jest.fn().mockReturnValue(true),
      hasAnyPermission: jest.fn().mockReturnValue(false)
    };

    await TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([
          {
            path: '',
            component: DummyShellComponent,
            children: [
              {
                path: 'settings/roles-permissions',
                canActivate: [rbacGuard],
                component: DummyShellComponent
              }
            ]
          },
          { path: 'dashboard', component: DummyShellComponent },
          { path: 'auth/login', component: DummyShellComponent }
        ]),
        RouterModule,
        DummyShellComponent
      ],
      providers: [{ provide: AuthService, useValue: authServiceMock }]
    }).compileComponents();

    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    const ok = await router.navigateByUrl('/settings/roles-permissions');
    expect(ok).toBe(true);
  });

  it('denies navigation for tenant non-admin without permissions', async () => {
    const authServiceMock = {
      currentUser$: of({ id: 11, tenant_id: 5 }),
      isSuperAdmin: jest.fn().mockReturnValue(false),
      isEkklesiaAdmin: jest.fn().mockReturnValue(false),
      isTenantAdmin: jest.fn().mockReturnValue(false),
      hasAnyPermission: jest.fn().mockReturnValue(false)
    };

    await TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([
          {
            path: '',
            component: DummyShellComponent,
            children: [
              {
                path: 'settings/roles-permissions',
                canActivate: [rbacGuard],
                component: DummyShellComponent
              }
            ]
          },
          { path: 'dashboard', component: DummyShellComponent },
          { path: 'auth/login', component: DummyShellComponent }
        ]),
        RouterModule,
        DummyShellComponent
      ],
      providers: [{ provide: AuthService, useValue: authServiceMock }]
    }).compileComponents();

    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    const ok = await router.navigateByUrl('/settings/roles-permissions');
    expect(ok).toBe(false);
  });
});
