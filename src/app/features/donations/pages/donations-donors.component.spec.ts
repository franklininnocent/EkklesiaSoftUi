import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ChurchCurrencyService } from '@core/services/church-currency.service';
import { DonationsDonorsComponent } from './donations-donors.component';
import { DonationsService } from '../services/donations.service';
import { QuickCollectService } from '../services/quick-collect.service';

describe('DonationsDonorsComponent', () => {
  let fixture: ComponentFixture<DonationsDonorsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DonationsDonorsComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { hasPermission: () => true } },
        { provide: QuickCollectService, useValue: { open: jest.fn() } },
        {
          provide: DonationsService,
          useValue: {
            getDonors: jest.fn().mockReturnValue(of({ data: { data: [] } })),
            createDonor: jest.fn(),
          },
        },
        { provide: ChurchCurrencyService, useValue: { currencyCode: () => 'USD' } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DonationsDonorsComponent);
    fixture.detectChanges();
  });

  it('uses the stewardship list page shell and filter drawer', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.cf-financial-dashboard')).toBeTruthy();
    expect(el.querySelector('app-page-header')).toBeTruthy();
    expect(el.querySelector('app-list-toolbar')).toBeTruthy();
    expect(el.querySelector('app-advanced-search-panel')).toBeTruthy();
    expect(el.querySelector('button[aria-label="Filters"]')).toBeTruthy();
    expect(el.querySelector('.cf-filters')).toBeNull();
  });
});
