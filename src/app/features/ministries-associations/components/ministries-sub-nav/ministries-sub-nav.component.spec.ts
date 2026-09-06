import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MinistriesSubNavComponent } from './ministries-sub-nav.component';

describe('MinistriesSubNavComponent', () => {
  let fixture: ComponentFixture<MinistriesSubNavComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MinistriesSubNavComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MinistriesSubNavComponent);
  });

  it('renders the four ministries sections', () => {
    fixture.detectChanges();

    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('a.cf-tab-strip__tab'),
    ).map((a) => (a as HTMLElement).textContent?.trim());

    expect(labels).toEqual(['Organizations', 'Guest members', 'Settings', 'Audit log']);
  });

  it('returns a stable array reference so repeated change detection does not thrash bindings', () => {
    fixture.detectChanges();

    const first = fixture.componentInstance.tabs;
    const second = fixture.componentInstance.tabs;

    expect(second).toBe(first);
    expect(() => fixture.detectChanges()).not.toThrow();
  });
});
