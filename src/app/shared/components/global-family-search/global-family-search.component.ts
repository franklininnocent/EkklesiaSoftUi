import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, HostListener, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, of, Subject, switchMap } from 'rxjs';
import { DonationsService } from '@features/donations/services/donations.service';
import { FinancialGlobalSearchResult, FinancialSearchResultItem } from '@features/donations/models/donation.model';

@Component({
  selector: 'app-global-family-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="global-family-search" [class.open]="isOpen">
      <span class="search-icon" aria-hidden="true">⌕</span>
      <input
        #searchInput
        type="search"
        [(ngModel)]="query"
        (ngModelChange)="onQueryChange($event)"
        (focus)="openResults()"
        placeholder="Find family, receipt, project…"
        aria-label="Search financial records globally"
        autocomplete="off"
      />
      <kbd class="shortcut-hint" aria-hidden="true">/</kbd>

      <div class="results" *ngIf="isOpen && (resultGroups.length || loading || (query.length >= 2 && !loading))" role="listbox">
        <p *ngIf="loading" class="empty">Searching…</p>
        <ng-container *ngFor="let group of resultGroups">
          <p class="group-label">{{ group.label }}</p>
          <button
            type="button"
            class="result-item"
            *ngFor="let item of group.items; let i = index"
            [class.active]="flatIndex(group, i) === activeIndex"
            (mousedown)="selectItem(item)"
          >
            <strong>{{ item.title }}</strong>
            <span>{{ item.subtitle }}</span>
          </button>
        </ng-container>
        <p *ngIf="!loading && query.length >= 2 && !resultGroups.length" class="empty">No matches found.</p>
      </div>
    </div>
  `,
  styles: [`
    .global-family-search {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      min-width: 220px;
      max-width: 420px;
      width: 100%;
      border: 1px solid var(--cf-panel-border);
      border-radius: 999px;
      padding: 0.35rem 0.65rem;
      background: var(--cf-slate-50);
    }
    .global-family-search.open {
      border-color: var(--cf-primary);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
      background: var(--cf-panel-bg);
    }
    .search-icon { color: var(--cf-muted); font-size: 0.95rem; }
    input {
      border: 0;
      background: transparent;
      outline: none;
      width: 100%;
      font-size: 0.88rem;
      color: var(--topbar-text, #1f2937);
    }
    .shortcut-hint {
      font-size: 0.68rem;
      color: #6b7280;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      padding: 0.05rem 0.3rem;
      background: #fff;
    }
    .results {
      position: absolute;
      top: calc(100% + 0.35rem);
      left: 0;
      right: 0;
      margin: 0;
      padding: 0.35rem 0;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.12);
      max-height: 360px;
      overflow: auto;
      z-index: 50;
    }
    .group-label {
      margin: 0.35rem 0.75rem 0.15rem;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #6b7280;
    }
    .result-item {
      width: 100%;
      border: 0;
      background: transparent;
      text-align: left;
      padding: 0.55rem 0.75rem;
      cursor: pointer;
      display: grid;
      gap: 0.1rem;
    }
    .result-item.active,
    .result-item:hover { background: #eff6ff; }
    .result-item span { color: #6b7280; font-size: 0.78rem; }
    .empty { padding: 0.55rem 0.75rem; color: #6b7280; margin: 0; }
  `]
})
export class GlobalFamilySearchComponent {
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  private readonly donationsService = inject(DonationsService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly search$ = new Subject<string>();

  query = '';
  resultGroups: FinancialGlobalSearchResult['groups'] = [];
  flatItems: FinancialSearchResultItem[] = [];
  loading = false;
  isOpen = false;
  activeIndex = 0;

  constructor() {
    this.search$.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      switchMap((query) => {
        if (!query || query.trim().length < 2) {
          this.loading = false;
          return of({ success: true, data: { query: '', groups: [], total: 0 } });
        }
        this.loading = true;
        return this.donationsService.searchFinancialEntities(query.trim());
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((response) => {
      this.resultGroups = response?.data?.groups ?? [];
      this.flatItems = this.resultGroups.flatMap((group) => group.items);
      this.activeIndex = 0;
      this.loading = false;
    });
  }

  flatIndex(group: FinancialGlobalSearchResult['groups'][number], index: number): number {
    let offset = 0;
    for (const current of this.resultGroups) {
      if (current === group) {
        return offset + index;
      }
      offset += current.items.length;
    }
    return index;
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName?.toLowerCase();
    const isTyping = tag === 'input' || tag === 'textarea' || target?.isContentEditable;

    if (event.key === '/' && !isTyping) {
      event.preventDefault();
      this.searchInput?.nativeElement.focus();
      this.openResults();
      return;
    }

    if (!this.isOpen) {
      return;
    }

    if (event.key === 'Escape') {
      this.closeResults();
      this.searchInput?.nativeElement.blur();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex = Math.min(this.activeIndex + 1, Math.max(0, this.flatItems.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex = Math.max(this.activeIndex - 1, 0);
      return;
    }

    if (event.key === 'Enter' && this.flatItems[this.activeIndex]) {
      event.preventDefault();
      this.selectItem(this.flatItems[this.activeIndex]);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    const root = this.searchInput?.nativeElement.closest('.global-family-search');
    if (target && root && !root.contains(target)) {
      this.closeResults();
    }
  }

  onQueryChange(value: string): void {
    this.isOpen = true;
    this.search$.next(value);
  }

  openResults(): void {
    this.isOpen = true;
  }

  closeResults(): void {
    this.isOpen = false;
    this.activeIndex = 0;
  }

  selectItem(item: FinancialSearchResultItem): void {
    this.closeResults();
    this.query = '';
    this.resultGroups = [];
    this.flatItems = [];
    if (item.type === 'family') {
      void this.router.navigate(['/families', item.id]);
      return;
    }
    void this.router.navigateByUrl(item.route);
  }
}
