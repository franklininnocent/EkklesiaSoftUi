import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FocSatellitesGridComponent } from './foc-satellites-grid.component';
import { FinancialCommandCenterPayload } from '../../../models/donation.model';

describe('FocSatellitesGridComponent', () => {
  let fixture: ComponentFixture<FocSatellitesGridComponent>;

  const data = {
    meta: { church_name: 'St Mary', currency_code: 'INR' },
    collections_command: { today_collected: 100, today_count: 2, target: 500, completion_pct: 20 },
    ai_advisor: { insights: [], recommended_actions: [], narratives: ['Stable collections'] },
    contribution_intelligence: { top_contributors: [], recent_contributors: [] },
    communication_center: { whatsapp_queued: 1, whatsapp_sent: 5, families_awaiting_follow_up: 2 },
    intelligence: [],
    projects_command: []
  } as unknown as FinancialCommandCenterPayload;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FocSatellitesGridComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(FocSatellitesGridComponent);
    fixture.componentInstance.data = data;
    fixture.componentInstance.sections = ['collections_command', 'ai_advisor', 'communication_center'];
    fixture.detectChanges();
  });

  it('renders nested satellite widgets for visible layers', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Collections Command');
    expect(text).toContain('AI Financial Advisor');
    expect(text).toContain('Communication Center');
    expect(text).not.toContain('Contribution Intelligence');
  });

  it('hides widgets when persona sections omit them', () => {
    fixture.componentRef.setInput('sections', ['projects_command']);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Collections Command');
    expect(fixture.nativeElement.textContent).toContain('Project Funding Command');
  });
});
