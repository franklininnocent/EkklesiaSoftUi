import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FocOperationsHubComponent } from './foc-workspace-menu.component';
import { FinancialCommandCenterPayload } from '../../../models/donation.model';
import { mockCollectionHealth } from '../../utils/collection-health.mock';

describe('FocOperationsHubComponent', () => {
  let fixture: ComponentFixture<FocOperationsHubComponent>;
  let component: FocOperationsHubComponent;

  const data = {
    meta: {
      church_name: 'Sacred Heart Church',
      last_synced_at: new Date().toISOString(),
      currency_code: 'INR',
      operator_name: 'Administrator'
    },
    health_index: { score: 88, label: 'Excellent', status: 'healthy' },
    collection_health: mockCollectionHealth({ score: 91, status: 'healthy', status_label: 'Excellent' }),
    executive_cards: [
      { key: 'outstanding', label: 'Outstanding', value: 12500, comparison_period: '', context_message: '' },
      { key: 'projects', label: 'Projects', value: 62, comparison_period: '', context_message: '' }
    ],
    action_center: [
      {
        key: 'families_follow_up',
        priority: 'high',
        title: 'Families Requiring Follow-Up',
        affected_count: 7,
        expected_amount: 12500,
        summary: '7 families need follow-up.',
        suggested_actions: [],
        cta_route: '/donations/dues'
      }
    ],
    analytics: {
      family_engagement: { active_contributors: 120, inactive_families: 28, participation_rate: 75, contributing_families_delta: 2 },
      collection_trend: [],
      geographic: { by_bcc: [], by_city: [] },
      project_funding: []
    },
    collections_command: {
      today_collected: 15250,
      today_count: 8,
      families_processed_today: 8,
      target: 20000,
      completion_pct: 76
    },
    projects_command: [],
    communication_center: { whatsapp_queued: 0, whatsapp_sent: 0, whatsapp_failed: 0, families_awaiting_follow_up: 7 },
    expense_summary: { month_total: 0, annual_total: 0, expense_ratio_pct: 0, recent: [] },
    contribution_intelligence: { top_contributors: [], recent_contributors: [] },
    intelligence: [],
    ai_advisor: { insights: [], recommended_actions: [], narratives: [] }
  } as unknown as FinancialCommandCenterPayload;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FocOperationsHubComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(FocOperationsHubComponent);
    component = fixture.componentInstance;
    component.data = data;
    fixture.detectChanges();
  });

  afterEach(() => {
    document.body.style.overflow = '';
    document.querySelector('.foc-ops-portal')?.remove();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should open the enterprise drawer with priority section', () => {
    component.toggle();
    fixture.detectChanges();
    expect(component.open).toBe(true);
    expect(component.vm?.priorities.length).toBeGreaterThan(0);
    expect(component.vm?.workflowGroups.length).toBe(3);
    const drawerText = document.body.querySelector('.foc-ops__drawer')?.textContent ?? '';
    expect(drawerText).toContain('Priority Actions');
    expect(drawerText).toContain('Quick Workflows');
  });

  it('should emit quick collect from workflow tile', () => {
    const spy = jest.spyOn(component.quickCollect, 'emit');
    component.toggle();
    fixture.detectChanges();
    const collectItem = component.vm!.workflowGroups[0].items[0];
    component.onWorkflowItem(collectItem);
    expect(spy).toHaveBeenCalled();
  });

  it('should close on escape', () => {
    component.toggle();
    fixture.detectChanges();
    component.onEscape();
    expect(component.open).toBe(false);
  });
});
