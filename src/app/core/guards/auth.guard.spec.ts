import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '@core/services/auth.service';

describe('authGuard', () => {
  let routerNavigateSpy: jest.SpyInstance;
  let authService: { isAuthenticated: jest.Mock<boolean, []> };

  beforeEach(() => {
    const routerSpy = {
      navigate: jest.fn()
    } as unknown as Router;

    authService = { isAuthenticated: jest.fn() } as any;

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: AuthService, useValue: authService }
      ]
    });

    const router = TestBed.inject(Router);
    routerNavigateSpy = jest.spyOn(router, 'navigate');
  });

  it('returns true when user is authenticated', () => {
    authService.isAuthenticated.mockReturnValue(true);
    const result = TestBed.runInInjectionContext(() => authGuard({} as any, { url: '/protected' } as any));
    expect(result).toBe(true);
    expect(routerNavigateSpy).not.toHaveBeenCalled();
  });

  it('navigates to /auth/login with returnUrl when not authenticated', () => {
    authService.isAuthenticated.mockReturnValue(false);
    const result = TestBed.runInInjectionContext(() => authGuard({} as any, { url: '/protected' } as any));
    expect(result).toBe(false);
    expect(routerNavigateSpy).toHaveBeenCalledWith(['/auth/login'], { queryParams: { returnUrl: '/protected' } });
  });
});


