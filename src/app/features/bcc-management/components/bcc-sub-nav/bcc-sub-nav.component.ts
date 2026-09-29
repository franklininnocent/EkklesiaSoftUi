import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '@core/services/auth.service';
import { TabStripComponent, TabStripItem } from '@shared/components/tab-strip/tab-strip.component';

@Component({
  selector: 'app-bcc-sub-nav',
  standalone: true,
  imports: [TabStripComponent],
  template: `<app-tab-strip mode="router" [tabs]="tabs" ariaLabel="BCC sections"></app-tab-strip>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BccSubNavComponent {
  private readonly auth = inject(AuthService);
  readonly tabs: TabStripItem[] = this.buildTabs();

  private buildTabs(): TabStripItem[] {
    const items: TabStripItem[] = [
      { id: 'dashboard', label: 'Dashboard', routerLink: '/bccs', exact: true },
      { id: 'list', label: 'BCC List', routerLink: '/bccs/list' },
    ];

    if (this.auth.canViewTenantAuditLogs()) {
      items.push({ id: 'audit', label: 'Audit', routerLink: '/bccs/audit' });
    }

    return items;
  }
}
