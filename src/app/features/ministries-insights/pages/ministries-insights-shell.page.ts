import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { TabStripComponent, TabStripItem } from '@shared/components/tab-strip/tab-strip.component';

@Component({
  selector: 'app-ministries-insights-shell-page',
  standalone: true,
  imports: [CommonModule, RouterModule, PageHeaderComponent, TabStripComponent],
  templateUrl: './ministries-insights-shell.page.html',
  styleUrl: './ministries-insights-shell.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MinistriesInsightsShellPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  noticeMessage: string | null = null;

  readonly tabs: TabStripItem[] = [
    { id: 'overview', label: 'Overview', routerLink: '/platform/ministries/overview', exact: true },
    { id: 'tenants', label: 'Tenants', routerLink: '/platform/ministries/tenants' },
    { id: 'organizations', label: 'Organizations', routerLink: '/platform/ministries/organizations' },
    { id: 'analytics', label: 'Analytics', routerLink: '/platform/ministries/analytics' },
    { id: 'reports', label: 'Reports', routerLink: '/platform/ministries/reports' },
  ];

  ngOnInit(): void {
    const message = this.route.snapshot.queryParamMap.get('message');
    const notice = this.route.snapshot.queryParamMap.get('notice');
    if (notice === 'tenant_context_required' && message?.trim()) {
      this.noticeMessage = message.trim();
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { notice: null, message: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  dismissNotice(): void {
    this.noticeMessage = null;
  }
}
