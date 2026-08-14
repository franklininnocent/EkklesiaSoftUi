import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { SacramentParticipantDraft } from '../../../models/sacrament-definition.model';

@Component({
  selector: 'app-sacrament-review-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sacrament-review-panel.component.html',
  styleUrl: './sacrament-review-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SacramentReviewPanelComponent {
  @Input() participants: SacramentParticipantDraft[] = [];
  @Input() dateAdministered: string | null = null;
  @Input() placeAdministered: string | null = null;

  displayName(p: SacramentParticipantDraft): string {
    return p.display_name || p.external_full_name || '—';
  }

  roleLabel(role: string): string {
    const map: Record<string, string> = {
      recipient: 'Recipient',
      bride: 'Bride',
      groom: 'Groom',
      father: 'Father',
      mother: 'Mother',
      godfather: 'Godfather',
      godmother: 'Godmother',
      sponsor: 'Sponsor',
      witness: 'Witness',
      minister: 'Minister',
      candidate: 'Candidate',
      co_consecrator: 'Co-consecrator',
    };
    return map[role] || role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  sourceLabel(p: SacramentParticipantDraft): string {
    switch (p.source) {
      case 'member':
        return 'Parish member';
      case 'internal_leadership':
        return 'Parish leadership';
      default:
        return 'External';
    }
  }

  affiliationLabel(p: SacramentParticipantDraft): string {
    if (!p.affiliation_type) {
      return '';
    }
    if (p.affiliation_type === 'home_parish') {
      return 'This parish';
    }
    const bits = [p.affiliation_parish_name, p.affiliation_diocese_name].filter(Boolean);
    return bits.length ? `Other — ${bits.join(', ')}` : 'Other parish/diocese';
  }
}
