import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, firstValueFrom } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { applicationAccessGuard } from './application-access.guard';

describe('applicationAccessGuard', () => {
  let routerNavigateSpy: jest.SpyInstance;
  let authMock: { currentUser$: any; canAccessApplicationAccess: jest.Mock };

  beforeEach(() => {
    authMock = {
      currentUser$: of(null),
      canAccessApplicationAccess: jest.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate: jest.fn() } },
        { provide: AuthService, useValue: authMock },
      ],
    });

    routerNavigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate');
  });

  it('allows Application Access during active support session', async () => {
    authMock.currentUser$ = of({ id: 1, role_name: 'EkklesiaAdmin' } as any);
    authMock.canAccessApplicationAccess.mockReturnValue(true);

    const result$ = TestBed.runInInjectionContext(() =>
      applicationAccessGuard({} as any, { url: '/application-access' } as any)
    ) as any;

    await expect(firstValueFrom(result$)).resolves.toBe(true);
    expect(routerNavigateSpy).not.toHaveBeenCalled();
  });
});
