import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FocCommandBarComponent } from './foc-command-bar.component';
import { FinancialCommandCenterPayload } from '../../../models/donation.model';
import { mockCollectionHealth } from '../../utils/collection-health.mock';

describe('FocCommandBarComponent', () => {
  let fixture: ComponentFixture<FocCommandBarComponent>;

  const data = {
    meta: {
      church_name: 'Sacred Heart Church',
      financial_year: '2026-2027',
      operator_role: 'Administrator',
      last_synced_at: new Date().toISOString(),
      currency_code: 'INR'
    },
    health_index: { score: 88, label: 'Excellent', status: 'healthy' },
    collection_health: mockCollectionHealth({ score: 88, status: 'healthy', status_label: 'On Track', label: 'Healthy', primary_reason: 'Collections are on track' }),
    executive_cards: [
      { key: 'outstanding', label: 'Outstanding Dues', value: 0, comparison_period: '', context_message: '' },
      { key: 'projects', label: 'Project Funding Status', value: 82, comparison_period: '', context_message: '' }
    ],
    action_center: [{ key: 'families_follow_up', affected_count: 0, priority: 'low', title: '', expected_amount: 0, summary: '', suggested_actions: [], cta_route: '' }],
    analytics: { family_engagement: { active_contributors: 3, inactive_families: 0, participation_rate: 80, contributing_families_delta: 1 }, collection_trend: [], geographic: { by_bcc: [], by_city: [] }, project_funding: [] },
    collections_command: { today_collected: 1550, today_count: 3, families_processed_today: 3, target: 5000, completion_pct: 31 },
    persona: {
      persona: 'secretary' as const,
      label: 'Secretary View',
      emphasis: 'Fast family follow-up, receipts, and daily collections.',
      sections: [] as string[],
      quick_actions: [{ id: 'collect', label: 'Quick collect' }, { id: 'receipts', label: 'Receipts hub' }]
    }
  } as unknown as FinancialCommandCenterPayload;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FocCommandBarComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(FocCommandBarComponent);
    fixture.componentInstance.data = data;
    fixture.componentInstance.period = 'month';
    fixture.detectChanges();
  });

  it('renders the executive header hierarchy', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Financial Operations Center');
    expect(text).toContain('Sacred Heart Church');
    expect(text).toContain('Operations Hub');
    expect(text).toContain('Collect Contribution');
    expect(text).toContain("Today's Collections");
    expect(text).toContain('Collection Health Score');
  });

  it('renders persona quick actions and operational status', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Quick collect');
    expect(text).toContain('Collections running normally');
    expect(text).toContain('3 contributions received today');
  });
});
