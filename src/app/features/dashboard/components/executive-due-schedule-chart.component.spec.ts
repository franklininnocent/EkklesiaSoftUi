import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ExecutiveDueScheduleChartComponent } from './executive-due-schedule-chart.component';

describe('ExecutiveDueScheduleChartComponent', () => {
  let fixture: ComponentFixture<ExecutiveDueScheduleChartComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExecutiveDueScheduleChartComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ExecutiveDueScheduleChartComponent);
    router = TestBed.inject(Router);
    fixture.componentInstance.slices = [
      { key: 'overdue', label: 'Overdue', amount: 100, percent: 50 },
      { key: 'next_14_days', label: 'Next 14 days', amount: 100, percent: 50 },
    ];
    fixture.componentInstance.currencyCode = 'USD';
    fixture.detectChanges();
  });

  it('navigates to dues with due_schedule when legend is clicked', async () => {
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const button = fixture.nativeElement.querySelector('.exec-due-chart__legend-btn') as HTMLButtonElement;
    button.click();

    expect(navigateSpy).toHaveBeenCalledWith(['/donations/dues'], {
      queryParams: { due_schedule: 'overdue' },
    });
  });
});
