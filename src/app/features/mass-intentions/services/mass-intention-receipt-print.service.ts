import { Injectable, inject } from '@angular/core';
import { ChurchCurrencyService } from '@core/services/church-currency.service';
import { cfFormatMoney } from '@shared/utils/cf-intl.util';
import { MassOfferingReceipt } from './mass-intentions-api.service';

@Injectable({ providedIn: 'root' })
export class MassIntentionReceiptPrintService {
  private readonly churchCurrency = inject(ChurchCurrencyService);

  print(receipt: MassOfferingReceipt, beneficiaryName: string): void {
    const code = this.churchCurrency.currencyCode() ?? '';
    const amount = cfFormatMoney(receipt.amount, code);
    const html = `<!DOCTYPE html><html><head><title>Mass offering receipt</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 2rem; font-size: 14px; }
        h1 { font-size: 1.125rem; margin: 0 0 1rem; }
        dl { display: grid; grid-template-columns: auto 1fr; gap: 0.5rem 1rem; }
      </style></head><body>
      <h1>Mass offering receipt</h1>
      <dl>
        <dt>For</dt><dd>${this.escape(beneficiaryName)}</dd>
        <dt>Receipt</dt><dd>${this.escape(receipt.receipt_number)}</dd>
        <dt>Amount</dt><dd>${this.escape(amount)}</dd>
        <dt>Date</dt><dd>${this.escape(receipt.received_on)}</dd>
        <dt>Method</dt><dd>${this.escape(receipt.payment_method)}</dd>
      </dl>
      </body></html>`;
    const win = window.open('', '_blank', 'noopener,noreferrer,width=480,height=640');
    if (!win) {
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  private escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
