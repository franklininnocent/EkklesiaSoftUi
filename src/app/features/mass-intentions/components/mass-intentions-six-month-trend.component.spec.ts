import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MassIntentionsTrendPoint } from '../services/mass-intentions-api.service';
import { MassIntentionsSixMonthTrendComponent } from './mass-intentions-six-month-trend.component';

function buildPoints(): MassIntentionsTrendPoint[] {
  return [
    { month: '2026-04', label: 'Apr 2026', registered: 0, closed: 0, said: 0 },
    { month: '2026-09', label: 'Sep 2026', registered: 6, closed: 1, said: 0, is_current: true },
  ];
}

describe('MassIntentionsSixMonthTrendComponent', () => {
  let fixture: ComponentFixture<MassIntentionsSixMonthTrendComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MassIntentionsSixMonthTrendComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MassIntentionsSixMonthTrendComponent);
    fixture.componentRef.setInput('points', buildPoints());
    fixture.detectChanges();
  });

  it('shows plain-language summary and current month badge', () => {
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Four-month overview');
    expect(text).toContain('New records');
    expect(text).toContain('This month');
    expect(text).toContain('6 new · 1 closed · 0 marked said');
  });

  it('aggregates six-month totals', () => {
    expect(fixture.componentInstance.seriesTotals()).toEqual({
      registered: 6,
      closed: 1,
      said: 0,
    });
  });
});
