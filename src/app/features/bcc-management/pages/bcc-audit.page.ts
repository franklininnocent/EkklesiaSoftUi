import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { BccAuditTabComponent } from '../components/bcc-audit-tab/bcc-audit-tab.component';
import { BccSubNavComponent } from '../components/bcc-sub-nav/bcc-sub-nav.component';

@Component({
  selector: 'app-bcc-audit-page',
  standalone: true,
  imports: [PageHeaderComponent, BccSubNavComponent, BccAuditTabComponent],
  template: `
    <section class="cf-page">
      <app-page-header title="BCC audit" subtitle="All BCC membership and leadership changes in this church"></app-page-header>
      <app-bcc-sub-nav></app-bcc-sub-nav>
      <app-bcc-audit-tab></app-bcc-audit-tab>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BccAuditPageComponent {}
