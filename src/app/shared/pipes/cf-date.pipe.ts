import { Pipe, PipeTransform } from '@angular/core';
import { CF_DEFAULT_DATE_LOCALE, cfFormatDate, CfDateStyle } from '@shared/utils/cf-intl.util';

/**
 * `{{ record.payment_date | cfDate }}`, `{{ createdAt | cfDate: 'datetime' }}`.
 * `YYYY-MM-DD` values render as that calendar day in every timezone.
 */
@Pipe({
  name: 'cfDate',
  standalone: true,
})
export class CfDatePipe implements PipeTransform {
  transform(
    value: string | Date | null | undefined,
    style: CfDateStyle = 'date',
    locale: string = CF_DEFAULT_DATE_LOCALE,
  ): string {
    return cfFormatDate(value, style, locale);
  }
}
