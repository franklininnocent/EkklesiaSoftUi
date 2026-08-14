import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TabStripComponent, TabStripItem } from '@shared/components/tab-strip/tab-strip.component';

@Component({
  selector: 'app-bcc-sub-nav',
  standalone: true,
  imports: [TabStripComponent],
  template: `<app-tab-strip mode="router" [tabs]="tabs" ariaLabel="BCC sections"></app-tab-strip>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BccSubNavComponent {
  readonly tabs: TabStripItem[] = [
    { id: 'dashboard', label: 'Dashboard', routerLink: '/bccs', exact: true },
    { id: 'list', label: 'BCC List', routerLink: '/bccs/list' },
    { id: 'audit', label: 'Audit', routerLink: '/bccs/audit' },
  ];
}
