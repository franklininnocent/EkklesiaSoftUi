import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SacramentParticipantDraft } from '../../../models/sacrament-definition.model';
import { SacramentContextResponse } from '../../../models/sacrament-context.model';
import { ParticipantSourceControlComponent } from '../participant-source-control/participant-source-control.component';
import {
  ChurchAffiliationControlComponent,
  ChurchAffiliationValue,
} from '../church-affiliation-control/church-affiliation-control.component';
import { PersonContextSummaryComponent } from '../person-context-summary/person-context-summary.component';
import { SacramentConflictPanelComponent } from '../sacrament-conflict-panel/sacrament-conflict-panel.component';
import { MissingFieldsSummaryComponent } from '../missing-fields-summary/missing-fields-summary.component';
import { SacramentEvidenceSummaryComponent } from '../sacrament-evidence-summary/sacrament-evidence-summary.component';

export interface MarriagePartyFieldErrors {
  fullName?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  churchName?: string | null;
}

@Component({
  selector: 'app-marriage-party-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ParticipantSourceControlComponent,
    ChurchAffiliationControlComponent,
    PersonContextSummaryComponent,
    SacramentConflictPanelComponent,
    MissingFieldsSummaryComponent,
    SacramentEvidenceSummaryComponent,
  ],
  templateUrl: './marriage-party-panel.component.html',
  styleUrl: './marriage-party-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarriagePartyPanelComponent {
  @Input({ required: true }) role!: 'bride' | 'groom';
  @Input({ required: true }) partyLabel!: string;
  @Input() draft: SacramentParticipantDraft | null = null;
  @Input() context: SacramentContextResponse | null = null;
  @Input() contextLoading = false;
  @Input() contextError: string | null = null;
  @Input() affiliationDraft: ChurchAffiliationValue | null = null;
  @Input() homeParishName = '';
  @Input() allowedSources: Array<'member' | 'external'> = ['member', 'external'];
  @Input() baptismalStatusOptions: Array<{ value: string; label: string }> = [];
  @Input() ecclesialAffiliationOptions: Array<{ value: string; label: string }> = [];
  @Input() hideBaptismalStatus = false;
  @Input() hideEcclesialInput = false;
  @Input() fieldErrors: MarriagePartyFieldErrors = {};

  @Output() draftChange = new EventEmitter<SacramentParticipantDraft>();
  @Output() affiliationChange = new EventEmitter<ChurchAffiliationValue>();
  @Output() missingFieldFocus = new EventEmitter<string>();
  @Output() conflictCorrect = new EventEmitter<{
    field: string;
    candidates: Array<{ value: string; source_type: string }>;
  }>();

  get showMemberContext(): boolean {
    return this.draft?.source === 'member';
  }

  get actionableMissing(): Array<{ field: string; classification: string; label: string }> {
    return (this.context?.missing ?? []).filter((item) => item.field !== 'baptism_register_record');
  }

  get confirmationSummary(): string | null {
    const block = this.context?.sacraments?.confirmation;
    if (!block || block.record_status !== 'FOUND' || !block.evidence) {
      return null;
    }
    const date = block.evidence.date?.value;
    const place = block.evidence.place?.value ?? block.evidence.parish?.value;
    const parts = [date, place].filter((value) => !!value);
    return parts.length > 0 ? parts.join(' · ') : null;
  }

  get baptismEvidenceAnchorId(): string {
    return `party-${this.role}-baptism-evidence`;
  }

  get baptismalStatusAnchorId(): string {
    return `party-${this.role}-baptismal-status`;
  }
}
