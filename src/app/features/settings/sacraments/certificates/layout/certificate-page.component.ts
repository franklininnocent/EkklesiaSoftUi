import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaperSize, PRINT_SPEC } from '../models/certificate';

@Component({
  selector: 'app-certificate-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="cert-page"
      [class.cert-page--letter]="paper === 'LETTER'"
      [style.width.mm]="spec.widthMm"
      [style.height.mm]="spec.heightMm"
    >
      <ng-content />
    </div>
  `,
  styles: [`
    :host { display: block; }
    .cert-page {
      position: relative;
      background: var(--cert-page-bg);
      color: var(--cert-ink);
      font-family: var(--cert-font-body);
      overflow: hidden;
      box-sizing: border-box;
    }
  `],
})
export class CertificatePageComponent {
  @Input() paper: PaperSize = 'A4';

  get spec() {
    return PRINT_SPEC[this.paper];
  }
}
