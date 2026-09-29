import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LiturgicalTerminology, SignatureSlot } from '../models/certificate';

@Component({
  selector: 'app-certificate-signatures',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cert-signs">
      <div class="cert-signs__slot" *ngFor="let slot of slots">
        <div class="cert-signs__line">{{ slot.name || '' }}</div>
        <span>{{ slot.label }}</span>
      </div>
      <div class="cert-signs__seal" *ngIf="showSeal">
        <img *ngIf="sealUrl" [src]="sealUrl" alt="" />
        <span *ngIf="!sealUrl">{{ terms.sealLabel }}</span>
      </div>
    </div>
  `,
  styles: [`
    .cert-signs {
      display: grid;
      grid-template-columns: 1fr 1fr 28mm;
      gap: 8mm;
      align-items: end;
      margin-top: 8mm;
    }
    .cert-signs__line {
      min-height: 8mm;
      border-bottom: 0.3mm solid var(--cert-ink);
      font-size: 3.4mm;
    }
    .cert-signs__slot span {
      display: block;
      margin-top: 1.4mm;
      font-size: 2.6mm;
      text-transform: uppercase;
      letter-spacing: 0.4mm;
      color: var(--cert-muted);
    }
    .cert-signs__seal {
      width: 28mm;
      height: 22mm;
      border: 0.35mm dashed var(--cert-seal);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.4mm;
      color: var(--cert-seal);
      text-align: center;
      padding: 2mm;
    }
    .cert-signs__seal img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  `],
})
export class CertificateSignaturesComponent {
  @Input() slots: SignatureSlot[] = [];
  @Input({ required: true }) terms!: LiturgicalTerminology;
  @Input() showSeal = true;
  @Input() sealUrl: string | null = null;
}
