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
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { FormFieldComponent } from '@shared/components/form-field/form-field.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import {
  ConfirmationModalComponent,
  ConfirmationResult,
} from '@shared/components/confirmation-modal/confirmation-modal.component';
import { AuthService } from '@core/services/auth.service';
import {
  dateWindowValidator,
  fieldErrorText,
  filterDateRangeValidator,
  markFormGroupTouched,
} from '@core/validators/form-validation.helper';
import { SupportSessionService } from '../services/support-session.service';
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

type SupportCenterTab = 'start' | 'active' | 'history' | 'approvals' | 'grants' | 'audit' | 'settings';
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
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    PageHeaderComponent,
    TabStripComponent,
    StatusBadgeComponent,
    PaginationComponent,
    CfEmptyStateComponent,
    SectionCardComponent,
    DataTableComponent,
    FormFieldComponent,
    LoadingSkeletonComponent,
    ConfirmationModalComponent,
  ],
  templateUrl: './support-center.page.html',
  styleUrl: './support-center.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportCenterPage implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly sessions = inject(SupportSessionService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<string>();

  readonly canAccess =
    this.auth.hasPermission('support.sessions.start') ||
    this.auth.hasPermission('support.sessions.view') ||
    this.isPlatformAdmin();

  readonly canManageSettings =
    this.auth.hasPermission('support.configuration.manage') || this.isPlatformAdmin();

  readonly canForceEnd =
    this.auth.hasPermission('support.sessions.end') || this.isPlatformAdmin();

  readonly canExport =
    this.auth.hasPermission('support.audit.view') || this.isPlatformAdmin();

  readonly canApprove =
    this.auth.hasPermission('support.sessions.approve') || this.isPlatformAdmin();

  readonly canViewGrants =
    this.auth.hasPermission('support.grants.view') ||
    this.auth.hasPermission('support.grants.manage') ||
    this.isPlatformAdmin();

  readonly canManageGrants =
    this.auth.hasPermission('support.grants.manage') || this.isPlatformAdmin();

  activeTab: SupportCenterTab = 'start';
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
  historySubmitted = false;
  auditSubmitted = false;
  exporting = false;
  exportingAudit = false;
  error: string | null = null;
  success: string | null = null;

  confirmOpen = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmText = 'Confirm';
  confirmButtonClass = 'btn-primary';
  showDecisionNote = false;
  pendingAction: PendingAction | null = null;

  readonly searchControl = this.fb.nonNullable.control('');
  readonly historyForm = this.fb.nonNullable.group(
    {
      q: ['', Validators.maxLength(100)],
      status: [''],
      mode: [''],
      from: [''],
      to: [''],
    },
    { validators: [filterDateRangeValidator()] }
  );

  readonly auditForm = this.fb.nonNullable.group(
    {
      q: ['', Validators.maxLength(100)],
      event_type: ['', Validators.maxLength(64)],
      module: ['', Validators.maxLength(64)],
      from: [''],
      to: [''],
    },
    { validators: [filterDateRangeValidator()] }
  );

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

    this.searchControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((q) => this.search$.next(q));
    this.search$.next('');
    this.sessions.getActive().pipe(takeUntil(this.destroy$)).subscribe();
    this.loadMetrics();
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

    this.startForm.controls.mode.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.syncStartConditionalValidators();
      this.cdr.markForCheck();
    });

    const initialTab = (this.route.snapshot.queryParamMap.get('tab') || 'start') as SupportCenterTab;
    if (this.tabs.some((t) => t.id === initialTab) && initialTab !== 'start') {
      this.onTabChange(initialTab, false);
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
    if (this.activeTab === 'active') {
      this.loadMonitor();
      this.loadMetrics();
    } else if (this.activeTab === 'history') {
      this.loadHistory();
    } else if (this.activeTab === 'approvals') {
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

    this.sessions
      .start({
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
    this.loadingGrants = true;
    this.sessions.listGrants({ per_page: 50 }).pipe(takeUntil(this.destroy$)).subscribe({
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
    if (!this.grantSubmitted && !ends.touched) {
      return null;
    }
    if (this.grantForm.hasError('startsAfterEnds')) {
      return 'Ends must be after Starts.';
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

  historyToError(): string | null {
    if (!this.historySubmitted && !this.historyForm.controls.to.touched) {
      return null;
    }
    if (this.historyForm.hasError('fromAfterTo')) {
      return 'To date must be on or after From date.';
    }
    return fieldErrorText('to', this.historyForm, this.historySubmitted);
  }

  auditToError(): string | null {
    if (!this.auditSubmitted && !this.auditForm.controls.to.touched) {
      return null;
    }
    if (this.auditForm.hasError('fromAfterTo')) {
      return 'To date must be on or after From date.';
    }
    return fieldErrorText('to', this.auditForm, this.auditSubmitted);
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
    this.confirmOpen = false;
    this.pendingAction = null;
    if (!result.confirmed || !action) {
      this.cdr.markForCheck();
      return;
    }
    const note = result.description?.trim() || undefined;

    if (action.type === 'exit' && this.myActive) {
      this.sessions.end(this.myActive.id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.success = 'Support session ended.';
          this.loadMonitor();
          this.loadMetrics();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = err?.error?.message || 'Could not end session.';
          this.cdr.markForCheck();
        },
      });
      return;
    }
    if (action.type === 'force') {
      this.sessions.forceEnd(action.session.id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.success = `Ended session for ${action.session.tenant?.name || action.session.tenant_id}.`;
          this.loadMonitor();
          this.loadMetrics();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = err?.error?.message || 'Could not force-end session.';
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

  applyHistoryFilters(): void {
    this.historySubmitted = true;
    markFormGroupTouched(this.historyForm, '#history-filters-form ');
    this.cdr.markForCheck();
    if (this.historyForm.invalid) {
      return;
    }
    this.historyPage = 1;
    this.loadHistory();
  }

  loadHistory(): void {
    if (this.loadingHistory || this.historyForm.invalid) {
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

  applyAuditFilters(): void {
    this.auditSubmitted = true;
    markFormGroupTouched(this.auditForm, '#audit-filters-form ');
    this.cdr.markForCheck();
    if (this.auditForm.invalid) {
      return;
    }
    this.loadAudit();
  }

  loadAudit(): void {
    if (this.loadingAudit || this.auditForm.invalid) {
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
    const tabs: TabStripItem[] = [
      { id: 'start', label: 'Start session' },
      { id: 'active', label: 'Active sessions' },
      { id: 'history', label: 'History' },
      { id: 'approvals', label: 'Approvals' },
    ];
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

  private saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private isPlatformAdmin(): boolean {
    const user = this.auth.currentUserValue;
    const name = user?.role_name || user?.role?.name;
    return name === 'SuperAdmin' || name === 'EkklesiaAdmin';
  }
}
