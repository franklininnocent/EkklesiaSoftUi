import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { DonationsDownloadHistoryComponent } from './donations-download-history.component';
import { DonationsService } from '../services/donations.service';

describe('DonationsDownloadHistoryComponent', () => {
  let fixture: ComponentFixture<DonationsDownloadHistoryComponent>;
  let listExports: jest.Mock;

  const exportsResponse = {
    data: {
      data: [
        {
          report_type: 'family_ledger',
          format: 'csv',
          requested_by_name: 'Parish Admin',
          created_at: '2026-09-30T10:00:00Z',
          status: 'completed',
          completed_at: '2026-09-30T10:05:00Z',
          downloadable: true,
        },
      ],
      current_page: 1,
      total: 1,
    },
  };

  beforeEach(async () => {
    listExports = jest.fn().mockReturnValue(of(exportsResponse));
    await TestBed.configureTestingModule({
      imports: [DonationsDownloadHistoryComponent],
      providers: [
        provideRouter([]),
        {
          provide: DonationsService,
          useValue: {
            listExports,
            getReportCatalog: jest.fn().mockReturnValue(of({ data: [] })),
          },
        },
        {
          provide: AuthService,
          useValue: {
            hasAnyPermission: jest.fn(() => true),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DonationsDownloadHistoryComponent);
    fixture.detectChanges();
  });

  it('loads download history without panel summary headings', () => {
    expect(listExports).toHaveBeenCalledWith(
      expect.objectContaining({
        page: '1',
        per_page: '20',
      }),
    );
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.stewardship-panel-head')).toBeFalsy();
    expect(el.textContent).not.toContain('Download register');
    expect(el.textContent).not.toMatch(/\d+ downloads?/);
    expect(el.textContent).toContain('Parish Admin');
  });
});
