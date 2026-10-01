import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MassCelebrationsViewNavComponent } from './mass-celebrations-view-nav.component';

describe('MassCelebrationsViewNavComponent', () => {
  let fixture: ComponentFixture<MassCelebrationsViewNavComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MassCelebrationsViewNavComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(MassCelebrationsViewNavComponent);
    fixture.componentRef.setInput('view', 'list');
    fixture.componentRef.setInput('periodLabel', 'September 2026');
    fixture.componentRef.setInput('monthKey', '2026-09');
    fixture.componentRef.setInput('weekSunday', '2026-09-28');
    fixture.detectChanges();
  });

  it('marks List as the active view in the segmented control', () => {
    const toggle = fixture.nativeElement.querySelector('.mass-view-nav__view-toggle');
    expect(toggle?.textContent).toContain('List');
    expect(toggle?.querySelector('span.active')?.textContent?.trim()).toBe('List');
  });

  it('shows the period as the primary heading', () => {
    const title = fixture.nativeElement.querySelector('.mass-view-nav__period-title') as HTMLElement;
    expect(title?.textContent?.trim()).toBe('September 2026');
  });

  it('navigates to the previous month from list view', async () => {
    const navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.nativeElement.querySelector('button[aria-label="Previous month"]')?.click();
    expect(navigate).toHaveBeenCalledWith(
      ['/mass-intentions/masses'],
      expect.objectContaining({
        queryParams: expect.objectContaining({ month: '2026-08' }),
      })
    );
  });

  it('shows month picker on list view', () => {
    expect(fixture.nativeElement.querySelector('input[type="month"]')).toBeTruthy();
  });
});
