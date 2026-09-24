import { Pipe, PipeTransform } from '@angular/core';
import { cfFormatMoney, CfFractionDigits } from '@shared/utils/cf-intl.util';

/**
 * `{{ amount | cfCurrency: currencyCode }}` or `{{ amount | cfCurrency: currencyCode : 0 }}`.
 * Currency code is required; pass the same field the screen already uses
 * (tenant currency, record currency) — there is no global default.
 */
@Pipe({
  name: 'cfCurrency',
  standalone: true,
})
export class CfCurrencyPipe implements PipeTransform {
  transform(
    value: number | string | null | undefined,
    currencyCode: string | null | undefined,
    fractionDigits: CfFractionDigits = 2,
  ): string {
    return currencyCode ? cfFormatMoney(value, currencyCode, fractionDigits) : '';
  }
}
