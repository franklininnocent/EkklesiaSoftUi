import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, takeUntil, merge, map, catchError, EMPTY, finalize } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { ChurchLeadershipGovernanceService } from '@core/services/church/church-leadership-governance.service';
import { ChurchLeadershipService } from '@core/services/church/church-leadership.service';
import {
  CurrentLeadershipResponse,
  LeadershipAssignment,
  LeadershipExitReasonCode,
  LeadershipHistoryFilters,
  LeadershipRoleOption,
} from '@core/models/church/leadership-governance.model';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { SectionCardComponent } from '@shared/components/section-card/section-card.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import {
  AdvancedSearchPanelComponent,
  ActiveFilter,
  SearchField,
} from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { EditIconButtonComponent } from '@shared/components/edit-icon-button/edit-icon-button.component';
import { ParishPerson, ParishPersonService } from '@features/settings/sacraments/services/person.service';

type HistoryView = 'table' | 'timeline';

@Component({
  selector: 'app-church-leadership-governance',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    ModalShellComponent,
    PaginationComponent,
    StatusBadgeComponent,
    SectionCardComponent,
    ListToolbarComponent,
    AdvancedSearchPanelComponent,
    EditIconButtonComponent,
  ],
  templateUrl: './church-leadership-governance.component.html',
  styleUrl: './church-leadership-governance.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChurchLeadershipGovernanceComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly personSearch$ = new Subject<string>();
  private readonly historyReload$ = new Subject<{ filters: LeadershipHistoryFilters; showLoading: boolean }>();
  private readonly api = inject(ChurchLeadershipGovernanceService);
  private readonly leadershipService = inject(ChurchLeadershipService);
  private readonly personService = inject(ParishPersonService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() canEdit = false;
  @Output() currentChanged = new EventEmitter<CurrentLeadershipResponse | null>();

  current: CurrentLeadershipResponse | null = null;
  loadingCurrent = false;
  currentError: string | null = null;

  history: LeadershipAssignment[] = [];
  historyLoading = false;
  historyError: string | null = null;
  historyView: HistoryView = 'table';
  historyFilters: LeadershipHistoryFilters = { page: 1, per_page: 15 };
  historyPagination = { current_page: 1, last_page: 1, per_page: 15, total: 0 };

  roles: LeadershipRoleOption[] = [];

  showAdvancedSearch = false;
  searchFields: SearchField[] = [];

  showAssignModal = false;
  showHandoverModal = false;
  showTerminateModal = false;
  showEditModal = false;
  saving = false;
  modalError: string | null = null;
  incumbent: LeadershipAssignment | null = null;
  terminatingAssignment: LeadershipAssignment | null = null;
  editingAssignment: LeadershipAssignment | null = null;

  personQuery = '';
  personResults: ParishPerson[] = [];
  lastPersonResults: ParishPerson[] = [];
  personSearching = false;
  selectedPerson: ParishPerson | null = null;
  showPersonResults = false;
  assignPhotoFile: File | null = null;
  assignPhotoPreview: string | null = null;
  editPhotoFile: File | null = null;
  editPhotoPreview: string | null = null;

  readonly assignForm = this.fb.nonNullable.group({
    person_id: [''],
    role_id: ['', Validators.required],
    appointment_date: [''],
    start_date: ['', Validators.required],
    end_date: [''],
    jurisdiction_name: [''],
    appointment_letter_ref: [''],
  });

  readonly handoverForm = this.fb.nonNullable.group({
    outgoing_end_date: ['', Validators.required],
    outgoing_exit_reason_code: ['transferred' as LeadershipExitReasonCode, Validators.required],
    outgoing_exit_reason_note: [''],
    appointment_date: [''],
    start_date: ['', Validators.required],
    jurisdiction_name: [''],
    appointment_letter_ref: [''],
  });

  readonly terminateForm = this.fb.nonNullable.group({
    end_date: ['', Validators.required],
    exit_reason_code: ['completed' as LeadershipExitReasonCode, Validators.required],
    exit_reason_note: [''],
  });

  readonly editForm = this.fb.nonNullable.group({
    first_name: ['', Validators.required],
    last_name: ['', Validators.required],
    role_id: ['', Validators.required],
    appointment_date: [''],
    start_date: ['', Validators.required],
    jurisdiction_name: [''],
    appointment_letter_ref: [''],
  });

  readonly exitReasons: LeadershipExitReasonCode[] = [
    'transferred',
    'retired',
    'resigned',
    'removed',
    'completed',
    'deceased',
    'other',
  ];

  ngOnInit(): void {
    this.initializeSearchFields();
    this.setupModalFormChangeDetection();
    this.setupPersonSearch();
    this.setupHistoryReload();
    this.loadRoles();
    this.refreshAll();
  }

  get canSubmitAssign(): boolean {
    if (this.saving) {
      return false;
    }

    const { role_id, start_date } = this.assignForm.getRawValue();
    const hasPerson = !!this.selectedPerson || this.personQuery.trim().length >= 2;
    return hasPerson
      && !!this.asId(role_id)
      && !!String(start_date ?? '').trim();
  }

  get assignPhotoAltText(): string {
    if (this.selectedPerson) {
      return this.personDisplayName(this.selectedPerson);
    }
    const name = this.personQuery.trim();
    return name || 'Leader photo preview';
  }

  get canSubmitHandover(): boolean {
    return !this.saving && this.handoverForm.valid;
  }

  get canSubmitTerminate(): boolean {
    return !this.saving && this.terminateForm.valid;
  }

  get canSubmitEdit(): boolean {
    return !this.saving && this.editForm.valid;
  }

  get editPhotoAltText(): string {
    const raw = this.editForm.getRawValue();
    const name = `${raw.first_name} ${raw.last_name}`.trim();
    return name || 'Leader photo preview';
  }

  get drawerFilterCount(): number {
    return this.getActiveFilterCount();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  refreshAll(): void {
    this.loadCurrent();
    this.loadHistory(false);
  }

  loadCurrent(): void {
    this.loadingCurrent = true;
    this.currentError = null;
    this.cdr.markForCheck();

    this.api.getCurrent().subscribe({
      next: (response) => {
        this.current = response.data;
        this.loadingCurrent = false;
        this.currentChanged.emit(this.current);
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingCurrent = false;
        this.currentError = 'Could not load current governance.';
        this.cdr.markForCheck();
      },
    });
  }

  loadHistory(showLoading = true): void {
    this.historyReload$.next({
      filters: { ...this.historyFilters },
      showLoading,
    });
  }

  private setupHistoryReload(): void {
    this.historyReload$.pipe(
      switchMap(({ filters, showLoading }) => {
        if (showLoading || this.history.length === 0) {
          this.historyLoading = true;
        }
        this.historyError = null;
        this.cdr.markForCheck();

        return this.api.getHistory(filters).pipe(
          map((response) => ({ response, showLoading })),
          catchError(() => {
            this.historyLoading = false;
            this.historyError = 'Could not load leadership history.';
            this.cdr.markForCheck();
            return EMPTY;
          }),
        );
      }),
      takeUntil(this.destroy$),
    ).subscribe(({ response }) => {
      this.history = Array.isArray(response.data) ? response.data : [];

      const pagination = response.pagination;
      if (pagination) {
        this.historyPagination = {
          current_page: pagination.current_page,
          last_page: pagination.last_page,
          per_page: pagination.per_page,
          total: pagination.total,
        };
      }

      this.historyLoading = false;
      this.cdr.markForCheck();
    });
  }

  private patchHistoryRow(assignment?: LeadershipAssignment): void {
    if (!assignment?.id) {
      return;
    }

    const index = this.history.findIndex((row) => row.id === assignment.id);
    if (index < 0) {
      return;
    }

    this.history = [
      ...this.history.slice(0, index),
      assignment,
      ...this.history.slice(index + 1),
    ];
  }

  openFilters(): void {
    this.syncSearchFieldValues();
    this.showAdvancedSearch = true;
    this.cdr.markForCheck();
  }

  onAdvancedSearch(searchValues: { [key: string]: unknown }): void {
    this.historyFilters = {
      ...this.historyFilters,
      page: 1,
      category: (searchValues['category'] as LeadershipHistoryFilters['category']) || '',
      status: (searchValues['status'] as LeadershipHistoryFilters['status']) || '',
      role_id: (searchValues['role_id'] as string) || '',
      from: (searchValues['from'] as string) || '',
      to: (searchValues['to'] as string) || '',
      as_of: (searchValues['as_of'] as string) || '',
    };
    this.loadHistory();
    this.showAdvancedSearch = false;
    this.cdr.markForCheck();
  }

  onClearAdvancedSearch(): void {
    const perPage = this.historyFilters.per_page ?? 15;
    this.historyFilters = { page: 1, per_page: perPage };
    this.searchFields.forEach((field) => {
      field.value = undefined;
    });
    this.loadHistory();
    this.cdr.markForCheck();
  }

  getActiveFilters(): ActiveFilter[] {
    const filters: ActiveFilter[] = [];

    if (this.historyFilters.category) {
      filters.push({
        key: 'category',
        label: 'Category',
        value: this.historyFilters.category,
        displayValue: this.categoryLabel(this.historyFilters.category),
      });
    }

    if (this.historyFilters.status) {
      filters.push({
        key: 'status',
        label: 'Status',
        value: this.historyFilters.status,
        displayValue: this.statusLabel(this.historyFilters.status),
      });
    }

    if (this.historyFilters.role_id) {
      const role = this.roles.find((row) => String(row.id) === String(this.historyFilters.role_id));
      filters.push({
        key: 'role_id',
        label: 'Role',
        value: this.historyFilters.role_id,
        displayValue: role?.title || String(this.historyFilters.role_id),
      });
    }

    if (this.historyFilters.from) {
      filters.push({
        key: 'from',
        label: 'From date',
        value: this.historyFilters.from,
        displayValue: this.formatFilterDate(this.historyFilters.from),
      });
    }

    if (this.historyFilters.to) {
      filters.push({
        key: 'to',
        label: 'To date',
        value: this.historyFilters.to,
        displayValue: this.formatFilterDate(this.historyFilters.to),
      });
    }

    if (this.historyFilters.as_of) {
      filters.push({
        key: 'as_of',
        label: 'As of date',
        value: this.historyFilters.as_of,
        displayValue: this.formatFilterDate(this.historyFilters.as_of),
      });
    }

    return filters;
  }

  getActiveFilterCount(): number {
    return this.getActiveFilters().length;
  }

  removeFilter(filter: ActiveFilter): void {
    const next: LeadershipHistoryFilters = { ...this.historyFilters, page: 1 };

    if (filter.key === 'category') {
      next.category = '';
    } else if (filter.key === 'status') {
      next.status = '';
    } else if (filter.key === 'role_id') {
      next.role_id = '';
    } else if (filter.key === 'from') {
      next.from = '';
    } else if (filter.key === 'to') {
      next.to = '';
    } else if (filter.key === 'as_of') {
      next.as_of = '';
    }

    this.historyFilters = next;

    const field = this.searchFields.find((row) => row.key === filter.key);
    if (field) {
      field.value = undefined;
    }

    this.loadHistory();
    this.cdr.markForCheck();
  }

  clearAllFilters(): void {
    this.onClearAdvancedSearch();
  }

  onHistoryPageChange(page: number): void {
    this.historyFilters = { ...this.historyFilters, page };
    this.loadHistory();
  }

  setHistoryView(view: HistoryView): void {
    this.historyView = view;
    this.cdr.markForCheck();
  }

  openAssignModal(): void {
    if (!this.canEdit) {
      return;
    }
    const today = this.todayIso();
    this.selectedPerson = null;
    this.personQuery = '';
    this.personResults = [];
    this.lastPersonResults = [];
    this.showPersonResults = false;
    this.incumbent = null;
    this.modalError = null;
    this.assignPhotoFile = null;
    this.assignPhotoPreview = null;
    this.assignForm.reset({
      person_id: '',
      role_id: '',
      appointment_date: today,
      start_date: today,
      end_date: '',
      jurisdiction_name: '',
      appointment_letter_ref: '',
    });
    this.showAssignModal = true;
    this.cdr.markForCheck();
  }

  closeAssignModal(): void {
    if (this.saving) {
      return;
    }
    this.showAssignModal = false;
    this.cdr.markForCheck();
  }

  submitAssign(): void {
    this.applyPendingPersonSelection();
    if (this.canSubmitAssign && this.selectedPerson) {
      this.persistAssignment();
      return;
    }

    const query = this.personQuery.trim();
    if (query.length >= 2 && this.hasAssignRoleAndDate()) {
      this.saving = true;
      this.modalError = null;
      this.cdr.markForCheck();
      this.personService.search(query, false).subscribe({
        next: (response) => {
          this.saving = false;
          this.personResults = Array.isArray(response.data) ? response.data : [];
          this.lastPersonResults = this.personResults;
          this.applyPendingPersonSelection();
          if (this.canSubmitAssign) {
            this.persistAssignment();
            return;
          }
          this.assignForm.markAllAsTouched();
          this.modalError = this.assignValidationMessage();
          this.cdr.markForCheck();
        },
        error: () => {
          this.saving = false;
          if (this.canSubmitAssign) {
            this.persistAssignment();
            return;
          }
          this.assignForm.markAllAsTouched();
          this.modalError = this.assignValidationMessage();
          this.cdr.markForCheck();
        },
      });
      return;
    }

    this.assignForm.markAllAsTouched();
    this.modalError = this.assignValidationMessage();
    this.cdr.markForCheck();
  }

  private hasAssignRoleAndDate(): boolean {
    const { role_id, start_date } = this.assignForm.getRawValue();
    return !!this.asId(role_id) && !!String(start_date ?? '').trim();
  }

  private persistAssignment(): void {
    const raw = this.assignForm.getRawValue();
    const common = {
      role_id: this.asId(raw.role_id),
      appointment_date: raw.appointment_date || null,
      start_date: raw.start_date,
      end_date: raw.end_date || null,
      jurisdiction_name: raw.jurisdiction_name || null,
      appointment_letter_ref: raw.appointment_letter_ref || null,
    };

    const person = this.selectedPerson;
    const typedName = this.parseTypedLeaderName(this.personQuery);

    if (!person && !typedName) {
      return;
    }

    this.saving = true;
    this.modalError = null;
    this.cdr.markForCheck();

    const payload = person
      ? { is_external: false as const, person_id: person.id, ...common }
      : { is_external: true as const, first_name: typedName!.first_name, last_name: typedName!.last_name, ...common };

    this.api.assign(payload).pipe(
      switchMap((response) => this.uploadAssignPhotoIfNeeded(response)),
    ).subscribe({
      next: () => this.onAssignSuccess(),
      error: (error: unknown) => this.handleAssignError(error),
    });
  }

  private parseTypedLeaderName(query: string): { first_name: string; last_name: string } | null {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return null;
    }

    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return { first_name: parts[0], last_name: parts[0] };
    }

    return {
      first_name: parts.slice(0, -1).join(' '),
      last_name: parts[parts.length - 1],
    };
  }

  private uploadAssignPhotoIfNeeded(response: { data?: LeadershipAssignment }) {
    if (!this.assignPhotoFile || !response.data?.id) {
      return of(response);
    }

    return this.api.uploadAssignmentPhoto(response.data.id, this.assignPhotoFile).pipe(
      map(() => response),
      catchError(() => {
        this.toastService.warning('Leader added, but the profile photo could not be uploaded.', 'Photo Upload');
        return of(response);
      }),
    );
  }

  private onAssignSuccess(): void {
    this.saving = false;
    this.showAssignModal = false;
    this.assignPhotoFile = null;
    this.assignPhotoPreview = null;
    this.toastService.success('Leader added.', 'Success');
    this.refreshAll();
    this.cdr.markForCheck();
  }

  onAssignPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.assignPhotoFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      this.assignPhotoPreview = reader.result as string;
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  removeAssignPhoto(): void {
    this.assignPhotoFile = null;
    this.assignPhotoPreview = null;
    this.cdr.markForCheck();
  }

  openHandoverFromIncumbent(): void {
    if (!this.incumbent || !this.selectedPerson) {
      return;
    }
    const today = this.todayIso();
    this.handoverForm.reset({
      outgoing_end_date: today,
      outgoing_exit_reason_code: 'transferred',
      outgoing_exit_reason_note: '',
      appointment_date: today,
      start_date: today,
      jurisdiction_name: '',
      appointment_letter_ref: '',
    });
    this.showAssignModal = false;
    this.showHandoverModal = true;
    this.modalError = null;
    this.cdr.markForCheck();
  }

  closeHandoverModal(): void {
    if (this.saving) {
      return;
    }
    this.showHandoverModal = false;
    this.cdr.markForCheck();
  }

  submitHandover(): void {
    if (!this.incumbent || !this.selectedPerson || this.handoverForm.invalid) {
      this.handoverForm.markAllAsTouched();
      this.cdr.markForCheck();
      return;
    }

    const raw = this.handoverForm.getRawValue();
    this.saving = true;
    this.modalError = null;
    this.cdr.markForCheck();

    this.api.handover({
      outgoing_assignment_id: this.incumbent.id,
      outgoing_end_date: raw.outgoing_end_date,
      outgoing_exit_reason_code: raw.outgoing_exit_reason_code,
      outgoing_exit_reason_note: raw.outgoing_exit_reason_note || null,
      person_id: this.selectedPerson.id,
      role_id: this.incumbent.role_id,
      appointment_date: raw.appointment_date || null,
      start_date: raw.start_date,
      jurisdiction_name: raw.jurisdiction_name || null,
      appointment_letter_ref: raw.appointment_letter_ref || null,
    }).subscribe({
      next: () => {
        this.saving = false;
        this.showHandoverModal = false;
        this.incumbent = null;
        this.toastService.success('Leadership handover completed.', 'Success');
        this.refreshAll();
        this.cdr.markForCheck();
      },
      error: (error: unknown) => {
        this.saving = false;
        this.modalError = this.extractError(error, 'Could not complete handover.');
        this.cdr.markForCheck();
      },
    });
  }

  openTerminateModal(assignment: LeadershipAssignment): void {
    if (!this.canEdit) {
      return;
    }
    this.terminatingAssignment = assignment;
    this.terminateForm.reset({
      end_date: this.todayIso(),
      exit_reason_code: 'completed',
      exit_reason_note: '',
    });
    this.modalError = null;
    this.showTerminateModal = true;
    this.cdr.markForCheck();
  }

  openEditModal(assignment: LeadershipAssignment): void {
    if (!this.canEdit) {
      return;
    }

    this.editingAssignment = assignment;
    this.editPhotoFile = null;
    this.editPhotoPreview = this.leaderPhotoUrl(assignment);
    this.editForm.reset({
      first_name: assignment.person?.first_name || '',
      last_name: assignment.person?.last_name || '',
      role_id: assignment.role_id,
      appointment_date: assignment.appointment_date || '',
      start_date: assignment.start_date,
      jurisdiction_name: assignment.jurisdiction_name || '',
      appointment_letter_ref: assignment.appointment_letter_ref || '',
    });
    this.modalError = null;
    this.showEditModal = true;
    this.cdr.markForCheck();
  }

  closeEditModal(): void {
    if (this.saving) {
      return;
    }
    this.showEditModal = false;
    this.editingAssignment = null;
    this.editPhotoFile = null;
    this.editPhotoPreview = null;
    this.cdr.markForCheck();
  }

  submitEdit(): void {
    if (!this.editingAssignment || this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      this.cdr.markForCheck();
      return;
    }

    const raw = this.editForm.getRawValue();
    this.saving = true;
    this.modalError = null;
    this.cdr.markForCheck();

    const payload = {
      role_id: raw.role_id,
      first_name: raw.first_name.trim(),
      last_name: raw.last_name.trim(),
      appointment_date: raw.appointment_date || null,
      start_date: raw.start_date,
      jurisdiction_name: raw.jurisdiction_name || null,
      appointment_letter_ref: raw.appointment_letter_ref || null,
    };

    this.api.updateAssignment(this.editingAssignment.id, payload).pipe(
      switchMap((response) => this.uploadEditPhotoIfNeeded(response)),
      finalize(() => {
        this.saving = false;
        this.cdr.markForCheck();
      }),
    ).subscribe({
      next: (response) => {
        this.showEditModal = false;
        this.editingAssignment = null;
        this.editPhotoFile = null;
        this.editPhotoPreview = null;
        this.toastService.success('Leader updated.', 'Success');
        this.patchHistoryRow(response?.data);
        this.refreshAll();
      },
      error: (error: unknown) => {
        this.modalError = this.extractError(error, 'Could not update leader.');
        this.cdr.markForCheck();
      },
    });
  }

  onEditPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.editPhotoFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      this.editPhotoPreview = reader.result as string;
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  removeEditPhoto(): void {
    this.editPhotoFile = null;
    this.editPhotoPreview = this.editingAssignment ? this.leaderPhotoUrl(this.editingAssignment) : null;
    this.cdr.markForCheck();
  }

  private uploadEditPhotoIfNeeded(response: { data?: LeadershipAssignment }) {
    if (!this.editPhotoFile || !response.data?.id) {
      return of(response);
    }

    return this.api.uploadAssignmentPhoto(response.data.id, this.editPhotoFile).pipe(
      map(() => response),
      catchError(() => {
        this.toastService.warning('Leader updated, but the profile photo could not be uploaded.', 'Photo Upload');
        return of(response);
      }),
    );
  }

  closeTerminateModal(): void {
    if (this.saving) {
      return;
    }
    this.showTerminateModal = false;
    this.terminatingAssignment = null;
    this.cdr.markForCheck();
  }

  submitTerminate(): void {
    if (!this.terminatingAssignment || this.terminateForm.invalid) {
      this.terminateForm.markAllAsTouched();
      this.cdr.markForCheck();
      return;
    }

    const raw = this.terminateForm.getRawValue();
    this.saving = true;
    this.modalError = null;
    this.cdr.markForCheck();

    this.api.terminate(this.terminatingAssignment.id, raw).subscribe({
      next: () => {
        this.saving = false;
        this.showTerminateModal = false;
        this.terminatingAssignment = null;
        this.toastService.success('Leadership assignment ended.', 'Success');
        this.refreshAll();
        this.cdr.markForCheck();
      },
      error: (error: unknown) => {
        this.saving = false;
        this.modalError = this.extractError(error, 'Could not terminate assignment.');
        this.cdr.markForCheck();
      },
    });
  }

  onPersonQueryInput(): void {
    if (this.selectedPerson) {
      this.selectedPerson = null;
      this.assignForm.controls.person_id.setValue('');
    }
    this.showPersonResults = true;
    this.personSearch$.next(this.personQuery);
    this.cdr.markForCheck();
  }

  onPersonSearchEnter(event: Event): void {
    event.preventDefault();
    this.applyPendingPersonSelection();
    this.showPersonResults = false;
    this.cdr.markForCheck();
  }

  selectPerson(person: ParishPerson, event?: Event): void {
    event?.preventDefault();
    this.selectedPerson = person;
    this.assignForm.controls.person_id.setValue(person.id);
    this.personQuery = this.personDisplayName(person);
    this.showPersonResults = false;
    this.cdr.markForCheck();
  }

  clearSelectedPerson(): void {
    this.selectedPerson = null;
    this.personQuery = '';
    this.assignForm.controls.person_id.setValue('');
    this.cdr.markForCheck();
  }

  private applyPendingPersonSelection(): void {
    if (this.selectedPerson) {
      return;
    }

    const match = this.matchPersonFromQuery(this.personQuery);
    if (match) {
      this.selectPerson(match);
    }
  }

  private matchPersonFromQuery(rawQuery: string): ParishPerson | null {
    const query = rawQuery.trim().toLowerCase();
    if (query.length < 2) {
      return null;
    }

    const pool = this.personResults.length ? this.personResults : this.lastPersonResults;
    if (!pool.length) {
      return null;
    }

    const named = (person: ParishPerson): string => this.personDisplayName(person).toLowerCase();
    const exact = pool.find((person) => named(person) === query);
    if (exact) {
      return exact;
    }

    const contained = pool.filter((person) => named(person).includes(query) || query.includes(named(person)));
    if (contained.length === 1) {
      return contained[0];
    }

    if (pool.length === 1) {
      return pool[0];
    }

    return contained[0] ?? null;
  }

  personDisplayName(person: ParishPerson): string {
    return (person.full_name_display || `${person.first_name} ${person.last_name}`).trim();
  }

  private assignValidationMessage(): string {
    const { role_id, start_date } = this.assignForm.getRawValue();

    if (!this.selectedPerson && this.personQuery.trim().length < 2) {
      return 'Enter the leader’s name.';
    }
    if (!this.asId(role_id)) {
      return 'Choose a leadership role.';
    }
    if (!String(start_date ?? '').trim()) {
      return 'Choose a start date.';
    }
    return 'Complete the required fields to add this leader.';
  }

  private asId(value: unknown): string {
    if (value == null || value === '') {
      return '';
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value).trim();
    }
    if (typeof value === 'object' && 'id' in (value as object)) {
      return String((value as { id?: unknown }).id ?? '').trim();
    }
    return '';
  }

  private setupModalFormChangeDetection(): void {
    merge(
      this.assignForm.valueChanges,
      this.assignForm.statusChanges,
      this.handoverForm.valueChanges,
      this.handoverForm.statusChanges,
      this.terminateForm.valueChanges,
      this.terminateForm.statusChanges,
      this.editForm.valueChanges,
      this.editForm.statusChanges,
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.cdr.markForCheck();
      });
  }

  statusTone(status: string): StatusBadgeTone {
    switch (status) {
      case 'active':
        return 'success';
      case 'transferred':
        return 'info';
      case 'completed':
        return 'neutral';
      default:
        return 'warning';
    }
  }

  statusLabel(status: string): string {
    if (!status) {
      return '';
    }

    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  formatDate(value?: string | null): string {
    if (!value) {
      return 'Present';
    }
    return value;
  }

  leaderPhotoUrl(assignment: LeadershipAssignment): string | null {
    const fullUrl = assignment.person?.photo_full_url;
    if (fullUrl) {
      return fullUrl;
    }

    return this.leadershipService.resolveLeaderPhotoUrl(assignment.person?.photo_url);
  }

  leaderInitials(assignment: LeadershipAssignment): string {
    const person = assignment.person;
    if (!person) {
      return '?';
    }

    const first = person.first_name?.trim().charAt(0) ?? '';
    const last = person.last_name?.trim().charAt(0) ?? '';
    const initials = `${first}${last}`.toUpperCase();

    if (initials) {
      return initials;
    }

    return person.full_name?.trim().charAt(0)?.toUpperCase() || '?';
  }

  private setupPersonSearch(): void {
    this.personSearch$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => {
          const search = term.trim();
          if (search.length < 2) {
            this.personSearching = false;
            this.personResults = [];
            this.cdr.markForCheck();
            return of(null);
          }
          this.personSearching = true;
          this.cdr.markForCheck();
          return this.personService.search(search, false);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (response) => {
          if (!response) {
            return;
          }
          this.personResults = Array.isArray(response.data) ? response.data : [];
          this.lastPersonResults = this.personResults;
          this.personSearching = false;
          this.showPersonResults = this.personResults.length > 0 && !this.selectedPerson;
          this.cdr.markForCheck();
        },
        error: () => {
          this.personSearching = false;
          this.personResults = [];
          this.cdr.markForCheck();
        },
      });
  }

  private initializeSearchFields(): void {
    this.searchFields = [
      {
        key: 'category',
        label: 'Category',
        type: 'select',
        options: [
          { value: 'CANONICAL_DIOCESAN', label: 'Diocesan / Canonical' },
          { value: 'PARISH_CLERGY', label: 'Parish Clergy' },
          { value: 'PARISH_COUNCIL', label: 'Parish Councils' },
          { value: 'MINISTRY_PIOUS', label: 'Ministries' },
          { value: 'OTHER', label: 'Other' },
        ],
        value: this.historyFilters.category || undefined,
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'completed', label: 'Completed' },
          { value: 'vacated', label: 'Vacated' },
          { value: 'transferred', label: 'Transferred' },
        ],
        value: this.historyFilters.status || undefined,
      },
      {
        key: 'role_id',
        label: 'Role',
        type: 'select',
        options: this.roles.map((role) => ({ value: role.id, label: role.title })),
        value: this.historyFilters.role_id || undefined,
      },
      {
        key: 'from',
        label: 'From date',
        type: 'date',
        value: this.historyFilters.from,
      },
      {
        key: 'to',
        label: 'To date',
        type: 'date',
        value: this.historyFilters.to,
      },
      {
        key: 'as_of',
        label: 'As of date',
        type: 'date',
        value: this.historyFilters.as_of,
      },
    ];
  }

  private syncSearchFieldValues(): void {
    const values: Record<string, unknown> = {
      category: this.historyFilters.category || undefined,
      status: this.historyFilters.status || undefined,
      role_id: this.historyFilters.role_id || undefined,
      from: this.historyFilters.from || undefined,
      to: this.historyFilters.to || undefined,
      as_of: this.historyFilters.as_of || undefined,
    };

    this.searchFields.forEach((field) => {
      field.value = values[field.key];
    });
  }

  private categoryLabel(category: string): string {
    const labels: Record<string, string> = {
      CANONICAL_DIOCESAN: 'Diocesan / Canonical',
      PARISH_CLERGY: 'Parish Clergy',
      PARISH_COUNCIL: 'Parish Councils',
      MINISTRY_PIOUS: 'Ministries',
      OTHER: 'Other',
    };
    return labels[category] || category;
  }

  private formatFilterDate(value: string): string {
    const parsed = new Date(`${value}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  private loadRoles(): void {
    this.api.listRoles().subscribe({
      next: (response) => {
        this.roles = response.data;
        const roleField = this.searchFields.find((field) => field.key === 'role_id');
        if (roleField) {
          roleField.options = this.roles.map((role) => ({ value: role.id, label: role.title }));
        }
        this.cdr.markForCheck();
      },
    });
  }

  private handleAssignError(error: unknown): void {
    this.saving = false;
    if (error instanceof HttpErrorResponse && error.status === 409) {
      const incumbent = error.error?.errors?.incumbent as LeadershipAssignment | undefined;
      if (incumbent) {
        this.incumbent = incumbent;
        this.modalError = 'This role currently has an active incumbent. Complete a handover to replace them.';
        this.cdr.markForCheck();
        return;
      }
    }
    this.modalError = this.extractError(error, 'Could not add leader.');
    this.cdr.markForCheck();
  }

  private extractError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      return error.error?.message || fallback;
    }
    return fallback;
  }

  private todayIso(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
}
