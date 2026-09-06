import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChurchMetadata, EmblemId, LiturgicalTerminology } from '../models/certificate';
import { CertificateEmblemComponent } from './certificate-emblem.component';

@Component({
  selector: 'app-certificate-header',
  standalone: true,
  imports: [CommonModule, CertificateEmblemComponent],
  template: `
    <header class="cert-header">
      <app-certificate-emblem [emblem]="emblem" />
      <div class="cert-header__identity">
        <p class="cert-header__church">{{ church.name }}</p>
        <p class="cert-header__diocese" *ngIf="church.diocese">{{ church.diocese }}</p>
        <p class="cert-header__address" *ngIf="church.address">{{ church.address }}</p>
      </div>
      <div class="cert-header__logo" aria-hidden="true"></div>
    </header>
    <div class="cert-title-block">
      <h1 class="cert-title">{{ terms.sacramentTitle }}</h1>
      <p class="cert-subtitle">{{ terms.subtitle }}</p>
    </div>
  `,
  styles: [`
    .cert-header {
      display: grid;
      grid-template-columns: 18mm 1fr 22mm;
      gap: 4mm;
      align-items: center;
    }
    .cert-header__church {
      font-family: var(--cert-font-heading);
      font-size: 5.2mm;
      letter-spacing: 0.3mm;
      margin: 0;
    }
    .cert-header__diocese,
    .cert-header__address {
      margin: 0.6mm 0 0;
      color: var(--cert-muted);
      font-size: 3.2mm;
    }
    .cert-header__logo {
      width: 22mm;
      height: 18mm;
    }
    .cert-title-block { text-align: center; margin-top: 4mm; }
    .cert-title {
      font-family: var(--cert-font-display);
      font-size: 8mm;
      font-weight: 600;
      margin: 0;
      color: var(--cert-accent);
    }
    .cert-subtitle {
      margin: 1.5mm 0 0;
      letter-spacing: 1.2mm;
      text-transform: uppercase;
      font-size: 3mm;
      color: var(--cert-muted);
    }
  `],
})
export class CertificateHeaderComponent {
  @Input({ required: true }) church!: ChurchMetadata;
  @Input({ required: true }) terms!: LiturgicalTerminology;
  @Input() emblem: EmblemId = 'NONE';
}
