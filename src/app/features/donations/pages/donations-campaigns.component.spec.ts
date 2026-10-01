import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { DonationsCampaignsComponent } from './donations-campaigns.component';
import { DonationsService } from '../services/donations.service';
import { QuickCollectService } from '../services/quick-collect.service';
import { AuthService } from '@core/services/auth.service';
import { ChurchCurrencyService } from '@core/services/church-currency.service';

describe('DonationsCampaignsComponent', () => {
  let fixture: ComponentFixture<DonationsCampaignsComponent>;
  let getCampaigns: jest.Mock;
  let getProjectFamilyProgress: jest.Mock;
  let ledgerMutated$: Subject<void>;
  let quickCollect: { open: jest.Mock };

  const sampleCampaign = {
    id: 'c1',
    name: 'Roof Drive',
    code: 'ROOF',
    entity_kind: 'campaign',
    campaign_type: 'building',
    assignment_mode: 'uniform',
    default_family_target: 0,
    target_amount: 10000,
    raised_amount: 2500,
    status: 'active',
    collection_percentage: 25,
  };

  beforeEach(async () => {
    getCampaigns = jest.fn().mockReturnValue(of({ success: true, data: [sampleCampaign] }));
    getProjectFamilyProgress = jest.fn().mockReturnValue(
      of({
        success: true,
        data: { data: [], total: 0, current_page: 1, last_page: 1, per_page: 50 },
      })
    );
    ledgerMutated$ = new Subject<void>();
    quickCollect = { open: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [DonationsCampaignsComponent],
      providers: [
        provideRouter([]),
        { provide: QuickCollectService, useValue: quickCollect },
        { provide: AuthService, useValue: { hasPermission: jest.fn().mockReturnValue(true) } },
        {
          provide: ChurchCurrencyService,
          useValue: { currencySymbol: () => '$', currencyCode: () => 'USD' },
        },
        {
          provide: DonationsService,
          useValue: {
            getCampaigns,
            ledgerMutated$,
            createCampaign: jest.fn().mockReturnValue(of({ success: true })),
            getCampaignDashboard: jest.fn().mockReturnValue(
              of({
                success: true,
                data: {
                  project: sampleCampaign,
                  totals: {
                    overall_target: 10000,
                    collected: 2500,
                    outstanding: 7500,
                    collection_percentage: 25,
                  },
                  families: { enrolled: 0, completed: 0, partial: 0, exempt: 0 },
                  family_progress: [],
                },
              })
            ),
            getProjectFamilyProgress,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DonationsCampaignsComponent);
    fixture.detectChanges();
  });

  it('loads campaigns once on init and clears the loader on success', () => {
    expect(getCampaigns).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.campaignsLoaded).toBe(true);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('Loading campaigns…');
  });

  it('renders the campaign table when data exists', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.campaigns-summary')).toBeFalsy();
    expect(el.textContent).toContain('Roof Drive');
    expect(el.querySelector('.stewardship-table-panel')).toBeTruthy();
  });

  it('clears the loader and shows error when campaigns request fails', () => {
    getCampaigns.mockReturnValueOnce(throwError(() => ({ message: 'Network error' })));
    fixture.componentInstance.loadCampaigns();
    fixture.detectChanges();

    expect(fixture.componentInstance.campaignsLoaded).toBe(true);
    expect(fixture.componentInstance.campaignsLoadError).toBeTruthy();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.cf-loading-block')).toBeFalsy();
  });

  it('opens campaign details from the campaign name', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[aria-label="View Roof Drive"]')).toBeFalsy();
    const name = el.querySelector('.campaigns-table__name') as HTMLButtonElement;
    name.click();
    fixture.detectChanges();
    expect(el.querySelector('app-modal-shell')).toBeTruthy();
    expect(el.textContent).toContain('Roof Drive');
    expect(el.textContent).toContain('Done');
  });

  it('refreshes campaign amounts when a payment is recorded', () => {
    expect(getCampaigns).toHaveBeenCalledTimes(1);
    getCampaigns.mockReturnValueOnce(of({ success: true, data: [{ ...sampleCampaign, raised_amount: 5000 }] }));
    ledgerMutated$.next();
    fixture.detectChanges();

    expect(getCampaigns).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.campaigns[0].raised_amount).toBe(5000);
    expect(fixture.componentInstance.campaignsLoaded).toBe(true);
  });

  it('filters campaigns by search term', () => {
    fixture.componentInstance.onTableSearchChange('nomatch');
    fixture.detectChanges();
    expect(fixture.componentInstance.filteredCampaigns.length).toBe(0);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('No campaigns match your filters');
  });

  it('opens Collect Payment with the family and campaign from the selected row', () => {
    const name = fixture.nativeElement.querySelector('.campaigns-table__name') as HTMLButtonElement;
    name.click();
    fixture.detectChanges();
    fixture.componentInstance.familyRows = [{
      family_id: 'fam-1',
      family_code: 'FAM001',
      family_name: 'Peter Household',
      head_of_family: 'John Peter',
      bcc_id: null,
      bcc_name: null,
      target_amount: 5000,
      amount_collected: 0,
      outstanding_amount: 5000,
      completion_percentage: 0,
      status: 'not_started',
    }];
    fixture.componentInstance.collectForFamily(fixture.componentInstance.familyRows[0]);
    expect(quickCollect.open).toHaveBeenCalledWith({
      familyId: 'fam-1',
      projectId: 'c1',
      campaignId: 'c1',
    });
  });
});
