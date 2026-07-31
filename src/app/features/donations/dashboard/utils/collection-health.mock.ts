import { CollectionHealthPayload } from '../../models/donation.model';

export function mockCollectionHealth(overrides: Partial<CollectionHealthPayload> = {}): CollectionHealthPayload {
  return {
    score: 71,
    max_score: 100,
    label: 'Attention Needed',
    status: 'attention',
    status_label: 'Moderate Risk',
    summary: '12 families need follow-up. Participation is 66%.',
    trend_pct: -4,
    trend_direction: 'down',
    issue_count: 2,
    primary_reason: '12 families require follow-up',
    secondary_reason: 'Building Fund behind target',
    action_label: 'Review Issues',
    action_route: '/donations/collection-health',
    factors: [
      { key: 'completion', label: 'Collection Completion Rate', score: 68, weight_pct: 35, status: 'attention', trend_pct: -2, trend_direction: 'down' },
      { key: 'participation', label: 'Family Participation Rate', score: 72, weight_pct: 35, status: 'attention', trend_pct: -8, trend_direction: 'down' },
      { key: 'overdue', label: 'Overdue Contributions', score: 55, weight_pct: 30, status: 'attention' },
      { key: 'growth', label: 'Contribution Growth Trend', score: 48, weight_pct: 15, status: 'risk', trend_pct: -4, trend_direction: 'down' },
      { key: 'projects', label: 'Project Funding Progress', score: 62, weight_pct: 20, status: 'attention' }
    ],
    issues: [
      { severity: 'warning', message: '12 families have overdue contributions', cta_route: '/donations/dues' }
    ],
    recommended_actions: [
      { id: 'overdue', label: 'View Overdue Families', route: '/donations/dues' }
    ],
    insights: ['Collection participation decreased by 4.0% compared to last month.'],
    ...overrides
  };
}
