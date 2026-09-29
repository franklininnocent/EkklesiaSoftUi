import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Subject, filter, takeUntil } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { TabStripComponent, TabStripItem } from '@shared/components/tab-strip/tab-strip.component';
import {
  SUBSCRIPTION_ADMIN_LAYOUT_VERSION,
  isPlanEditorRoute,
  isSubscriptionAdminLayoutV2,
} from '../../config/subscription-admin-layout.config';
import { subscriptionAdminCapabilities } from '../../services/subscription-admin-access';

const BASE = '/settings/subscription';

@Component({
  selector: 'app-subscription-admin-shell-page',
  standalone: true,
  imports: [CommonModule, RouterModule, PageHeaderComponent, TabStripComponent],
  templateUrl: './subscription-admin-shell.page.html',
  styleUrl: './subscription-admin-shell.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionAdminShellPage implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly layoutVersion = SUBSCRIPTION_ADMIN_LAYOUT_VERSION;
  readonly isLayoutV2 = isSubscriptionAdminLayoutV2();
  readonly tabs: TabStripItem[] = this.buildTabs();

  planEditorFocus = isPlanEditorRoute(this.router.url);

  ngOnInit(): void {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntil(this.destroy$),
      )
      .subscribe((event) => {
        const focus = isPlanEditorRoute(event.urlAfterRedirects);
        if (focus === this.planEditorFocus) return;
        this.planEditorFocus = focus;
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private buildTabs(): TabStripItem[] {
    const can = subscriptionAdminCapabilities(this.auth);
    const tabs: TabStripItem[] = [];
    if (can.usage) {
      tabs.push({ id: 'overview', label: 'Overview', routerLink: `${BASE}/overview` });
    }
    if (can.requests) {
      tabs.push({ id: 'requests', label: 'Plan requests', routerLink: `${BASE}/requests` });
    }
    if (can.usage) {
      tabs.push({ id: 'usage', label: 'Church usage', routerLink: `${BASE}/usage` });
    }
    tabs.push(
      { id: 'plans', label: 'Plans', routerLink: `${BASE}/plans` },
      { id: 'matrix', label: 'Compare plans', routerLink: `${BASE}/matrix` },
      { id: 'features', label: 'Features', routerLink: `${BASE}/features` },
      { id: 'policies', label: 'Policies', routerLink: `${BASE}/policies` },
      { id: 'tax', label: 'Tax', routerLink: `${BASE}/tax` },
    );
    if (can.audit) {
      tabs.push({ id: 'audit', label: 'Change history', routerLink: `${BASE}/audit` });
    }
    tabs.push({ id: 'access', label: 'Access & renewals', routerLink: `${BASE}/access` });
    return tabs;
  }
}
