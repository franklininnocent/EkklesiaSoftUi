import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { MassIntentionsApiService, MassIntentionsHomeSummary } from '../services/mass-intentions-api.service';
import { MassIntentionsHomePageComponent } from './mass-intentions-home.page';

function buildSummary(): MassIntentionsHomeSummary {
  return {
    queue: { open: 2, closed: 1 },
    kpis: {
      open: 2,
      closed: 1,
      intentions_registered_this_month: 3,
      intentions_registered_last_month: 1,
    },
    requests: { open: 2, closed: 1 },
    period: {
      label: 'September 2026',
      intentions_registered_this_month: 3,
    },
    trend: [
      { month: '2026-09', label: 'Sep 2026', registered: 3, closed: 1, is_current: true },
    ],
  };
}

describe('MassIntentionsHomePageComponent', () => {
  let fixture: ComponentFixture<MassIntentionsHomePageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MassIntentionsHomePageComponent],
      providers: [
        provideRouter([]),
        {
          provide: MassIntentionsApiService,
          useValue: {
            getHome: jest.fn().mockReturnValue(of({ success: true, data: buildSummary() })),
          },
        },
        {
          provide: AuthService,
          useValue: {
            hasTenantPermission: (name: string) =>
              ['mass.intentions.create', 'mass.intentions.register.export'].includes(name),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MassIntentionsHomePageComponent);
    fixture.detectChanges();
  });

  it('shows dashboard KPIs and new intention action', () => {
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Open');
    expect(text).toContain('Closed');
    expect(text).toContain('New intention');
  });
});
