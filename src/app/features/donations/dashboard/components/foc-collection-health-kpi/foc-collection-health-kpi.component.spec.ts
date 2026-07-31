import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FocCollectionHealthKpiComponent } from './foc-collection-health-kpi.component';
import { CollectionHealthPayload } from '../../../models/donation.model';

describe('FocCollectionHealthKpiComponent', () => {
  let fixture: ComponentFixture<FocCollectionHealthKpiComponent>;

  const health: CollectionHealthPayload = {
    score: 71,
    max_score: 100,
    label: 'Attention Needed',
    status: 'attention',
    status_label: 'Moderate Risk',
    summary: '12 families need follow-up.',
    trend_pct: -4,
    trend_direction: 'down',
    issue_count: 2,
    primary_reason: '12 families require follow-up',
    secondary_reason: 'Building Fund behind by INR 45,000.00',
    action_label: 'Review Issues',
    action_route: '/donations/collection-health',
    factors: [
      { key: 'completion', label: 'Collection Completion Rate', score: 68, weight_pct: 35, status: 'attention' },
      { key: 'participation', label: 'Family Participation Rate', score: 72, weight_pct: 35, status: 'attention' },
      { key: 'overdue', label: 'Overdue Contributions', score: 55, weight_pct: 30, status: 'attention' }
    ],
    issues: [],
    recommended_actions: [],
    insights: []
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FocCollectionHealthKpiComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(FocCollectionHealthKpiComponent);
    fixture.componentInstance.health = health;
    fixture.detectChanges();
  });

  it('renders actionable collection health score details', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Collection Health Score');
    expect(text).toContain('71');
    expect(text).toContain('Moderate Risk');
    expect(text).toContain('12 families require follow-up');
    expect(text).toContain('Review Issues');
  });

  it('links to the collection health center', () => {
    const link = fixture.nativeElement.querySelector('a.foc-health-kpi') as HTMLAnchorElement;
    expect(link.getAttribute('ng-reflect-router-link') || link.getAttribute('href')).toBeTruthy();
  });
});
