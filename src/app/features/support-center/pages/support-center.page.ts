import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { TabStripComponent, TabStripItem } from '@shared/components/tab-strip/tab-strip.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { SectionCardComponent } from '@shared/components/section-card/section-card.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import {
  AdvancedSearchPanelComponent,
  SearchField,
} from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { FormFieldComponent } from '@shared/components/form-field/form-field.component';
import { CfDateTimeFieldComponent } from '@shared/components/cf-datetime-field/cf-datetime-field.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { CfBrandLoaderComponent } from '@shared/components/cf-brand-loader/cf-brand-loader.component';
import {
  ConfirmationModalComponent,
  ConfirmationResult,
} from '@shared/components/confirmation-modal/confirmation-modal.component';
import { AuthService } from '@core/services/auth.service';
import { SupportContextService } from '@core/services/support-context.service';
import { ToastService } from '@core/services/toast.service';
import {
  dateWindowValidator,
  fieldErrorText,
  markFormGroupTouched,
} from '@core/validators/form-validation.helper';
import { SupportSessionService } from '../services/support-session.service';
import { SupportTicketsOpsPanelComponent } from '../components/support-tickets-ops-panel/support-tickets-ops-panel.component';
import { SupportTicketCatalogPanelComponent } from '../components/support-ticket-catalog-panel/support-ticket-catalog-panel.component';
import { CfDatePipe } from '@shared/pipes/cf-date.pipe';
import {
  SupportAccessGrant,
  SupportAccessRequest,
  SupportGrantMode,
  SupportOpsSettings,
  SupportReasonCode,
  SupportSession,
  SupportSessionEvent,
  SupportSessionMetrics,
  SupportSessionMode,
  SupportTenantSummary,
} from '../models/support-access.model';

type SupportCenterTab = 'start' | 'active' | 'history' | 'approvals' | 'grants' | 'audit' | 'settings' | 'tickets';
type PendingAction =
  | { type: 'exit' }
  | { type: 'force'; session: SupportSession }
  | { type: 'revoke'; grant: SupportAccessGrant }
  | { type: 'approve'; request: SupportAccessRequest }
  | { type: 'reject'; request: SupportAccessRequest }
  | { type: 'cancel'; request: SupportAccessRequest };

@Component({
  selector: 'app-support-center-page',
  standalone: true,
  imports: [
    CfDatePipe,
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    PageHeaderComponent,
    TabStripComponent,
    StatusBadgeComponent,
    PaginationComponent,
    CfEmptyStateComponent,
    SectionCardComponent,
    ListToolbarComponent,
    AdvancedSearchPanelComponent,
    DataTableComponent,
    FormFieldComponent,
    CfDateTimeFieldComponent,
    LoadingSkeletonComponent,
    CfBrandLoaderComponent,
    ConfirmationModalComponent,
    SupportTicketsOpsPanelComponent,
    SupportTicketCatalogPanelComponent,
  ],
  templateUrl: './support-center.page.html',
  styleUrl: './support-center.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportCenterPage implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly sessions = inject(SupportSessionService);
  private readonly supportContext = inject(SupportContextService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<string>();

  readonly canAccess = this.auth.canAccessSupportCenter();

  readonly canStartSessions =
    this.auth.hasPermission('support.sessions.start') || this.auth.isSuperAdmin();

  readonly canViewSessions =
    this.auth.hasPermission('support.sessions.view') || this.auth.isSuperAdmin();

  readonly canViewApprovals = this.canViewSessions;

  readonly canManageSettings =
    this.auth.hasPermission('support.configuration.manage') || this.auth.isSuperAdmin();

  readonly canForceEnd =
    this.auth.hasPermission('support.sessions.end') || this.auth.isSuperAdmin();

  readonly canExport = this.auth.canViewSupportOperationalAudit();

  readonly canApprove =
    this.auth.hasPermission('support.sessions.approve') || this.auth.isSuperAdmin();

  readonly canViewGrants =
    this.auth.hasPermission('support.grants.view') ||
    this.auth.hasPermission('support.grants.manage') ||
    this.auth.isSuperAdmin();

  readonly canManageGrants =
    this.auth.hasPermission('support.grants.manage') || this.auth.isSuperAdmin();

  readonly canViewTickets =
    this.auth.hasPermission('support.ops.tickets.view') || this.auth.isSuperAdmin();

  activeTab: SupportCenterTab = 'tickets';
  tabs: TabStripItem[] = [];

  tenants: SupportTenantSummary[] = [];
  monitorRows: SupportSession[] = [];
  historyRows: SupportSession[] = [];
  historyTotal = 0;
  historyPage = 1;
  historyPageSize = 20;
  auditRows: SupportSessionEvent[] = [];
  approvalRows: SupportAccessRequest[] = [];
  approvedForStart: SupportAccessRequest[] = [];
  grantRows: SupportAccessGrant[] = [];
  selected: SupportTenantSummary | null = null;
  selectedDetail: SupportTenantSummary | null = null;
  myActive: SupportSession | null = null;
  settings: SupportOpsSettings | null = null;
  metrics: SupportSessionMetrics | null = null;

  loadingSearch = false;
  loadingMonitor = false;
  loadingHistory = false;
  loadingAudit = false;
  loadingApprovals = false;
  loadingGrants = false;
  loadingSettings = false;
  starting = false;
  requestingApproval = false;
  savingSettings = false;
  creatingGrant = false;
  grantSubmitted = false;
  startSubmitted = false;
  approvalSubmitted = false;
  settingsSubmitted = false;
  exporting = false;
  exportingAudit = false;
  error: string | null = null;
  success: string | null = null;

  showHistoryFilters = false;
  historySearchFields: SearchField[] = [];
  showAuditFilters = false;
  auditSearchFields: SearchField[] = [];
  showGrantFilters = false;
  grantSearchFields: SearchField[] = [];

  confirmOpen = false;
  endingSession = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmText = 'Confirm';
  confirmButtonClass = 'btn-primary';
  showDecisionNote = false;
  pendingAction: PendingAction | null = null;

  readonly searchControl = this.fb.nonNullable.control('');
  /** Applied History filters (search + drawer). Draft drawer values are separate until Apply. */
  readonly historyForm = this.fb.nonNullable.group({
    q: ['', Validators.maxLength(100)],
    status: [''],
    mode: [''],
    from: [''],
    to: [''],
  });

  /** Applied Audit filters (search + drawer). */
  readonly auditForm = this.fb.nonNullable.group({
    q: ['', Validators.maxLength(100)],
    event_type: ['', Validators.maxLength(64)],
    module: ['', Validators.maxLength(64)],
    from: [''],
    to: [''],
  });

  get historyDrawerFilterCount(): number {
    const f = this.historyForm.getRawValue();
    return [f.status, f.mode, f.from, f.to].filter((v) => !!v).length;
  }

  get auditDrawerFilterCount(): number {
    const f = this.auditForm.getRawValue();
    return [f.event_type, f.module, f.from, f.to].filter((v) => !!v).length;
  }

  /** Applied grant list filters (search + drawer). Separate from create form. */
  readonly grantListForm = this.fb.nonNullable.group({
    q: ['', Validators.maxLength(100)],
    status: [''],
    allowed_mode: [''],
  });

  get grantDrawerFilterCount(): number {
    const f = this.grantListForm.getRawValue();
    return [f.status, f.allowed_mode].filter((v) => !!v).length;
  }

  get hasActiveGrantFilters(): boolean {
    const f = this.grantListForm.getRawValue();
    return !!(f.q.trim() || f.status || f.allowed_mode);
  }

  readonly startForm = this.fb.nonNullable.group({
    mode: ['readonly' as SupportSessionMode, Validators.required],
    reason_code: ['diagnosis' as SupportReasonCode, Validators.required],
    reason_description: ['', Validators.maxLength(2000)],
    ticket_ref: ['', Validators.maxLength(128)],
    password: ['', Validators.required],
    confirm_emergency: [false],
    approval_request_id: [''],
  });

  readonly approvalForm = this.fb.nonNullable.group({
    reason_code: ['incident' as SupportReasonCode, Validators.required],
    reason_description: ['', Validators.maxLength(2000)],
    ticket_ref: ['', Validators.maxLength(128)],
  });

  readonly grantForm = this.fb.nonNullable.group(
    {
      tenant_id: [null as number | null, Validators.required],
      allowed_mode: ['any' as SupportGrantMode, Validators.required],
      starts_at: ['', Validators.required],
      ends_at: ['', Validators.required],
      note: ['', Validators.maxLength(2000)],
      max_sessions: [null as number | null, [Validators.min(1), Validators.max(1000)]],
    },
    { validators: [dateWindowValidator('starts_at', 'ends_at')] }
  );

  readonly settingsForm = this.fb.nonNullable.group({
    timeout_minutes: [30, Validators.required],
    max_concurrent_sessions: [25, [Validators.required, Validators.min(1), Validators.max(500)]],
    max_sessions_per_user: [1, [Validators.required, Validators.min(1), Validators.max(20)]],
    start_rate_limit_per_hour: [30, [Validators.required, Validators.min(1), Validators.max(1000)]],
    notification_mode: ['never' as 'never' | 'immediate' | 'digest', Validators.required],
    customer_disclosure_enabled: [false],
    emergency_requires_approval: [true],
    require_customer_grant: [false],
    jit_enabled: [true],
    jit_timeout_minutes: [15, [Validators.required, Validators.min(5), Validators.max(120)]],
    approval_request_ttl_minutes: [60, [Validators.required, Validators.min(5), Validators.max(240)]],
    require_ticket_ref: [false],
    ticket_validation_mode: ['off' as 'off' | 'required_format' | 'adapter', Validators.required],
    ip_binding_mode: ['soft' as 'off' | 'soft' | 'strict', Validators.required],
  });

  readonly reasonOptions: Array<{ value: SupportReasonCode; label: string }> = [
    { value: 'diagnosis', label: 'Diagnosis' },
    { value: 'data_fix', label: 'Data fix' },
    { value: 'configuration', label: 'Configuration' },
    { value: 'training', label: 'Training' },
    { value: 'incident', label: 'Incident' },
    { value: 'other', label: 'Other' },
  ];


  ngOnInit(): void {
    this.tabs = this.buildTabs();
    this.initHistorySearchFields();
    this.initAuditSearchFields();
    this.initGrantSearchFields();

    this.grantForm.controls.starts_at.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.grantForm.controls.ends_at.updateValueAndValidity({ onlySelf: true });
        this.grantForm.updateValueAndValidity({ onlySelf: false, emitEvent: false });
        this.cdr.markForCheck();
      });

    if (!this.canAccess) {
      return;
    }

    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const tab = (params.get('tab') || 'start') as SupportCenterTab;
      if (this.tabs.some((t) => t.id === tab) && tab !== this.activeTab) {
        this.onTabChange(tab, false);
      }
    });

    this.sessions.session$.pipe(takeUntil(this.destroy$)).subscribe((session) => {
      this.myActive = session;
      this.cdr.markForCheck();
    });

    if (this.canStartSessions) {
      this.search$
        .pipe(
          debounceTime(250),
          distinctUntilChanged(),
          switchMap((q) => {
            this.loadingSearch = true;
            this.cdr.markForCheck();
            return this.sessions.searchTenants(q);
          }),
          takeUntil(this.destroy$)
        )
        .subscribe({
          next: (res) => {
            this.tenants = res.data;
            this.loadingSearch = false;
            this.cdr.markForCheck();
          },
          error: () => {
            this.loadingSearch = false;
            this.error = 'Could not search tenants.';
            this.cdr.markForCheck();
          },
        });

      this.search$.next(this.searchControl.value);
    }

    if (this.canViewSessions) {
      this.sessions.getActive().pipe(takeUntil(this.destroy$)).subscribe();
      this.loadMetrics();
    }

    if (this.canManageSettings) {
      this.sessions
        .getSettings()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (settings) => {
            this.settings = settings;
            this.syncStartConditionalValidators();
            this.cdr.markForCheck();
          },
        });
    }

    this.startForm.controls.mode.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.syncStartConditionalValidators();
      this.cdr.markForCheck();
    });

    this.activeTab = this.resolveInitialTab(
      (this.route.snapshot.queryParamMap.get('tab') || this.defaultTab()) as SupportCenterTab
    );
    if (this.activeTab !== this.defaultTab()) {
      this.onTabChange(this.activeTab, false);
    }

    const preselectTenantId = Number(this.route.snapshot.queryParamMap.get('tenant_id') || 0);
    const preselectTicketRef = (this.route.snapshot.queryParamMap.get('ticket_ref') || '').trim();
    if (preselectTicketRef) {
      this.startForm.patchValue({ ticket_ref: preselectTicketRef });
    }
    if (preselectTenantId > 0 && this.canStartSessions) {
      this.sessions.getTenant(preselectTenantId).pipe(takeUntil(this.destroy$)).subscribe({
        next: (tenant) => {
          this.selectTenant(tenant);
          if (this.activeTab !== 'start') {
            this.onTabChange('start', true);
          }
          this.cdr.markForCheck();
        },
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onTabChange(id: string, syncQuery = true): void {
    this.activeTab = id as SupportCenterTab;
    this.error = null;
    this.success = null;
    if (syncQuery) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { tab: this.activeTab },
        queryParamsHandling: 'merge',
      });
    }
    if (this.activeTab === 'active' && this.canViewSessions) {
      this.loadMonitor();
      this.loadMetrics();
    } else if (this.activeTab === 'history' && this.canViewSessions) {
      this.loadHistory();
    } else if (this.activeTab === 'approvals' && this.canViewApprovals) {
      this.loadApprovals();
    } else if (this.activeTab === 'grants' && this.canViewGrants) {
      this.loadGrants();
    } else if (this.activeTab === 'audit' && this.canExport) {
      this.loadAudit();
    } else if (this.activeTab === 'settings' && this.canManageSettings) {
      this.loadSettings();
    }
    this.cdr.markForCheck();
  }

  onTenantSearch(query: string): void {
    const next = query ?? '';
    if (this.searchControl.value !== next) {
      this.searchControl.setValue(next, { emitEvent: false });
    }
    this.search$.next(next);
    this.cdr.markForCheck();
  }

  selectTenant(tenant: SupportTenantSummary): void {
    this.selected = tenant;
    this.selectedDetail = tenant;
    this.error = null;
    this.success = null;
    this.grantForm.patchValue({ tenant_id: tenant.id });
    this.loadApprovedForStart();
    this.sessions.getTenant(tenant.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (detail) => {
        this.selectedDetail = detail;
        this.cdr.markForCheck();
      },
    });
    this.cdr.markForCheck();
  }

  startSession(): void {
    if (this.starting) {
      return;
    }

    if (!this.selected) {
      this.error = 'Select a tenant before starting a session.';
      this.cdr.markForCheck();
      return;
    }

    this.syncStartConditionalValidators();
    this.startSubmitted = true;
    this.error = null;
    this.success = null;
    markFormGroupTouched(this.startForm, '#start-session-form ');
    this.cdr.markForCheck();

    if (this.startForm.invalid) {
      return;
    }

    const value = this.startForm.getRawValue();
    this.starting = true;

    this.supportContext
      .enterSupportContext({
        tenant_id: this.selected.id,
        mode: value.mode,
        reason_code: value.reason_code,
        reason_description: value.reason_description || undefined,
        ticket_ref: value.ticket_ref || undefined,
        password: value.password,
        confirm_emergency: value.mode === 'emergency' ? !!value.confirm_emergency : undefined,
        approval_request_id:
          value.mode === 'emergency' && value.approval_request_id
            ? value.approval_request_id
            : undefined,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (session) => {
          this.starting = false;
          this.startSubmitted = false;
          this.success = `Session started for ${session.tenant?.name || 'tenant'}.`;
          this.startForm.patchValue({ password: '', confirm_emergency: false, approval_request_id: '' });
          this.cdr.markForCheck();
          void this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          this.starting = false;
          this.error = err?.error?.message || 'Could not start support session.';
          this.cdr.markForCheck();
        },
      });
  }

  requestEmergencyApproval(): void {
    if (this.requestingApproval) {
      return;
    }

    if (!this.selected) {
      this.error = 'Select a tenant before requesting approval.';
      this.cdr.markForCheck();
      return;
    }

    this.approvalSubmitted = true;
    this.error = null;
    this.success = null;
    markFormGroupTouched(this.approvalForm, '#approval-request-form ');
    this.cdr.markForCheck();

    if (this.approvalForm.invalid) {
      return;
    }

    this.requestingApproval = true;
    const value = this.approvalForm.getRawValue();
    this.sessions
      .requestApproval({
        tenant_id: this.selected.id,
        reason_code: value.reason_code,
        reason_description: value.reason_description || undefined,
        ticket_ref: value.ticket_ref || undefined,
        mode: 'emergency',
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.requestingApproval = false;
          this.approvalSubmitted = false;
          this.success = 'Emergency approval requested. A second admin must approve it.';
          this.loadApprovals();
          this.loadApprovedForStart();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.requestingApproval = false;
          this.error = err?.error?.message || 'Could not request approval.';
          this.cdr.markForCheck();
        },
      });
  }

  loadApprovals(): void {
    this.loadingApprovals = true;
    const filters = this.canApprove
      ? { status: 'pending', per_page: 50 }
      : { mine: true, per_page: 50 };
    this.sessions.listApprovals(filters).pipe(takeUntil(this.destroy$)).subscribe({
      next: (page) => {
        this.approvalRows = page.data;
        this.loadingApprovals = false;
        this.loadMetrics();
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingApprovals = false;
        this.error = 'Could not load approval requests.';
        this.cdr.markForCheck();
      },
    });
  }

  loadApprovedForStart(): void {
    if (!this.selected) {
      this.approvedForStart = [];
      return;
    }
    this.sessions.listApprovals({ status: 'approved', tenant_id: this.selected.id, per_page: 20 }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (page) => {
        const me = this.auth.currentUserValue?.id;
        this.approvedForStart = page.data.filter(
          (row) => !me || row.requester_user_id === me
        );
        this.cdr.markForCheck();
      },
    });
  }

  approveRequest(row: SupportAccessRequest): void {
    if (!this.canApprove) {
      return;
    }
    this.openConfirm({
      type: 'approve',
      request: row,
      title: 'Approve emergency access?',
      message: `Approve emergency access for ${row.tenant?.name || '#' + row.tenant_id}?`,
      confirmText: 'Approve',
      note: true,
    });
  }

  rejectRequest(row: SupportAccessRequest): void {
    if (!this.canApprove) {
      return;
    }
    this.openConfirm({
      type: 'reject',
      request: row,
      title: 'Reject emergency access?',
      message: `Reject emergency request for ${row.tenant?.name || '#' + row.tenant_id}?`,
      confirmText: 'Reject',
      buttonClass: 'btn-danger',
      note: true,
    });
  }

  cancelRequest(row: SupportAccessRequest): void {
    this.openConfirm({
      type: 'cancel',
      request: row,
      title: 'Cancel approval request?',
      message: 'Cancel this pending emergency approval request?',
      confirmText: 'Cancel request',
      buttonClass: 'btn-danger',
    });
  }

  loadGrants(): void {
    if (this.loadingGrants) {
      return;
    }

    this.loadingGrants = true;
    const f = this.grantListForm.getRawValue();
    this.sessions
      .listGrants({
        q: f.q || undefined,
        status: f.status || undefined,
        allowed_mode: f.allowed_mode || undefined,
        per_page: 50,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (page) => {
          this.grantRows = page.data;
          this.loadingGrants = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingGrants = false;
          this.error = 'Could not load access grants.';
          this.cdr.markForCheck();
        },
      });
  }

  onGrantSearchChange(value: string): void {
    this.grantListForm.patchValue({ q: value.slice(0, 100) });
    this.error = null;
    this.loadGrants();
  }

  openGrantFilters(): void {
    this.syncGrantSearchFieldValues();
    this.showGrantFilters = true;
    this.cdr.markForCheck();
  }

  closeGrantFilters(): void {
    this.showGrantFilters = false;
    this.cdr.markForCheck();
  }

  onGrantAdvancedSearch(values: { [key: string]: unknown }): void {
    this.grantListForm.patchValue({
      status: String(values['status'] ?? '').trim(),
      allowed_mode: String(values['allowed_mode'] ?? '').trim(),
    });
    this.syncGrantSearchFieldValues();
    this.showGrantFilters = false;
    this.error = null;
    this.loadGrants();
  }

  onGrantClearFilters(): void {
    this.grantListForm.patchValue({
      status: '',
      allowed_mode: '',
    });
    this.grantSearchFields.forEach((field) => {
      field.value = undefined;
    });
    this.error = null;
    this.loadGrants();
    this.cdr.markForCheck();
  }

  createGrant(): void {
    if (!this.canManageGrants || this.creatingGrant) {
      return;
    }

    this.grantSubmitted = true;
    this.error = null;
    this.success = null;
    markFormGroupTouched(this.grantForm, '#grants-create-form ');
    this.cdr.markForCheck();

    if (this.grantForm.invalid) {
      return;
    }

    const value = this.grantForm.getRawValue();
    if (!value.tenant_id) {
      return;
    }

    this.creatingGrant = true;
    this.sessions
      .createGrant({
        tenant_id: value.tenant_id,
        allowed_mode: value.allowed_mode,
        starts_at: value.starts_at,
        ends_at: value.ends_at,
        note: value.note || undefined,
        max_sessions: value.max_sessions || undefined,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.creatingGrant = false;
          this.grantSubmitted = false;
          this.success = 'Access grant created.';
          this.resetGrantForm();
          this.loadGrants();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.creatingGrant = false;
          this.error = err?.error?.message || 'Could not create grant.';
          this.cdr.markForCheck();
        },
      });
  }

  grantFieldError(controlName: string): string | null {
    return fieldErrorText(controlName, this.grantForm, this.grantSubmitted);
  }

  grantEndsError(): string | null {
    const ends = this.grantForm.controls.ends_at;
    const starts = this.grantForm.controls.starts_at;
    const showErrors =
      this.grantSubmitted || ends.touched || (starts.touched && !!ends.value);
    if (!showErrors) {
      return null;
    }
    if (this.grantForm.hasError('startsAfterEnds')) {
      return 'End date and time must be after the start date and time.';
    }
    return this.grantFieldError('ends_at');
  }

  startFieldError(controlName: string): string | null {
    return fieldErrorText(controlName, this.startForm, this.startSubmitted);
  }

  approvalFieldError(controlName: string): string | null {
    return fieldErrorText(controlName, this.approvalForm, this.approvalSubmitted);
  }

  settingsFieldError(controlName: string): string | null {
    return fieldErrorText(controlName, this.settingsForm, this.settingsSubmitted);
  }

  private resetGrantForm(): void {
    this.grantForm.reset({
      tenant_id: this.selected?.id ?? null,
      allowed_mode: 'any',
      starts_at: '',
      ends_at: '',
      note: '',
      max_sessions: null,
    });
    this.grantForm.markAsPristine();
    this.grantForm.markAsUntouched();
  }

  private syncStartConditionalValidators(): void {
    const confirm = this.startForm.controls.confirm_emergency;
    const approval = this.startForm.controls.approval_request_id;
    const ticket = this.startForm.controls.ticket_ref;

    if (this.isEmergencyMode) {
      confirm.setValidators([Validators.requiredTrue]);
    } else {
      confirm.clearValidators();
    }

    if (this.needsApprovalForStart) {
      approval.setValidators([Validators.required]);
    } else {
      approval.clearValidators();
    }

    const ticketValidators = [Validators.maxLength(128)];
    if (this.settings?.require_ticket_ref) {
      ticketValidators.unshift(Validators.required);
    }
    ticket.setValidators(ticketValidators);

    confirm.updateValueAndValidity({ emitEvent: false });
    approval.updateValueAndValidity({ emitEvent: false });
    ticket.updateValueAndValidity({ emitEvent: false });
  }

  revokeGrant(row: SupportAccessGrant): void {
    if (!this.canManageGrants) {
      return;
    }
    this.openConfirm({
      type: 'revoke',
      grant: row,
      title: 'Revoke access grant?',
      message: `Revoke the access window for ${row.tenant?.name || '#' + row.tenant_id}?`,
      confirmText: 'Revoke',
      buttonClass: 'btn-danger',
    });
  }

  endMine(): void {
    if (!this.myActive) {
      return;
    }
    this.openConfirm({
      type: 'exit',
      title: 'Exit support session?',
      message: 'You will leave this tenant context. Your support identity is unchanged.',
      confirmText: 'Exit session',
      buttonClass: 'btn-danger',
    });
  }

  forceEnd(row: SupportSession): void {
    if (!this.canForceEnd) {
      return;
    }
    this.openConfirm({
      type: 'force',
      session: row,
      title: 'Force-end support session?',
      message: `Force end the session for ${row.tenant?.name || row.tenant_id}?`,
      confirmText: 'Force end',
      buttonClass: 'btn-danger',
    });
  }

  onConfirm(result: ConfirmationResult): void {
    const action = this.pendingAction;
    if (!result.confirmed || !action) {
      this.closeConfirm();
      return;
    }
    const note = result.description?.trim() || undefined;

    if (action.type === 'exit' && this.myActive) {
      this.pendingAction = null;
      this.endingSession = true;
      this.cdr.markForCheck();
      this.supportContext.exitSupportContext().pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.endingSession = false;
          this.confirmOpen = false;
          this.success = 'Support session ended.';
          this.loadMonitor();
          this.loadMetrics();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.endingSession = false;
          const message = err?.message || err?.error?.message || 'Could not end session.';
          this.error = message;
          this.toast.error(message, 'Could not exit session');
          this.confirmOpen = false;
          this.cdr.markForCheck();
        },
      });
      return;
    }

    this.closeConfirm();
    if (action.type === 'force') {
      this.sessions.forceEnd(action.session.id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.success = `Ended session for ${action.session.tenant?.name || action.session.tenant_id}.`;
          this.loadMonitor();
          this.loadMetrics();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = err?.message || err?.error?.message || 'Could not force-end session.';
          this.cdr.markForCheck();
        },
      });
      return;
    }
    if (action.type === 'revoke') {
      this.sessions.revokeGrant(action.grant.id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.success = 'Grant revoked.';
          this.loadGrants();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = err?.error?.message || 'Could not revoke grant.';
          this.cdr.markForCheck();
        },
      });
      return;
    }
    if (action.type === 'approve') {
      this.sessions.approveRequest(action.request.id, note).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.success = 'Emergency request approved.';
          this.loadApprovals();
          this.loadApprovedForStart();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = err?.error?.message || 'Could not approve request.';
          this.cdr.markForCheck();
        },
      });
      return;
    }
    if (action.type === 'reject') {
      this.sessions.rejectRequest(action.request.id, note).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.success = 'Emergency request rejected.';
          this.loadApprovals();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = err?.error?.message || 'Could not reject request.';
          this.cdr.markForCheck();
        },
      });
      return;
    }
    if (action.type === 'cancel') {
      this.sessions.cancelRequest(action.request.id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.success = 'Request cancelled.';
          this.loadApprovals();
          this.loadApprovedForStart();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = err?.error?.message || 'Could not cancel request.';
          this.cdr.markForCheck();
        },
      });
    }
  }

  loadMonitor(): void {
    this.loadingMonitor = true;
    this.sessions.listActiveMonitor(50).pipe(takeUntil(this.destroy$)).subscribe({
      next: (page) => {
        this.monitorRows = page.data;
        this.loadingMonitor = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingMonitor = false;
        this.error = 'Could not load active sessions.';
        this.cdr.markForCheck();
      },
    });
  }

  onHistorySearchChange(value: string): void {
    this.historyForm.patchValue({ q: value.slice(0, 100) });
    this.historyPage = 1;
    this.error = null;
    this.loadHistory();
  }

  openHistoryFilters(): void {
    this.syncHistorySearchFieldValues();
    this.showHistoryFilters = true;
    this.cdr.markForCheck();
  }

  closeHistoryFilters(): void {
    this.showHistoryFilters = false;
    this.cdr.markForCheck();
  }

  onHistoryAdvancedSearch(values: { [key: string]: unknown }): void {
    const from = String(values['from'] ?? '').trim();
    const to = String(values['to'] ?? '').trim();
    if (this.isInvalidDateRange(from, to)) {
      this.error = 'To date must be on or after From date.';
      this.cdr.markForCheck();
      return;
    }

    this.historyForm.patchValue({
      status: String(values['status'] ?? '').trim(),
      mode: String(values['mode'] ?? '').trim(),
      from,
      to,
    });
    this.syncHistorySearchFieldValues();
    this.showHistoryFilters = false;
    this.error = null;
    this.historyPage = 1;
    this.loadHistory();
  }

  onHistoryClearFilters(): void {
    this.historyForm.patchValue({
      status: '',
      mode: '',
      from: '',
      to: '',
    });
    this.historySearchFields.forEach((field) => {
      field.value = undefined;
    });
    this.error = null;
    this.historyPage = 1;
    this.loadHistory();
    this.cdr.markForCheck();
  }

  loadHistory(): void {
    if (this.loadingHistory) {
      return;
    }

    this.loadingHistory = true;
    const f = this.historyForm.getRawValue();
    this.sessions
      .searchHistory({
        scope: 'all',
        q: f.q,
        status: (f.status || '') as any,
        mode: (f.mode || '') as any,
        from: f.from || undefined,
        to: f.to || undefined,
        per_page: this.historyPageSize,
        page: this.historyPage,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (page) => {
          this.historyRows = page.data;
          this.historyTotal = page.total || page.data.length;
          this.loadingHistory = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingHistory = false;
          this.error = 'Could not load session history.';
          this.cdr.markForCheck();
        },
      });
  }

  onHistoryPageChange(page: number): void {
    this.historyPage = page;
    this.loadHistory();
  }

  onHistoryPageSizeChange(size: number): void {
    this.historyPageSize = size;
    this.historyPage = 1;
    this.loadHistory();
  }

  exportHistory(): void {
    if (!this.canExport || this.exporting) {
      return;
    }
    this.exporting = true;
    const f = this.historyForm.getRawValue();
    this.sessions
      .downloadHistoryCsv({
        q: f.q,
        status: (f.status || '') as any,
        mode: (f.mode || '') as any,
        from: f.from || undefined,
        to: f.to || undefined,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          this.saveBlob(blob, `support-sessions-${new Date().toISOString().slice(0, 10)}.csv`);
          this.exporting = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.exporting = false;
          this.error = 'Could not export session history.';
          this.cdr.markForCheck();
        },
      });
  }

  onAuditSearchChange(value: string): void {
    this.auditForm.patchValue({ q: value.slice(0, 100) });
    this.error = null;
    this.loadAudit();
  }

  openAuditFilters(): void {
    this.syncAuditSearchFieldValues();
    this.showAuditFilters = true;
    this.cdr.markForCheck();
  }

  closeAuditFilters(): void {
    this.showAuditFilters = false;
    this.cdr.markForCheck();
  }

  onAuditAdvancedSearch(values: { [key: string]: unknown }): void {
    const from = String(values['from'] ?? '').trim();
    const to = String(values['to'] ?? '').trim();
    if (this.isInvalidDateRange(from, to)) {
      this.error = 'To date must be on or after From date.';
      this.cdr.markForCheck();
      return;
    }

    this.auditForm.patchValue({
      event_type: String(values['event_type'] ?? '').trim().slice(0, 64),
      module: String(values['module'] ?? '').trim().slice(0, 64),
      from,
      to,
    });
    this.syncAuditSearchFieldValues();
    this.showAuditFilters = false;
    this.error = null;
    this.loadAudit();
  }

  onAuditClearFilters(): void {
    this.auditForm.patchValue({
      event_type: '',
      module: '',
      from: '',
      to: '',
    });
    this.auditSearchFields.forEach((field) => {
      field.value = undefined;
    });
    this.error = null;
    this.loadAudit();
    this.cdr.markForCheck();
  }

  loadAudit(): void {
    if (this.loadingAudit) {
      return;
    }

    this.loadingAudit = true;
    const f = this.auditForm.getRawValue();
    this.sessions
      .searchEvents({
        q: f.q,
        event_type: f.event_type || undefined,
        module: f.module || undefined,
        from: f.from || undefined,
        to: f.to || undefined,
        per_page: 50,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (page) => {
          this.auditRows = page.data;
          this.loadingAudit = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingAudit = false;
          this.error = 'Could not load audit events.';
          this.cdr.markForCheck();
        },
      });
  }

  exportAudit(): void {
    if (!this.canExport || this.exportingAudit) {
      return;
    }
    this.exportingAudit = true;
    const f = this.auditForm.getRawValue();
    this.sessions
      .downloadEventsCsv({
        q: f.q,
        from: f.from || undefined,
        to: f.to || undefined,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          this.saveBlob(blob, `support-events-${new Date().toISOString().slice(0, 10)}.csv`);
          this.exportingAudit = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.exportingAudit = false;
          this.error = 'Could not export audit events.';
          this.cdr.markForCheck();
        },
      });
  }

  private initHistorySearchFields(): void {
    const f = this.historyForm.getRawValue();
    this.historySearchFields = [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        group: 'Session',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'ended', label: 'Ended' },
          { value: 'expired', label: 'Expired' },
        ],
        value: f.status || undefined,
      },
      {
        key: 'mode',
        label: 'Mode',
        type: 'select',
        group: 'Session',
        options: [
          { value: 'readonly', label: 'Read only' },
          { value: 'standard', label: 'Standard' },
          { value: 'emergency', label: 'Emergency' },
        ],
        value: f.mode || undefined,
      },
      {
        key: 'from',
        label: 'From',
        type: 'date',
        group: 'Date range',
        value: f.from || undefined,
      },
      {
        key: 'to',
        label: 'To',
        type: 'date',
        group: 'Date range',
        value: f.to || undefined,
      },
    ];
  }

  private syncHistorySearchFieldValues(): void {
    const f = this.historyForm.getRawValue();
    this.historySearchFields.forEach((field) => {
      const raw = f[field.key as keyof typeof f];
      field.value = raw ? raw : undefined;
    });
  }

  private initGrantSearchFields(): void {
    const f = this.grantListForm.getRawValue();
    this.grantSearchFields = [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        group: 'Grant',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'revoked', label: 'Revoked' },
          { value: 'expired', label: 'Expired' },
        ],
        value: f.status || undefined,
      },
      {
        key: 'allowed_mode',
        label: 'Allowed mode',
        type: 'select',
        group: 'Grant',
        options: [
          { value: 'any', label: 'Any' },
          { value: 'readonly', label: 'Read only' },
          { value: 'standard', label: 'Standard' },
          { value: 'emergency', label: 'Emergency' },
        ],
        value: f.allowed_mode || undefined,
      },
    ];
  }

  private syncGrantSearchFieldValues(): void {
    const f = this.grantListForm.getRawValue();
    this.grantSearchFields.forEach((field) => {
      const raw = f[field.key as keyof typeof f];
      field.value = raw ? raw : undefined;
    });
  }

  private initAuditSearchFields(): void {
    const f = this.auditForm.getRawValue();
    this.auditSearchFields = [
      {
        key: 'event_type',
        label: 'Event type',
        type: 'text',
        group: 'Event',
        placeholder: 'Event type',
        value: f.event_type || undefined,
      },
      {
        key: 'module',
        label: 'Module',
        type: 'text',
        group: 'Event',
        placeholder: 'Module',
        value: f.module || undefined,
      },
      {
        key: 'from',
        label: 'From',
        type: 'date',
        group: 'Date range',
        value: f.from || undefined,
      },
      {
        key: 'to',
        label: 'To',
        type: 'date',
        group: 'Date range',
        value: f.to || undefined,
      },
    ];
  }

  private syncAuditSearchFieldValues(): void {
    const f = this.auditForm.getRawValue();
    this.auditSearchFields.forEach((field) => {
      const raw = f[field.key as keyof typeof f];
      field.value = raw ? raw : undefined;
    });
  }

  private isInvalidDateRange(from: string, to: string): boolean {
    return !!from && !!to && from > to;
  }

  loadSettings(): void {
    this.loadingSettings = true;
    this.sessions.getSettings().pipe(takeUntil(this.destroy$)).subscribe({
      next: (settings) => {
        this.settings = settings;
        this.settingsForm.patchValue({
          timeout_minutes: settings.timeout_minutes,
          max_concurrent_sessions: settings.max_concurrent_sessions,
          max_sessions_per_user: settings.max_sessions_per_user,
          start_rate_limit_per_hour: settings.start_rate_limit_per_hour,
          notification_mode: settings.notification_mode,
          customer_disclosure_enabled: settings.customer_disclosure_enabled,
          emergency_requires_approval: settings.emergency_requires_approval,
          require_customer_grant: settings.require_customer_grant,
          jit_enabled: settings.jit_enabled,
          jit_timeout_minutes: settings.jit_timeout_minutes,
          approval_request_ttl_minutes: settings.approval_request_ttl_minutes,
          require_ticket_ref: settings.require_ticket_ref,
          ticket_validation_mode: settings.ticket_validation_mode,
          ip_binding_mode: settings.ip_binding_mode || 'soft',
        });
        this.syncStartConditionalValidators();
        this.loadingSettings = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingSettings = false;
        this.error = 'Could not load support settings.';
        this.cdr.markForCheck();
      },
    });
  }

  saveSettings(): void {
    if (!this.canManageSettings || this.savingSettings) {
      return;
    }

    this.settingsSubmitted = true;
    this.error = null;
    this.success = null;
    markFormGroupTouched(this.settingsForm, '#settings-form ');
    this.cdr.markForCheck();

    if (this.settingsForm.invalid) {
      return;
    }

    this.savingSettings = true;
    this.sessions.updateSettings(this.settingsForm.getRawValue()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (settings) => {
        this.settings = settings;
        this.savingSettings = false;
        this.settingsSubmitted = false;
        this.success = 'Support settings saved.';
        this.syncStartConditionalValidators();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.savingSettings = false;
        this.error = err?.error?.message || 'Could not save settings.';
        this.cdr.markForCheck();
      },
    });
  }

  actorLabel(row: SupportSession): string {
    return row.support_user?.name || row.support_user?.email || `#${row.support_user_id}`;
  }

  statusTone(status: string): 'success' | 'neutral' | 'warning' | 'critical' | 'info' {
    switch (status) {
      case 'active':
      case 'approved':
        return 'success';
      case 'pending':
        return 'warning';
      case 'emergency':
      case 'expired':
      case 'rejected':
      case 'revoked':
        return 'critical';
      case 'ended':
      case 'cancelled':
      case 'consumed':
        return 'neutral';
      default:
        return 'info';
    }
  }

  modeTone(mode: string): 'success' | 'neutral' | 'warning' | 'critical' | 'info' {
    if (mode === 'emergency') {
      return 'critical';
    }
    if (mode === 'standard') {
      return 'warning';
    }
    return 'info';
  }

  get isEmergencyMode(): boolean {
    return this.startForm.controls.mode.value === 'emergency';
  }

  get needsApprovalForStart(): boolean {
    return this.isEmergencyMode && (this.settings?.emergency_requires_approval ?? true);
  }

  closeConfirm(): void {
    if (this.endingSession) {
      return;
    }
    this.confirmOpen = false;
    this.pendingAction = null;
    this.cdr.markForCheck();
  }

  private openConfirm(opts: {
    type: PendingAction['type'];
    title: string;
    message: string;
    confirmText: string;
    buttonClass?: string;
    note?: boolean;
    session?: SupportSession;
    grant?: SupportAccessGrant;
    request?: SupportAccessRequest;
  }): void {
    this.confirmTitle = opts.title;
    this.confirmMessage = opts.message;
    this.confirmText = opts.confirmText;
    this.confirmButtonClass = opts.buttonClass || 'btn-primary';
    this.showDecisionNote = !!opts.note;
    if (opts.type === 'exit') {
      this.pendingAction = { type: 'exit' };
    } else if (opts.type === 'force' && opts.session) {
      this.pendingAction = { type: 'force', session: opts.session };
    } else if (opts.type === 'revoke' && opts.grant) {
      this.pendingAction = { type: 'revoke', grant: opts.grant };
    } else if (opts.type === 'approve' && opts.request) {
      this.pendingAction = { type: 'approve', request: opts.request };
    } else if (opts.type === 'reject' && opts.request) {
      this.pendingAction = { type: 'reject', request: opts.request };
    } else if (opts.type === 'cancel' && opts.request) {
      this.pendingAction = { type: 'cancel', request: opts.request };
    } else {
      return;
    }
    this.confirmOpen = true;
    this.cdr.markForCheck();
  }

  private loadMetrics(): void {
    this.sessions.metrics().pipe(takeUntil(this.destroy$)).subscribe({
      next: (metrics) => {
        this.metrics = metrics;
        this.cdr.markForCheck();
      },
    });
  }

  private buildTabs(): TabStripItem[] {
    const tabs: TabStripItem[] = [];
    if (this.canStartSessions) {
      tabs.push({ id: 'start', label: 'Start session' });
    }
    if (this.canViewTickets) {
      tabs.push({ id: 'tickets', label: 'Tickets' });
    }
    if (this.canViewSessions) {
      tabs.push(
        { id: 'active', label: 'Active sessions' },
        { id: 'history', label: 'History' }
      );
    }
    if (this.canViewApprovals) {
      tabs.push({ id: 'approvals', label: 'Approvals' });
    }
    if (this.canViewGrants) {
      tabs.push({ id: 'grants', label: 'Grants' });
    }
    if (this.canExport) {
      tabs.push({ id: 'audit', label: 'Audit events' });
    }
    if (this.canManageSettings) {
      tabs.push({ id: 'settings', label: 'Settings' });
    }
    return tabs;
  }

  private defaultTab(): SupportCenterTab {
    if (this.canStartSessions) {
      return 'start';
    }
    if (this.canViewTickets) {
      return 'tickets';
    }
    return (this.tabs[0]?.id as SupportCenterTab) ?? 'tickets';
  }

  private resolveInitialTab(requested: SupportCenterTab): SupportCenterTab {
    if (this.tabs.some((tab) => tab.id === requested)) {
      return requested;
    }
    return this.defaultTab();
  }

  private saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

}
