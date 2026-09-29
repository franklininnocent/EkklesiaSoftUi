import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { TabStripComponent, TabStripItem } from '@shared/components/tab-strip/tab-strip.component';
import { NotificationApiService } from '../services/notification-api.service';
import { NotificationInboxService } from '../services/notification-inbox.service';
import { NotificationView, UserNotification } from '../models/notification.model';
import { inboxDateGroup } from '@shared/utils/relative-time.util';
import { NotificationListItemComponent } from '../components/notification-list-item/notification-list-item.component';
import { ToastService } from '@core/services/toast.service';

@Component({
  selector: 'app-notification-center-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PageHeaderComponent,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    ListToolbarComponent,
    TabStripComponent,
    NotificationListItemComponent,
  ],
  templateUrl: './notification-center.page.html',
  styleUrl: './notification-center.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationCenterPage implements OnInit {
  private readonly api = inject(NotificationApiService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly inbox = inject(NotificationInboxService);

  readonly tabItems: TabStripItem[] = [
    { id: 'all', label: 'All', domId: 'notif-tab-all', ariaControls: 'notif-panel' },
    { id: 'unread', label: 'Unread', domId: 'notif-tab-unread', ariaControls: 'notif-panel' },
    { id: 'mentions', label: 'Mentions', domId: 'notif-tab-mentions', ariaControls: 'notif-panel' },
    { id: 'action_required', label: 'Action required', domId: 'notif-tab-action', ariaControls: 'notif-panel' },
    { id: 'archived', label: 'Archived', domId: 'notif-tab-archived', ariaControls: 'notif-panel' },
  ];

  activeView = signal<NotificationView>('all');
  items = signal<UserNotification[]>([]);
  loading = signal(true);
  loadingMore = signal(false);
  error = signal<string | null>(null);
  nextCursor = signal<string | null>(null);
  hasMore = signal(false);
  search = '';
  selectedIds = signal<Set<string>>(new Set());
  bulkWorking = signal(false);

  ngOnInit(): void {
    this.load();
  }

  tabDomId(view: NotificationView): string {
    const tab = this.tabItems.find((t) => t.id === view);
    return tab?.domId ?? 'notif-tab-all';
  }

  onTabChange(view: string): void {
    this.activeView.set(view as NotificationView);
    this.clearSelection();
    this.load();
  }

  onSearchChange(value: string): void {
    this.search = value;
    this.load();
  }

  load(append = false): void {
    if (!append) {
      this.loading.set(true);
      this.error.set(null);
    } else {
      this.loadingMore.set(true);
    }

    this.api
      .list({
        view: this.activeView(),
        cursor: append ? this.nextCursor() : null,
        q: this.search.length >= 2 ? this.search : undefined,
        per_page: 20,
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.loadingMore.set(false);
          if (!res.success) {
            this.error.set('Could not load notifications.');
            return;
          }
          this.items.set(append ? [...this.items(), ...res.data] : res.data);
          this.nextCursor.set(res.meta.next_cursor);
          this.hasMore.set(res.meta.has_more);
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading.set(false);
          this.loadingMore.set(false);
          this.error.set('Could not load notifications.');
          this.cdr.markForCheck();
        },
      });
  }

  loadMore(): void {
    if (this.hasMore() && this.nextCursor() && !this.loadingMore()) {
      this.load(true);
    }
  }

  markAllRead(): void {
    this.inbox.markAllRead();
    this.load();
  }

  markItemRead(item: UserNotification): void {
    this.inbox.markReadOptimistic(item);
    this.items.update((rows) =>
      rows.map((row) => (row.id === item.id ? { ...row, status: 'read' as const } : row))
    );
  }

  groupLabel(group: string): string {
    return group === 'today' ? 'Today' : group === 'yesterday' ? 'Yesterday' : 'Older';
  }

  groupedItems(): { group: string; items: UserNotification[] }[] {
    const map = new Map<string, UserNotification[]>();
    for (const item of this.items()) {
      const g = inboxDateGroup(item.created_at);
      if (!map.has(g)) {
        map.set(g, []);
      }
      map.get(g)!.push(item);
    }
    const order = ['today', 'yesterday', 'older'];
    return order.filter((g) => map.has(g)).map((g) => ({ group: g, items: map.get(g)! }));
  }

  selectionCount(): number {
    return this.selectedIds().size;
  }

  allVisibleSelected(): boolean {
    const visible = this.items();
    return visible.length > 0 && visible.every((i) => this.selectedIds().has(i.id));
  }

  toggleSelectAll(checked: boolean): void {
    const next = new Set(this.selectedIds());
    if (checked) {
      this.items().forEach((i) => next.add(i.id));
    } else {
      this.items().forEach((i) => next.delete(i.id));
    }
    this.selectedIds.set(next);
  }

  toggleSelect(id: string, checked: boolean): void {
    const next = new Set(this.selectedIds());
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    this.selectedIds.set(next);
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  bulkMarkRead(): void {
    const ids = Array.from(this.selectedIds());
    if (!ids.length) {
      return;
    }
    this.bulkWorking.set(true);
    this.api.bulkAction('read', ids).subscribe({
      next: () => {
        this.bulkWorking.set(false);
        this.toast.success('Marked selected as read.');
        this.clearSelection();
        this.inbox.refreshUnreadCount();
        this.load();
      },
      error: () => {
        this.bulkWorking.set(false);
        this.toast.error('Could not update selected notifications.');
      },
    });
  }

  bulkArchive(): void {
    const ids = Array.from(this.selectedIds());
    if (!ids.length) {
      return;
    }
    this.bulkWorking.set(true);
    this.api.bulkAction('archive', ids).subscribe({
      next: () => {
        this.bulkWorking.set(false);
        this.toast.success('Archived selected notifications.');
        this.clearSelection();
        this.inbox.refreshUnreadCount();
        this.load();
      },
      error: () => {
        this.bulkWorking.set(false);
        this.toast.error('Could not archive selected notifications.');
      },
    });
  }

  emptyTitle(): string {
    if (this.activeView() === 'mentions') {
      return 'No mentions yet';
    }
    if (this.activeView() === 'action_required') {
      return 'Nothing needs your action';
    }
    if (this.activeView() === 'archived') {
      return 'No archived notifications';
    }
    if (this.activeView() === 'unread') {
      return 'All caught up';
    }
    return 'No notifications';
  }

  emptyDescription(): string {
    if (this.activeView() === 'mentions') {
      return 'When someone mentions you, it will show up here.';
    }
    if (this.search.length >= 2) {
      return 'Try a different search term.';
    }
    return 'You are all caught up for this view.';
  }
}
