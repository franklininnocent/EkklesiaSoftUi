import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { ParishPersonService } from '@features/settings/sacraments/services/person.service';
import { MassIntentionsApiService } from '../services/mass-intentions-api.service';
import { MassIntentionsListPageComponent } from './mass-intentions-list.page';

describe('MassIntentionsListPageComponent', () => {
  let fixture: ComponentFixture<MassIntentionsListPageComponent>;
  let hasTenantPermission: jest.Mock;

  beforeEach(async () => {
    hasTenantPermission = jest.fn((name: string) => name === 'mass.intentions.create');

    await TestBed.configureTestingModule({
      imports: [MassIntentionsListPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: MassIntentionsApiService,
          useValue: {
            listRequests: jest.fn().mockReturnValue(of({ data: [], total: 0, last_page: 1, current_page: 1 })),
            listAllRequests: jest.fn().mockReturnValue(of([])),
            listCategories: jest.fn().mockReturnValue(of({ data: [] })),
          },
        },
        { provide: ParishPersonService, useValue: { search: jest.fn().mockReturnValue(of({ data: [] })) } },
        {
          provide: AuthService,
          useValue: {
            hasTenantPermission,
            hasPermission: jest.fn(() => false),
          },
        },
        {
          provide: ToastService,
          useValue: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MassIntentionsListPageComponent);
    fixture.detectChanges();
  });

  it('shows Create intention when tenant create is allowed', () => {
    const button = fixture.nativeElement.querySelector('button.cf-btn-primary');
    expect(button?.textContent).toMatch(/Create intention/i);
    expect(fixture.nativeElement.textContent).toContain('Office register');
    expect(fixture.nativeElement.querySelector('.cf-workspace-nav')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-advanced-search-panel')).toBeTruthy();
  });

  it('opens form modal when create query param is set', () => {
    hasTenantPermission.mockReturnValue(true);
    const component = fixture.componentInstance;
    component.openCreate();
    fixture.detectChanges();
    expect(component.showFormModal()).toBe(true);
  });

  it('merges page into query params when changing page', async () => {
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.componentInstance.goToPage(3);
    expect(navigateSpy).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { page: 3 },
        queryParamsHandling: 'merge',
      }),
    );
  });
});
