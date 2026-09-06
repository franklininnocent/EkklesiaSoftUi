import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SacramentSacramentEvidenceBlock } from '../../../models/sacrament-context.model';

@Component({
  selector: 'app-sacrament-evidence-summary',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sacrament-evidence-summary.component.html',
  styleUrl: './sacrament-evidence-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SacramentEvidenceSummaryComponent {
  @Input() title = 'Baptism';
  @Input() evidence: SacramentSacramentEvidenceBlock | null = null;
  @Input() derivedStatus: string | null = null;
  @Input() showCertificateAdvisory = true;
  /** Flatten card chrome when nested inside `.sacrament-nested-block`. */
  @Input() compact = false;

  get isFound(): boolean {
    return this.evidence?.record_status === 'FOUND';
  }

  get isProfileEvidence(): boolean {
    return this.evidence?.evidence_tier === 'MEMBER_PROFILE'
      || (this.evidence?.register_record_status === 'NOT_FOUND' && this.isFound);
  }

  get statusMessage(): string {
    if (!this.isFound) {
      return 'No record found in this parish';
    }
    return this.isProfileEvidence
      ? 'On member profile (not parish register)'
      : 'Parish register record found';
  }

  get showRegisterAdvisory(): boolean {
    return this.showCertificateAdvisory && this.isProfileEvidence;
  }

  get advisoryMessage(): string {
    return 'Parish register record not found — verify baptism certificate before marriage.';
  }

  get baptismDate(): string | null {
    return this.evidence?.evidence?.date?.value ?? null;
  }

  get baptismPlace(): string | null {
    return this.evidence?.evidence?.place?.value ?? this.evidence?.evidence?.parish?.value ?? null;
  }

  get sacramentId(): string | number | null {
    return this.evidence?.evidence?.sacrament_id ?? null;
  }
}
