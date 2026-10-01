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
      needs_a_tick: 1,
      needs_a_mass: 2,
      this_week_masses: 5,
      offering_received_this_month: '25.00',
      receipts_this_month: 1,
    },
    period: {
      label: 'September 2026',
      intentions_registered_this_month: 3,
      created_from: '2026-09-01',
      created_to: '2026-10-01',
    },
    offerings: {
      received_this_month: '25.00',
      received_last_month: '0',
      receipts_this_month: 1,
    },
    trend: [
      { month: '2026-08', label: 'Aug 2026', registered: 0, closed: 0, said: 0 },
      { month: '2026-09', label: 'Sep 2026', registered: 3, closed: 1, said: 4, is_current: true },
    ],
    operational: {
      needs_a_tick: 1,
      needs_a_mass: 2,
    },
    upcoming_celebrations: [
      {
        id: 'mass-1',
        celebrated_on: '2026-09-30',
        celebrated_at: '09:00',
        place: 'Main church',
        intention_count: 2,
      },
    ],
    generation: { attention_required: false },
    meta: {
      next_upcoming_celebration_id: 'mass-1',
    },
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
              ['mass.intentions.create', 'mass.intentions.offerings.view', 'mass.intentions.register.export'].includes(
                name,
              ),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MassIntentionsHomePageComponent);
    fixture.detectChanges();
  });

  it('shows executive KPIs and attention strip', () => {
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Open');
    expect(text).toContain('Registered this month');
    expect(text).toContain('This week');
    expect(text).toContain('Needs attention');
    expect(text).not.toContain('Office actions');
    expect(text).not.toContain('New intention');
  });

  it('lists next Masses with intention count', () => {
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Next Masses');
    expect(text).toContain('Next Mass');
    expect(text).toContain('Main church');
    expect(text).toContain('2');
    expect(text).toContain('intentions');
  });
});
