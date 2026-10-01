import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  StewardshipActiveFilterChipsComponent,
  StewardshipFilterChip,
} from './stewardship-active-filter-chips.component';

describe('StewardshipActiveFilterChipsComponent', () => {
  let fixture: ComponentFixture<StewardshipActiveFilterChipsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StewardshipActiveFilterChipsComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(StewardshipActiveFilterChipsComponent);
    fixture.componentInstance.chips = [{ key: 'a', label: 'Status', value: 'Open' }];
    fixture.detectChanges();
  });

  it('renders dashboard-active-filters chrome', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.cf-active-filters')).toBeTruthy();
    expect(el.textContent).toContain('Status');
    expect(el.textContent).toContain('Open');
  });

  it('hides Clear all when showClearAll is false', () => {
    const localFixture = TestBed.createComponent(StewardshipActiveFilterChipsComponent);
    localFixture.componentInstance.chips = [{ key: 'a', label: 'Status', displayValue: 'Open' }];
    localFixture.componentInstance.showClearAll = false;
    localFixture.detectChanges();
    const el = localFixture.nativeElement as HTMLElement;
    expect(el.querySelector('.cf-btn')).toBeNull();
    expect(el.textContent).toContain('Active filters:');
  });

  it('emits remove when chip dismiss is clicked', () => {
    const chip: StewardshipFilterChip = { key: 'a', label: 'Status', value: 'Open' };
    const spy = jest.fn();
    fixture.componentInstance.remove.subscribe(spy);
    const btn = fixture.nativeElement.querySelector('.cf-active-filter-chip__remove') as HTMLButtonElement;
    btn.click();
    expect(spy).toHaveBeenCalledWith(chip);
  });
});
