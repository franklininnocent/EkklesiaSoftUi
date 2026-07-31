import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DonationsService } from '@features/donations/services/donations.service';

@Injectable({ providedIn: 'root' })
export class ReceiptPrintService {
  constructor(private readonly donationsService: DonationsService) {}

  printPaymentReceipt(paymentId: string): void {
    this.loadReceiptHtmlIntoWindow(paymentId, true);
  }

  viewPaymentReceipt(paymentId: string): void {
    this.loadReceiptHtmlIntoWindow(paymentId, false);
  }

  printStewardshipReport(): void {
    this.loadHtmlIntoWindow(
      () => this.donationsService.getStewardshipPrintHtml(),
      true,
      'Unable to open stewardship report for printing right now.'
    );
  }

  printExecutiveBoardPack(): void {
    this.loadHtmlIntoWindow(
      () => this.donationsService.getExecutiveBoardPrintHtml(),
      true,
      'Unable to open executive board pack for printing right now.'
    );
  }

  printFamilyStatement(familyId: string): void {
    this.loadHtmlIntoWindow(
      () => this.donationsService.getFamilyStatementPrintHtml(familyId),
      true,
      'Unable to open family statement for printing right now.'
    );
  }

  private loadReceiptHtmlIntoWindow(paymentId: string, autoPrint: boolean): void {
    this.loadHtmlIntoWindow(
      () => this.donationsService.getReceiptPrintHtml(paymentId),
      autoPrint,
      autoPrint ? 'Unable to open receipt for printing right now.' : 'Unable to open receipt preview right now.'
    );
  }

  private loadHtmlIntoWindow(
    request: () => Observable<string>,
    autoPrint: boolean,
    errorMessage: string
  ): void {
    const targetWindow = this.openBlankTargetWindow();
    if (!targetWindow) {
      return;
    }

    request().subscribe({
      next: (html) => {
        this.writeHtmlToWindow(targetWindow, html, autoPrint);
      },
      error: () => {
        targetWindow.close();
        window.alert(errorMessage);
      }
    });
  }

  /**
   * Must run synchronously inside the user click handler.
   * Do not pass noopener — it makes window.open return null in modern browsers.
   */
  private openBlankTargetWindow(): Window | null {
    const targetWindow = window.open('', '_blank', 'width=760,height=900');
    if (!targetWindow) {
      window.alert('Allow pop-ups to view or print receipts.');
      return null;
    }

    targetWindow.document.open();
    targetWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>Loading receipt…</title></head>
      <body style="font-family:system-ui,sans-serif;padding:2rem;color:#475569;">Loading receipt…</body></html>
    `);
    targetWindow.document.close();

    return targetWindow;
  }

  private writeHtmlToWindow(targetWindow: Window, html: string, autoPrint: boolean): void {
    targetWindow.document.open();
    targetWindow.document.write(html);
    targetWindow.document.close();
    targetWindow.focus();
    if (autoPrint) {
      targetWindow.onload = () => {
        targetWindow.print();
      };
    }
  }
}
