import { Injectable, computed, signal } from '@angular/core';
import { ChurchCurrency } from '@core/models/church-currency.model';
import { cfFormatMoney, CfFractionDigits } from '@shared/utils/cf-intl.util';

@Injectable({ providedIn: 'root' })
export class ChurchCurrencyService {
  private readonly currencyState = signal<ChurchCurrency | null>(null);

  readonly currency = this.currencyState.asReadonly();

  readonly currencyCode = computed(() => this.currencyState()?.currency_code ?? null);

  readonly currencySymbol = computed(() => this.currencyState()?.currency_symbol ?? null);

  readonly locale = computed(() => this.currencyState()?.locale ?? null);

  readonly decimalDigits = computed(() => this.currencyState()?.decimal_digits ?? 2);

  hydrate(currency: ChurchCurrency | null | undefined): void {
    this.currencyState.set(currency ?? null);
  }

  clear(): void {
    this.currencyState.set(null);
  }

  formatAmount(
    value: number | string | null | undefined,
    fractionDigits?: CfFractionDigits,
  ): string {
    const code = this.currencyCode();
    if (!code) {
      return '';
    }
    const digits = fractionDigits ?? (this.decimalDigits() === 0 ? 0 : 2);

    return cfFormatMoney(value, code, digits as CfFractionDigits);
  }
}
