import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { of } from 'rxjs';
import { NavMenuService } from '@core/services/nav-menu.service';
import { EntitlementService } from '@core/services/entitlement.service';
import { StewardshipWorkspaceShellComponent } from './stewardship-workspace-shell.component';

describe('StewardshipWorkspaceShellComponent', () => {
  let fixture: ComponentFixture<StewardshipWorkspaceShellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StewardshipWorkspaceShellComponent],
      providers: [
        {
          provide: Router,
          useValue: {
            url: '/donations/collection-day',
            events: of(new NavigationEnd(1, '/donations/collection-day', '/donations/collection-day')),
            navigateByUrl: () => Promise.resolve(true)
          }
        },
        {
          provide: NavMenuService,
          useValue: { isRouteAllowed: () => true }
        },
        {
          provide: EntitlementService,
          useValue: { entitlements: () => ({}) }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StewardshipWorkspaceShellComponent);
    fixture.detectChanges();
  });

  it('always renders workspace chrome on collection day', () => {
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Dashboard');
    expect(text).toContain('Collect');
    expect(text).toContain('Projects');
    expect(text).toContain('Configure');
    expect(text).toContain('Collection Day');
    expect(fixture.nativeElement.querySelector('.stewardship-shell__chrome')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.stewardship-shell__header')).toBeFalsy();
  });
});
