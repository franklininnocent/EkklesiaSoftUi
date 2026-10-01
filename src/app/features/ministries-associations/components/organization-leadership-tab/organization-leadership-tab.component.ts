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
import { EntitlementService } from '@core/services/entitlement.service';
import { ToastService } from '@core/services/toast.service';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { CfActionIconComponent } from '@shared/components/cf-action-icon/cf-action-icon.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { SortableDirective, SortEvent } from '@shared/directives/sortable.directive';
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
import { cfFormatDate } from '@shared/utils/cf-intl.util';

type StatusFilter = '' | LeadershipStatus;

type CurrentLeadershipRow =
  | { type: 'filled'; term: LeadershipTerm }
  | { type: 'vacant'; position: CurrentLeadershipPositionRow['position'] };

type CurrentSortColumn = 'position' | 'member' | 'term' | 'status';
type TimelineSortColumn =
  | 'position_name'
  | 'member_name'
  | 'effective_from'
  | 'effective_to'
  | 'status'
  | 'exit_reason';

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
    CfActionIconComponent,
    PageHeaderComponent,
    SortableDirective,
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
  private readonly entitlements = inject(EntitlementService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) organizationId!: string;
  @Input({ required: true }) organizationStatus!: Organization['status'];
  @Input() isArchived = false;
  @Output() leadershipChanged = new EventEmitter<void>();

  currentAllRows: CurrentLeadershipRow[] = [];
  timelineTerms: LeadershipTerm[] = [];
  positions: Position[] = [];

  currentLoading = false;
  currentLoaded = false;
  currentError: string | null = null;

  timelineLoading = false;
  timelineLoaded = false;
  timelineError: string | null = null;

  canManageLeadership = false;
  showAssignModal = false;
  assignPositionId: string | null = null;
  showEditModal = false;
  editTerm: LeadershipTerm | null = null;
  showHandoverModal = false;
  handoverTerm: LeadershipTerm | null = null;
  showTerminateModal = false;
  terminateTerm: LeadershipTerm | null = null;

  positionFilter = '';
  statusFilter: StatusFilter = '';

  currentPage = 1;
  currentPerPage = 15;
  currentSortBy: CurrentSortColumn = 'position';
  currentSortDir: 'asc' | 'desc' = 'asc';
  /** Single-selection key for toolbar actions (`term:{id}` or `vacant:{positionId}`). */
  selectedCurrentRowKey: string | null = null;

  timelinePage = 1;
  timelinePerPage = 15;
  timelineTotalItems = 0;
  timelineSortBy: TimelineSortColumn = 'effective_from';
  timelineSortDir: 'asc' | 'desc' = 'desc';

  readonly perPageOptions = [10, 15, 20, 50];

  ngOnInit(): void {
    this.canManageLeadership = this.authService.hasPermission('ministries.manage_leadership');
    this.loadCurrent();
    this.loadTimeline();
    this.loadPositions();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['organizationId'] && !changes['organizationId'].firstChange) {
      this.currentPage = 1;
      this.timelinePage = 1;
      this.selectedCurrentRowKey = null;
      this.timelineLoaded = false;
      this.loadCurrent();
      this.loadTimeline();
      this.loadPositions();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get paginatedCurrentRows(): CurrentLeadershipRow[] {
    const sorted = this.sortedCurrentRows();
    const start = (this.currentPage - 1) * this.currentPerPage;
    return sorted.slice(start, start + this.currentPerPage);
  }

  get currentTotalItems(): number {
    return this.currentAllRows.length;
  }

  get isInactiveOrganization(): boolean {
    return this.organizationStatus === 'inactive' || this.isArchived;
  }

  private get canChangeLeadership(): boolean {
    return (
      this.canManageLeadership &&
      !this.isInactiveOrganization &&
      this.entitlements.hasFeature('ADVANCED_MINISTRY_MANAGEMENT')
    );
  }

  get canAssign(): boolean {
    return this.canChangeLeadership;
  }

  get canHandover(): boolean {
    return this.canChangeLeadership;
  }

  get canTerminate(): boolean {
    return this.canChangeLeadership;
  }

  get canEdit(): boolean {
    return this.canChangeLeadership;
  }

  get hasTimelineFilters(): boolean {
    return !!(this.positionFilter || this.statusFilter);
  }

  get showCurrentSelectionColumn(): boolean {
    return this.canChangeLeadership;
  }

  get showCurrentToolbarActions(): boolean {
    return this.canChangeLeadership;
  }

  get selectedCurrentRow(): CurrentLeadershipRow | null {
    if (!this.selectedCurrentRowKey) {
      return null;
    }
    return (
      this.currentAllRows.find((row) => this.currentRowSelectionKey(row) === this.selectedCurrentRowKey) ?? null
    );
  }

  get selectedActiveTerm(): LeadershipTerm | null {
    const row = this.selectedCurrentRow;
    if (!row || row.type !== 'filled' || row.term.status !== 'active') {
      return null;
    }
    return row.term;
  }

  get canEditSelected(): boolean {
    return this.canEdit && this.selectedActiveTerm !== null;
  }

  get canHandoverSelected(): boolean {
    return this.canHandover && this.selectedActiveTerm !== null;
  }

  get canTerminateSelected(): boolean {
    return this.canTerminate && this.selectedActiveTerm !== null;
  }

  /** Assign without a row, or fill a vacant position when that row is selected. */
  get canAssignFromToolbar(): boolean {
    if (!this.canAssign) {
      return false;
    }
    const row = this.selectedCurrentRow;
    if (!row) {
      return true;
    }
    return row.type === 'vacant';
  }

  get editSelectedAriaLabel(): string {
    const term = this.selectedActiveTerm;
    if (!term) {
      return 'Edit';
    }
    return `Edit ${this.positionName(term)} — ${this.holderName(term)}`;
  }

  get handoverSelectedAriaLabel(): string {
    const term = this.selectedActiveTerm;
    if (!term) {
      return 'Hand over';
    }
    return `Hand over ${this.positionName(term)} — ${this.holderName(term)}`;
  }

  get terminateSelectedAriaLabel(): string {
    const term = this.selectedActiveTerm;
    if (!term) {
      return 'Terminate';
    }
    return `Terminate ${this.positionName(term)} — ${this.holderName(term)}`;
  }

  get assignSelectedAriaLabel(): string {
    const row = this.selectedCurrentRow;
    if (row?.type === 'vacant') {
      return `Assign ${row.position.name}`;
    }
    return 'Assign leadership';
  }

  currentRowSelectionKey(row: CurrentLeadershipRow): string {
    if (row.type === 'filled') {
      return `term:${row.term.id}`;
    }
    return `vacant:${row.position.id}`;
  }

  currentRowLabel(row: CurrentLeadershipRow): string {
    if (row.type === 'filled') {
      return `${this.positionName(row.term)} — ${this.holderName(row.term)}`;
    }
    return `${row.position.name} (vacant)`;
  }

  isCurrentRowSelected(row: CurrentLeadershipRow): boolean {
    return this.selectedCurrentRowKey === this.currentRowSelectionKey(row);
  }

  onSelectCurrentRow(row: CurrentLeadershipRow, checked: boolean): void {
    const key = this.currentRowSelectionKey(row);
    if (checked) {
      this.selectedCurrentRowKey = key;
    } else if (this.selectedCurrentRowKey === key) {
      this.selectedCurrentRowKey = null;
    }
    this.cdr.markForCheck();
  }

  editSelected(): void {
    const term = this.selectedActiveTerm;
    if (term) {
      this.openEditModal(term);
    }
  }

  handoverSelected(): void {
    const term = this.selectedActiveTerm;
    if (term) {
      this.openHandoverModal(term);
    }
  }

  terminateSelected(): void {
    const term = this.selectedActiveTerm;
    if (term) {
      this.openTerminateModal(term);
    }
  }

  assignFromToolbar(): void {
    if (!this.canAssignFromToolbar) {
      return;
    }
    const row = this.selectedCurrentRow;
    if (row?.type === 'vacant') {
      this.openAssignModal(row.position.id);
      return;
    }
    this.openAssignModal();
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

  openEditModal(term: LeadershipTerm): void {
    if (!this.canEdit || term.status !== 'active') {
      return;
    }
    this.editTerm = term;
    this.showEditModal = true;
    this.cdr.markForCheck();
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.editTerm = null;
    this.cdr.markForCheck();
  }

  onLeadershipUpdated(): void {
    this.showEditModal = false;
    this.editTerm = null;
    this.selectedCurrentRowKey = null;
    this.toastService.success('Office bearer updated successfully.');
    this.loadCurrent();
    this.loadTimeline();
    this.leadershipChanged.emit();
    this.cdr.markForCheck();
  }

  onLeadershipAssigned(): void {
    this.showAssignModal = false;
    this.assignPositionId = null;
    this.selectedCurrentRowKey = null;
    this.toastService.success('Leadership assigned successfully.');
    this.loadCurrent();
    this.loadTimeline();
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
    this.selectedCurrentRowKey = null;
    this.toastService.success('Leadership handed over successfully.');
    this.loadCurrent();
    this.loadTimeline();
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
    this.selectedCurrentRowKey = null;
    this.toastService.success('Leadership terminated successfully.');
    this.loadCurrent();
    this.loadTimeline();
    this.leadershipChanged.emit();
    this.cdr.markForCheck();
  }

  statusTone(status: LeadershipStatus): StatusBadgeTone {
    return status === 'active' ? 'success' : 'neutral';
  }

  onCurrentSort(event: SortEvent): void {
    const column = event.column as CurrentSortColumn;
    if (!['position', 'member', 'term', 'status'].includes(column)) {
      return;
    }
    this.currentSortBy = column;
    this.currentSortDir = event.direction ?? 'asc';
    this.currentPage = 1;
    this.cdr.markForCheck();
  }

  onTimelineSort(event: SortEvent): void {
    const column = event.column as TimelineSortColumn;
    const allowed: TimelineSortColumn[] = [
      'position_name',
      'member_name',
      'effective_from',
      'effective_to',
      'status',
      'exit_reason',
    ];
    if (!allowed.includes(column)) {
      return;
    }
    this.timelineSortBy = column;
    this.timelineSortDir = event.direction ?? 'asc';
    this.timelinePage = 1;
    this.loadTimeline();
  }

  onTimelineFilterChange(): void {
    this.timelinePage = 1;
    this.loadTimeline();
  }

  onCurrentPageChange(page: number): void {
    this.currentPage = page;
    this.cdr.markForCheck();
  }

  onCurrentPageSizeChange(size: number): void {
    this.currentPerPage = size;
    this.currentPage = 1;
    this.cdr.markForCheck();
  }

  onTimelinePageChange(page: number): void {
    this.timelinePage = page;
    this.loadTimeline();
  }

  onTimelinePageSizeChange(size: number): void {
    this.timelinePerPage = size;
    this.timelinePage = 1;
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
    return cfFormatDate(date) || '—';
  }

  private sortedCurrentRows(): CurrentLeadershipRow[] {
    const rows = [...this.currentAllRows];
    const dir = this.currentSortDir === 'desc' ? -1 : 1;

    rows.sort((a, b) => {
      let cmp = 0;
      switch (this.currentSortBy) {
        case 'position':
          cmp = this.currentRowPositionName(a).localeCompare(this.currentRowPositionName(b), undefined, {
            sensitivity: 'base',
          });
          break;
        case 'member':
          cmp = this.currentRowMemberName(a).localeCompare(this.currentRowMemberName(b), undefined, {
            sensitivity: 'base',
          });
          break;
        case 'term':
          cmp = this.currentRowTermStart(a).localeCompare(this.currentRowTermStart(b));
          break;
        case 'status':
          cmp = this.currentRowStatusKey(a).localeCompare(this.currentRowStatusKey(b), undefined, {
            sensitivity: 'base',
          });
          break;
      }
      if (cmp === 0) {
        cmp = this.currentRowPositionName(a).localeCompare(this.currentRowPositionName(b), undefined, {
          sensitivity: 'base',
        });
      }
      return cmp * dir;
    });

    return rows;
  }

  private currentRowPositionName(row: CurrentLeadershipRow): string {
    if (row.type === 'vacant') {
      return row.position.name;
    }
    return this.positionName(row.term);
  }

  private currentRowMemberName(row: CurrentLeadershipRow): string {
    if (row.type === 'vacant') {
      return '';
    }
    return this.holderName(row.term);
  }

  private currentRowTermStart(row: CurrentLeadershipRow): string {
    if (row.type === 'vacant') {
      return '';
    }
    return row.term.effective_from ?? '';
  }

  private currentRowStatusKey(row: CurrentLeadershipRow): string {
    if (row.type === 'vacant') {
      return 'vacant';
    }
    return row.term.status;
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
          this.currentAllRows = this.toCurrentRows(response.data?.positions ?? []);
          this.pruneCurrentRowSelection();
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

  private pruneCurrentRowSelection(): void {
    if (!this.selectedCurrentRowKey) {
      return;
    }
    const stillExists = this.currentAllRows.some(
      (row) => this.currentRowSelectionKey(row) === this.selectedCurrentRowKey,
    );
    if (!stillExists) {
      this.selectedCurrentRowKey = null;
    }
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
        page: this.timelinePage,
        per_page: this.timelinePerPage,
        position_id: this.positionFilter || undefined,
        status: this.statusFilter || undefined,
        sort_by: this.timelineSortBy,
        sort_dir: this.timelineSortDir,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.timelineTerms = response.data;
          this.timelineTotalItems = response.meta?.total ?? 0;
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
