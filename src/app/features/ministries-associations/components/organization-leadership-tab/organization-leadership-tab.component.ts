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
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { ActionBarComponent, ActionBarItem } from '@shared/components/action-bar/action-bar.component';
import { SectionCardComponent } from '@shared/components/section-card/section-card.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import {
  CurrentLeadershipPositionRow,
  LeadershipExitReason,
  LeadershipStatus,
  LeadershipTerm,
  Organization,
  Position,
} from '../../models/ministries.model';
import { MinistriesApiService } from '../../services/ministries-api.service';
import { AssignLeadershipModalComponent } from '../assign-leadership-modal/assign-leadership-modal.component';
import { HandoverLeadershipModalComponent } from '../handover-leadership-modal/handover-leadership-modal.component';
import { TerminateLeadershipModalComponent } from '../terminate-leadership-modal/terminate-leadership-modal.component';

type StatusFilter = '' | LeadershipStatus;

type CurrentLeadershipRow =
  | { type: 'filled'; term: LeadershipTerm }
  | { type: 'vacant'; position: CurrentLeadershipPositionRow['position'] };

@Component({
  selector: 'app-organization-leadership-tab',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    PaginationComponent,
    DataTableComponent,
    StatusBadgeComponent,
    ActionBarComponent,
    SectionCardComponent,
    PageHeaderComponent,
    AssignLeadershipModalComponent,
    HandoverLeadershipModalComponent,
    TerminateLeadershipModalComponent,
  ],
  templateUrl: './organization-leadership-tab.component.html',
  styleUrl: './organization-leadership-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationLeadershipTabComponent implements OnInit, OnChanges, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly api = inject(MinistriesApiService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) organizationId!: string;
  @Input({ required: true }) organizationStatus!: Organization['status'];
  @Input() isArchived = false;
  @Output() leadershipChanged = new EventEmitter<void>();

  currentRows: CurrentLeadershipRow[] = [];
  timelineTerms: LeadershipTerm[] = [];
  positions: Position[] = [];

  currentLoading = false;
  currentLoaded = false;
  currentError: string | null = null;

  timelineExpanded = false;
  timelineLoading = false;
  timelineLoaded = false;
  timelineError: string | null = null;

  canManageLeadership = false;
  showAssignModal = false;
  assignPositionId: string | null = null;
  showHandoverModal = false;
  handoverTerm: LeadershipTerm | null = null;
  showTerminateModal = false;
  terminateTerm: LeadershipTerm | null = null;

  positionFilter = '';
  statusFilter: StatusFilter = '';
  currentPage = 1;
  perPage = 15;
  totalItems = 0;
  readonly perPageOptions = [10, 15, 20, 50];

  ngOnInit(): void {
    this.canManageLeadership = this.authService.hasPermission('ministries.manage_leadership');
    this.loadCurrent();
    this.loadPositions();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['organizationId'] && !changes['organizationId'].firstChange) {
      this.timelineExpanded = false;
      this.timelineLoaded = false;
      this.loadCurrent();
      this.loadPositions();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isInactiveOrganization(): boolean {
    return this.organizationStatus === 'inactive' || this.isArchived;
  }

  get canAssign(): boolean {
    return this.canManageLeadership && !this.isInactiveOrganization;
  }

  get canHandover(): boolean {
    return this.canManageLeadership && !this.isInactiveOrganization;
  }

  get canTerminate(): boolean {
    return this.canManageLeadership && !this.isInactiveOrganization;
  }

  get hasTimelineFilters(): boolean {
    return !!(this.positionFilter || this.statusFilter);
  }

  get showCurrentActions(): boolean {
    return this.canAssign || this.canHandover || this.canTerminate;
  }

  openAssignModal(positionId: string | null = null): void {
    if (!this.canAssign) {
      return;
    }
    this.assignPositionId = positionId;
    this.showAssignModal = true;
    this.cdr.markForCheck();
  }

  closeAssignModal(): void {
    this.showAssignModal = false;
    this.assignPositionId = null;
    this.cdr.markForCheck();
  }

  onLeadershipAssigned(): void {
    this.showAssignModal = false;
    this.assignPositionId = null;
    this.toastService.success('Leadership assigned successfully.');
    this.loadCurrent();
    if (this.timelineExpanded) {
      this.loadTimeline();
    }
    this.leadershipChanged.emit();
    this.cdr.markForCheck();
  }

  openHandoverModal(term: LeadershipTerm): void {
    if (!this.canHandover || term.status !== 'active') {
      return;
    }
    this.handoverTerm = term;
    this.showHandoverModal = true;
    this.cdr.markForCheck();
  }

  closeHandoverModal(): void {
    this.showHandoverModal = false;
    this.handoverTerm = null;
    this.cdr.markForCheck();
  }

  onLeadershipHandedOver(): void {
    this.showHandoverModal = false;
    this.handoverTerm = null;
    this.toastService.success('Leadership handed over successfully.');
    this.loadCurrent();
    if (this.timelineExpanded) {
      this.loadTimeline();
    }
    this.leadershipChanged.emit();
    this.cdr.markForCheck();
  }

  openTerminateModal(term: LeadershipTerm): void {
    if (!this.canTerminate || term.status !== 'active') {
      return;
    }
    this.terminateTerm = term;
    this.showTerminateModal = true;
    this.cdr.markForCheck();
  }

  closeTerminateModal(): void {
    this.showTerminateModal = false;
    this.terminateTerm = null;
    this.cdr.markForCheck();
  }

  onLeadershipTerminated(): void {
    this.showTerminateModal = false;
    this.terminateTerm = null;
    this.toastService.success('Leadership terminated successfully.');
    this.loadCurrent();
    if (this.timelineExpanded) {
      this.loadTimeline();
    }
    this.leadershipChanged.emit();
    this.cdr.markForCheck();
  }

  onTimelineToggle(expanded: boolean): void {
    this.timelineExpanded = expanded;
    if (expanded && !this.timelineLoaded && !this.timelineLoading) {
      this.loadTimeline();
    }
    this.cdr.markForCheck();
  }

  statusTone(status: LeadershipStatus): StatusBadgeTone {
    return status === 'active' ? 'success' : 'neutral';
  }

  currentRowActions(term: LeadershipTerm): ActionBarItem[] {
    return [
      { id: 'handover', label: 'Hand over', tier: 'secondary', hidden: !this.canHandover },
      { id: 'terminate', label: 'Terminate', tier: 'danger', hidden: !this.canTerminate },
    ];
  }

  onCurrentRowAction(actionId: string, term: LeadershipTerm): void {
    if (actionId === 'handover') {
      this.openHandoverModal(term);
    } else if (actionId === 'terminate') {
      this.openTerminateModal(term);
    }
  }

  onTimelineFilterChange(): void {
    this.currentPage = 1;
    this.loadTimeline();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadTimeline();
  }

  onPageSizeChange(size: number): void {
    this.perPage = size;
    this.currentPage = 1;
    this.loadTimeline();
  }

  retryCurrent(): void {
    this.loadCurrent();
  }

  retryTimeline(): void {
    this.loadTimeline();
  }

  statusLabel(status: LeadershipStatus): string {
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

  exitReasonLabel(reason: LeadershipExitReason | null): string {
    if (!reason) {
      return '—';
    }
    switch (reason) {
      case 'resigned':
        return 'Resigned';
      case 'transferred':
        return 'Transferred';
      case 'removed':
        return 'Removed';
      case 'term_completed':
        return 'Term completed';
      case 'deceased':
        return 'Deceased';
      case 'census_cascade':
        return 'Parish record change';
      default:
        return reason;
    }
  }

  termRange(term: LeadershipTerm): string {
    const from = this.formatDate(term.effective_from);
    if (!term.effective_to) {
      return `${from} – Open`;
    }
    return `${from} – ${this.formatDate(term.effective_to)}`;
  }

  positionName(term: LeadershipTerm): string {
    return term.position?.name?.trim() || '—';
  }

  holderName(term: LeadershipTerm): string {
    return term.holder?.display_name?.trim() || '—';
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  private loadPositions(): void {
    this.api
      .listPositions({ is_active: true, per_page: 100 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.positions = response.data;
          this.cdr.markForCheck();
        },
      });
  }

  private loadCurrent(): void {
    if (!this.organizationId) {
      return;
    }

    this.currentLoading = true;
    this.currentError = null;
    this.cdr.markForCheck();

    this.api
      .getCurrentLeadership(this.organizationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.currentRows = this.toCurrentRows(response.data?.positions ?? []);
          this.currentLoading = false;
          this.currentLoaded = true;
          this.cdr.markForCheck();
        },
        error: () => {
          this.currentError = 'Could not load current office bearers. Please try again.';
          this.currentLoading = false;
          this.currentLoaded = true;
          this.cdr.markForCheck();
        },
      });
  }

  private toCurrentRows(positions: CurrentLeadershipPositionRow[]): CurrentLeadershipRow[] {
    const rows: CurrentLeadershipRow[] = [];
    for (const row of positions) {
      const terms = row.current_terms ?? [];
      if (row.vacant || terms.length === 0) {
        rows.push({ type: 'vacant', position: row.position });
        continue;
      }
      for (const term of terms) {
        rows.push({ type: 'filled', term });
      }
    }
    return rows;
  }

  private loadTimeline(): void {
    if (!this.organizationId) {
      return;
    }

    this.timelineLoading = true;
    this.timelineError = null;
    this.cdr.markForCheck();

    this.api
      .getLeadershipTimeline(this.organizationId, {
        page: this.currentPage,
        per_page: this.perPage,
        position_id: this.positionFilter || undefined,
        status: this.statusFilter || undefined,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.timelineTerms = response.data;
          this.totalItems = response.meta?.total ?? 0;
          this.timelineLoading = false;
          this.timelineLoaded = true;
          this.cdr.markForCheck();
        },
        error: () => {
          this.timelineError = 'Could not load leadership history. Please try again.';
          this.timelineLoading = false;
          this.timelineLoaded = true;
          this.cdr.markForCheck();
        },
      });
  }
}
