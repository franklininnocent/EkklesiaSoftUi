import { Pipe, PipeTransform } from '@angular/core';
import { CF_DEFAULT_DATE_LOCALE, cfFormatDate, CfDateStyle } from '@shared/utils/cf-intl.util';

/**
 * `{{ record.payment_date | cfDate }}` → `30 Sep 2026`.
 * `{{ createdAt | cfDate: 'datetime' }}` → `30 Sep 2026, 9:59 AM`.
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
