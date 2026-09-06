import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface CertificateDetailRow {
  label: string;
  value: string;
}

@Component({
  selector: 'app-certificate-details',
  standalone: true,
  imports: [CommonModule],
  template: `
    <dl class="cert-details">
      <div class="cert-details__row" *ngFor="let row of rows">
        <dt>{{ row.label }}</dt>
        <dd>{{ row.value }}</dd>
      </div>
    </dl>
  `,
  styles: [`
    .cert-details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2.4mm 8mm;
      margin: 0;
    }
    .cert-details__row dt {
      font-size: 2.6mm;
      letter-spacing: 0.4mm;
      text-transform: uppercase;
      color: var(--cert-muted);
    }
    .cert-details__row dd {
      margin: 0.6mm 0 0;
      font-size: 4.2mm;
    }
  `],
})
export class CertificateDetailsComponent {
  @Input() rows: CertificateDetailRow[] = [];
}
