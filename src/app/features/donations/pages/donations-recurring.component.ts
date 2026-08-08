import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { DonationsService } from '../services/donations.service';
import { DonationCategory, Donor, RecurringDonationSchedule } from '../models/donation.model';
import { refreshStewardshipView, setupStewardshipRouteReload } from '../utils/stewardship-view.util';

@Component({
  selector: 'app-donations-recurring',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, CfEmptyStateComponent, LoadingSkeletonComponent, PageHeaderComponent],
  templateUrl: './donations-recurring.component.html',
  styleUrl: './donations-recurring.component.scss'
})
export class DonationsRecurringComponent implements OnInit {
  schedules: RecurringDonationSchedule[] = [];
  schedulesLoaded = false;
  donors: Donor[] = [];
  categories: DonationCategory[] = [];
  tableSearch = '';
  showForm = false;
  saving = false;
  running = false;
  canCollect = false;

  form = this.fb.group({
    donor_id: [''],
    donation_category_id: [''],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    frequency: ['monthly', Validators.required],
    next_run_on: [new Date().toISOString().slice(0, 10), Validators.required],
    status: ['active']
  });

  constructor(
    private fb: FormBuilder,
    private donationsService: DonationsService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private destroyRef: DestroyRef
  ) {}

  ngOnInit(): void {
    this.canCollect = this.authService.hasPermission('donations.collect');
    this.donationsService.getDonors().subscribe({
      next: (res) => {
        this.donors = res.data?.data ?? [];
        refreshStewardshipView(this.cdr);
      }
    });
    this.donationsService.getCategories().subscribe({
      next: (res) => {
        this.categories = res.data ?? [];
        refreshStewardshipView(this.cdr);
      }
    });
    this.load();
    setupStewardshipRouteReload(this.router, this.destroyRef, '/donations/recurring', () => this.load());
  }

  get activeCount(): number {
    return this.schedules.filter((schedule) => schedule.status === 'active').length;
  }

  get dueSoonCount(): number {
    return this.schedules.filter((schedule) => this.isDueSoon(schedule)).length;
  }

  get filteredSchedules(): RecurringDonationSchedule[] {
    const query = this.tableSearch.trim().toLowerCase();
    if (!query) {
      return this.schedules;
    }
    return this.schedules.filter((schedule) =>
      [schedule.frequency, schedule.status, String(schedule.amount)].join(' ').toLowerCase().includes(query)
    );
  }

  isDueSoon(schedule: RecurringDonationSchedule): boolean {
    if (schedule.status !== 'active' || !schedule.next_run_on) {
      return false;
    }
    const days = Math.ceil((new Date(schedule.next_run_on).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days <= 7;
  }

  load(): void {
    this.schedulesLoaded = false;
    refreshStewardshipView(this.cdr);
    this.donationsService.getRecurringSchedules().subscribe({
      next: (res) => {
        this.schedules = res.data?.data ?? [];
        this.schedulesLoaded = true;
        refreshStewardshipView(this.cdr);
      },
      error: () => {
        this.schedules = [];
        this.schedulesLoaded = true;
        refreshStewardshipView(this.cdr);
      }
    });
  }

  openCreateForm(): void {
    this.showForm = true;
    this.form.patchValue({
      amount: null,
      frequency: 'monthly',
      next_run_on: new Date().toISOString().slice(0, 10),
      status: 'active'
    });
    refreshStewardshipView(this.cdr);
    setTimeout(() => document.getElementById('recurring-amount')?.focus(), 0);
  }

  closeForm(): void {
    if (this.saving) {
      return;
    }
    this.showForm = false;
    refreshStewardshipView(this.cdr);
  }

  save(): void {
    if (this.form.invalid) {
      return;
    }
    this.saving = true;
    refreshStewardshipView(this.cdr);
    const raw = this.form.getRawValue();
    const payload: Record<string, unknown> = { ...raw };
    if (!payload['donor_id']) delete payload['donor_id'];
    if (!payload['donation_category_id']) delete payload['donation_category_id'];
    this.donationsService.createRecurringSchedule(payload).subscribe({
      next: () => {
        this.saving = false;
        this.form.patchValue({ amount: null });
        this.showForm = false;
        this.load();
      },
      error: () => {
        this.saving = false;
        refreshStewardshipView(this.cdr);
      }
    });
  }

  runDue(): void {
    this.running = true;
    refreshStewardshipView(this.cdr);
    this.donationsService.runDueRecurringSchedules().subscribe({
      next: () => {
        this.running = false;
        this.load();
      },
      error: () => {
        this.running = false;
        refreshStewardshipView(this.cdr);
      }
    });
  }

  pause(id: string): void {
    this.donationsService.pauseRecurringSchedule(id).subscribe({ next: () => this.load() });
  }

  cancel(id: string): void {
    this.donationsService.cancelRecurringSchedule(id).subscribe({ next: () => this.load() });
  }
}
