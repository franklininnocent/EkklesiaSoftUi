import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TabStripComponent, TabStripItem } from '@shared/components/tab-strip/tab-strip.component';
import { ministriesBasePath } from '../../utils/ministries-links';

@Component({
  selector: 'app-ministries-sub-nav',
  standalone: true,
  imports: [TabStripComponent],
  templateUrl: './ministries-sub-nav.component.html',
  styleUrl: './ministries-sub-nav.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MinistriesSubNavComponent {
  private readonly router = inject(Router);

  private cachedBase = '';
  private cachedTabs: TabStripItem[] = [];

  // Bound in the template, so the same array reference must be returned while the
  // base path is unchanged; a fresh array each check breaks change detection.
  get tabs(): TabStripItem[] {
    const base = ministriesBasePath(this.router.url);
    if (base !== this.cachedBase || this.cachedTabs.length === 0) {
      this.cachedBase = base;
      this.cachedTabs = [
        { id: 'organizations', label: 'Organizations', routerLink: base, exact: true },
        { id: 'guests', label: 'Guest members', routerLink: `${base}/guests` },
        { id: 'settings', label: 'Settings', routerLink: `${base}/settings` },
        { id: 'audit', label: 'Audit log', routerLink: `${base}/audit` },
      ];
    }

    return this.cachedTabs;
  }
}
