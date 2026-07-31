import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { DonationsService } from '../services/donations.service';
import {
  ACTIVITY_FILTER_OPTIONS,
  ACTIVITY_QUICK_FILTERS,
  ActivityFeedCategory,
  ActivityFeedGroup,
  ActivityQuickFilter,
  ActivityTimeFilter,
  activityIcon,
  buildCompactSummary,
  filterActivitiesByTime,
  formatExactTimestamp,
  formatTimelineClock,
  groupActivitiesByPeriod,
  ParishActivityItem,
  TimelineDensity
} from '../utils/activity-feed.utils';

@Component({
  selector: 'app-donations-history',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LoadingSkeletonComponent],
  templateUrl: './donations-history.component.html',
  styleUrl: './donations-history.component.scss'
})
export class DonationsHistoryComponent implements OnInit, OnDestroy {
  activities: ParishActivityItem[] = [];
  activitiesLoaded = false;
  loadError: string | null = null;
  loadingMore = false;
  categoryFilter: ActivityFeedCategory = 'all';
  timeFilter: ActivityTimeFilter = 'all';
  density: TimelineDensity = 'compact';
  filterOptions = ACTIVITY_FILTER_OPTIONS;
  quickFilters = ACTIVITY_QUICK_FILTERS;
  openMenuId: number | null = null;
  currentPage = 1;
  totalCount = 0;
  hasMore = false;
  private readonly pageSize = 50;
  private loadActivitiesSeq = 0;
  private routerSub?: Subscription;
  private skipNextNavReload = true;

  constructor(
    private donationsService: DonationsService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.reload();
    this.routerSub = this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
      if (!e.urlAfterRedirects.includes('/donations/history')) {
        return;
      }
      if (this.skipNextNavReload) {
        this.skipNextNavReload = false;
        return;
      }
      this.reload();
    });
    document.addEventListener('click', this.closeMenuOnOutsideClick);
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
    document.removeEventListener('click', this.closeMenuOnOutsideClick);
  }

  get visibleActivities(): ParishActivityItem[] {
    return filterActivitiesByTime(this.activities, this.timeFilter);
  }

  get groupedActivities(): ActivityFeedGroup[] {
    return groupActivitiesByPeriod(this.visibleActivities);
  }

  iconFor(item: ParishActivityItem): string {
    return activityIcon(item.icon, item.category);
  }

  compactSummary(item: ParishActivityItem): string {
    return buildCompactSummary(item);
  }

  timelineClock(item: ParishActivityItem, groupLabel: string): string {
    return formatTimelineClock(item.created_at, groupLabel);
  }

  exactTime(isoDate: string): string {
    return formatExactTimestamp(isoDate);
  }

  setDensity(mode: TimelineDensity): void {
    this.density = mode;
    this.cdr.detectChanges();
  }

  isQuickFilterActive(chip: ActivityQuickFilter): boolean {
    if (chip.type === 'time') {
      return this.timeFilter === chip.id;
    }
    return chip.id === 'all'
      ? this.categoryFilter === 'all' && this.timeFilter === 'all'
      : this.categoryFilter === chip.id && this.timeFilter === 'all';
  }

  applyQuickFilter(chip: ActivityQuickFilter): void {
    if (chip.type === 'time') {
      this.timeFilter = chip.id as ActivityTimeFilter;
      this.cdr.detectChanges();
      return;
    }

    this.timeFilter = 'all';
    this.categoryFilter = chip.id as ActivityFeedCategory;
    if (chip.id === 'all') {
      this.reload();
      return;
    }
    this.reload();
  }

  toggleMenu(itemId: number, event: Event): void {
    event.stopPropagation();
    this.openMenuId = this.openMenuId === itemId ? null : itemId;
  }

  copyLink(item: ParishActivityItem): void {
    if (!item.action_path) {
      return;
    }
    const url = `${window.location.origin}${item.action_path}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    this.openMenuId = null;
  }

  reload(): void {
    this.currentPage = 1;
    this.load(false);
  }

  loadMore(): void {
    if (this.loadingMore || !this.hasMore) {
      return;
    }
    this.currentPage += 1;
    this.load(true);
  }

  private closeMenuOnOutsideClick = (): void => {
    if (this.openMenuId !== null) {
      this.openMenuId = null;
      this.cdr.detectChanges();
    }
  };

  private load(append: boolean): void {
    const seq = ++this.loadActivitiesSeq;
    if (!append) {
      this.activitiesLoaded = false;
      this.loadError = null;
    } else {
      this.loadingMore = true;
    }

    const filters: Record<string, string> = {
      per_page: String(this.pageSize),
      page: String(this.currentPage)
    };
    if (this.categoryFilter !== 'all') {
      filters['category'] = this.categoryFilter;
    }

    this.donationsService.getAuditLogs(filters).subscribe({
      next: (res) => {
        if (seq !== this.loadActivitiesSeq) {
          return;
        }
        const rows = Array.isArray(res.data?.data) ? res.data.data : [];
        this.activities = append ? [...this.activities, ...rows] : rows;
        this.totalCount = res.data?.total ?? this.activities.length;
        this.hasMore = (res.data?.current_page ?? 1) < (res.data?.last_page ?? 1);
        this.activitiesLoaded = true;
        this.loadingMore = false;
        this.cdr.detectChanges();
      },
      error: () => {
        if (seq !== this.loadActivitiesSeq) {
          return;
        }
        if (append) {
          this.loadingMore = false;
          this.currentPage = Math.max(1, this.currentPage - 1);
        } else {
          this.activitiesLoaded = true;
          this.loadError = 'Unable to load activity history. Please try again.';
        }
        this.cdr.detectChanges();
      }
    });
  }
}
