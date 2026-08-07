import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TabStripComponent, TabStripItem } from '@shared/components/tab-strip/tab-strip.component';

@Component({
  selector: 'app-ministries-sub-nav',
  standalone: true,
  imports: [TabStripComponent],
  templateUrl: './ministries-sub-nav.component.html',
  styleUrl: './ministries-sub-nav.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MinistriesSubNavComponent {
  readonly tabs: TabStripItem[] = [
    {
      id: 'organizations',
      label: 'Organizations',
      routerLink: '/ministries',
      exact: true,
    },
    {
      id: 'guests',
      label: 'Guest members',
      routerLink: '/ministries/guests',
    },
    {
      id: 'settings',
      label: 'Settings',
      routerLink: '/ministries/settings',
    },
    {
      id: 'audit',
      label: 'Audit log',
      routerLink: '/ministries/audit',
    },
  ];
}
