import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { FinancialCommandCenterPageComponent } from './financial-command-center.page';
import { CommandCenterDataService } from './services/command-center-data.service';
import { QuickCollectService } from '../services/quick-collect.service';
import { mockCollectionHealth } from './utils/collection-health.mock';

describe('FinancialCommandCenterPageComponent', () => {
  let component: FinancialCommandCenterPageComponent;

  const commandCenterPayload = {
    meta: { church_name: 'St. Mary Parish', currency_code: 'INR', last_synced_at: new Date().toISOString() },
    health_index: { score: 72, label: 'Stable', status: 'attention', summary: 'Review collections' },
    collection_health: mockCollectionHealth(),
    executive_cards: [{ key: 'month_collected', label: 'Month', value: 1000, comparison_period: 'MoM', context_message: 'ok' }],
    action_center: [],
    analytics: {
      collection_trend: [{ period: '2026-06', label: 'Jun 2026', collected: 1000 }],
      collection_performance_chart: {
        granularity: 'month',
        series: [
          { key: 'collected', label: 'Collected', points: [{ period: '2026-06', label: 'Jun 2026', value: 1000 }] },
          { key: 'outstanding', label: 'Outstanding', points: [{ period: '2026-06', label: 'Jun 2026', value: 200 }] },
          { key: 'target', label: 'Target', points: [{ period: '2026-06', label: 'Jun 2026', value: 1200 }] }
        ]
      },
      family_engagement: { active_contributors: 10, inactive_families: 5, participation_rate: 66, contributing_families_delta: 2 },
      geographic: { by_bcc: [], by_city: [] },
      project_funding: []
    },
    intelligence: [],
    ai_advisor: { insights: [], recommended_actions: [], narratives: ['Collections are stable'] },
    contribution_intelligence: { top_contributors: [], recent_contributors: [] },
    collections_command: { today_count: 0, today_collected: 0, families_processed_today: 0, target: 0, completion_pct: 0 },
    projects_command: [],
    communication_center: { whatsapp_queued: 0, whatsapp_sent: 0, whatsapp_failed: 0, families_awaiting_follow_up: 0, recent_messages: [] },
    expense_summary: { month_total: 0, annual_total: 0, expense_ratio_pct: 0, recent: [] },
    totals: { pending_dues: 500 },
    persona: {
      persona: 'admin',
      label: 'Administrator View',
      emphasis: 'Full financial visibility across the parish.',
      sections: ['health_overview', 'action_center', 'analytics'],
      quick_actions: [{ id: 'collect', label: 'Quick collect' }]
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinancialCommandCenterPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: CommandCenterDataService,
          useValue: {
            loadCommandCenter: jest.fn().mockReturnValue(of(commandCenterPayload)),
            loadRollup: jest.fn().mockReturnValue(of({ available: false })),
            createExpense: jest.fn().mockReturnValue(of({
              id: 'exp-1',
              category: 'Utilities',
              amount: 100,
              payee: 'Vendor',
              method: 'cash',
              status: 'recorded'
            }))
          }
        },
        {
          provide: QuickCollectService,
          useValue: { open: jest.fn() }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(FinancialCommandCenterPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads command center payload on init', () => {
    expect(component.data?.meta.church_name).toBe('St. Mary Parish');
    expect(component.loading).toBe(false);
  });

  it('shows layers included in persona sections', () => {
    expect(component.showLayer('health_overview')).toBe(true);
    expect(component.showLayer('communication_center')).toBe(false);
  });

  it('supports legacy persona layer aliases', () => {
    if (!component.data) {
      return;
    }
    component.data.persona = {
      persona: 'admin',
      label: 'Administrator View',
      emphasis: 'Full financial visibility across the parish.',
      sections: ['layer_3_actions'],
      quick_actions: [{ id: 'collect', label: 'Quick collect' }]
    };
    expect(component.showLayer('action_center')).toBe(true);
  });

  it('changes period and reloads command center', () => {
    const dataService = TestBed.inject(CommandCenterDataService);
    component.onPeriodChange('quarter');
    expect(component.period).toBe('quarter');
    expect(dataService.loadCommandCenter).toHaveBeenCalled();
  });
});
