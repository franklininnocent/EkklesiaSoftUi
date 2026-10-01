import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { MassIntentionsWorkspaceShellComponent } from './mass-intentions-workspace-shell.component';
import { MassIntentionsWorkspaceShellV1Component } from './mass-intentions-workspace-shell.v1.component';
import { MassIntentionsWorkspaceShellV2Component } from './mass-intentions-workspace-shell.v2.component';

function routerProviders(initialUrl: string) {
  return [
    {
      provide: Router,
      useValue: {
        url: initialUrl,
        events: of(new NavigationEnd(1, initialUrl, initialUrl)),
        navigateByUrl: () => Promise.resolve(true),
      },
    },
    {
      provide: ActivatedRoute,
      useValue: {
        snapshot: { params: {}, queryParams: {}, data: {} },
      },
    },
  ];
}

describe('MassIntentionsWorkspaceShellComponent', () => {
  let fixture: ComponentFixture<MassIntentionsWorkspaceShellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MassIntentionsWorkspaceShellComponent,
        MassIntentionsWorkspaceShellV1Component,
        MassIntentionsWorkspaceShellV2Component,
      ],
      providers: [
        ...routerProviders('/mass-intentions/masses/week'),
        {
          provide: AuthService,
          useValue: {
            hasTenantPermission: () => true,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MassIntentionsWorkspaceShellComponent);
    fixture.detectChanges();
  });

  it('renders Version 2 compact chrome by default', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('app-mass-intentions-workspace-shell-v2')).toBeTruthy();
    expect(host.querySelector('.mass-intentions-shell__nav-row')).toBeTruthy();
    expect(host.querySelectorAll('.mass-intentions-shell__nav-row').length).toBe(1);
    expect(host.querySelector('.cf-workspace-nav')).toBeFalsy();
    const text = host.textContent ?? '';
    expect(text).toContain('Dashboard');
    expect(text).toContain('Week view');
    expect(text).not.toContain('Parish overview');
  });

  it('exposes router-outlet for child routes', () => {
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
  });
});

describe('MassIntentionsWorkspaceShellV1Component', () => {
  let fixture: ComponentFixture<MassIntentionsWorkspaceShellV1Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MassIntentionsWorkspaceShellV1Component],
      providers: [
        ...routerProviders('/mass-intentions/intentions'),
        {
          provide: AuthService,
          useValue: {
            hasTenantPermission: () => true,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MassIntentionsWorkspaceShellV1Component);
    fixture.detectChanges();
  });

  it('renders card workspace tabs with hint lines and intentions subnav', () => {
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Parish overview');
    expect(text).toContain('Office register');
    expect(fixture.nativeElement.querySelector('.cf-workspace-nav')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.cf-workspace-subnav')).toBeTruthy();
  });
});

describe('MassIntentionsWorkspaceShellV2Component', () => {
  let fixture: ComponentFixture<MassIntentionsWorkspaceShellV2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MassIntentionsWorkspaceShellV2Component],
      providers: [
        ...routerProviders('/mass-intentions/intentions'),
        {
          provide: AuthService,
          useValue: {
            hasTenantPermission: () => true,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MassIntentionsWorkspaceShellV2Component);
    fixture.detectChanges();
  });

  it('hides secondary subnav when only one task link', () => {
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Intentions');
    expect(text).not.toContain('Parish overview');
    expect(fixture.nativeElement.querySelector('.mass-intentions-shell__secondary-group')).toBeFalsy();
  });
});
