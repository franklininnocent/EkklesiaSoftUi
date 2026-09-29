import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LiturgicalTerminology } from '../models/certificate';

@Component({
  selector: 'app-certificate-verification',
  standalone: true,
  imports: [CommonModule],
  template: `
    <footer class="cert-verify">
      <p class="cert-verify__notice">{{ terms.issuedNotice }}</p>
      <div class="cert-verify__qr" *ngIf="qrDataUri">
        <img [src]="qrDataUri" alt="" />
        <span>{{ terms.verifyHint }}</span>
      </div>
    </footer>
  `,
  styles: [`
    .cert-verify {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 4mm;
      gap: 4mm;
    }
    .cert-verify__notice {
      margin: 0;
      font-size: 2.6mm;
      color: var(--cert-muted);
    }
    .cert-verify__qr {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 1mm;
    }
    .cert-verify__qr img {
      width: 18mm;
      height: 18mm;
    }
    .cert-verify__qr span {
      font-size: 2.2mm;
      color: var(--cert-muted);
    }
  `],
})
export class CertificateVerificationComponent {
  @Input({ required: true }) terms!: LiturgicalTerminology;
  @Input() qrDataUri: string | null = null;
}
