import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CfCurrencyPipe } from '@shared/pipes/cf-currency.pipe';
import { PublicPlanCard, TaxBreakdown } from '../../models/subscription-admin.models';

interface ComparisonCard {
  plan: PublicPlanCard;
  previousName: string | null;
  newFeatures: { code: string; name: string }[];
  isCurrent: boolean;
  isRequested: boolean;
  hasHighlight: boolean;
}

/**
 * Side-by-side plan cards built only from the published public catalog.
 * Features are cumulative, so each card lists what it adds over the plan before it.
 */
@Component({
  selector: 'app-plan-comparison',
  standalone: true,
  imports: [CommonModule, CfCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="plan-compare" role="list">
      <article
        *ngFor="let card of cards(); trackBy: trackByCode"
        class="plan-compare__card"
        role="listitem"
        [class.plan-compare__card--current]="card.isCurrent"
        [class.plan-compare__card--featured]="card.plan.is_featured"
        [attr.data-plan]="card.plan.code"
        [attr.data-current]="card.isCurrent ? 'true' : null"
        [attr.aria-current]="card.isCurrent ? 'true' : null">
        <header class="plan-compare__head">
          <h3>{{ card.plan.name }}</h3>
          <span class="plan-compare__badge plan-compare__badge--current" *ngIf="card.isCurrent">Your Current Plan</span>
          <span class="plan-compare__badge plan-compare__badge--accent" *ngIf="!card.isCurrent && card.plan.badge_label">
            {{ card.plan.badge_label }}
          </span>
        </header>
        <p class="plan-compare__desc" *ngIf="card.plan.short_description">{{ card.plan.short_description }}</p>

        <div class="plan-compare__price" *ngIf="showCatalogPrice(card); else currentPrice">
          <p *ngIf="card.plan.monthly_price">
            <strong>{{ card.plan.monthly_price | cfCurrency: card.plan.currency_code : 0 }}</strong> / month
          </p>
          <p class="plan-compare__alt" *ngIf="card.plan.annual_price">
            or {{ card.plan.annual_price | cfCurrency: card.plan.currency_code : 0 }} / year
          </p>
          <p class="plan-compare__tax" *ngIf="taxNote(card.plan) as note">{{ note }}</p>
        </div>
        <ng-template #currentPrice>
          <div class="plan-compare__price">
            <p *ngIf="card.plan.is_lifetime"><strong>Lifetime</strong></p>
            <p *ngIf="card.plan.pricing_type === 'CUSTOM' && !card.plan.is_lifetime"><strong>Custom pricing</strong></p>
            <p class="plan-compare__alt" *ngIf="card.plan.is_lifetime">No end date</p>
          </div>
        </ng-template>

        <ul class="plan-compare__limits" *ngIf="card.plan.limits?.length">
          <li *ngFor="let limit of card.plan.limits">
            {{ limit.name }}: <strong>{{ limit.unlimited || limit.value === null ? 'Unlimited' : (limit.value | number) }}</strong>
          </li>
        </ul>

        <p class="plan-compare__includes">
          {{ card.previousName ? 'Everything in ' + card.previousName + ', plus:' : 'Includes:' }}
        </p>
        <ul class="plan-compare__features">
          <li
            *ngFor="let feature of card.newFeatures"
            [class.plan-compare__feature--highlight]="feature.code === highlightFeature()">
            {{ feature.name }}
          </li>
          <li *ngIf="!card.newFeatures.length" class="plan-compare__feature--muted">Higher limits</li>
        </ul>

        <p class="plan-compare__match" *ngIf="card.hasHighlight && !card.isCurrent">Includes what you asked about</p>

        <footer class="plan-compare__actions" *ngIf="selectable()">
          <span *ngIf="card.isCurrent" class="plan-compare__state">
            {{ currentPlanState(card.plan) }}
          </span>
          <span *ngIf="!card.isCurrent && card.isRequested" class="plan-compare__state">Request sent</span>
          <button
            *ngIf="!card.isCurrent && !card.isRequested && card.plan.primary_action !== 'current'"
            type="button"
            class="cf-btn"
            [class.cf-btn-primary]="card.plan.is_featured || card.hasHighlight"
            [class.cf-btn-secondary]="!(card.plan.is_featured || card.hasHighlight)"
            [disabled]="disabled()"
            (click)="choose.emit(card.plan)">
            {{ card.plan.primary_action === 'quote' || card.plan.pricing_type === 'CUSTOM' ? 'Ask for a quote' : 'Request this plan' }}
          </button>
        </footer>
      </article>
    </div>
  `,
  styles: [
    `
      .plan-compare {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
        gap: var(--spacing-md);
      }
      .plan-compare__card {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: var(--spacing-md);
        border: 1px solid var(--cf-panel-border, var(--gray-200));
        border-radius: var(--cf-radius, var(--radius-md));
        background: var(--cf-panel-bg, #fff);
      }
      .plan-compare__card--featured {
        border-color: color-mix(in srgb, var(--cf-primary, #2563eb) 45%, white);
      }
      .plan-compare__card--current {
        background: color-mix(in srgb, var(--cf-success, #15803d) 6%, white);
        border-color: color-mix(in srgb, var(--cf-success, #15803d) 40%, white);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--cf-success, #15803d) 18%, transparent);
      }
      .plan-compare__badge {
        font-size: var(--font-size-xs, 0.75rem);
        font-weight: 600;
        padding: 0.1rem 0.5rem;
        border-radius: 999px;
        background: var(--cf-slate-100, var(--gray-100));
      }
      .plan-compare__badge--current {
        background: color-mix(in srgb, var(--cf-success, #15803d) 16%, white);
        color: var(--cf-success, #15803d);
      }
      .plan-compare__head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
      }
      .plan-compare__head h3 {
        margin: 0;
        font-size: var(--cf-text-md, var(--font-size-lg));
      }
      .plan-compare__badge--accent {
        background: color-mix(in srgb, var(--cf-primary, #2563eb) 12%, white);
      }
      .plan-compare__desc,
      .plan-compare__alt,
      .plan-compare__tax,
      .plan-compare__includes {
        margin: 0;
        color: var(--cf-muted, var(--text-secondary));
        font-size: var(--cf-text-base, var(--font-size-sm));
      }
      .plan-compare__price p {
        margin: 0;
      }
      .plan-compare__price strong {
        font-size: var(--font-size-xl, 1.25rem);
      }
      .plan-compare__limits,
      .plan-compare__features {
        margin: 0;
        padding-left: 1.1rem;
        font-size: var(--cf-text-base, var(--font-size-sm));
      }
      .plan-compare__feature--highlight {
        font-weight: 700;
      }
      .plan-compare__feature--muted {
        color: var(--cf-muted, var(--text-secondary));
      }
      .plan-compare__match {
        margin: 0;
        font-weight: 600;
        color: var(--cf-success, #15803d);
        font-size: var(--cf-text-base, var(--font-size-sm));
      }
      .plan-compare__actions {
        margin-top: auto;
        padding-top: 0.5rem;
      }
      .plan-compare__state {
        font-weight: 600;
        color: var(--cf-muted, var(--text-secondary));
      }
    `,
  ],
})
export class PlanComparisonComponent {
  readonly plans = input<PublicPlanCard[]>([]);
  readonly currentCode = input<string | null>(null);
  readonly requestedCode = input<string | null>(null);
  readonly highlightFeature = input<string | null>(null);
  readonly selectable = input(false);
  readonly disabled = input(false);
  readonly choose = output<PublicPlanCard>();

  readonly cards = computed<ComparisonCard[]>(() => {
    const sorted = [...this.plans()].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    const highlight = this.highlightFeature();
    let previous: PublicPlanCard | null = null;

    return sorted.map((plan) => {
      const features = plan.features ?? [];
      const before = new Set((previous?.features ?? []).map((f) => f.code));
      const card: ComparisonCard = {
        plan,
        previousName: previous?.name ?? null,
        newFeatures: features.filter((f) => !before.has(f.code)),
        isCurrent: this.isCurrentPlan(plan),
        isRequested: plan.code === this.requestedCode(),
        hasHighlight: !!highlight && features.some((f) => f.code === highlight),
      };
      previous = plan;
      return card;
    });
  });

  showCatalogPrice(card: ComparisonCard): boolean {
    if (card.isCurrent && (card.plan.is_lifetime || card.plan.pricing_type === 'CUSTOM')) {
      return false;
    }
    return card.plan.pricing_type !== 'CUSTOM';
  }

  currentPlanState(plan: PublicPlanCard): string {
    if (plan.is_lifetime) {
      return 'Lifetime access · no end date';
    }
    switch (plan.subscription_status) {
      case 'TRIAL':
        return 'You are on a trial of this plan';
      case 'EXPIRING':
        return 'This plan is ending soon';
      case 'GRACE_PERIOD':
        return 'This plan is in a grace period';
      case 'EXPIRED':
        return 'This was your plan — access has ended';
      case 'SUSPENDED':
        return 'This plan is suspended';
      default:
        return 'You are on this plan';
    }
  }

  taxNote(plan: PublicPlanCard): string | null {
    const label = plan.tax?.label || 'Tax';
    if (plan.tax?.prices_include_tax) {
      return `Includes ${label}`;
    }
    const breakdown: TaxBreakdown | null | undefined = plan.tax?.monthly ?? plan.tax?.annual;
    const rate = plan.tax?.rate_percent ?? breakdown?.rate_percent ?? null;
    if (rate && Number(rate) > 0) {
      return `Plus ${label} (${Number(rate)}%)`;
    }
    return null;
  }

  trackByCode(_index: number, card: ComparisonCard): string {
    return card.plan.code;
  }

  private isCurrentPlan(plan: PublicPlanCard): boolean {
    if (plan.is_current === true || plan.primary_action === 'current') {
      return true;
    }
    if (plan.is_current === false) {
      return false;
    }
    const code = this.currentCode();
    return !!code && plan.code === code;
  }
}
