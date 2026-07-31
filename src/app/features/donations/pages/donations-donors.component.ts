import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { DonationsService } from '../services/donations.service';
import { QuickCollectService } from '../services/quick-collect.service';
import { Donor } from '../models/donation.model';

@Component({
  selector: 'app-donations-donors',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, CfEmptyStateComponent, LoadingSkeletonComponent],
  template: `
    <section class="donors cf-page">
      <header class="cf-hero">
        <h1>Donors & Supporters</h1>
        <p>Know who gives — thank them, reach them, and link gifts to families.</p>
      </header>

      <div class="donors-loading cf-panel" *ngIf="!donorsLoaded" role="status" aria-live="polite" aria-busy="true">
        <p class="donors-loading__label">Loading donors…</p>
        <app-loading-skeleton type="table" [rows]="5" [columns]="4"></app-loading-skeleton>
      </div>

      <ng-container *ngIf="donorsLoaded">
      <div class="cf-decision-strip" role="region" aria-label="Suggested next step" *ngIf="!donorsLoadError && donors.length">
        <div class="cf-decision-strip__copy">
          <strong>{{ donors.length }} donor{{ donors.length === 1 ? '' : 's' }} · {{ reachableCount }} reachable</strong>
          <span>{{ donorDecisionHint }}</span>
        </div>
        <div class="cf-decision-strip__actions">
          <button type="button" class="cf-btn cf-btn-primary" (click)="openQuickCollect()">Collect Payment</button>
          <a routerLink="/donations/register" class="cf-btn">Record offering</a>
        </div>
      </div>

      <details class="cf-disclosure" role="group" *ngIf="canManage" [attr.open]="showForm ? true : null">
        <summary class="cf-disclosure__trigger" (click)="showForm = true">
          <strong>Add donor</strong>
          <span>For walk-in, external, or organizational supporters</span>
        </summary>
        <div class="cf-disclosure__body">
          <form [formGroup]="form" (ngSubmit)="save()" class="cf-form-grid">
            <input formControlName="name" placeholder="Donor name" />
            <input formControlName="email" placeholder="Email" />
            <input formControlName="phone" placeholder="Phone" />
            <select formControlName="donor_type">
              <option value="external">External supporter</option>
              <option value="individual">Individual</option>
              <option value="family">Family-linked</option>
              <option value="organization">Organization</option>
            </select>
            <button type="submit" class="cf-btn cf-btn-primary" [disabled]="form.invalid || saving">{{ saving ? 'Saving…' : 'Save donor' }}</button>
          </form>
        </div>
      </details>

      <div class="cf-filters cf-panel" *ngIf="donors.length">
        <input type="search" [(ngModel)]="tableSearch" placeholder="Search name, email, phone…" />
      </div>

      <table class="table cf-table" *ngIf="filteredDonors.length">
        <thead><tr><th>Name</th><th>Type</th><th>Contact</th><th>Actions</th></tr></thead>
        <tbody>
          <tr *ngFor="let donor of filteredDonors">
            <td><strong>{{ donor.name }}</strong></td>
            <td>{{ donorTypeLabel(donor.donor_type) }}</td>
            <td>
              <span *ngIf="donor.email">{{ donor.email }}</span>
              <span *ngIf="donor.email && donor.phone"> · </span>
              <span *ngIf="donor.phone">{{ donor.phone }}</span>
              <span *ngIf="!donor.email && !donor.phone" class="cf-state">No contact info</span>
            </td>
            <td>
              <a *ngIf="donor.family_id" [routerLink]="['/families', donor.family_id]" class="cf-link">View family</a>
            </td>
          </tr>
        </tbody>
      </table>

      <p *ngIf="donors.length && !filteredDonors.length" class="cf-state">No donors match your search.</p>

      <div class="donors-load-error cf-panel" *ngIf="donorsLoadError" role="alert">
        <p class="donors-load-error__text">{{ donorsLoadError }}</p>
        <button type="button" class="cf-btn cf-btn-primary" (click)="load()">Try again</button>
      </div>

      <app-cf-empty-state
        *ngIf="!donorsLoadError && !donors.length"
        icon="♡"
        title="No donors recorded yet"
        description="Donors are created automatically when you collect offerings — or add supporters manually here."
      >
        <button type="button" class="cf-btn cf-btn-primary" (click)="openQuickCollect()">Collect Payment</button>
        <button type="button" class="cf-btn" *ngIf="canManage" (click)="showForm = true">Add donor</button>
      </app-cf-empty-state>
      </ng-container>
    </section>
  `,
  styles: [`
    details summary { list-style: none; cursor: pointer; }
    details summary::-webkit-details-marker { display: none; }
    .donors-loading { display: grid; gap: 0.75rem; padding: 1rem; }
    .donors-loading__label { margin: 0; font-size: 0.88rem; color: var(--cf-muted); }
    .donors-load-error {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem;
      padding: 1rem; border-color: #fecaca; background: var(--cf-critical-soft);
    }
    .donors-load-error__text { margin: 0; color: var(--cf-critical); font-size: 0.9rem; }
  `]
})
export class DonationsDonorsComponent implements OnInit, OnDestroy {
  donors: Donor[] = [];
  donorsLoaded = false;
  donorsLoadError: string | null = null;
  private loadDonorsSeq = 0;
  private routerSub?: Subscription;
  private skipNextNavReload = true;
  tableSearch = '';
  showForm = false;
  saving = false;
  canManage = false;

  form = this.fb.group({
    name: ['', Validators.required],
    email: [''],
    phone: [''],
    donor_type: ['external']
  });

  constructor(
    private fb: FormBuilder,
    private donationsService: DonationsService,
    private authService: AuthService,
    private quickCollectService: QuickCollectService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.canManage = this.authService.hasPermission('donations.manage');
    this.load();
    this.routerSub = this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
      if (!e.urlAfterRedirects.includes('/donations/donors')) {
        return;
      }
      if (this.skipNextNavReload) {
        this.skipNextNavReload = false;
        return;
      }
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  get reachableCount(): number {
    return this.donors.filter((donor) => !!(donor.email || donor.phone)).length;
  }

  get donorDecisionHint(): string {
    const missingContact = this.donors.length - this.reachableCount;
    if (missingContact > 0) {
      return `${missingContact} donor${missingContact === 1 ? '' : 's'} missing contact info — add phone or email for thank-you outreach.`;
    }
    return 'Use contact details for stewardship thank-you messages and recurring gifts.';
  }

  get filteredDonors(): Donor[] {
    const query = this.tableSearch.trim().toLowerCase();
    if (!query) {
      return this.donors;
    }
    return this.donors.filter((donor) =>
      [donor.name, donor.email, donor.phone, donor.donor_type].filter(Boolean).join(' ').toLowerCase().includes(query)
    );
  }

  donorTypeLabel(type?: string): string {
    return ({
      external: 'External',
      individual: 'Individual',
      family: 'Family',
      organization: 'Organization'
    } as Record<string, string>)[type || 'external'] || type || '—';
  }

  openQuickCollect(): void {
    this.quickCollectService.open();
  }

  load(): void {
    const seq = ++this.loadDonorsSeq;
    this.donorsLoaded = false;
    this.donorsLoadError = null;
    this.donationsService.getDonors().subscribe({
      next: (res) => {
        if (seq !== this.loadDonorsSeq) {
          return;
        }
        const rows = Array.isArray(res.data?.data) ? res.data.data : [];
        this.donors = rows;
        this.donorsLoaded = true;
        this.cdr.detectChanges();
      },
      error: () => {
        if (seq !== this.loadDonorsSeq) {
          return;
        }
        this.donorsLoaded = true;
        this.donorsLoadError = 'Unable to load donors. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }

  save(): void {
    if (this.form.invalid) {
      return;
    }
    this.saving = true;
    this.donationsService.createDonor(this.form.getRawValue()).subscribe({
      next: () => {
        this.saving = false;
        this.form.reset({ donor_type: 'external' });
        this.showForm = false;
        this.load();
        this.cdr.detectChanges();
      },
      error: () => { this.saving = false; }
    });
  }
}
