import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FocHealthZoneComponent } from './foc-health-zone.component';
import { FinancialCommandCenterPayload } from '../../../models/donation.model';

describe('FocHealthZoneComponent', () => {
  let fixture: ComponentFixture<FocHealthZoneComponent>;

  const data = {
    health_index: { score: 80, label: 'Healthy', status: 'healthy', ai_summary: 'Stable finances' },
    executive_cards: [{ key: 'month_collected', label: 'Month', value: 1200, comparison_period: 'MoM', context_message: 'ok' }],
    meta: { currency_code: 'INR' }
  } as FinancialCommandCenterPayload;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FocHealthZoneComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(FocHealthZoneComponent);
    fixture.componentInstance.data = data;
    fixture.detectChanges();
  });

  it('renders health index and executive cards', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Financial Health Index');
    expect(text).toContain('Healthy');
    expect(text).toContain('Month');
  });
});
