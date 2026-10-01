import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { EMPTY, Subject, merge } from 'rxjs';
import { catchError, debounceTime, finalize, map, switchMap } from 'rxjs/operators';
import { AuthService } from '@core/services/auth.service';
import { ChurchCurrencyService } from '@core/services/church-currency.service';
import { ToastService } from '@core/services/toast.service';
import { FamilyService } from '@core/services/family.service';
import { Family } from '@core/models/family.model';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { ConfirmationModalComponent, ConfirmationResult } from '@shared/components/confirmation-modal/confirmation-modal.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { CfActionIconComponent } from '@shared/components/cf-action-icon/cf-action-icon.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { SortableDirective, SortEvent } from '@shared/directives/sortable.directive';
import { DonationsService } from '../services/donations.service';
import { QuickCollectService } from '../services/quick-collect.service';
import {
  DonationProject,
  ProjectDashboard,
  ProjectFamilyAssignment,
  ProjectFamilyProgressResponse,
  ProjectFamilyProgressRow,
  ProjectFamilyProgressSort,
  ProjectFamilyProgressStatus,
  ProjectInstallmentGenerationResult,
  ProjectInstallmentSchedule
} from '../models/donation.model';
import { localDateOnly } from '../utils/local-date-only';
import { daysUntilProjectEnd, projectNeedsAttention } from '../utils/project-attention.util';
import { CfCurrencyPipe } from '@shared/pipes/cf-currency.pipe';
import { CfDatePipe } from '@shared/pipes/cf-date.pipe';
import { CfFamilyPickerLabelPipe } from '@shared/pipes/cf-family-picker-label.pipe';
import { formatFamilyHeadWithCode, formatFamilyPickerLabel } from '@shared/utils/family-display.util';
import { refreshStewardshipView, setupStewardshipRouteReload } from '../utils/stewardship-view.util';

function projectDateRangeValidator(control: AbstractControl): ValidationErrors | null {
  const start = control.get('start_date')?.value;
  const end = control.get('end_date')?.value;
  if (start && end && end < start) {
    return { dateRange: true };
  }
  return null;
}
@Component({
  selector: 'app-donations-projects',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    ModalShellComponent,
    ConfirmationModalComponent,
    PageHeaderComponent,
    ListToolbarComponent,
    DataTableComponent,
    PaginationComponent,
    SortableDirective,
    StatusBadgeComponent,
    CfCurrencyPipe,
    CfDatePipe,
    CfActionIconComponent,
    CfFamilyPickerLabelPipe],
  templateUrl: './donations-projects.component.html',
  styleUrl: './donations-projects.component.scss'
})
export class DonationsProjectsComponent implements OnInit {
  private readonly churchCurrency = inject(ChurchCurrencyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private familiesLoadStarted = false;

  get currencySymbol(): string {
    return this.churchCurrency.currencySymbol() ?? '';
  }

  projects: DonationProject[] = [];
  tableSearch = '';
  families: Family[] = [];
  draftAssignments: ProjectFamilyAssignment[] = [];
  dashboard: ProjectDashboard | null = null;
  dashboardLoading = false;
  dashboardLoadError: string | null = null;
  familyRows: ProjectFamilyProgressRow[] = [];
  familyTotal = 0;
  familyPage = 1;
  familyPerPage = 20;
  readonly familyPerPageOptions = [10, 20, 50];
  familySearch = '';
  familyStatusFilter: ProjectFamilyProgressStatus | '' = '';
  familyBccFilter = '';
  familyBccOptions: Array<{ id: string; name: string }> = [];
  familySort: ProjectFamilyProgressSort = 'outstanding_amount';
  familySortDirection: 'asc' | 'desc' = 'desc';
  familyLoading = false;
  familyLoaded = false;
  familyLoadError: string | null = null;
  private readonly familyReload$ = new Subject<{ resetPage: boolean }>();
  private readonly familySearch$ = new Subject<string>();
  selectedProjectId: string | null = null;
  selectedFamilyId = '';
  assignmentAmount = 0;
  assignmentExempt = false;
  assignmentEffectiveFrom = localDateOnly();
  showForm = false;
  editingProjectId: string | null = null;
  submitAttempted = false;
  saving = false;
  projectsLoaded = false;
  projectsLoadError: string | null = null;
  message: string | null = null;
  error: string | null = null;
  generatingProjectId: string | null = null;
  regenerateProject: DonationProject | null = null;
  installmentNotice: string | null = null;
  installmentNoticeError = false;
  canManage = false;

  projectForm = this.fb.group({
    name: ['', Validators.required],
    code: ['', Validators.required],
    assignment_mode: ['uniform', Validators.required],
    default_family_target: [null as number | null, [Validators.required, Validators.min(0.01)]],
    target_amount: [null as number | null],
    installment_count: [1, [Validators.required, Validators.min(1)]],
    installment_frequency: [''],
    start_date: [''],
    end_date: [''],
    auto_generate_installments: [true],
    status: ['active']
  }, { validators: projectDateRangeValidator });

  constructor(
    private fb: FormBuilder,
    private donationsService: DonationsService,
    private familyService: FamilyService,
    private authService: AuthService,
    private quickCollectService: QuickCollectService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.canManage = this.authService.hasPermission('donations.manage');
    this.setupFamilyProgressLoader();
    this.loadProjects();
    this.donationsService.ledgerMutated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refreshAfterLedgerChange());
    setupStewardshipRouteReload(this.router, this.destroyRef, '/donations/projects', () => this.loadProjects());
  }

  readonly pageTitle = 'Building & Special Projects';

  readonly pageSubtitle =
    'Long-running building and special funds — track family targets, installments, and follow up on gaps.';

  get isStatusActive(): boolean {
    return this.projectForm.value.status === 'active';
  }

  get isAutoInstallmentsEnabled(): boolean {
    return !!this.projectForm.value.auto_generate_installments;
  }

  get filteredProjects(): DonationProject[] {
    const query = this.tableSearch.trim().toLowerCase();
    if (!query) {
      return this.projects;
    }
    return this.projects.filter((project) =>
      [project.name, project.code, project.status].join(' ').toLowerCase().includes(query)
    );
  }

  onTableSearchChange(value: string): void {
    this.tableSearch = value;
    this.cdr.markForCheck();
  }

  clearSearch(): void {
    this.tableSearch = '';
    this.cdr.markForCheck();
  }

  trackProject(_index: number, project: DonationProject): string {
    return project.id;
  }

  get selectedProject(): DonationProject | null {
    if (!this.selectedProjectId) {
      return null;
    }
    return (
      this.projects.find((project) => project.id === this.selectedProjectId) ??
      this.dashboard?.project ??
      null
    );
  }

  get needsAssignments(): boolean {
    const mode = this.projectForm.value.assignment_mode;
    return mode === 'individual' || mode === 'uniform_with_exceptions';
  }

  get familyTargetLabel(): string {
    const mode = this.projectForm.value.assignment_mode;
    if (mode === 'individual') {
      return 'Default family target';
    }
    return 'Fixed amount per family';
  }

  isProjectAtRisk(project: DonationProject): boolean {
    return projectNeedsAttention(project);
  }

  isFieldInvalid(field: string): boolean {
    if (field === 'end_date' && this.projectForm.errors?.['dateRange'] && (this.submitAttempted || this.projectForm.get('end_date')?.touched)) {
      return true;
    }
    const control = this.projectForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched || this.submitAttempted));
  }

  fieldError(field: string): string {
    const control = this.projectForm.get(field);
    if (!control?.errors) {
      if (field === 'end_date' && this.projectForm.errors?.['dateRange']) {
        return 'End date must be on or after the start date.';
      }
      return '';
    }
    if (control.errors['required']) {
      const labels: Record<string, string> = {
        name: 'Project name is required.',
        code: 'Project code is required.',
        default_family_target: 'Enter the expected contribution amount.',
        installment_count: 'Installment count is required.'
      };
      return labels[field] || 'This field is required.';
    }
    if (control.errors['min']) {
      if (field === 'default_family_target') {
        return 'Amount must be greater than zero.';
      }
      if (field === 'installment_count') {
        return 'Enter at least one installment.';
      }
    }
    return 'Please check this field.';
  }

  modeLabel(mode: string): string {
    return ({
      uniform: 'Fixed for all',
      individual: 'Per family',
      uniform_with_exceptions: 'Fixed + exceptions'
    } as Record<string, string>)[mode] || mode;
  }

  projectEndLabel(project: DonationProject): string {
    const days = daysUntilProjectEnd(project.end_date);
    if (days === null) {
      return 'No end date';
    }
    if (days < 0) {
      return 'Ended';
    }
    if (days === 0) {
      return 'Ends today';
    }
    if (days === 1) {
      return '1 day left';
    }
    return `${days} days left`;
  }

  isProjectEndUrgent(project: DonationProject): boolean {
    const days = daysUntilProjectEnd(project.end_date);
    return days !== null && days >= 0 && days <= 14;
  }

  hasProjectEnded(project: DonationProject): boolean {
    const days = daysUntilProjectEnd(project.end_date);
    return days !== null && days < 0;
  }

  hasFundingTarget(project: DonationProject): boolean {
    if (project.has_funding_target != null) {
      return project.has_funding_target;
    }
    return Number(project.overall_target ?? project.target_amount) > 0;
  }

  progressPercent(project: DonationProject): number {
    if (!this.hasFundingTarget(project) || project.collection_percentage == null) {
      return 0;
    }
    return Math.min(100, Math.max(0, Math.round(Number(project.collection_percentage))));
  }

  dashboardProgressPercent(dashboard: ProjectDashboard): number {
    return Math.min(100, Math.max(0, Math.round(Number(dashboard.totals.collection_percentage ?? 0))));
  }

  remainingPercent(dashboard: ProjectDashboard): number {
    return Math.max(0, Math.round(100 - Number(dashboard.totals.collection_percentage ?? 0)));
  }

  projectSummaryTitle(project: DonationProject): string {
    const mode = this.modeLabel(project.assignment_mode);
    return project.description ? `${mode} · ${project.description}` : mode;
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      active: 'Active',
      draft: 'Draft',
      completed: 'Completed',
      cancelled: 'Cancelled',
      inactive: 'Inactive'
    };
    return labels[status] ?? status;
  }

  statusTone(project: DonationProject): StatusBadgeTone {
    if (project.status === 'active') {
      return this.isProjectAtRisk(project) ? 'warning' : 'success';
    }
    if (project.status === 'completed') {
      return 'info';
    }
    return 'neutral';
  }

  openQuickCollect(): void {
    this.quickCollectService.open(
      this.selectedProjectId ? { projectId: this.selectedProjectId } : {}
    );
  }

  collectForFamily(row: ProjectFamilyProgressRow): void {
    this.quickCollectService.open({
      familyId: row.family_id,
      projectId: this.selectedProjectId ?? undefined,
    });
  }

  private refreshAfterLedgerChange(): void {
    this.donationsService
      .getProjects()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.projects = res.data || [];
          refreshStewardshipView(this.cdr);
        },
      });
    if (this.selectedProject) {
      this.viewDashboard(this.selectedProject);
    }
  }

  openCreateForm(): void {
    this.ensureFamiliesLoaded();
    this.editingProjectId = null;
    this.submitAttempted = false;
    this.draftAssignments = [];
    this.projectForm.reset({
      assignment_mode: 'uniform',
      default_family_target: null,
      target_amount: null,
      installment_count: 1,
      installment_frequency: '',
      start_date: '',
      end_date: '',
      auto_generate_installments: true,
      status: 'active'
    });
    this.showForm = true;
  }

  closeForm(): void {
    this.resetForm();
  }

  editProject(project: DonationProject): void {
    this.ensureFamiliesLoaded();
    this.editingProjectId = project.id;
    this.showForm = true;
    this.submitAttempted = false;
    this.projectForm.patchValue({
      name: project.name,
      code: project.code,
      assignment_mode: project.assignment_mode || 'uniform',
      default_family_target: project.default_family_target,
      target_amount: project.target_amount,
      installment_count: project.installment_count || 1,
      installment_frequency: project.installment_frequency || '',
      start_date: project.start_date || '',
      end_date: project.end_date || '',
      auto_generate_installments: project.auto_generate_installments ?? true,
      status: project.status
    });
    this.draftAssignments = [];
  }

  setStatusActive(active: boolean): void {
    this.projectForm.patchValue({ status: active ? 'active' : 'draft' });
  }

  setAutoInstallments(enabled: boolean): void {
    this.projectForm.patchValue({ auto_generate_installments: enabled });
  }

  loadProjects(): void {
    this.projectsLoaded = false;
    this.projectsLoadError = null;
    refreshStewardshipView(this.cdr);
    this.donationsService
      .getProjects()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.projectsLoaded = true;
          refreshStewardshipView(this.cdr);
        })
      )
      .subscribe({
        next: (res) => {
          this.projects = res.data || [];
          const projectId = this.route.snapshot.paramMap.get('id');
          const selected = projectId ? this.projects.find((project) => project.id === projectId) : undefined;
          if (selected) {
            this.viewDashboard(selected);
          }
        },
        error: (err: HttpErrorResponse) => {
          this.projectsLoadError =
            err.error?.message ||
            err.message ||
            'Unable to load projects. Please check your connection and try again.';
        }
      });
  }

  ensureFamiliesLoaded(): void {
    if (this.familiesLoadStarted || this.families.length > 0) {
      return;
    }
    this.familiesLoadStarted = true;
    this.familyService
      .getFamilies({ per_page: 200, status: 'active' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.families = res.data || [];
          this.cdr.markForCheck();
        },
        error: () => {
          this.familiesLoadStarted = false;
        }
      });
  }

  addAssignment(): void {
    if (!this.selectedFamilyId) {
      return;
    }
    this.draftAssignments.push({
      family_id: this.selectedFamilyId,
      target_amount: this.assignmentExempt ? null : this.assignmentAmount,
      is_exempt: this.assignmentExempt,
      effective_from: this.assignmentEffectiveFrom,
      status: 'active'
    });
    this.selectedFamilyId = '';
    this.assignmentAmount = 0;
    this.assignmentExempt = false;
  }

  removeAssignment(index: number): void {
    this.draftAssignments.splice(index, 1);
  }

  familyName(familyId: string): string {
    const family = this.families.find((f) => f.id === familyId);
    return family ? formatFamilyPickerLabel(family) : familyId;
  }

  familyProgressLabel(row: ProjectFamilyProgressRow): string {
    return formatFamilyHeadWithCode(row);
  }

  saveProject(): void {
    this.submitAttempted = true;
    this.projectForm.markAllAsTouched();
    if (this.projectForm.invalid) {
      return;
    }
    this.saving = true;
    this.message = null;
    this.error = null;

    const payload: Record<string, unknown> = {
      ...this.projectForm.getRawValue(),
      assignments: this.needsAssignments ? this.draftAssignments : []
    };

    const request$ = this.editingProjectId
      ? this.donationsService.updateProject(this.editingProjectId, payload)
      : this.donationsService.createProject(payload);

    request$.subscribe({
      next: (res) => {
        this.message = res.message;
        this.saving = false;
        this.submitAttempted = false;
        this.resetForm();
        this.loadProjects();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to save project.';
        this.saving = false;
        this.cdr.detectChanges();
      }
    });
  }

  viewDashboard(project: DonationProject): void {
    const switchingProject = this.selectedProjectId !== project.id;
    this.selectedProjectId = project.id;
    if (switchingProject) {
      this.dashboard = null;
      this.resetFamilyProgress();
    }
    this.familyReload$.next({ resetPage: false });
    this.dashboardLoadError = null;
    this.dashboardLoading = true;
    refreshStewardshipView(this.cdr);
    this.donationsService
      .getProjectDashboard(project.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.dashboardLoading = false;
          refreshStewardshipView(this.cdr);
        })
      )
      .subscribe({
        next: (res) => {
          if (this.selectedProjectId === project.id) {
            this.dashboard = res.data;
          }
        },
        error: () => {
          if (this.selectedProjectId === project.id) {
            this.dashboardLoadError = 'Failed to load project dashboard.';
          }
        }
      });
  }

  closeProjectDetail(): void {
    this.selectedProjectId = null;
    this.dashboard = null;
    this.dashboardLoadError = null;
    this.dashboardLoading = false;
    this.installmentNotice = null;
    this.installmentNoticeError = false;
    this.resetFamilyProgress();
    this.familyReload$.next({ resetPage: true });
  }

  get hasFamilyFilters(): boolean {
    return Boolean(this.familySearch.trim() || this.familyStatusFilter || this.familyBccFilter);
  }

  trackFamilyRow(_index: number, row: ProjectFamilyProgressRow): string {
    return row.family_id;
  }

  familySortDirectionFor(column: ProjectFamilyProgressSort): 'asc' | 'desc' | null {
    return this.familySort === column ? this.familySortDirection : null;
  }

  onFamilySearchChange(value: string): void {
    this.familySearch = value;
    this.familySearch$.next(value.trim());
  }

  onFamilyFilterChange(): void {
    this.familyReload$.next({ resetPage: true });
  }

  onFamilySort(event: SortEvent): void {
    this.familySort = event.column as ProjectFamilyProgressSort;
    this.familySortDirection = event.direction === 'desc' ? 'desc' : 'asc';
    this.familyReload$.next({ resetPage: true });
  }

  onFamilyPageChange(page: number): void {
    if (page === this.familyPage) {
      return;
    }
    this.familyPage = page;
    this.familyReload$.next({ resetPage: false });
  }

  onFamilyPageSizeChange(size: number): void {
    this.familyPerPage = size;
    this.familyReload$.next({ resetPage: true });
  }

  clearFamilyFilters(): void {
    this.familySearch = '';
    this.familyStatusFilter = '';
    this.familyBccFilter = '';
    this.familyReload$.next({ resetPage: true });
  }

  reloadFamilyProgress(): void {
    this.familyReload$.next({ resetPage: false });
  }

  private resetFamilyProgress(): void {
    this.familyRows = [];
    this.familyTotal = 0;
    this.familyPage = 1;
    this.familySearch = '';
    this.familyStatusFilter = '';
    this.familyBccFilter = '';
    this.familyBccOptions = [];
    this.familySort = 'outstanding_amount';
    this.familySortDirection = 'desc';
    this.familyLoading = false;
    this.familyLoaded = false;
    this.familyLoadError = null;
  }

  private setupFamilyProgressLoader(): void {
    merge(
      this.familyReload$,
      this.familySearch$.pipe(debounceTime(300), map(() => ({ resetPage: true })))
    )
      .pipe(
        switchMap(({ resetPage }) => {
          const projectId = this.selectedProjectId;
          if (!projectId) {
            return EMPTY;
          }
          if (resetPage) {
            this.familyPage = 1;
          }
          this.familyLoading = true;
          this.familyLoadError = null;
          refreshStewardshipView(this.cdr);
          return this.donationsService
            .getProjectFamilyProgress(projectId, {
              search: this.familySearch.trim() || undefined,
              status: this.familyStatusFilter || undefined,
              bcc_id: this.familyBccFilter || undefined,
              sort: this.familySort,
              direction: this.familySortDirection,
              page: this.familyPage,
              per_page: this.familyPerPage,
            })
            .pipe(
              map((res) => ({ projectId, res })),
              catchError((err: HttpErrorResponse) => {
                if (this.selectedProjectId === projectId) {
                  this.familyLoadError = this.familyProgressError(err);
                }
                return EMPTY;
              }),
              finalize(() => {
                this.familyLoading = false;
                refreshStewardshipView(this.cdr);
              })
            );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ projectId, res }) => {
        if (this.selectedProjectId === projectId) {
          this.applyFamilyProgress(res);
        }
      });
  }

  private applyFamilyProgress(res: ProjectFamilyProgressResponse): void {
    const page = res?.data;
    this.familyRows = page?.data ?? [];
    this.familyTotal = page?.total ?? 0;
    this.familyPage = page?.current_page ?? this.familyPage;
    this.familyPerPage = page?.per_page ?? this.familyPerPage;
    this.familyBccOptions = res?.meta?.filter_options?.bccs ?? [];
    this.familyLoaded = true;
  }

  private familyProgressError(err: HttpErrorResponse): string {
    const errors = err?.error?.errors as Record<string, string[]> | undefined;
    const first = errors ? Object.values(errors)[0]?.[0] : undefined;
    return first || err?.error?.message || 'Could not load families. Try again.';
  }

  isGeneratingInstallments(projectId: string): boolean {
    return this.generatingProjectId === projectId;
  }

  installmentSchedule(project: DonationProject): ProjectInstallmentSchedule {
    if (project.installment_schedule) {
      return project.installment_schedule;
    }
    const hasRows = (project.installment_dues_count ?? 0) > 0;
    return {
      state: hasRows ? 'generated' : 'not_generated',
      active_count: project.installment_dues_count ?? 0,
      pending_count: 0,
      partial_count: 0,
      paid_count: 0,
      waived_count: 0,
      cancelled_count: 0,
      overdue_count: 0,
      families_with_schedule: hasRows ? 1 : 0,
      families_with_payments: 0,
      families_regenerable: 0,
      families_missing: hasRows ? 0 : 1,
      can_generate: !hasRows,
      can_regenerate: false,
    };
  }

  installmentState(project: DonationProject): ProjectInstallmentSchedule['state'] {
    return this.installmentSchedule(project).state;
  }

  installmentStateLabel(project: DonationProject): string {
    const schedule = this.installmentSchedule(project);
    if (schedule.state === 'not_generated') {
      return 'Installments not generated';
    }
    if (schedule.state === 'payments_recorded') {
      const overdue = schedule.overdue_count ?? 0;
      return overdue > 0 ? `Payments recorded · ${overdue} overdue` : 'Payments recorded';
    }
    const overdue = schedule.overdue_count ?? 0;
    return overdue > 0 ? `Installments generated · ${overdue} overdue` : 'Installments generated';
  }

  hasGeneratedInstallments(project: DonationProject): boolean {
    return this.installmentState(project) !== 'not_generated';
  }

  canGenerateInstallments(project: DonationProject): boolean {
    return this.canManage && this.installmentSchedule(project).can_generate;
  }

  canRegenerateInstallments(project: DonationProject): boolean {
    return this.canManage && this.installmentSchedule(project).can_regenerate;
  }

  generateActionLabel(project: DonationProject): string {
    return this.installmentState(project) === 'not_generated'
      ? 'Generate installments'
      : 'Generate for new families';
  }

  get regenerateMessage(): string {
    const project = this.regenerateProject;
    if (!project) {
      return '';
    }
    const paidFamilies = this.installmentSchedule(project).families_with_payments > 0;
    const shared = 'Waived installments and ones cancelled for a pastoral reason stay forgiven, and that amount is not charged again on the other installments. Extra unpaid installments are cancelled and kept on record, not deleted.';
    if (paidFamilies) {
      return `Some families have already paid. This replaces unpaid installments only for families with no payments, so they match the current targets, installment count, and due dates. Paid and partially paid installments stay as financial history. ${shared}`;
    }
    return `This replaces unpaid installments so they match the current family targets, installment count, and due dates. No payments are on this schedule yet. ${shared}`;
  }

  generateInstallments(project: DonationProject): void {
    this.runInstallmentGeneration(project, { mode: 'generate' });
  }

  requestRegenerate(project: DonationProject): void {
    if (this.generatingProjectId || !this.canRegenerateInstallments(project)) {
      return;
    }
    this.regenerateProject = project;
    this.cdr.detectChanges();
  }

  cancelRegenerate(): void {
    if (this.generatingProjectId) {
      return;
    }
    this.regenerateProject = null;
  }

  confirmRegenerate(result: ConfirmationResult): void {
    const project = this.regenerateProject;
    const reason = result.description?.trim() ?? '';
    if (!project || reason.length < 10) {
      return;
    }
    this.runInstallmentGeneration(project, {
      mode: 'regenerate',
      confirm: true,
      reason,
    });
  }

  private runInstallmentGeneration(
    project: DonationProject,
    payload: { mode: 'generate' | 'regenerate'; confirm?: boolean; reason?: string }
  ): void {
    if (this.generatingProjectId) {
      return;
    }

    this.generatingProjectId = project.id;
    this.installmentNotice = null;
    this.installmentNoticeError = false;
    this.message = null;
    this.error = null;
    this.cdr.detectChanges();

    this.donationsService
      .generateProjectInstallments(project.id, payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.generatingProjectId = null;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (res) => {
          const summary = this.installmentSummary(res?.data);
          this.applyInstallmentSchedule(project.id, summary.schedule);
          const text = summary.outcome
            ? (res?.message || this.installmentResultText(project, summary))
            : this.installmentResultText(project, summary);
          const quiet = summary.outcome === 'already_generated' || summary.outcome === 'unchanged' || summary.outcome === 'empty';
          this.installmentNotice = text;
          this.installmentNoticeError = summary.outcome === 'empty' || summary.outcome === 'blocked';
          this.message = text;
          if (summary.outcome === 'generated' || summary.outcome === 'regenerated' || (!summary.outcome && summary.written > 0)) {
            this.toast.success(text, payload.mode === 'regenerate' ? 'Installments updated' : 'Installments generated');
            this.regenerateProject = null;
            if (payload.mode === 'generate') {
              void this.router.navigate(['/donations/project-installments'], {
                queryParams: { project_id: project.id },
              });
            }
          } else if (quiet) {
            this.toast.warning(text, 'Installments');
            this.regenerateProject = null;
          } else {
            this.toast.error(text, 'Installments');
          }
          this.cdr.detectChanges();
        },
        error: (err) => {
          const text = err?.error?.message || err?.message || 'Failed to generate installments.';
          this.installmentNotice = text;
          this.installmentNoticeError = true;
          this.error = text;
          this.toast.error(text, 'Installments');
          this.cdr.detectChanges();
        }
      });
  }

  private applyInstallmentSchedule(projectId: string, schedule?: ProjectInstallmentSchedule): void {
    if (!schedule) {
      return;
    }
    this.projects = this.projects.map((project) =>
      project.id === projectId
        ? { ...project, installment_schedule: schedule, installment_dues_count: schedule.active_count }
        : project
    );
  }

  private installmentResultText(
    project: DonationProject,
    summary: { written: number; outcome?: string }
  ): string {
    if (summary.outcome === 'already_generated') {
      return `Installments are already generated for ${project.name}.`;
    }
    if (summary.outcome === 'regenerated') {
      return `Unpaid installments for ${project.name} were updated.`;
    }
    if (summary.written > 0) {
      return `${summary.written} installment${summary.written === 1 ? '' : 's'} generated for ${project.name}.`;
    }
    return `No installments were generated for ${project.name}. Enroll active families and set a family target, then try again.`;
  }

  private installmentSummary(data: unknown): { written: number; outcome?: string; schedule?: ProjectInstallmentSchedule } {
    if (Array.isArray(data)) {
      return { written: data.length };
    }
    if (data && typeof data === 'object') {
      const summary = data as ProjectInstallmentGenerationResult;
      const written = Number(summary.installments ?? (Number(summary.created ?? 0) + Number(summary.updated ?? 0) + Number(summary.reactivated ?? 0)));
      return {
        written: Number.isFinite(written) ? written : 0,
        outcome: summary.outcome,
        schedule: summary.schedule,
      };
    }
    return { written: 0 };
  }

  private resetForm(): void {
    this.editingProjectId = null;
    this.showForm = false;
    this.submitAttempted = false;
    this.draftAssignments = [];
    this.projectForm.reset({
      assignment_mode: 'uniform',
      default_family_target: null,
      target_amount: null,
      installment_count: 1,
      installment_frequency: '',
      start_date: '',
      end_date: '',
      auto_generate_installments: true,
      status: 'active'
    });
  }
}
