import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  FamilyMetricChartComponent,
  FamilyMetricSlice,
  metricSliceIndexAt,
} from './family-metric-chart.component';

describe('metricSliceIndexAt', () => {
  const scale = {
    top: 10,
    right: 80,
    bottom: 110,
    left: 8,
    getValueForPixel: (pixel: number) => (pixel < 60 ? 0 : 1),
  };
  const plot = { top: 10, right: 200, bottom: 110, left: 90 };

  it('uses a direct bar hit', () => {
    expect(metricSliceIndexAt({ x: 120, y: 40 }, 'bar', 2, 1, scale, plot)).toBe(1);
  });

  it('maps a category-label click to that row', () => {
    expect(metricSliceIndexAt({ x: 20, y: 40 }, 'bar', 2, undefined, scale, plot)).toBe(0);
    expect(metricSliceIndexAt({ x: 140, y: 80 }, 'bar', 2, undefined, scale, plot)).toBe(1);
  });

  it('ignores clicks outside the category axis and plot', () => {
    expect(metricSliceIndexAt({ x: 20, y: 4 }, 'bar', 2, undefined, scale, plot)).toBeUndefined();
    expect(metricSliceIndexAt({ x: 220, y: 40 }, 'bar', 2, undefined, scale, plot)).toBeUndefined();
  });
});

describe('FamilyMetricChartComponent legend', () => {
  let fixture: ComponentFixture<FamilyMetricChartComponent>;

  const slices: FamilyMetricSlice[] = [
    { key: 'male', label: 'Male', count: 2, percent: 100, color: '#2563eb' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FamilyMetricChartComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(FamilyMetricChartComponent);
    fixture.componentInstance.slices = slices;
    fixture.componentInstance.type = 'bar';
    fixture.detectChanges();
  });

  it('emits the slice when its legend item is clicked', () => {
    const selected: FamilyMetricSlice[] = [];
    fixture.componentInstance.select.subscribe((slice) => selected.push(slice));

    const button = fixture.nativeElement.querySelector('.fam-metric-chart__legend-btn') as HTMLButtonElement;
    button.click();

    expect(selected).toEqual([slices[0]]);
  });
});
