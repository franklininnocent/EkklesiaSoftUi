import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { AuditLogPanelComponent } from '../components/audit-log-panel/audit-log-panel.component';
import { MinistriesSubNavComponent } from '../components/ministries-sub-nav/ministries-sub-nav.component';

@Component({
  selector: 'app-audit-log-page',
  standalone: true,
  imports: [
    PageHeaderComponent,
    ListToolbarComponent,
    AuditLogPanelComponent,
    MinistriesSubNavComponent,
  ],
  templateUrl: './audit-log.page.html',
  // Default so header badge re-reads panel.drawerFilterCount after drawer apply/clear.
  changeDetection: ChangeDetectionStrategy.Default,
})
export class AuditLogPageComponent {}
