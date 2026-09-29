import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import {
  MassIntentionsApiService,
  MassIntentionsHomeSummary,
  MassIntentionsTrendPoint,
} from '../services/mass-intentions-api.service';
import {
  canConfigureMassIntentions,
  canCreateMassIntention,
  canExportMassRegister,
} from '../utils/mass-intentions-auth.util';

@Component({
  selector: 'app-mass-intentions-home-page',
  standalone: true,
  imports: [CommonModule, RouterModule, PageHeaderComponent, LoadingSkeletonComponent],
  template: `
    <div class="cf-page mass-dash">
      <app-page-header title="Mass intentions" [subtitle]="periodSubtitle()">
        @if (canCreate()) {
          <a
            routerLink="/mass-intentions/intentions"
            [queryParams]="{ create: '1' }"
            class="cf-btn cf-btn-primary"
          >
            New intention
          </a>
        }
        @if (canRegister()) {
          <a routerLink="/mass-intentions/reports" class="cf-btn">Reports</a>
        }
        @if (canConfigure()) {
          <a routerLink="/mass-intentions/settings" class="cf-btn">Settings</a>
        }
      </app-page-header>

      @if (loading()) {
        <app-loading-skeleton type="card" [rows]="4" />
      } @else if (loadError()) {
        <div class="cf-inline-alert cf-panel" role="alert">{{ loadError() }}</div>
      } @else if (summary(); as s) {
        <div class="cf-kpi-strip" aria-label="Mass intention snapshot">
          <a
            class="cf-kpi-card--executive"
            routerLink="/mass-intentions/intentions"
            [queryParams]="{ status: 'open' }"
            title="Open intentions"
          >
            <span class="cf-kpi-card__label">Open</span>
            <strong class="cf-kpi-card__value">{{ s.kpis?.open ?? s.queue.open }}</strong>
            <span class="cf-kpi-card__trend">Active on the register</span>
          </a>
          <a
            class="cf-kpi-card--executive"
            routerLink="/mass-intentions/intentions"
            [queryParams]="{ status: 'closed' }"
            title="Closed intentions"
          >
            <span class="cf-kpi-card__label">Closed</span>
            <strong class="cf-kpi-card__value">{{ s.kpis?.closed ?? s.queue.closed }}</strong>
            <span class="cf-kpi-card__trend">Finished or past scheduled day</span>
          </a>
          <article class="cf-kpi-card--executive" title="Registered this month">
            <span class="cf-kpi-card__label">Registered this month</span>
            <strong class="cf-kpi-card__value">{{ s.kpis?.intentions_registered_this_month ?? s.period.intentions_registered_this_month }}</strong>
            <span class="cf-kpi-card__trend">{{ lastMonthHint(s.kpis?.intentions_registered_last_month ?? s.period.intentions_registered_last_month) }}</span>
          </article>
        </div>

        <div class="mass-dash__grid">
          <section class="cf-panel mass-dash__queue" aria-label="Quick actions">
            <h2 class="mass-dash__section-title">Office actions</h2>
            <nav class="cf-decision-strip mass-dash__workspace" aria-label="Mass intention workspace">
              <div class="cf-decision-strip__copy">
                <strong>Parish office register</strong>
                <span>Record intentions when someone visits the office. Open through the scheduled day, then close automatically.</span>
              </div>
              <div class="cf-decision-strip__actions">
                @if (canCreate()) {
                  <a
                    routerLink="/mass-intentions/intentions"
                    [queryParams]="{ create: '1' }"
                    class="cf-btn cf-btn-primary"
                  >
                    New intention
                  </a>
                }
                <a
                  routerLink="/mass-intentions/intentions"
                  [queryParams]="{ status: 'all' }"
                  class="cf-btn"
                >
                  All intentions
                </a>
                <a routerLink="/mass-intentions/masses" class="cf-btn">Masses</a>
                @if (canRegister()) {
                  <a routerLink="/mass-intentions/reports" class="cf-btn">Reports</a>
                }
                @if (canConfigure()) {
                  <a routerLink="/mass-intentions/audit" class="cf-btn">Audit</a>
                }
              </div>
            </nav>
            @if (!canCreate()) {
              <p class="mass-dash__muted">
                You can view intentions but need the <strong>Create Mass Intentions</strong> permission to add new records.
              </p>
            }
          </section>

          <section class="cf-panel" aria-label="Last six months">
            <h2 class="mass-dash__section-title">Last six months</h2>
            @if (trendPoints().length === 0) {
              <p class="mass-dash__muted">No month-by-month activity yet.</p>
            } @else {
              <ul class="mass-dash__trend" role="list">
                @for (point of trendPoints(); track point.month) {
                  <li class="mass-dash__trend-row" [class.mass-dash__trend-row--current]="point.is_current">
                    <span class="mass-dash__trend-label">{{ point.label }}</span>
                    <span class="mass-dash__trend-bars" aria-hidden="true">
                      <span class="mass-dash__bar mass-dash__bar--registered" [style.width.%]="barWidth(point.registered ?? 0)"></span>
                      <span class="mass-dash__bar mass-dash__bar--closed" [style.width.%]="barWidth(point.closed ?? 0)"></span>
                    </span>
                    <span class="mass-dash__trend-nums">
                      {{ point.registered }} registered · {{ point.closed }} closed
                    </span>
                  </li>
                }
              </ul>
            }
          </section>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .mass-dash {
        display: grid;
        gap: var(--cf-space-4);
      }
      .mass-dash .cf-kpi-strip {
        margin: 0;
      }
      .mass-dash .cf-kpi-card--executive {
        text-decoration: none;
        color: inherit;
        min-height: var(--cf-touch-target);
      }
      .mass-dash__grid {
        display: grid;
        gap: var(--cf-space-4);
        grid-template-columns: 1fr;
      }
      @media (min-width: 56rem) {
        .mass-dash__grid {
          grid-template-columns: 1fr 1fr;
        }
      }
      .mass-dash__section-title {
        font-size: var(--cf-text-section-title);
        margin: 0 0 var(--cf-space-3);
        font-weight: 700;
      }
      .mass-dash__queue {
        padding: var(--cf-space-3);
        display: grid;
        gap: var(--cf-space-3);
      }
      .mass-dash__muted {
        font-size: var(--cf-text-sm);
        color: var(--cf-color-text-muted);
        margin: 0;
      }
      .mass-dash__workspace {
        margin: 0;
      }
      .mass-dash__trend {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: var(--cf-space-3);
      }
      .mass-dash__trend-row {
        display: grid;
        gap: var(--cf-space-1);
      }
      .mass-dash__trend-label {
        font-size: var(--cf-text-sm);
        font-weight: 600;
      }
      .mass-dash__trend-bars {
        display: grid;
        gap: 2px;
      }
      .mass-dash__bar {
        display: block;
        height: 0.45rem;
        border-radius: 999px;
        min-width: 0.35rem;
        background: var(--cf-slate-300, #cbd5e1);
      }
      .mass-dash__bar--registered {
        background: var(--cf-forest, #1b4332);
      }
      .mass-dash__bar--closed {
        background: var(--cf-slate-400, #94a3b8);
      }
      .mass-dash__trend-nums {
        font-size: var(--cf-text-xs);
        color: var(--cf-color-text-muted);
      }
      @media (max-width: 40rem) {
        .mass-dash .cf-kpi-strip {
          grid-auto-flow: row;
          grid-auto-columns: minmax(0, 1fr);
        }
      }
    `,
  ],
})
export class MassIntentionsHomePageComponent {
  private readonly api = inject(MassIntentionsApiService);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly summary = signal<MassIntentionsHomeSummary | null>(null);

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.getHome().subscribe({
      next: (res) => {
        this.summary.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set('Could not load the Mass intention dashboard.');
      },
    });
  }

  canCreate(): boolean {
    return canCreateMassIntention(this.auth);
  }

  canRegister(): boolean {
    return canExportMassRegister(this.auth);
  }

  canConfigure(): boolean {
    return canConfigureMassIntentions(this.auth);
  }

  periodSubtitle(): string {
    const label = this.summary()?.period.label;
    return label
      ? `Parish office register — ${label}`
      : 'Parish office register — open intentions and monthly activity.';
  }

  lastMonthHint(lastMonth: number | undefined): string {
    if (lastMonth === undefined) {
      return 'Compared with last month when available';
    }
    return `${lastMonth} last month`;
  }

  trendPoints(): MassIntentionsTrendPoint[] {
    return this.summary()?.trend ?? [];
  }

  barWidth(value: number): number {
    const max = Math.max(1, ...this.trendPoints().flatMap((p) => [p.registered ?? 0, p.closed ?? 0]));
    return Math.round((value / max) * 100);
  }
}
