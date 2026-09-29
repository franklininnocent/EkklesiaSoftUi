import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import { NgSelectModule } from '@ng-select/ng-select';
import { AuthService } from '@core/services/auth.service';
import { BCCService } from '@core/services/bcc.service';
import { ToastService } from '@core/services/toast.service';
import { ApiResponse } from '@core/models/family.model';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import {
  StatusBadgeComponent,
  StatusBadgeTone,
} from '@shared/components/status-badge/status-badge.component';
import { BccEligibleMember, BccLeaderRow, BccPaged } from '../../models/bcc.model';

const ROLES = ['leader', 'coordinator', 'assistant', 'secretary', 'treasurer', 'animator', 'other'];

type FormMode = 'assign' | 'edit' | 'end' | 'handover';
type LeaderStatus = 'active' | 'completed' | 'vacated' | 'terminated';

const EXIT_REASONS: { value: string; label: string }[] = [
  { value: 'resigned', label: 'Resigned' },
  { value: 'transferred', label: 'Transferred' },
  { value: 'removed', label: 'Removed' },
  { value: 'term_completed', label: 'Term completed' },
  { value: 'deceased', label: 'Deceased' },
];

const EXIT_REASON_LABELS: Record<string, string> = {
  resigned: 'Resigned',
  transferred: 'Transferred',
  removed: 'Removed',
  term_completed: 'Term completed',
  deceased: 'Deceased',
  handover: 'Handed over',
};

@Component({
  selector: 'app-bcc-leadership-tab',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgSelectModule,
    CfEmptyStateComponent,
    DataTableComponent,
    LoadingSkeletonComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './bcc-leadership-tab.component.html',
  styleUrl: './bcc-leadership-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BccLeadershipTabComponent implements OnChanges {
  @Input({ required: true }) bccId!: string;
  @Input() bccStatus = 'active';

  private readonly api = inject(BCCService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  loading = true;
  loadError: string | null = null;
  saving = false;
  submitted = false;
  leaders: BccLeaderRow[] = [];
  timeline: BccLeaderRow[] = [];
  eligible: BccEligibleMember[] = [];
  loadingEligible = false;
  eligibleError: string | null = null;

  mode: FormMode = 'assign';
  editingLeader: BccLeaderRow | null = null;

  // Term fields (assign / edit)
  familyMemberId: string | null = null;
  role = 'leader';
  appointmentDate = '';
  effectiveFrom = '';
  effectiveTo = '';
  termLabel = '';
  appointmentReference = '';
  isInterim = false;
  remarks = '';

  // End-term fields
  endEffectiveTo = '';
  exitReason = '';
  endRemarks = '';

  readonly roles = ROLES;
  readonly exitReasons = EXIT_REASONS;

  constructor() {
    this.applyDefaults();
  }

  get canManage(): boolean {
    return this.auth.hasPermission('bcc.manage_leadership') && this.bccStatus === 'active';
  }

  get primaryLeader(): BccLeaderRow | null {
    return this.leaders.find((leader) => leader.role === 'leader') ?? null;
  }

  get isEditing(): boolean {
    return this.mode === 'edit';
  }

  get isEnding(): boolean {
    return this.mode === 'end';
  }

  get isHandingOver(): boolean {
    return this.mode === 'handover';
  }

  get incomingEligible(): BccEligibleMember[] {
    const outgoingId = this.editingLeader?.family_member_id;
    if (!outgoingId) {
      return this.eligible;
    }
    return this.eligible.filter((member) => member.id !== outgoingId);
  }

  get formTitle(): string {
    switch (this.mode) {
      case 'edit':
        return 'Update leadership term';
      case 'end':
        return 'End leadership term';
      case 'handover':
        return 'Hand over leadership';
      default:
        return 'Assign leadership';
    }
  }

  get submitLabel(): string {
    if (this.saving) {
      if (this.mode === 'end') {
        return 'Ending…';
      }
      if (this.mode === 'handover') {
        return 'Handing over…';
      }
      return this.isEditing ? 'Saving…' : 'Assigning…';
    }
    switch (this.mode) {
      case 'end':
        return 'End leadership';
      case 'handover':
        return 'Complete handover';
      case 'edit':
        return 'Save changes';
      default:
        return 'Assign leadership';
    }
  }

  /** Appointment date must be on or before effective from. */
  get appointmentAfterEffective(): boolean {
    return !!this.appointmentDate && !!this.effectiveFrom && this.appointmentDate > this.effectiveFrom;
  }

  /** Effective to must be on or after effective from. */
  get effectiveToBeforeFrom(): boolean {
    return !!this.effectiveTo && !!this.effectiveFrom && this.effectiveTo < this.effectiveFrom;
  }

  /** End date must be on or after the term start of the leader being ended. */
  get endBeforeTermStart(): boolean {
    const start = this.editingLeader?.effective_from || this.editingLeader?.term_start_date || '';
    return !!this.endEffectiveTo && !!start && this.endEffectiveTo < start;
  }

  get termFormValid(): boolean {
    if (!this.role || !this.appointmentDate || !this.effectiveFrom) {
      return false;
    }
    if (this.appointmentAfterEffective || this.effectiveToBeforeFrom) {
      return false;
    }
    if ((this.mode === 'assign' || this.mode === 'handover') && !this.familyMemberId) {
      return false;
    }
    return true;
  }

  get endFormValid(): boolean {
    return !!this.endEffectiveTo && !!this.exitReason && !this.endBeforeTermStart;
  }

  get handoverFormValid(): boolean {
    return (
      !!this.editingLeader &&
      this.endFormValid &&
      !!this.familyMemberId &&
      this.familyMemberId !== this.editingLeader.family_member_id &&
      this.termFormValid
    );
  }

  get canSubmit(): boolean {
    if (this.saving || !this.canManage) {
      return false;
    }
    if (this.mode === 'end') {
      return this.endFormValid;
    }
    if (this.mode === 'handover') {
      return this.handoverFormValid;
    }
    return this.termFormValid;
  }

  /** Option label: "Agnes M Stephen - FAM000005" (name only when no family code). */
  memberOptionLabel(member: BccEligibleMember): string {
    const name = (member.display_name || '').trim() || 'Unnamed member';
    const code = (member.family_code || '').trim();
    return code ? `${name} - ${code}` : name;
  }

  /** Search across display name and family code. */
  searchEligibleMembers(term: string, item: BccEligibleMember): boolean {
    const query = term.trim().toLowerCase();
    if (!query) {
      return true;
    }
    const haystack = [item.display_name, item.family_code, item.family_name]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  }

  statusLabel(row: BccLeaderRow): string {
    const status = (row.status || (row.is_active ? 'active' : 'terminated')) as LeaderStatus;
    switch (status) {
      case 'active':
        return 'Active';
      case 'completed':
        return 'Completed';
      case 'vacated':
        return 'Vacated';
      case 'terminated':
        return 'Terminated';
      default:
        return status;
    }
  }

  statusTone(row: BccLeaderRow): StatusBadgeTone {
    return row.is_active ? 'success' : 'neutral';
  }

  exitReasonLabel(row: BccLeaderRow): string {
    if (!row.exit_reason) {
      return '—';
    }
    return EXIT_REASON_LABELS[row.exit_reason] ?? row.exit_reason;
  }

  remarksText(row: BccLeaderRow): string | null {
    const text = (row.remarks || row.notes || '').trim();
    return text || null;
  }

  termRange(row: BccLeaderRow): string {
    const from = row.effective_from || row.term_start_date || row.appointed_date || '—';
    const to = row.effective_to || row.term_end_date;
    return to ? `${from} – ${to}` : `${from} – Open`;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['bccId'] && this.bccId) {
      this.resetForm();
      this.load();
      if (this.canManage) {
        this.loadEligible();
      }
    } else if (changes['bccStatus'] && this.canManage && this.bccId && !this.eligible.length) {
      this.loadEligible();
    }
  }

  load(): void {
    this.loading = true;
    this.loadError = null;
    this.api.getLeadershipCurrent(this.bccId).subscribe({
      next: (res: ApiResponse<unknown>) => {
        const data = res.data as { leaders?: BccLeaderRow[] };
        this.leaders = data?.leaders ?? [];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadError = 'Could not load leadership.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
    this.api.getLeadershipTimeline(this.bccId, { per_page: 20 }).subscribe({
      next: (res) => {
        this.timeline = ((res as BccPaged<BccLeaderRow>).data || []) as BccLeaderRow[];
        this.cdr.markForCheck();
      },
    });
  }

  loadEligible(): void {
    this.loadingEligible = true;
    this.eligibleError = null;
    this.api.getEligibleLeaders(this.bccId).subscribe({
      next: (res: ApiResponse<unknown>) => {
        this.eligible = (res.data as BccEligibleMember[]) || [];
        this.loadingEligible = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.eligible = [];
        this.eligibleError = 'Could not load members for this BCC.';
        this.loadingEligible = false;
        this.cdr.markForCheck();
      },
    });
  }

  startEdit(leader: BccLeaderRow): void {
    if (!this.canManage || !leader.is_active) {
      return;
    }
    this.mode = 'edit';
    this.editingLeader = leader;
    this.familyMemberId = leader.family_member_id;
    this.role = leader.role || 'leader';
    this.appointmentDate = leader.appointment_date || leader.appointed_date || '';
    this.effectiveFrom = leader.effective_from || leader.term_start_date || this.appointmentDate;
    this.effectiveTo = leader.effective_to || leader.term_end_date || '';
    this.termLabel = leader.term_label || '';
    this.appointmentReference = leader.appointment_reference || '';
    this.isInterim = !!leader.is_interim;
    this.remarks = leader.remarks || leader.notes || '';
    this.submitted = false;
    this.cdr.markForCheck();
  }

  startHandover(leader: BccLeaderRow): void {
    if (!this.canManage || !leader.is_active) {
      return;
    }
    this.mode = 'handover';
    this.editingLeader = leader;
    this.familyMemberId = null;
    this.role = leader.role || 'leader';
    const today = this.todayIsoDate();
    this.endEffectiveTo = today;
    this.exitReason = '';
    this.endRemarks = '';
    this.appointmentDate = today;
    this.effectiveFrom = today;
    this.effectiveTo = '';
    this.termLabel = '';
    this.appointmentReference = '';
    this.isInterim = false;
    this.remarks = '';
    this.submitted = false;
    this.cdr.markForCheck();
  }

  startEnd(leader: BccLeaderRow): void {
    if (!this.canManage || !leader.is_active) {
      return;
    }
    this.mode = 'end';
    this.editingLeader = leader;
    this.endEffectiveTo = this.todayIsoDate();
    this.exitReason = '';
    this.endRemarks = '';
    this.submitted = false;
    this.cdr.markForCheck();
  }

  cancelEdit(): void {
    this.resetForm();
    this.cdr.markForCheck();
  }

  submit(): void {
    this.submitted = true;
    if (!this.canSubmit) {
      return;
    }
    if (this.mode === 'end' && this.editingLeader) {
      this.end(this.editingLeader);
      return;
    }
    if (this.mode === 'handover' && this.editingLeader) {
      this.handover(this.editingLeader);
      return;
    }
    if (this.mode === 'edit' && this.editingLeader) {
      this.update(this.editingLeader);
      return;
    }
    this.assign();
  }

  private assign(): void {
    this.saving = true;
    this.api
      .assignLeadership(this.bccId, {
        family_member_id: this.familyMemberId,
        role: this.role,
        appointment_date: this.appointmentDate,
        effective_from: this.effectiveFrom,
        effective_to: this.effectiveTo || undefined,
        term_label: this.termLabel.trim() || undefined,
        appointment_reference: this.appointmentReference.trim() || undefined,
        is_interim: this.isInterim,
        remarks: this.remarks.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.toast.success('Leadership assigned.');
          this.resetForm();
          this.load();
          this.loadEligible();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.saving = false;
          this.toast.error(err?.error?.message || 'Could not assign leadership.');
          this.cdr.markForCheck();
        },
      });
  }

  private update(leader: BccLeaderRow): void {
    this.saving = true;
    this.api
      .updateLeader(this.bccId, leader.id, {
        role: this.role,
        appointment_date: this.appointmentDate,
        effective_from: this.effectiveFrom,
        effective_to: this.effectiveTo || null,
        term_label: this.termLabel.trim() || null,
        appointment_reference: this.appointmentReference.trim() || null,
        is_interim: this.isInterim,
        remarks: this.remarks.trim() || null,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.toast.success('Leadership term updated.');
          this.resetForm();
          this.load();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.saving = false;
          this.toast.error(err?.error?.message || 'Could not update leadership.');
          this.cdr.markForCheck();
        },
      });
  }

  private handover(leader: BccLeaderRow): void {
    this.saving = true;
    this.api
      .handoverLeadership(this.bccId, {
        outgoing_leader_id: leader.id,
        incoming_family_member_id: this.familyMemberId,
        role: this.role,
        outgoing_effective_to: this.endEffectiveTo,
        outgoing_exit_reason: this.exitReason,
        appointment_date: this.appointmentDate,
        effective_from: this.effectiveFrom,
        effective_to: this.effectiveTo || undefined,
        term_label: this.termLabel.trim() || undefined,
        appointment_reference: this.appointmentReference.trim() || undefined,
        is_interim: this.isInterim,
        remarks: this.remarks.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.toast.success('Leadership handed over.');
          this.resetForm();
          this.load();
          this.loadEligible();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.saving = false;
          this.toast.error(err?.error?.message || 'Could not hand over leadership.');
          this.cdr.markForCheck();
        },
      });
  }

  private end(leader: BccLeaderRow): void {
    this.saving = true;
    this.api
      .terminateLeadership(this.bccId, leader.id, {
        effective_to: this.endEffectiveTo,
        exit_reason: this.exitReason,
        remarks: this.endRemarks.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.toast.success('Leadership ended.');
          this.resetForm();
          this.load();
          this.loadEligible();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.saving = false;
          this.toast.error(err?.error?.message || 'Could not end leadership.');
          this.cdr.markForCheck();
        },
      });
  }

  private resetForm(): void {
    this.mode = 'assign';
    this.editingLeader = null;
    this.submitted = false;
    this.applyDefaults();
  }

  private applyDefaults(): void {
    const today = this.todayIsoDate();
    this.familyMemberId = null;
    this.role = 'leader';
    this.appointmentDate = today;
    this.effectiveFrom = today;
    this.effectiveTo = '';
    this.termLabel = '';
    this.appointmentReference = '';
    this.isInterim = false;
    this.remarks = '';
    this.endEffectiveTo = today;
    this.exitReason = '';
    this.endRemarks = '';
  }

  private todayIsoDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
