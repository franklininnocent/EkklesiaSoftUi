import { buildOperationsHubViewModel } from './operations-hub.view-model';
import { FinancialCommandCenterPayload } from '../../models/donation.model';
import { mockCollectionHealth } from './collection-health.mock';

describe('buildOperationsHubViewModel', () => {
  const base = {
    meta: {
      church_name: 'Sacred Heart',
      last_synced_at: new Date().toISOString(),
      currency_code: 'INR',
      operator_name: 'Fr. Thomas'
    },
    health_index: { score: 88, label: 'Excellent', status: 'healthy' },
    collection_health: mockCollectionHealth({ score: 91, status: 'healthy', status_label: 'Excellent', trend_pct: 18 }),
    executive_cards: [
      { key: 'outstanding', label: 'Outstanding', value: 12500, comparison_period: '', context_message: '' },
      { key: 'projects', label: 'Projects', value: 62, comparison_period: '', context_message: '' }
    ],
    action_center: [
      {
        key: 'families_follow_up',
        priority: 'high',
        title: 'Families Requiring Follow-Up',
        affected_count: 12,
        expected_amount: 8500,
        summary: '12 families need pastoral or secretary follow-up.',
        suggested_actions: [],
        cta_route: '/donations/dues'
      },
      {
        key: 'project_funding_gaps',
        priority: 'medium',
        title: 'Project Funding Gaps',
        affected_count: 1,
        expected_amount: 25000,
        summary: 'Building Fund is below target.',
        suggested_actions: [],
        cta_route: '/donations/projects'
      }
    ],
    analytics: {
      family_engagement: {
        active_contributors: 120,
        inactive_families: 28,
        participation_rate: 75,
        contributing_families_delta: 2
      },
      collection_trend: [],
      geographic: { by_bcc: [{ area_name: 'Ward B', collected: 5000, family_count: 20, participation_density: 80 }], by_city: [] },
      project_funding: []
    },
    collections_command: {
      today_collected: 15250,
      today_count: 8,
      families_processed_today: 8,
      target: 20000,
      completion_pct: 76
    },
    projects_command: [
      {
        project_id: '1',
        name: 'Building Fund',
        target_amount: 100000,
        collected: 40000,
        funding_gap: 60000,
        funding_percentage: 40,
        risk_level: 'high',
        status: 'active'
      }
    ],
    communication_center: {
      whatsapp_queued: 3,
      whatsapp_sent: 42,
      whatsapp_failed: 0,
      families_awaiting_follow_up: 12
    },
    expense_summary: {
      month_total: 5000,
      annual_total: 50000,
      expense_ratio_pct: 12,
      recent: [{ id: 'e1', category: 'Utilities', amount: 1200, expense_date: new Date().toISOString() }]
    },
    contribution_intelligence: {
      top_contributors: [],
      recent_contributors: [
        {
          family_id: 'f1',
          family_name: 'Thomas Family',
          amount: 500,
          payment_date: new Date().toISOString()
        }
      ]
    },
    intelligence: [],
    ai_advisor: { insights: [], recommended_actions: [], narratives: [] }
  } as unknown as FinancialCommandCenterPayload;

  it('builds priority cards with expected amounts', () => {
    const vm = buildOperationsHubViewModel(base, 'INR');
    expect(vm.hasActivePriorities).toBe(true);
    expect(vm.openTasksCount).toBeGreaterThan(0);
    expect(vm.priorities.some((card) => card.expectedAmount)).toBe(true);
  });

  it('builds workflow groups and insights', () => {
    const vm = buildOperationsHubViewModel(base, 'INR');
    expect(vm.workflowGroups).toHaveLength(3);
    expect(vm.insights.length).toBeGreaterThan(0);
    expect(vm.timeline.length).toBeGreaterThan(0);
  });

  it('shows healthy empty state when no active priorities', () => {
    const clear = {
      ...base,
      collection_health: mockCollectionHealth({ score: 91, status: 'healthy', status_label: 'Excellent', issues: [] }),
      action_center: base.action_center!.map((queue) => ({ ...queue, affected_count: 0, expected_amount: 0, priority: 'low' }))
    } as FinancialCommandCenterPayload;
    const vm = buildOperationsHubViewModel(clear, 'INR');
    expect(vm.hasActivePriorities).toBe(false);
    expect(vm.priorities[0].title).toBe('Collection Performance');
  });
});
