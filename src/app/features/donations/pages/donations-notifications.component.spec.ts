import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { DonationsNotificationsComponent } from './donations-notifications.component';
import { DonationsService } from '../services/donations.service';

describe('DonationsNotificationsComponent', () => {
  let fixture: ComponentFixture<DonationsNotificationsComponent>;
  let component: DonationsNotificationsComponent;
  let listNotifications: jest.Mock;

  const notificationsResponse = {
    success: true,
    data: { data: [], total: 0, current_page: 1, last_page: 1, per_page: 20 },
  };

  beforeEach(async () => {
    listNotifications = jest.fn().mockReturnValue(of(notificationsResponse));

    await TestBed.configureTestingModule({
      imports: [DonationsNotificationsComponent],
      providers: [
        provideRouter([]),
        {
          provide: DonationsService,
          useValue: { listNotifications },
        },
        {
          provide: AuthService,
          useValue: { canAccessDonations: jest.fn(() => true) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DonationsNotificationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads with default created_at desc sort', () => {
    expect(listNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'created_at', direction: 'desc' })
    );
  });

  it('sends sort params when a column header is sorted', () => {
    listNotifications.mockClear();
    component.onSort({ column: 'recipient', direction: 'asc' });
    expect(component.sortColumn).toBe('recipient');
    expect(component.sortDirection).toBe('asc');
    expect(listNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'recipient', direction: 'asc', page: '1' })
    );
  });
});
