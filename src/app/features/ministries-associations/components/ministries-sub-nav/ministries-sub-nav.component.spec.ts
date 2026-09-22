import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { MinistriesSubNavComponent } from './ministries-sub-nav.component';

describe('MinistriesSubNavComponent', () => {
  let fixture: ComponentFixture<MinistriesSubNavComponent>;
  let authMock: { canViewTenantAuditLogs: jest.Mock };

  beforeEach(async () => {
    authMock = {
      canViewTenantAuditLogs: jest.fn(() => false),
    };

    await TestBed.configureTestingModule({
      imports: [MinistriesSubNavComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MinistriesSubNavComponent);
  });

  it('hides audit log for users without tenant audit access', () => {
    fixture.detectChanges();

    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('a.cf-tab-strip__tab'),
    ).map((a) => (a as HTMLElement).textContent?.trim());

    expect(labels).toEqual(['Organizations', 'Guest members', 'Settings']);
  });

  it('shows audit log for default tenant admin', () => {
    authMock.canViewTenantAuditLogs.mockReturnValue(true);
    fixture.detectChanges();

    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('a.cf-tab-strip__tab'),
    ).map((a) => (a as HTMLElement).textContent?.trim());

    expect(labels).toEqual(['Organizations', 'Guest members', 'Settings', 'Audit log']);
  });

  it('returns a stable array reference so repeated change detection does not thrash bindings', () => {
    fixture.detectChanges();

    const first = fixture.componentInstance.tabs;
    const second = fixture.componentInstance.tabs;

    expect(second).toBe(first);
    expect(() => fixture.detectChanges()).not.toThrow();
  });
});
