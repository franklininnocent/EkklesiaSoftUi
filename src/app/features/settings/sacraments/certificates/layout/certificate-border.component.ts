import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-certificate-border',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cert-border" aria-hidden="true">
      <div class="cert-border__outer"></div>
      <div class="cert-border__inner"></div>
      <div class="cert-border__micro" [attr.data-text]="microprint"></div>
    </div>
  `,
  styles: [`
    .cert-border { position: absolute; inset: 6mm; pointer-events: none; }
    .cert-border__outer {
      position: absolute;
      inset: 0;
      border: 1.1mm solid var(--cert-border-outer);
    }
    .cert-border__inner {
      position: absolute;
      inset: 2.2mm;
      border: 0.35mm solid var(--cert-border-inner);
    }
    .cert-border__micro {
      position: absolute;
      inset: 0.7mm;
      overflow: hidden;
      color: var(--cert-microprint);
      font-size: 1.6mm;
      letter-spacing: 0.4mm;
      line-height: 2.2mm;
      white-space: nowrap;
    }
    .cert-border__micro::before {
      content: attr(data-text) " · " attr(data-text) " · " attr(data-text) " · " attr(data-text);
      display: block;
    }
  `],
})
export class CertificateBorderComponent {
  @Input() microprint = 'SACRAMENTAL REGISTER';
}
