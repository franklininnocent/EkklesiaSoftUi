import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LiturgicalTerminology, RegistryIndex } from '../models/certificate';

@Component({
  selector: 'app-certificate-registry',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cert-registry" *ngIf="hasRegistry">
      <span *ngIf="registry.bookNumber">{{ terms.registryBookLabel }} {{ registry.bookNumber }}</span>
      <span *ngIf="registry.pageNumber">{{ terms.registryPageLabel }} {{ registry.pageNumber }}</span>
      <span *ngIf="registry.certificateNumber">{{ terms.certificateNumberLabel }} {{ registry.certificateNumber }}</span>
    </div>
  `,
  styles: [`
    .cert-registry {
      display: flex;
      gap: 6mm;
      justify-content: center;
      margin-top: 4mm;
      font-size: 3mm;
      color: var(--cert-muted);
    }
  `],
})
export class CertificateRegistryComponent {
  @Input({ required: true }) registry!: RegistryIndex;
  @Input({ required: true }) terms!: LiturgicalTerminology;

  get hasRegistry(): boolean {
    return !!(this.registry.bookNumber || this.registry.pageNumber || this.registry.certificateNumber);
  }
}
