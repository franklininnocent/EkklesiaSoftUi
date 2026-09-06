import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { Subject, takeUntil } from 'rxjs';
import { LeadershipAssignment } from '@core/models/church/leadership-governance.model';
import { ChurchLeadershipGovernanceService } from '@core/services/church/church-leadership-governance.service';
import { ChurchLeadership } from '@core/models/church';
import { ChurchLeadershipService } from '@core/services/church/church-leadership.service';
import {
  ParticipantSourceKind,
  SacramentParticipantDraft,
} from '../../../models/sacrament-definition.model';

@Component({
  selector: 'app-minister-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './minister-picker.component.html',
  styleUrl: './minister-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MinisterPickerComponent implements OnInit, OnChanges, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly governance = inject(ChurchLeadershipGovernanceService);
  private readonly legacyLeadership = inject(ChurchLeadershipService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() ministerRoles: string[] = ['priest', 'deacon', 'pastor', 'other'];
  @Input() controlId = 'minister';
  @Input() label = 'Who administered this sacrament?';
  @Input() value: SacramentParticipantDraft | null = null;
  @Output() valueChange = new EventEmitter<SacramentParticipantDraft>();

  source: Extract<ParticipantSourceKind, 'internal_leadership' | 'external'> = 'internal_leadership';
  assignments: LeadershipAssignment[] = [];
  legacyLeaders: ChurchLeadership[] = [];
  loadingLeaders = false;
  selectedAssignmentId: string | null = null;
  selectedLegacyLeaderId: number | null = null;

  externalName = '';
  externalTitle = '';
  externalRole = '';

  ngOnInit(): void {
    this.loadLeaders();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] && this.value) {
      if (this.value.source === 'internal_leadership') {
        this.source = 'internal_leadership';
        this.selectedAssignmentId = this.value.leadership_assignment_id ?? null;
        this.selectedLegacyLeaderId = this.value.church_leadership_id ?? null;
      } else {
        this.source = 'external';
        this.externalName = this.value.external_full_name || '';
        this.externalTitle = this.value.external_title || '';
        this.externalRole = this.value.external_minister_role || '';
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSourceChange(next: 'internal_leadership' | 'external'): void {
    this.source = next;
    this.emit();
  }

  onLeaderChange(): void {
    this.emit();
  }

  onExternalChange(): void {
    this.emit();
  }

  leaderLabel(assignment: LeadershipAssignment): string {
    const role = assignment.role?.title || 'Leader';
    return `${assignment.person?.full_name || 'Unknown'} (${role})`;
  }

  legacyLeaderLabel(leader: ChurchLeadership): string {
    const title = leader.title ? `${leader.title} ` : '';
    return `${title}${leader.full_name} (${leader.role})`;
  }

  get leaderOptions(): Array<{ id: string; label: string; assignment?: LeadershipAssignment; legacy?: ChurchLeadership }> {
    const assignmentOptions = this.assignments.map((assignment) => ({
      id: `assignment:${assignment.id}`,
      label: this.leaderLabel(assignment),
      assignment,
    }));
    const legacyOptions = this.legacyLeaders.map((leader) => ({
      id: `legacy:${leader.id}`,
      label: this.legacyLeaderLabel(leader),
      legacy: leader,
    }));
    return [...assignmentOptions, ...legacyOptions];
  }

  get selectedLeaderKey(): string | null {
    if (this.selectedAssignmentId) {
      return `assignment:${this.selectedAssignmentId}`;
    }
    if (this.selectedLegacyLeaderId) {
      return `legacy:${this.selectedLegacyLeaderId}`;
    }
    return null;
  }

  set selectedLeaderKey(value: string | null) {
    if (!value) {
      this.selectedAssignmentId = null;
      this.selectedLegacyLeaderId = null;
      return;
    }
    if (value.startsWith('assignment:')) {
      this.selectedAssignmentId = value.replace('assignment:', '');
      this.selectedLegacyLeaderId = null;
    } else if (value.startsWith('legacy:')) {
      this.selectedLegacyLeaderId = Number(value.replace('legacy:', ''));
      this.selectedAssignmentId = null;
    }
  }

  private loadLeaders(): void {
    this.loadingLeaders = true;
    this.governance.getCurrent()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.assignments = (response.data.assignments || []).filter(
            (assignment) =>
              assignment.status === 'active' &&
              (assignment.role?.category === 'PARISH_CLERGY' || assignment.role?.category === 'CANONICAL_DIOCESAN')
          );
          this.loadingLeaders = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.assignments = [];
          this.loadingLeaders = false;
          this.cdr.markForCheck();
        },
      });

    this.legacyLeadership.getLeaders({ active: 1, current: true })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.legacyLeaders = response?.data ?? [];
          this.cdr.markForCheck();
        },
      });
  }

  roleLabel(role: string): string {
    const map: Record<string, string> = {
      priest: 'Priest',
      deacon: 'Deacon',
      pastor: 'Pastor',
      bishop: 'Bishop',
      archbishop: 'Archbishop',
      other: 'Other',
    };
    return map[role] || role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private emit(): void {
    const draft: SacramentParticipantDraft = {
      role: 'minister',
      source: this.source,
      sort_order: 0,
    };

    if (this.source === 'internal_leadership') {
      if (this.selectedAssignmentId) {
        const assignment = this.assignments.find((item) => item.id === this.selectedAssignmentId);
        draft.leadership_assignment_id = this.selectedAssignmentId;
        draft.display_name = assignment?.person?.full_name;
        draft.external_minister_role = assignment?.role?.title || undefined;
      } else if (this.selectedLegacyLeaderId) {
        const leader = this.legacyLeaders.find((item) => item.id === this.selectedLegacyLeaderId);
        draft.church_leadership_id = this.selectedLegacyLeaderId;
        draft.display_name = leader ? leader.full_name : undefined;
        draft.external_title = leader?.title || undefined;
        draft.external_minister_role = leader?.role || undefined;
      }
    } else {
      draft.external_full_name = this.externalName.trim();
      draft.display_name = draft.external_full_name;
      draft.external_title = this.externalTitle.trim() || undefined;
      draft.external_minister_role = this.externalRole || undefined;
    }

    this.valueChange.emit(draft);
  }
}
