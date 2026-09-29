import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BCCService } from '@core/services/bcc.service';
import { DonationsService } from '../services/donations.service';
import { restoreActiveElement, saveActiveElement, trapFocus } from '@shared/utils/focus-trap.util';
import { catchError, of } from 'rxjs';
import { DashboardDateRangeValue, DashboardPeriodPreset } from './dashboard-date-range.component';

type DrawerDateMode = '' | 'ytd' | 'custom';
type DrawerFilterChipKey = 'ytd' | 'custom' | 'bcc' | 'project';

@Component({
  selector: 'app-donations-dashboard-filter-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      *ngIf="isOpen"
      class="drawer-backdrop animate-fade-in"
      (click)="onClose()"
      aria-hidden="true"
    ></div>

    <div
      #drawerRef
      class="filter-drawer"
      [class.open]="isOpen"
      role="dialog"
      aria-modal="true"
      aria-labelledby="donations-dashboard-filter-title"
    >
      <header class="filter-drawer__header">
        <div class="filter-drawer__heading">
          <h2 id="donations-dashboard-filter-title" class="filter-drawer__title">Filters</h2>
          <span
            *ngIf="appliedFilterChips.length"
            class="cf-badge cf-badge--info filter-drawer__count"
            aria-live="polite"
          >
            {{ appliedFilterChips.length }} active
          </span>
        </div>
        <button
          type="button"
          class="filter-drawer__close"
          (click)="onClose()"
          aria-label="Close filters"
        >
          <svg viewBox="0 0 24 24" class="cf-icon-sm" aria-hidden="true" focusable="false">
            <path
              d="M6 6l12 12M18 6L6 18"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </header>

      <div class="filter-drawer__body">
        <div class="filter-drawer__group">
          <p class="filter-drawer__group-caption">Date filters</p>

          <div class="filter-drawer__field" [class.is-active]="draftMode === 'ytd'">
            <label class="filter-drawer__checkbox">
              <input
                type="radio"
                name="dash-filter-date-mode"
                value="ytd"
                [checked]="draftMode === 'ytd'"
                (change)="selectYtd()"
              />
              <span class="filter-drawer__checkbox-label">Year to date</span>
            </label>
            <p class="filter-drawer__hint cf-meta">
              January 1 through today in your parish timezone.
            </p>
          </div>
        </div>

        <div class="filter-drawer__group">
          <p class="filter-drawer__group-caption">Custom date range</p>
          <p class="filter-drawer__hint cf-meta">
            Choose start and end dates. Collections, participation, and trends use this range.
          </p>

          <div class="filter-drawer__field" [class.is-active]="!!draftFrom">
            <label for="dash-custom-from" class="filter-drawer__label">
              From
              <span *ngIf="draftFrom" class="filter-drawer__active-dot" aria-hidden="true"></span>
            </label>
            <input
              id="dash-custom-from"
              type="date"
              class="filter-drawer__input"
              name="date_from"
              [ngModel]="draftFrom"
              (ngModelChange)="onCustomFromChange($event)"
            />
          </div>

          <div class="filter-drawer__field" [class.is-active]="!!draftTo">
            <label for="dash-custom-to" class="filter-drawer__label">
              To
              <span *ngIf="draftTo" class="filter-drawer__active-dot" aria-hidden="true"></span>
            </label>
            <input
              id="dash-custom-to"
              type="date"
              class="filter-drawer__input"
              name="date_to"
              [ngModel]="draftTo"
              (ngModelChange)="onCustomToChange($event)"
            />
          </div>

          <p class="filter-drawer__validation" *ngIf="draftMode === 'custom' && draftFrom && draftTo && !customValid" role="alert">
            Start date must be on or before the end date.
          </p>
        </div>

        <div class="filter-drawer__group">
          <p class="filter-drawer__group-caption">BCC / Community</p>
          <div class="filter-drawer__field" [class.is-active]="!!draftBccId">
            <label for="dash-filter-bcc" class="filter-drawer__label">
              BCC
              <span *ngIf="draftBccId" class="filter-drawer__active-dot" aria-hidden="true"></span>
            </label>
            <select
              id="dash-filter-bcc"
              class="filter-drawer__input"
              name="bcc_id"
              [(ngModel)]="draftBccId"
              [disabled]="bccLoading"
            >
              <option value="">All BCC / communities</option>
              <option value="unassigned">Unassigned Area</option>
              <option *ngFor="let bcc of bccOptions" [value]="bcc.id">{{ bcc.name }}</option>
            </select>
            <p class="filter-drawer__hint cf-meta" *ngIf="bccLoading">Loading BCCs…</p>
          </div>
        </div>

        <div class="filter-drawer__group">
          <p class="filter-drawer__group-caption">Project funding</p>
          <div class="filter-drawer__field" [class.is-active]="!!draftProjectId">
            <label for="dash-filter-project" class="filter-drawer__label">
              Project
              <span *ngIf="draftProjectId" class="filter-drawer__active-dot" aria-hidden="true"></span>
            </label>
            <select
              id="dash-filter-project"
              class="filter-drawer__input"
              name="project_id"
              [(ngModel)]="draftProjectId"
              [disabled]="projectLoading"
            >
              <option value="">All projects</option>
              <option *ngFor="let project of projectOptions" [value]="project.id">{{ project.name }}</option>
            </select>
            <p class="filter-drawer__hint cf-meta" *ngIf="projectLoading">Loading projects…</p>
          </div>
        </div>
      </div>

      <div *ngIf="appliedFilterChips.length" class="filter-drawer__applied">
        <div class="filter-drawer__applied-head">
          <span class="filter-drawer__applied-label">Applied filters</span>
          <button type="button" class="cf-btn-text filter-drawer__clear" (click)="onReset()">
            Clear all
          </button>
        </div>
        <div class="filter-drawer__chips">
          <span
            class="cf-badge cf-badge--info filter-drawer__chip"
            *ngFor="let chip of appliedFilterChips"
          >
            {{ chip.label }}
            <button
              type="button"
              class="filter-drawer__chip-remove"
              (click)="removeAppliedFilter(chip.key)"
              [attr.aria-label]="chip.removeAriaLabel"
            >
              ×
            </button>
          </span>
        </div>
      </div>

      <footer class="filter-drawer__footer">
        <button type="button" class="cf-btn filter-drawer__reset" (click)="onReset()">
          Reset
        </button>
        <button
          type="button"
          class="cf-btn cf-btn-primary"
          [disabled]="!canApply"
          (click)="onApply()"
        >
          Apply Filters
        </button>
      </footer>
    </div>
  `,
  styleUrl: '../../../shared/components/advanced-search-panel/advanced-search-panel.component.scss',
  styles: [
    `
      .filter-drawer__hint {
        margin: 0.35rem 0 0;
        font-size: 0.78rem;
        line-height: 1.4;
      }
      .filter-drawer__group .filter-drawer__hint.cf-meta:first-of-type {
        margin-bottom: 0.85rem;
      }
      .filter-drawer__validation {
        margin: 0.5rem 0 0;
        font-size: 0.78rem;
        color: var(--cf-color-danger, #b42318);
      }
    `,
  ],
})
export class DonationsDashboardFilterDrawerComponent implements OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly bccService = inject(BCCService);
  private readonly donationsService = inject(DonationsService);

  @Input() isOpen = false;
  @Input() appliedPreset: DashboardPeriodPreset = 'this_month';
  @Input() appliedCustomFrom = '';
  @Input() appliedCustomTo = '';
  @Input() appliedBccId = '';
  @Input() appliedBccName = '';
  @Input() appliedProjectId = '';
  @Input() appliedProjectName = '';

  @Output() readonly close = new EventEmitter<void>();
  @Output() readonly apply = new EventEmitter<DashboardDateRangeValue>();
  @Output() readonly reset = new EventEmitter<void>();

  @ViewChild('drawerRef') drawerRef?: ElementRef<HTMLElement>;

  draftMode: DrawerDateMode = '';
  draftFrom = '';
  draftTo = '';
  draftBccId = '';
  draftProjectId = '';
  bccOptions: Array<{ id: string; name: string }> = [];
  projectOptions: Array<{ id: string; name: string }> = [];
  bccLoading = false;
  projectLoading = false;

  private previousActiveElement: HTMLElement | null = null;
  private focusTrapCleanup: (() => void) | null = null;
  private bccOptionsLoaded = false;
  private projectOptionsLoaded = false;

  get customValid(): boolean {
    return !!this.draftFrom && !!this.draftTo && this.draftFrom <= this.draftTo;
  }

  get canApply(): boolean {
    if (this.draftMode === 'ytd') {
      return true;
    }
    if (this.draftMode === 'custom') {
      return this.customValid;
    }
    if (this.draftBccId !== (this.appliedBccId ?? '')) {
      return true;
    }
    if (this.draftProjectId !== (this.appliedProjectId ?? '')) {
      return true;
    }
    return false;
  }

  get appliedFilterChips(): Array<{ key: DrawerFilterChipKey; label: string; removeAriaLabel: string }> {
    const chips: Array<{ key: DrawerFilterChipKey; label: string; removeAriaLabel: string }> = [];
    if (this.appliedPreset === 'ytd') {
      chips.push({
        key: 'ytd',
        label: 'Year to date',
        removeAriaLabel: 'Remove filter: Year to date'
      });
    }
    if (this.appliedPreset === 'custom') {
      const rangeLabel =
        this.appliedCustomFrom && this.appliedCustomTo
          ? `Custom range: ${this.appliedCustomFrom} – ${this.appliedCustomTo}`
          : 'Custom range';
      chips.push({
        key: 'custom',
        label: rangeLabel,
        removeAriaLabel: 'Remove filter: Custom date range'
      });
    }
    if (this.appliedBccId) {
      chips.push({
        key: 'bcc',
        label: `BCC: ${this.appliedBccName || 'Selected community'}`,
        removeAriaLabel: 'Remove filter: BCC'
      });
    }
    if (this.appliedProjectId && this.appliedProjectName) {
      chips.push({
        key: 'project',
        label: `Project: ${this.appliedProjectName}`,
        removeAriaLabel: 'Remove filter: Project funding'
      });
    }
    return chips;
  }

  removeAppliedFilter(key: DrawerFilterChipKey): void {
    const payload = this.buildApplyPayload();
    if (!payload) {
      return;
    }
    if (key === 'bcc') {
      payload.bcc_id = null;
    } else if (key === 'project') {
      payload.project_id = null;
    } else if (key === 'ytd') {
      payload.preset = 'this_month';
    } else if (key === 'custom') {
      payload.preset = 'this_month';
    }
    this.apply.emit(payload);
    this.close.emit();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true) {
      this.syncDraftFromApplied();
      this.loadBccOptions();
      this.loadProjectOptions();
      this.onDrawerOpened();
      setTimeout(() => this.cdr.markForCheck(), 0);
    }
    if (changes['isOpen']?.currentValue === false) {
      this.onDrawerClosed();
    }
  }

  ngOnDestroy(): void {
    this.releaseFocusTrap();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen) {
      this.onClose();
    }
  }

  selectYtd(): void {
    this.draftMode = 'ytd';
    this.draftFrom = '';
    this.draftTo = '';
    this.cdr.markForCheck();
  }

  onCustomFromChange(value: string): void {
    this.draftFrom = value;
    this.draftMode = 'custom';
    this.cdr.markForCheck();
  }

  onCustomToChange(value: string): void {
    this.draftTo = value;
    this.draftMode = 'custom';
    this.cdr.markForCheck();
  }

  onClose(): void {
    this.close.emit();
  }

  onApply(): void {
    const payload = this.buildApplyPayload();
    if (!payload || !this.canApply) {
      return;
    }
    this.apply.emit(payload);
    this.close.emit();
  }

  onReset(): void {
    this.draftMode = '';
    this.draftFrom = '';
    this.draftTo = '';
    this.draftBccId = '';
    this.draftProjectId = '';
    if (this.appliedPreset === 'custom' || this.appliedPreset === 'ytd' || this.appliedBccId || this.appliedProjectId) {
      this.reset.emit();
    }
    this.close.emit();
    this.cdr.markForCheck();
  }

  private buildApplyPayload(): DashboardDateRangeValue | null {
    let preset = this.appliedPreset;
    let dateFrom = this.appliedCustomFrom;
    let dateTo = this.appliedCustomTo;

    if (this.draftMode === 'ytd') {
      preset = 'ytd';
      dateFrom = '';
      dateTo = '';
    } else if (this.draftMode === 'custom' && this.customValid) {
      preset = 'custom';
      dateFrom = this.draftFrom;
      dateTo = this.draftTo;
    }

    const payload: DashboardDateRangeValue = {
      preset,
      bcc_id: this.draftBccId || null,
      project_id: this.draftProjectId || null,
      project_name: this.draftProjectId ? this.projectLabelForId(this.draftProjectId) : null
    };
    if (preset === 'custom') {
      payload.date_from = dateFrom;
      payload.date_to = dateTo;
    }
    return payload;
  }

  private projectLabelForId(projectId: string): string | null {
    const match = this.projectOptions.find((project) => project.id === projectId);
    if (match?.name) {
      return match.name;
    }
    if (projectId && projectId === this.appliedProjectId && this.appliedProjectName) {
      return this.appliedProjectName;
    }
    return null;
  }

  private loadProjectOptions(): void {
    if (this.projectOptionsLoaded) {
      return;
    }
    this.projectLoading = true;
    this.donationsService
      .getProjects()
      .pipe(catchError(() => of({ data: [] })))
      .subscribe((response) => {
        this.projectOptions = (response.data ?? [])
          .filter((project) => project.status === 'active' || project.status === 'completed')
          .map((project) => ({
            id: String(project.id),
            name: project.name
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        this.projectOptionsLoaded = true;
        this.projectLoading = false;
        this.cdr.markForCheck();
      });
  }

  private loadBccOptions(): void {
    if (this.bccOptionsLoaded) {
      return;
    }
    this.bccLoading = true;
    this.bccService
      .getBCCs({ status: 'active', per_page: 500, sort_by: 'name', sort_order: 'asc' })
      .pipe(catchError(() => of({ data: [] })))
      .subscribe((response) => {
        this.bccOptions = (response.data ?? []).map((bcc) => ({
          id: String(bcc.id),
          name: bcc.name
        }));
        this.bccOptionsLoaded = true;
        this.bccLoading = false;
        this.cdr.markForCheck();
      });
  }

  private syncDraftFromApplied(): void {
    if (this.appliedPreset === 'ytd') {
      this.draftMode = 'ytd';
      this.draftFrom = '';
      this.draftTo = '';
      this.draftBccId = this.appliedBccId ?? '';
      this.draftProjectId = this.appliedProjectId ?? '';
      return;
    }
    if (this.appliedPreset === 'custom') {
      this.draftMode = 'custom';
      this.draftFrom = this.appliedCustomFrom;
      this.draftTo = this.appliedCustomTo;
      this.draftBccId = this.appliedBccId ?? '';
      this.draftProjectId = this.appliedProjectId ?? '';
      return;
    }
    this.draftMode = '';
    this.draftFrom = '';
    this.draftTo = '';
    this.draftBccId = this.appliedBccId ?? '';
    this.draftProjectId = this.appliedProjectId ?? '';
  }

  private onDrawerOpened(): void {
    this.previousActiveElement = saveActiveElement();
    setTimeout(() => {
      if (this.isOpen && this.drawerRef?.nativeElement) {
        this.releaseFocusTrap(false);
        this.focusTrapCleanup = trapFocus(this.drawerRef.nativeElement);
      }
    }, 0);
  }

  private onDrawerClosed(): void {
    this.releaseFocusTrap();
  }

  private releaseFocusTrap(restore = true): void {
    this.focusTrapCleanup?.();
    this.focusTrapCleanup = null;
    if (restore) {
      restoreActiveElement(this.previousActiveElement);
      this.previousActiveElement = null;
    }
  }
}
