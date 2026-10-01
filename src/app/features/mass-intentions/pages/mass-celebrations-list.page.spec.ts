import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { MassIntentionsApiService } from '../services/mass-intentions-api.service';
import { AuthService } from '@core/services/auth.service';
import { MassCelebrationsListPageComponent } from './mass-celebrations-list.page';

describe('MassCelebrationsListPageComponent', () => {
  let fixture: ComponentFixture<MassCelebrationsListPageComponent>;
  let listCelebrations: jest.Mock;

  beforeEach(async () => {
    listCelebrations = jest.fn().mockReturnValue(of({ data: [], total: 0, current_page: 1, last_page: 1 }));
    await TestBed.configureTestingModule({
      imports: [MassCelebrationsListPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: MassIntentionsApiService,
          useValue: {
            listCelebrations,
          },
        },
        {
          provide: AuthService,
          useValue: { hasPermission: jest.fn().mockReturnValue(false) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MassCelebrationsListPageComponent);
    fixture.detectChanges();
  });

  it('loads celebrations for the current calendar month', () => {
    expect(listCelebrations).toHaveBeenCalled();
    const params = listCelebrations.mock.calls[0][0] as Record<string, string | number>;
    expect(params.from).toMatch(/^\d{4}-\d{2}-01$/);
    expect(params.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(params.per_page).toBe(100);
  });

  it('uses the filter side panel instead of inline filters', () => {
    expect(fixture.nativeElement.querySelector('app-advanced-search-panel')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.mass-celebrations-page__filters')).toBeNull();
  });

  it('opens filter drawer when toolbar filter is triggered', () => {
    const component = fixture.componentInstance;
    component.openFilters();
    fixture.detectChanges();
    expect(component.showAdvancedSearch()).toBe(true);
  });

  it('orders upcoming before past and pins next Mass first', () => {
    const component = fixture.componentInstance;
    component.parishNowIso.set('2026-09-29T16:00:00+05:30');
    component.parishTimezone.set('Asia/Kolkata');
    component.items.set([
      { id: 'past', celebrated_on: '2026-09-29', celebrated_at: '06:00', status: 'scheduled' },
      { id: 'next', celebrated_on: '2026-09-29', celebrated_at: '18:15', status: 'scheduled' },
      { id: 'later', celebrated_on: '2026-09-30', celebrated_at: '06:15', status: 'scheduled' },
    ]);
    component.nextUpcomingCelebrationId.set('next');
    expect(component.displayItems().map((r) => r.id)).toEqual(['next', 'later', 'past']);
  });

  it('merges search into query params when applying drawer filters', async () => {
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.componentInstance.onAdvancedSearch({ search: 'chapel', status: 'all' });
    expect(navigateSpy).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: expect.objectContaining({ search: 'chapel' }),
        queryParamsHandling: 'merge',
      }),
    );
  });
});
