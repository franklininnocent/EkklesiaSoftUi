import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, firstValueFrom } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ekklesiaGuard } from './ekklesia.guard';

describe('ekklesiaGuard', () => {
  let routerNavigateSpy: jest.SpyInstance;
  let authMock: { currentUser$: any; hasEkklesiaRole: jest.Mock };

  beforeEach(() => {
    authMock = {
      currentUser$: of(null),
      hasEkklesiaRole: jest.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate: jest.fn() } },
        { provide: AuthService, useValue: authMock },
      ],
    });

    routerNavigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate');
  });

  it('allows Ekklesia user during active support session', async () => {
    authMock.currentUser$ = of({ id: 1, role_name: 'EkklesiaAdmin' } as any);
    authMock.hasEkklesiaRole.mockReturnValue(true);

    const result$ = TestBed.runInInjectionContext(() =>
      ekklesiaGuard({} as any, { url: '/settings/ecclesiastical' } as any)
    ) as any;

    await expect(firstValueFrom(result$)).resolves.toBe(true);
  });

  it('allows Ekklesia user when support overlay is inactive', async () => {
    authMock.currentUser$ = of({ id: 1, role_name: 'EkklesiaAdmin' } as any);
    authMock.hasEkklesiaRole.mockReturnValue(true);

    const result$ = TestBed.runInInjectionContext(() =>
      ekklesiaGuard({} as any, { url: '/settings/ecclesiastical' } as any)
    ) as any;

    await expect(firstValueFrom(result$)).resolves.toBe(true);
  });
});
