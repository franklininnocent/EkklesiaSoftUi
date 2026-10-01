import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { NavMenuService } from '@core/services/nav-menu.service';
import { EntitlementService } from '@core/services/entitlement.service';
import { StewardshipWorkspaceShellComponent } from './stewardship-workspace-shell.component';

describe('StewardshipWorkspaceShellComponent', () => {
  let fixture: ComponentFixture<StewardshipWorkspaceShellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        StewardshipWorkspaceShellComponent,
        RouterTestingModule.withRoutes([
          { path: 'donations/collection-day', component: StewardshipWorkspaceShellComponent },
        ]),
      ],
      providers: [
        {
          provide: NavMenuService,
          useValue: { isRouteAllowed: () => true },
        },
        {
          provide: EntitlementService,
          useValue: { entitlements: () => ({}) },
        },
      ],
    }).compileComponents();

    const router = TestBed.inject(Router);
    await router.navigateByUrl('/donations/collection-day');

    fixture = TestBed.createComponent(StewardshipWorkspaceShellComponent);
    fixture.detectChanges();
  });

  it('always renders workspace chrome on collection day', () => {
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Dashboard');
    expect(text).toContain('Collect payments');
    expect(text).toContain('Operational collection');
    expect(text).toContain('Projects');
    expect(text).toContain('Configure');
    expect(text).toContain('Collection Day');
    expect(fixture.nativeElement.querySelector('.stewardship-shell__chrome-panel')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.stewardship-shell__header')).toBeFalsy();
  });
});
