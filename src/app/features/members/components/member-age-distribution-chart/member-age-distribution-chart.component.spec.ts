import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MemberAgeDistributionChartComponent } from './member-age-distribution-chart.component';

describe('MemberAgeDistributionChartComponent', () => {
  let fixture: ComponentFixture<MemberAgeDistributionChartComponent>;
  let component: MemberAgeDistributionChartComponent;
  let router: Router;

  const slices = [
    {
      key: 'adults' as const,
      label: 'Adults',
      displayLabel: 'Adults (Age 26–59)',
      count: 5,
      percent: 50,
    },
    {
      key: 'children' as const,
      label: 'Children',
      displayLabel: 'Children (Age 3–12)',
      count: 5,
      percent: 50,
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemberAgeDistributionChartComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MemberAgeDistributionChartComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    component.slices = slices;
    fixture.detectChanges();
  });

  it('navigates to member list with age_band when a legend row is clicked', async () => {
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    const button = fixture.nativeElement.querySelector('.member-age-chart__legend-btn') as HTMLButtonElement;
    expect(button).toBeTruthy();
    button.click();

    expect(navigateSpy).toHaveBeenCalledWith(['/members/list'], {
      queryParams: { age_band: 'adults' },
    });
  });

  it('does not navigate when list drilldown is disabled', () => {
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    component.enableListDrilldown = false;
    fixture.detectChanges();

    component.drillToSlice(slices[1]);

    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
