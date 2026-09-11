import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { TabStripComponent, TabStripItem } from '@shared/components/tab-strip/tab-strip.component';
import {
  TaxonomyCrudPanelComponent,
  TaxonomyKind,
} from '../components/taxonomy-crud-panel/taxonomy-crud-panel.component';
import { MinistriesSubNavComponent } from '../components/ministries-sub-nav/ministries-sub-nav.component';

@Component({
  selector: 'app-taxonomy-settings-page',
  standalone: true,
  imports: [
    CommonModule,
    PageHeaderComponent,
    TabStripComponent,
    TaxonomyCrudPanelComponent,
    MinistriesSubNavComponent,
  ],
  templateUrl: './taxonomy-settings.page.html',
  styleUrl: './taxonomy-settings.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaxonomySettingsPageComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly tabs: TaxonomyKind[] = ['categories', 'types', 'positions'];
  readonly tabLabels: Record<TaxonomyKind, string> = {
    categories: 'Categories',
    types: 'Types',
    positions: 'Positions',
  };

  activeTab: TaxonomyKind = 'categories';
  canConfigure = false;

  ngOnInit(): void {
    this.canConfigure = this.authService.hasPermission('ministries.configure');
    this.initializeTabFromQuery();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get tabStripItems(): TabStripItem[] {
    return this.tabs.map((tab) => ({
      id: tab,
      label: this.tabLabels[tab],
      domId: this.tabId(tab),
      ariaControls: this.panelId(tab),
    }));
  }

  tabId(tab: TaxonomyKind): string {
    return `taxonomy-tab-${tab}`;
  }

  panelId(tab: TaxonomyKind): string {
    return `taxonomy-panel-${tab}`;
  }

  onTabChange(tabId: string): void {
    this.setActiveTab(tabId as TaxonomyKind);
  }

  setActiveTab(tab: TaxonomyKind): void {
    if (this.activeTab === tab) {
      return;
    }

    this.activeTab = tab;
    this.cdr.markForCheck();
  }

  private initializeTabFromQuery(): void {
    this.applyTabFromQuery(this.route.snapshot.queryParamMap.get('tab'));

    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.applyTabFromQuery(params.get('tab'));
    });
  }

  private applyTabFromQuery(tab: string | null): void {
    const next: TaxonomyKind =
      tab && this.tabs.includes(tab as TaxonomyKind) ? (tab as TaxonomyKind) : 'categories';

    this.setActiveTab(next);
  }
}
