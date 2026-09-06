import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmblemId } from '../models/certificate';

@Component({
  selector: 'app-certificate-emblem',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cert-emblem" aria-hidden="true">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" stroke-width="1.5"/>
        <path d="M32 10v44M18 22h28" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M22 14c8 6 8 30 0 36M42 14c-8 6-8 30 0 36" fill="none" stroke="currentColor" stroke-width="2"/>
      </svg>
    </div>
  `,
  styles: [`
    .cert-emblem {
      width: 22mm;
      height: 22mm;
      color: var(--cert-accent);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .cert-emblem svg {
      width: 100%;
      height: 100%;
    }
  `],
})
export class CertificateEmblemComponent {
  /** Retained for API compatibility; render always uses canonical Chi-Rho. */
  @Input({ required: true }) emblem: EmblemId = 'CHI_RHO';
}
