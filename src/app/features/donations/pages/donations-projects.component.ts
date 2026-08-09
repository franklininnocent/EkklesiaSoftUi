import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { FamilyService } from '@core/services/family.service';
import { Family } from '@core/models/family.model';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { DonationsService } from '../services/donations.service';
import { QuickCollectService } from '../services/quick-collect.service';
import { DonationProject, ProjectDashboard, ProjectFamilyAssignment } from '../models/donation.model';
import { FinancialActivityTimelineComponent } from '../components/financial-activity-timeline/financial-activity-timeline.component';

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
    FinancialActivityTimelineComponent,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    ModalShellComponent,
    PageHeaderComponent
  ],
  templateUrl: './donations-projects.component.html',
  styleUrl: './donations-projects.component.scss'
})
export class DonationsProjectsComponent implements OnInit {
  projects: DonationProject[] = [];
  tableSearch = '';
  families: Family[] = [];
  draftAssignments: ProjectFamilyAssignment[] = [];
  dashboard: ProjectDashboard | null = null;
  selectedProjectId: string | null = null;
  selectedFamilyId = '';
  assignmentAmount = 0;
  assignmentExempt = false;
  assignmentEffectiveFrom = new Date().toISOString().slice(0, 10);
  showForm = false;
  editingProjectId: string | null = null;
  submitAttempted = false;
  saving = false;
  projectsLoaded = false;
  projectsLoadError: string | null = null;
  message: string | null = null;
  error: string | null = null;
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
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.canManage = this.authService.hasPermission('donations.manage');
    this.loadProjects();
    this.loadFamilies();
  }

  get pageTitle(): string {
    return 'Building & Special Projects';
  }

  get pageSubtitle(): string {
    return 'Track funding progress — spot gaps and follow up with families.';
  }

  get activeProjectCount(): number {
    return this.projects.filter((project) => project.status === 'active').length;
  }

  get atRiskProjectCount(): number {
    return this.projects.filter((project) => this.isProjectAtRisk(project)).length;
  }

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
    return project.status === 'active' && (project.collection_percentage ?? 0) < 50;
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

  openQuickCollect(): void {
    this.quickCollectService.open();
  }

  openCreateForm(): void {
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
    this.donationsService.getProjects().subscribe({
      next: (res) => {
        this.projects = res.data || [];
        this.projectsLoaded = true;
        this.cdr.detectChanges();
      },
      error: (err: { message?: string }) => {
        this.projectsLoadError = err?.message || 'Unable to load projects. Please check your connection and try again.';
        this.projectsLoaded = true;
        this.cdr.detectChanges();
      }
    });
  }

  loadFamilies(): void {
    this.familyService.getFamilies({ per_page: 200, status: 'active' }).subscribe({
      next: (res) => { this.families = res.data || []; }
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
    return this.families.find((f) => f.id === familyId)?.family_name || familyId;
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
    this.selectedProjectId = project.id;
    this.donationsService.getProjectDashboard(project.id).subscribe({
      next: (res) => {
        this.dashboard = res.data;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Failed to load project dashboard.';
        this.cdr.detectChanges();
      }
    });
  }

  generateInstallments(project: DonationProject): void {
    this.donationsService.generateProjectInstallments(project.id).subscribe({
      next: (res) => {
        this.message = `${res.message} (${res.data?.length || 0} installments)`;
        this.loadProjects();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to generate installments.';
        this.cdr.detectChanges();
      }
    });
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
