import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FocIntelligenceStreamComponent } from './foc-intelligence-stream.component';

describe('FocIntelligenceStreamComponent', () => {
  let fixture: ComponentFixture<FocIntelligenceStreamComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FocIntelligenceStreamComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(FocIntelligenceStreamComponent);
    fixture.componentInstance.events = [
      { type: 'payment', title: 'Payment received', subtitle: 'Family A', date: '2026-06-01', amount: 250 }
    ];
    fixture.componentInstance.currencyCode = 'INR';
    fixture.detectChanges();
  });

  it('renders intelligence feed events', () => {
    expect(fixture.nativeElement.textContent).toContain('Payment received');
  });

  it('shows empty state when no events', () => {
    fixture.componentRef.setInput('events', []);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No operational events yet');
  });
});
