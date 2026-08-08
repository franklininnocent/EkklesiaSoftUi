import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { FamilyService } from '@core/services/family.service';
import { Family } from '@core/models/family.model';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { DonationsService } from '../services/donations.service';
import { ContributionPlan, ContributionPlanAssignment } from '../models/donation.model';

type ApiErrorBody = {
  message?: string;
  errors?: Record<string, string[]>;
};

@Component({
  selector: 'app-donations-plans',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, CfEmptyStateComponent, LoadingSkeletonComponent, PageHeaderComponent],
  templateUrl: './donations-plans.component.html',
  styleUrl: './donations-plans.component.scss'
})
export class DonationsPlansComponent implements OnInit, OnDestroy {
  plans: ContributionPlan[] = [];
  plansLoaded = false;
  plansLoadError: string | null = null;
  private loadPlansSeq = 0;
  private routerSub?: Subscription;
  private skipNextNavReload = true;
  tableSearch = '';
  funds: Array<{ id: string; name: string; code: string }> = [];
  fundsLoaded = false;
  fundsLoadError: string | null = null;
  newPurposeName = '';
  creatingPurpose = false;
  families: Family[] = [];
  draftAssignments: ContributionPlanAssignment[] = [];
  selectedFamilyId = '';
  assignmentAmount = 0;
  assignmentEffectiveFrom = new Date().toISOString().slice(0, 10);
  showForm = false;
  editingPlanId: string | null = null;
  saving = false;
  submitAttempted = false;
  formError: string | null = null;
  lastCreatedPlan: ContributionPlan | null = null;
  highlightPlanId: string | null = null;
  canManage = false;

  planForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    code: [''],
    fund_id: ['', Validators.required],
    plan_type: ['uniform', Validators.required],
    frequency: ['monthly', Validators.required],
    custom_interval_days: [30, [Validators.min(1)]],
    default_amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    start_date: ['', Validators.required],
    end_date: [''],
    auto_generate: [true],
    status: ['active']
  }, { validators: [this.endDateAfterStartValidator] });

  constructor(
    private fb: FormBuilder,
    private donationsService: DonationsService,
    private familyService: FamilyService,
    private authService: AuthService,
    private toastService: ToastService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.canManage = this.authService.hasPermission('donations.manage');
    this.loadPlans();
    this.loadFunds();
    this.loadFamilies();
    this.routerSub = this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
      if (!e.urlAfterRedirects.includes('/donations/plans')) {
        return;
      }
      if (this.skipNextNavReload) {
        this.skipNextNavReload = false;
        return;
      }
      this.loadPlans();
    });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  get activePlanCount(): number {
    return this.plans.filter((plan) => plan.status === 'active').length;
  }

  get sameAmountForAll(): boolean {
    return this.planForm.value.plan_type === 'uniform';
  }

  get formValidationSummary(): string {
    if (this.planForm.value.plan_type === 'individual' && !this.draftAssignments.length) {
      return 'Add at least one family amount before saving.';
    }
    if (!this.funds.length) {
      return 'Add a collection purpose before saving.';
    }
    return 'Complete the highlighted fields below.';
  }

  get filteredPlans(): ContributionPlan[] {
    const query = this.tableSearch.trim().toLowerCase();
    if (!query) {
      return this.plans;
    }
    return this.plans.filter((plan) =>
      [plan.name, plan.code, plan.frequency, plan.status].join(' ').toLowerCase().includes(query)
    );
  }

  frequencyLabel(frequency: string): string {
    const labels: Record<string, string> = {
      one_time: 'One time',
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      half_yearly: 'Half-yearly',
      yearly: 'Yearly',
      weekly: 'Weekly',
      custom: 'Custom'
    };
    return labels[frequency] || frequency;
  }

  isFieldInvalid(field: string): boolean {
    const control = this.planForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched || this.submitAttempted));
  }

  fieldError(field: string): string {
    const control = this.planForm.get(field);
    if (!control?.errors) {
      return '';
    }
    if (control.errors['required']) {
      const labels: Record<string, string> = {
        name: 'Plan name is required.',
        fund_id: 'Please select a collection purpose.',
        default_amount: 'Amount per family is required.',
        start_date: 'Start date is required.',
        custom_interval_days: 'Enter the interval in days.'
      };
      return labels[field] || 'This field is required.';
    }
    if (control.errors['min']) {
      return field === 'default_amount' ? 'Amount must be greater than zero.' : 'Enter a valid value.';
    }
    if (control.errors['dateRange']) {
      return 'End date cannot be before the start date.';
    }
    if (control.errors['duplicateName']) {
      return 'A plan with this name already exists.';
    }
    return 'Check this field.';
  }

  endDateAfterStartValidator(group: AbstractControl): ValidationErrors | null {
    const start = group.get('start_date')?.value;
    const end = group.get('end_date')?.value;
    const endControl = group.get('end_date');
    if (start && end && end < start) {
      endControl?.setErrors({ ...(endControl.errors || {}), dateRange: true });
      return { dateRange: true };
    }
    if (endControl?.errors?.['dateRange']) {
      const { dateRange, ...rest } = endControl.errors;
      endControl.setErrors(Object.keys(rest).length ? rest : null);
    }
    return null;
  }

  onSameAmountToggle(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.planForm.patchValue({ plan_type: checked ? 'uniform' : 'individual' });
  }

  onFrequencyChange(): void {
    if (this.planForm.value.frequency !== 'one_time') {
      return;
    }
    const start = this.planForm.value.start_date;
    if (start && !this.planForm.value.end_date) {
      this.planForm.patchValue({ end_date: start });
    }
  }

  onStartDateChange(): void {
    if (this.planForm.value.frequency !== 'one_time') {
      return;
    }
    const start = this.planForm.value.start_date;
    if (start) {
      this.planForm.patchValue({ end_date: start });
    }
  }

  openCreateForm(): void {
    if (!this.canManage) {
      this.toastService.error('You do not have permission to create contribution plans.', 'Permission required');
      return;
    }

    this.editingPlanId = null;
    this.lastCreatedPlan = null;
    this.formError = null;
    this.submitAttempted = false;
    this.showForm = true;
    this.resetFormFields(true);
    this.cdr.detectChanges();
    setTimeout(() => {
      document.getElementById('plan-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      document.getElementById('plan-name')?.focus();
    }, 0);
  }

  closeForm(): void {
    if (this.saving) {
      return;
    }
    this.showForm = false;
    this.editingPlanId = null;
    this.formError = null;
    this.submitAttempted = false;
  }

  scrollToPlan(planId: string): void {
    this.highlightPlanId = planId;
    setTimeout(() => {
      document.getElementById(`plan-row-${planId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
    setTimeout(() => { this.highlightPlanId = null; }, 4000);
  }

  loadPlans(): void {
    const seq = ++this.loadPlansSeq;
    this.plansLoaded = false;
    this.plansLoadError = null;
    this.donationsService.getPlans().subscribe({
      next: (res) => {
        if (seq !== this.loadPlansSeq) {
          return;
        }
        this.plans = Array.isArray(res.data) ? res.data : [];
        this.plansLoaded = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        if (seq !== this.loadPlansSeq) {
          return;
        }
        console.error('Failed to load contribution plans', err);
        this.plansLoaded = true;
        this.plansLoadError = 'Unable to load contribution plans. Please try again.';
        this.toastService.error(this.plansLoadError, 'Error');
        this.cdr.detectChanges();
      }
    });
  }

  loadFunds(): void {
    this.fundsLoaded = false;
    this.fundsLoadError = null;
    this.donationsService.getFunds().subscribe({
      next: (res) => {
        this.funds = res.data || [];
        this.fundsLoaded = true;
        this.ensureDefaultFund();
      },
      error: (err) => {
        console.error('Failed to load collection purposes', err);
        this.fundsLoaded = true;
        this.fundsLoadError = 'Unable to load collection purposes. Please refresh and try again.';
        this.toastService.error(this.fundsLoadError, 'Error');
      }
    });
  }

  createPurpose(): void {
    const name = this.newPurposeName.trim();
    if (!name || this.creatingPurpose) {
      return;
    }

    this.creatingPurpose = true;
    this.formError = null;
    this.donationsService.createFund({
      name,
      code: this.suggestPurposeCode(name),
      status: 'active'
    }).subscribe({
      next: (res) => {
        this.creatingPurpose = false;
        this.newPurposeName = '';
        this.funds = [...this.funds, res.data];
        this.planForm.patchValue({ fund_id: res.data.id });
        this.toastService.success(`"${res.data.name}" added.`, 'Purpose added');
      },
      error: (err) => {
        this.creatingPurpose = false;
        this.formError = this.parseApiError(err);
        this.toastService.error(this.formError, 'Could not add purpose');
      }
    });
  }

  loadFamilies(): void {
    this.familyService.getFamilies({ per_page: 200, status: 'active' }).subscribe({
      next: (res) => { this.families = res.data || []; }
    });
  }

  addAssignment(): void {
    if (!this.selectedFamilyId || this.assignmentAmount <= 0) {
      return;
    }
    this.draftAssignments.push({
      family_id: this.selectedFamilyId,
      amount: this.assignmentAmount,
      effective_from: this.assignmentEffectiveFrom,
      status: 'active'
    });
    this.selectedFamilyId = '';
    this.assignmentAmount = 0;
    this.formError = null;
  }

  removeAssignment(index: number): void {
    this.draftAssignments.splice(index, 1);
  }

  familyName(familyId: string): string {
    return this.families.find((f) => f.id === familyId)?.family_name || familyId;
  }

  editPlan(plan: ContributionPlan): void {
    this.editingPlanId = plan.id;
    this.showForm = true;
    this.formError = null;
    this.submitAttempted = false;
    this.lastCreatedPlan = null;
    this.planForm.patchValue({
      name: plan.name,
      code: plan.code,
      fund_id: plan.fund_id,
      plan_type: plan.plan_type || 'uniform',
      frequency: plan.frequency,
      custom_interval_days: plan.custom_interval_days || 30,
      default_amount: plan.default_amount,
      start_date: plan.start_date || '',
      end_date: plan.end_date || '',
      auto_generate: plan.auto_generate ?? true,
      status: plan.status
    });
    this.draftAssignments = [];
    this.cdr.detectChanges();
    setTimeout(() => {
      document.getElementById('plan-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      document.getElementById('plan-name')?.focus();
    }, 0);
  }

  savePlan(): void {
    if (this.saving) {
      return;
    }

    this.submitAttempted = true;
    this.formError = null;
    this.planForm.markAllAsTouched();

    if (this.planForm.value.frequency === 'custom' && !this.planForm.value.custom_interval_days) {
      this.planForm.get('custom_interval_days')?.setErrors({ required: true });
    }

    const name = (this.planForm.value.name || '').trim();
    const duplicateName = this.plans.some(
      (plan) => plan.name.toLowerCase() === name.toLowerCase() && plan.id !== this.editingPlanId
    );
    if (duplicateName) {
      this.planForm.get('name')?.setErrors({ duplicateName: true });
    }

    if (!this.fundsLoaded) {
      this.formError = 'Collection purposes are still loading. Please wait a moment.';
      return;
    }

    if (this.fundsLoadError) {
      this.formError = this.fundsLoadError;
      return;
    }

    if (this.planForm.value.plan_type === 'individual' && !this.draftAssignments.length && !this.editingPlanId) {
      this.formError = 'Add at least one family amount for per-family plans.';
      return;
    }

    if (!this.funds.length) {
      this.formError = 'Add a collection purpose before creating this plan.';
      return;
    }

    this.ensureDefaultFund();

    if (this.planForm.invalid) {
      this.formError = this.formValidationSummary;
      this.toastService.error(this.formValidationSummary, 'Complete required fields');
      return;
    }

    this.saving = true;
    const isEdit = !!this.editingPlanId;
    const raw = this.planForm.getRawValue();
    const code = (raw.code || '').trim() || this.suggestPlanCode(raw.name || '');

    const payload: Record<string, unknown> = {
      name,
      code,
      fund_id: raw.fund_id,
      plan_type: raw.plan_type,
      frequency: raw.frequency,
      custom_interval_days: raw.frequency === 'custom' ? Number(raw.custom_interval_days) : null,
      default_amount: Number(raw.default_amount),
      start_date: raw.start_date,
      end_date: raw.end_date || null,
      auto_generate: !!raw.auto_generate,
      status: raw.status,
      assignments: raw.plan_type === 'individual' ? this.draftAssignments : []
    };

    const request$ = this.editingPlanId
      ? this.donationsService.updatePlan(this.editingPlanId, payload)
      : this.donationsService.createPlan(payload);

    request$.subscribe({
      next: (res) => {
        this.saving = false;
        this.submitAttempted = false;
        const saved = res.data;
        if (saved) {
          const without = this.plans.filter((p) => p.id !== saved.id);
          this.plans = [saved, ...without];
          this.lastCreatedPlan = saved;
          this.highlightPlanId = saved.id;
        } else {
          this.loadPlans();
        }
        this.showForm = false;
        this.editingPlanId = null;
        this.resetFormFields(false);
        this.toastService.success(
          isEdit ? 'Contribution plan updated successfully.' : 'Contribution plan created successfully.',
          'Success'
        );
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.saving = false;
        this.formError = this.parseApiError(err);
        this.toastService.error(this.formError, 'Could not save plan');
      }
    });
  }

  generateDues(plan: ContributionPlan): void {
    this.donationsService.generatePlanDues(plan.id, { use_current_period: true }).subscribe({
      next: (res) => {
        this.toastService.success(`${res.data?.length || 0} dues created.`, 'Dues generated');
      },
      error: (err) => {
        this.toastService.error(this.parseApiError(err), 'Could not generate dues');
      }
    });
  }

  private parseApiError(err: unknown): string {
    const body = (err as { error?: ApiErrorBody })?.error ?? (err as ApiErrorBody);
    if (body?.errors) {
      const firstField = Object.keys(body.errors)[0];
      const firstMessage = firstField ? body.errors[firstField]?.[0] : undefined;
      if (firstMessage) {
        return firstMessage;
      }
    }
    const message = body?.message || (err as ApiErrorBody)?.message;
    if (message && message !== 'Validation error') {
      return message;
    }
    return 'Could not save the plan. Check your entries and try again.';
  }

  private ensureDefaultFund(): void {
    if (!this.funds.length) {
      return;
    }
    const currentFundId = this.planForm.get('fund_id')?.value;
    if (!currentFundId) {
      this.planForm.patchValue({ fund_id: this.funds[0].id });
    }
  }

  private suggestPlanCode(name: string): string {
    const slug = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20);
    const suffix = Date.now().toString().slice(-6);
    return slug ? `${slug}-${suffix}` : `PLAN-${suffix}`;
  }

  private suggestPurposeCode(name: string): string {
    const slug = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20);
    return slug || `PURPOSE-${Date.now().toString().slice(-6)}`;
  }

  private resetFormFields(keepFormOpen = false): void {
    if (!keepFormOpen) {
      this.showForm = false;
    }
    this.draftAssignments = [];
    this.planForm.reset({
      plan_type: 'uniform',
      frequency: 'monthly',
      custom_interval_days: 30,
      default_amount: null,
      auto_generate: true,
      status: 'active',
      start_date: new Date().toISOString().slice(0, 10),
      end_date: '',
      fund_id: this.funds[0]?.id || '',
      code: '',
      name: ''
    });
    this.ensureDefaultFund();
  }
}
