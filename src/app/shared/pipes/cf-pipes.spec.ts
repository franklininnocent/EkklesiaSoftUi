import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ChurchCurrencyService } from '@core/services/church-currency.service';
import { CfCurrencyPipe } from './cf-currency.pipe';
import { CfDatePipe } from './cf-date.pipe';

@Component({
  standalone: true,
  imports: [CfCurrencyPipe, CfDatePipe],
  template: `
    <span class="amount">{{ amount | cfCurrency: currency }}</span>
    <span class="whole">{{ amount | cfCurrency: currency : 0 }}</span>
    <span class="missing">{{ amount | cfCurrency: null }}</span>
    <span class="date">{{ date | cfDate }}</span>
  `,
})
class HostComponent {
  amount: string | number | null = '1500.5';
  currency = 'INR';
  date = '2026-09-25';
}

describe('CfCurrencyPipe / CfDatePipe', () => {
  it('render in a template with primitive arguments', () => {
    const fixture = TestBed.configureTestingModule({ imports: [HostComponent] }).createComponent(HostComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('.amount')?.textContent).toBe('₹1,500.50');
    expect(el.querySelector('.whole')?.textContent).toBe('₹1,501');
    expect(el.querySelector('.missing')?.textContent).toBe('');
    expect(el.querySelector('.date')?.textContent).toBe('25 Sep 2026');

    fixture.componentInstance.amount = null;
    fixture.componentInstance.currency = 'USD';
    fixture.detectChanges();
    expect(el.querySelector('.amount')?.textContent).toBe('');
  });

  it('transform directly', () => {
    TestBed.configureTestingModule({
      providers: [ChurchCurrencyService, CfCurrencyPipe, CfDatePipe],
    });
    const pipe = TestBed.inject(CfCurrencyPipe);
    expect(pipe.transform(99, 'USD')).toBe('$99.00');
    expect(pipe.transform(99, undefined)).toBe('');
    expect(TestBed.inject(CfDatePipe).transform('2026-01-05')).toBe('5 Jan 2026');
  });
});
