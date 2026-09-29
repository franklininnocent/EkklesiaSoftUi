import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, delay } from 'rxjs';
import { ReportDrillDownModalComponent } from './report-drill-down-modal.component';
import { DonationsService } from '../../services/donations.service';

describe('ReportDrillDownModalComponent', () => {
  let fixture: ComponentFixture<ReportDrillDownModalComponent>;
  let donationsMock: { getReportDrillDown: jasmine.Spy };

  const mockResponse = {
    success: true,
    data: {
      context: {
        graph_id: 'financial_health',
        data_element_id: 'overall_score',
        slice_id: 'overall_score',
        title: 'Financial health → overall_score',
        why_this_number: 'Calculated score',
        business_date: '2026-09-27',
        timezone: 'Asia/Kolkata',
        expected_amount: 44,
        expected_count: 0,
        value_kind: 'score' as const,
        point_kind: 'kpi' as const,
        record_kind: 'none' as const,
        workspace_path: '/donations',
        workspace_query: {},
        columns: [],
        supported_actions: [],
        supported_sorts: ['family_name'],
        methodology: { formula: 'Weighted sum', weights: { family_engagement: 35 } }
      },
      summary: { family_count: 0, record_count: 0, due_count: 0, amount_total: 0 },
      filter_options: {},
      data: { current_page: 1, per_page: 20, total: 0, last_page: 1, data: [] }
    }
  };

  beforeEach(async () => {
    donationsMock = {
      getReportDrillDown: jasmine.createSpy('getReportDrillDown').and.returnValue(of(mockResponse))
    };

    await TestBed.configureTestingModule({
      imports: [ReportDrillDownModalComponent],
      providers: [
        provideRouter([]),
        {
          provide: DonationsService,
          useValue: donationsMock
        },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ReportDrillDownModalComponent);
    fixture.componentInstance.request = {
      graph_id: 'financial_health',
      data_element_id: 'overall_score',
      slice_id: 'overall_score'
    };
    fixture.detectChanges();
  });

  it('renders score value without currency pipe on KPI', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('/100');
    expect(el.textContent).toContain('Weighted sum');
  });

  it('shows forecast banner when point_kind is forecast', () => {
    fixture.componentInstance.request = {
      graph_id: 'month_end_forecast',
      data_element_id: 'current_month_projection',
      slice_id: 'current_month_projection'
    };
    const forecastResponse = {
      ...mockResponse,
      data: {
        ...mockResponse.data,
        context: {
          ...mockResponse.data.context,
          graph_id: 'month_end_forecast',
          point_kind: 'forecast' as const,
          value_kind: 'money' as const,
          expected_amount: 500
        }
      }
    };
    donationsMock.getReportDrillDown.and.returnValue(of(forecastResponse));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Forecast — not collected yet');
  });

  it('drops superseded list responses when the drill target changes', fakeAsync(() => {
    let callCount = 0;
    donationsMock.getReportDrillDown.and.callFake(() => {
      callCount++;
      if (callCount === 1) {
        return of({
          ...mockResponse,
          data: {
            ...mockResponse.data,
            context: { ...mockResponse.data.context, expected_amount: 1 }
          }
        }).pipe(delay(50));
      }

      return of({
        ...mockResponse,
        data: {
          ...mockResponse.data,
          context: { ...mockResponse.data.context, expected_amount: 88 }
        }
      });
    });

    fixture.componentInstance.request = {
      graph_id: 'collections',
      data_element_id: 'current_month_collected',
      slice_id: 'current_month'
    };
    fixture.detectChanges();
    tick(10);

    fixture.componentInstance.request = {
      graph_id: 'financial_health',
      data_element_id: 'overall_score',
      slice_id: 'overall_score'
    };
    fixture.detectChanges();
    tick(100);

    expect(fixture.componentInstance.response?.context?.expected_amount).toBe(88);
  }));

  it('shows parish as-of label and empty state when list has no rows', fakeAsync(() => {
    const emptyListResponse = {
      ...mockResponse,
      data: {
        ...mockResponse.data,
        context: {
          ...mockResponse.data.context,
          graph_id: 'collections',
          point_kind: 'actual' as const,
          value_kind: 'money' as const,
          record_kind: 'payment' as const,
          business_date: '2026-03-01',
          timezone: 'Asia/Kolkata',
          expected_amount: 0,
          expected_count: 0
        },
        data: { current_page: 1, per_page: 20, total: 0, last_page: 1, data: [] }
      }
    };
    donationsMock.getReportDrillDown.and.returnValue(of(emptyListResponse));

    fixture.componentInstance.request = {
      graph_id: 'collections',
      data_element_id: 'current_month_collected',
      slice_id: 'current_month'
    };
    fixture.detectChanges();
    tick();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('As of');
    expect(el.textContent).toContain('parish business date');
    expect(el.textContent).toContain('No records match');
  }));
});
