import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TabStripComponent, TabStripItem } from '@shared/components/tab-strip/tab-strip.component';
import { MINISTRIES_NAV_LINKS } from '../../config/ministries-nav.config';
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

  get tabs(): TabStripItem[] {
    const base = ministriesBasePath(this.router.url);
    if (base !== this.cachedBase || this.cachedTabs.length === 0) {
      this.cachedBase = base;
      this.cachedTabs = MINISTRIES_NAV_LINKS.map((link) => {
        const suffix = link.path.replace('/ministries', '').replace(/^\//, '');
        const routerLink = suffix ? `${base}/${suffix}` : base;
        return {
          id: link.id,
          label: link.label,
          routerLink,
          exact: link.exact ?? false,
        };
      });
    }

    return this.cachedTabs;
  }
}
