import { inject, Pipe, PipeTransform } from '@angular/core';
import { ChurchCurrencyService } from '@core/services/church-currency.service';
import { cfFormatMoney, CfFractionDigits } from '@shared/utils/cf-intl.util';

/**
 * `{{ amount | cfCurrency: currencyCode }}` or `{{ amount | cfCurrency: currencyCode : 0 }}`.
 * Omit currencyCode for parish screens (uses ChurchCurrencyService). SaaS billing rows
 * should pass explicit record `currency_code`.
 */
@Pipe({
  name: 'cfCurrency',
  standalone: true,
})
export class CfCurrencyPipe implements PipeTransform {
  private readonly churchCurrency = inject(ChurchCurrencyService);

  transform(
    value: number | string | null | undefined,
    currencyCode?: string | null,
    fractionDigits: CfFractionDigits = 2,
  ): string {
    const code = currencyCode ?? this.churchCurrency.currencyCode();
    return code ? cfFormatMoney(value, code, fractionDigits) : '';
  }
}
