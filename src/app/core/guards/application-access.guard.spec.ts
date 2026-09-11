import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Observable, of, firstValueFrom } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { User } from '@core/models/user.model';
import { applicationAccessGuard } from './application-access.guard';

describe('applicationAccessGuard', () => {
  const navigate = jest.fn();
  let auth: {
    currentUser$: Observable<User | null>;
    canAccessApplicationAccess: jest.Mock;
  };

  beforeEach(() => {
    navigate.mockReset();
    auth = {
      currentUser$: of(null),
      canAccessApplicationAccess: jest.fn(() => false),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: { navigate } },
      ],
    });
  });

  it('redirects unauthenticated users to login', async () => {
    auth.currentUser$ = of(null);

    const result$ = TestBed.runInInjectionContext(() =>
      applicationAccessGuard({} as any, { url: '/application-access' } as any)
    ) as any;

    await expect(firstValueFrom(result$)).resolves.toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/application-access' },
    });
  });

  it('allows platform users with Application Access permission', async () => {
    auth.currentUser$ = of({
      id: 1,
      has_ekklesia_role: true,
      permissions: [{ name: 'application_access.view' }],
    } as any);
    auth.canAccessApplicationAccess.mockReturnValue(true);

    const result$ = TestBed.runInInjectionContext(() =>
      applicationAccessGuard({} as any, { url: '/application-access' } as any)
    ) as any;

    await expect(firstValueFrom(result$)).resolves.toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('redirects tenant users to dashboard', async () => {
    auth.currentUser$ = of({
      id: 2,
      tenant_id: 42,
      has_ekklesia_role: false,
      permissions: [],
    } as any);
    auth.canAccessApplicationAccess.mockReturnValue(false);

    const result$ = TestBed.runInInjectionContext(() =>
      applicationAccessGuard({} as any, { url: '/application-access' } as any)
    ) as any;

    await expect(firstValueFrom(result$)).resolves.toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/dashboard'], {
      queryParams: {
        error: 'forbidden',
        message: 'You do not have permission to view Application Access.',
      },
    });
  });
});
