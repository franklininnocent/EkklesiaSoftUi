import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { SacramentContextResponse } from '../../../models/sacrament-context.model';

@Component({
  selector: 'app-person-context-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './person-context-summary.component.html',
  styleUrl: './person-context-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonContextSummaryComponent {
  @Input() context: SacramentContextResponse | null = null;
  @Input() loading = false;
  @Input() error: string | null = null;
  @Input() marriageMode = false;

  get displayName(): string {
    return this.context?.subject?.display_name || 'Selected person';
  }

  get isMember(): boolean {
    return !!this.context?.subject?.family_member_id;
  }

  get summaryItems(): Array<{ key: string; label: string; notFoundLabel: string; found: boolean }> {
    const found = new Set(this.context?.found_summary ?? []);
    const items = [
      {
        key: 'member',
        label: 'Member information found',
        notFoundLabel: 'Member information not found',
        found: found.has('member'),
      },
      {
        key: 'family',
        label: 'Family information found',
        notFoundLabel: 'Family information not found',
        found: found.has('family'),
      },
      {
        key: 'baptism',
        label: this.sacramentLabel('baptism', 'Baptism record found', 'Baptism on member profile'),
        notFoundLabel: 'Baptism record not found',
        found: found.has('baptism'),
      },
    ];

    if (!this.marriageMode) {
      items.push({
        key: 'confirmation',
        label: this.sacramentLabel('confirmation', 'Confirmation record found', 'Confirmation on member profile'),
        notFoundLabel: 'Confirmation record not found',
        found: found.has('confirmation'),
      });
    }

    return items;
  }

  private sacramentLabel(
    sacramentKey: 'baptism' | 'confirmation',
    registerLabel: string,
    profileLabel: string,
  ): string {
    const block = this.context?.sacraments?.[sacramentKey];
    if (!block || block.record_status !== 'FOUND') {
      return registerLabel;
    }
    if (block.evidence_tier === 'MEMBER_PROFILE' || block.register_record_status === 'NOT_FOUND') {
      return profileLabel;
    }
    return registerLabel;
  }

  get hasFoundItems(): boolean {
    return this.summaryItems.some((item) => item.found);
  }

  get showAutoFillNote(): boolean {
    return !this.marriageMode && this.hasFoundItems;
  }
}
