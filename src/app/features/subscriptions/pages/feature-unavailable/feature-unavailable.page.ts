import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { AuthService } from '@core/services/auth.service';
import { EntitlementService } from '@core/services/entitlement.service';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { TenantSubscriptionService } from '../../services/tenant-subscription.service';

/** Plain explanation shown when a page is not part of the church's plan. */
@Component({
  selector: 'app-feature-unavailable-page',
  standalone: true,
  imports: [CommonModule, RouterLink, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cf-page feature-unavailable">
      <app-page-header title="Not included in your plan" backLink="/dashboard" backLabel="Dashboard"></app-page-header>

      <section class="fu-card" role="status" aria-live="polite">
        <h2>{{ featureName() }} is not part of {{ planLabel() }}</h2>
        <p class="fu-lead">
          Everything else keeps working as usual. Your church's records are safe — nothing has been removed.
        </p>

        <div *ngIf="includingPlans().length" class="fu-plans">
          <p>Available on:</p>
          <ul>
            <li *ngFor="let name of includingPlans()">{{ name }}</li>
          </ul>
        </div>

        <div class="fu-actions">
          <a
            *ngIf="canManageSubscription"
            class="cf-btn cf-btn-primary"
            routerLink="/settings/my-subscription"
            [queryParams]="{ request: featureCode() }">
            Request plan upgrade
          </a>
          <a class="cf-btn cf-btn-secondary" routerLink="/dashboard">Back to dashboard</a>
        </div>

        <p class="fu-help">
          <ng-container *ngIf="canManageSubscription; else askAdmin">
            Plan changes are made by your Ekklesia administrator after you send a request.
          </ng-container>
          <ng-template #askAdmin>Please ask your church administrator if your church needs this.</ng-template>
        </p>
      </section>
    </div>
  `,
  styles: [
    `
      .feature-unavailable { display: flex; flex-direction: column; gap: var(--cf-page-gap, var(--spacing-lg)); padding: var(--cf-page-pad); }
      .fu-card { max-width: 40rem; display: grid; gap: var(--cf-space-3, 0.75rem); padding: var(--cf-space-5, 1.5rem);
        border: 1px solid var(--cf-panel-border, var(--gray-200)); border-radius: var(--cf-radius, var(--radius-md)); background: var(--cf-surface, #fff); }
      .fu-card h2 { margin: 0; font-size: var(--cf-text-lg, 1.125rem); color: var(--cf-slate-900, var(--text-primary)); }
      .fu-lead, .fu-help, .fu-plans p { margin: 0; color: var(--cf-muted, var(--text-secondary)); }
      .fu-plans ul { margin: 0.25rem 0 0; padding-left: 1.25rem; }
      .fu-actions { display: flex; flex-wrap: wrap; gap: var(--cf-space-2, 0.5rem); }
    `,
  ],
})
export class FeatureUnavailablePageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly entitlements = inject(EntitlementService);
  private readonly plans = inject(TenantSubscriptionService);
  private readonly auth = inject(AuthService);

  readonly canManageSubscription = this.auth.canViewMySubscription();

  readonly featureCode = toSignal(
    this.route.queryParamMap.pipe(map((q) => (q.get('feature') ?? '').replace(/[^A-Za-z0-9_]/g, '').toUpperCase())),
    { initialValue: '' },
  );

  private readonly publicPlans = toSignal(this.plans.publicPlans(), { initialValue: [] });
  private readonly entitlementMap = toSignal(this.entitlements.load(), { initialValue: null });

  readonly featureName = computed(() => {
    this.entitlementMap();
    this.entitlements.entitlements();
    const code = this.featureCode();
    return code ? this.entitlements.featureName(code) : 'This feature';
  });

  readonly planLabel = computed(() => {
    const name = this.entitlements.plan()?.name;
    return name ? `the ${name} plan` : 'your current plan';
  });

  readonly includingPlans = computed(() => {
    const code = this.featureCode();
    if (!code) return [];
    return this.publicPlans()
      .filter((p) => (p.features ?? []).some((f) => f.code === code))
      .map((p) => p.name);
  });
}
