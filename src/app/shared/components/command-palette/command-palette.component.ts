import { CommonModule } from '@angular/common';
import { Component, DestroyRef, HostListener, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, of, Subject, switchMap } from 'rxjs';
import { FamilyService } from '@core/services/family.service';
import { Family } from '@core/models/family.model';
import { AuthService } from '@core/services/auth.service';
import { CommandPaletteService } from '@shared/services/command-palette.service';
import { QuickCollectService } from '@features/donations/services/quick-collect.service';
import { DonationsService } from '@features/donations/services/donations.service';
import { SubscriptionAccessService } from '@core/services/subscription-access.service';
import { SupportSessionService } from '@features/support-center/services/support-session.service';
import { FinancialAiResponse, FinancialGlobalSearchResult, FinancialSearchResultItem } from '@features/donations/models/donation.model';


@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="palette-backdrop" *ngIf="isOpen" (click)="close()"></div>
    <section class="command-palette cf-panel" *ngIf="isOpen" role="dialog" aria-label="Command center">
      <header class="palette-header">
        <input
          #queryInput
          type="search"
          [(ngModel)]="query"
          (ngModelChange)="onQueryChange($event)"
          placeholder="Find a family, collect payment, search records, or ask a question…"
          autocomplete="off"
        />
        <span class="hint">Ctrl+K · Esc close · Enter to run highlighted action</span>
      </header>

      <div class="results">
        <ng-container *ngIf="!query.trim() || filteredActions.length">
          <p class="group-label">Quick actions</p>
          <button type="button" class="result-btn" *ngFor="let action of filteredActions" (click)="runAction(action.id)">
            <strong>{{ action.label }}</strong>
            <span>{{ action.description }}</span>
          </button>
        </ng-container>

        <ng-container *ngIf="query.length >= 2">
          <p class="group-label">Families</p>
          <button type="button" class="result-btn" *ngFor="let family of families" (click)="openFamily(family)">
            <strong>{{ family.family_name }}</strong>
            <span>{{ family.family_code }} · {{ family.head_of_family || 'Family' }}</span>
          </button>
          <p *ngIf="!families.length" class="empty">No families match.</p>
        </ng-container>

        <ng-container *ngIf="canSearchFinancial && query.length >= 2">
          <p class="group-label">Financial records</p>
          <p *ngIf="searchLoading" class="empty">Searching…</p>
          <ng-container *ngFor="let group of searchGroups">
            <p class="subgroup-label">{{ group.label }}</p>
            <button type="button" class="result-btn" *ngFor="let item of group.items" (click)="openSearchItem(item)">
              <strong>{{ item.title }}</strong>
              <span>{{ item.subtitle || item.type }}</span>
            </button>
          </ng-container>
          <p *ngIf="!searchLoading && !searchGroups.length" class="empty">No financial records match.</p>
        </ng-container>
      </div>

      <footer class="palette-footer">
        <button type="button" class="cf-btn cf-btn-primary palette-ai" (click)="runAiQuery()" [disabled]="aiLoading || !query.trim()">
          {{ aiLoading ? 'Analyzing…' : 'Ask Financial Assistant' }}
        </button>
        <article *ngIf="aiResponse" class="ai-answer">
          <span class="cf-engine-badge" [class.cf-engine-badge--llm]="aiResponse.engine === 'llm_v1'" [class.cf-engine-badge--semantic]="aiResponse.engine !== 'llm_v1'">
            {{ aiResponse.engine === 'llm_v1' ? 'LLM Enhanced' : 'Semantic' }}
          </span>
          <p>{{ aiResponse.answer }}</p>
          <ul *ngIf="aiResponse.recommended_actions?.length">
            <li *ngFor="let step of aiResponse.recommended_actions">{{ step }}</li>
          </ul>
        </article>
      </footer>
    </section>
  `,
  styles: [`
    .palette-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5); z-index: 1300; }
    .command-palette {
      position: fixed; top: 10vh; left: 50%; transform: translateX(-50%); width: min(720px, calc(100vw - 2rem));
      z-index: 1301; overflow: hidden; padding: 0; box-shadow: var(--cf-shadow-lg);
    }
    .palette-header { padding: 1rem; border-bottom: 1px solid var(--cf-panel-border); display: grid; gap: 0.35rem; }
    .palette-header input { width: 100%; border: 0; font-size: 1rem; outline: none; background: transparent; color: var(--cf-slate-900); }
    .hint { color: var(--cf-muted); font-size: 0.78rem; }
    .results { max-height: 380px; overflow: auto; padding: 0.65rem; display: grid; gap: 0.35rem; }
    .result-btn { text-align: left; border: 1px solid var(--cf-panel-border); background: var(--cf-panel-bg); border-radius: var(--cf-radius-sm); padding: 0.65rem 0.75rem; cursor: pointer; display: grid; gap: 0.15rem; width: 100%; }
    .result-btn:hover { background: var(--cf-indigo-soft); border-color: var(--cf-indigo-soft); }
    .result-btn span, .empty { color: var(--cf-muted); font-size: 0.85rem; }
    .group-label { margin: 0.35rem 0.15rem 0; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; font-size: 0.72rem; color: var(--cf-slate-700); }
    .subgroup-label { margin: 0.15rem 0.15rem 0; font-size: 0.78rem; color: var(--cf-muted); }
    .palette-footer { padding: 0.85rem 1rem 1rem; border-top: 1px solid var(--cf-panel-border); background: var(--cf-slate-50); display: grid; gap: 0.65rem; }
    .palette-ai { width: 100%; }
    .ai-answer { padding: 0.75rem; border-radius: var(--cf-radius-sm); background: var(--cf-panel-bg); border: 1px solid var(--cf-panel-border); }
    .ai-answer ul { margin: 0.5rem 0 0; padding-left: 1.1rem; color: var(--cf-slate-700); }
  `]
})
export class CommandPaletteComponent implements OnInit {
  private readonly paletteService = inject(CommandPaletteService);
  private readonly quickCollectService = inject(QuickCollectService);
  private readonly donationsService = inject(DonationsService);
  private readonly familyService = inject(FamilyService);
  private readonly authService = inject(AuthService);
  private readonly subscriptionAccess = inject(SubscriptionAccessService);
  private readonly supportSessions = inject(SupportSessionService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly search$ = new Subject<string>();
  private readonly financialSearch$ = new Subject<string>();

  isOpen = false;
  query = '';
  families: Family[] = [];
  searchGroups: FinancialGlobalSearchResult['groups'] = [];
  searchLoading = false;
  aiLoading = false;
  aiResponse: FinancialAiResponse | null = null;

  readonly actions = [
    { id: 'collect', label: 'Quick Collect', description: 'Record a family payment', donations: true },
    { id: 'collection-day', label: 'Collection Day', description: 'Full-screen mode for busy collection days', donations: true },
    { id: 'dashboard', label: 'Financial Dashboard', description: 'Open stewardship overview', donations: true },
    { id: 'families', label: 'Browse Families', description: 'Open family directory', donations: false },
    { id: 'payments', label: 'Payments Register', description: 'View payment ledger', donations: true },
    { id: 'receipts', label: 'Receipts Hub', description: 'Search and reprint receipts', donations: true }
  ];

  get canSearchFinancial(): boolean {
    return this.authService.canAccessDonations(undefined, {
      hasActiveSupportSession: !!this.supportSessions.sessionId,
    });
  }

  get filteredActions() {
    const q = this.query.trim().toLowerCase();
    const canDonations = this.authService.canAccessDonations(undefined, {
      hasActiveSupportSession: !!this.supportSessions.sessionId,
    });
    const readOnly = this.subscriptionAccess.isReadOnly();
    return this.actions.filter((action) => {
      if (readOnly && (action.id === 'collect' || action.id === 'collection-day')) {
        return false;
      }
      if (action.donations && !canDonations) {
        return false;
      }
      if (!q) {
        return true;
      }
      return action.label.toLowerCase().includes(q) || action.description.toLowerCase().includes(q);
    });
  }

  ngOnInit(): void {
    this.paletteService.open$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.isOpen = true;
      this.aiResponse = null;
    });

    this.search$.pipe(
      debounceTime(180),
      distinctUntilChanged(),
      switchMap((query) => {
        if (query.trim().length < 2) {
          return of({ data: [] as Family[] });
        }
        return this.familyService.getFamilies({ search: query.trim(), status: 'active', per_page: 8 });
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((response) => {
      this.families = response?.data ?? [];
    });

    this.financialSearch$.pipe(
      debounceTime(180),
      distinctUntilChanged(),
      switchMap((query) => {
        if (!this.canSearchFinancial || query.trim().length < 2) {
          this.searchLoading = false;
          return of({ success: true, data: { query: '', groups: [], total: 0 } });
        }
        this.searchLoading = true;
        return this.donationsService.searchFinancialEntities(query.trim());
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((response) => {
      this.searchGroups = response?.data?.groups ?? [];
      this.searchLoading = false;
    });
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.isOpen ? this.close() : this.open();
      return;
    }
    if (event.key === 'Escape' && this.isOpen) {
      this.close();
    }
  }

  open(): void {
    this.isOpen = true;
    this.query = '';
    this.aiResponse = null;
    this.searchGroups = [];
  }

  close(): void {
    this.isOpen = false;
    this.searchGroups = [];
  }

  onQueryChange(value: string): void {
    this.search$.next(value);
    if (this.canSearchFinancial) {
      this.financialSearch$.next(value);
    }
  }

  runAction(actionId: string): void {
    this.close();
    switch (actionId) {
      case 'collect':
        this.quickCollectService.open();
        break;
      case 'collection-day':
        this.router.navigate(['/donations/collection-day']);
        break;
      case 'dashboard':
        this.router.navigate(['/donations']);
        break;
      case 'families':
        this.router.navigate(['/families']);
        break;
      case 'payments':
        this.router.navigate(['/donations/payments']);
        break;
      case 'receipts':
        this.router.navigate(['/donations/receipts']);
        break;
    }
  }

  openFamily(family: Family): void {
    this.close();
    this.router.navigate(['/families', family.id]);
  }

  openSearchItem(item: FinancialSearchResultItem): void {
    this.close();
    if (item.type === 'family') {
      void this.router.navigate(['/families', item.id]);
      return;
    }
    void this.router.navigateByUrl(item.route);
  }

  runAiQuery(): void {
    if (!this.query.trim()) {
      return;
    }
    this.aiLoading = true;
    this.donationsService.askFinancialAssistant(this.query.trim()).subscribe({
      next: (res) => {
        this.aiResponse = res.data;
        this.aiLoading = false;
      },
      error: () => {
        this.aiLoading = false;
        this.aiResponse = { intent: 'error', answer: 'Unable to process the request right now.' };
      }
    });
  }
}
