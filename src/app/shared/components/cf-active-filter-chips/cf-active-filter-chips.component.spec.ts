import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CfActiveFilterChipsComponent } from './cf-active-filter-chips.component';

describe('CfActiveFilterChipsComponent', () => {
  let fixture: ComponentFixture<CfActiveFilterChipsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CfActiveFilterChipsComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(CfActiveFilterChipsComponent);
    fixture.componentInstance.chips = [
      { key: 'bcc', label: 'BCC', value: 'BCC0007 - Holy Family Housing Board' },
    ];
    fixture.detectChanges();
  });

  it('renders label and chips on one row region', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.cf-active-filters')).toBeTruthy();
    expect(el.textContent).toContain('Active filters:');
    expect(el.textContent).toContain('BCC0007 - Holy Family Housing Board');
  });

  it('emits remove with accessible remove control', () => {
    const spy = jest.fn();
    fixture.componentInstance.remove.subscribe(spy);
    const btn = fixture.nativeElement.querySelector('.cf-active-filter-chip__remove') as HTMLButtonElement;
    expect(btn.getAttribute('aria-label')).toBe('Remove BCC filter');
    btn.click();
    expect(spy).toHaveBeenCalled();
  });
});
