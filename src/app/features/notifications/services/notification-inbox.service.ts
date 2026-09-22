import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { interval, Subscription, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { NotificationApiService } from './notification-api.service';
import { NotificationView, UserNotification } from '../models/notification.model';

const BROADCAST_CHANNEL = 'ekklesia-notifications';

@Injectable({ providedIn: 'root' })
export class NotificationInboxService {
  private readonly api = inject(NotificationApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly unreadCount = signal(0);
  readonly isPopoverOpen = signal(false);
  readonly recentItems = signal<UserNotification[]>([]);
  readonly loadingRecent = signal(false);

  private pollSub: Subscription | null = null;
  private broadcast: BroadcastChannel | null = null;
  private userId: number | null = null;

  constructor() {
    this.auth.currentUser$.pipe(takeUntilDestroyed()).subscribe((user) => {
      if (user) {
        this.userId = user.id;
        this.initBroadcast(user.id);
        this.startPolling();
        this.refreshUnreadCount();
      } else {
        this.clear();
      }
    });
  }

  openPopover(): void {
    this.isPopoverOpen.set(true);
    this.loadRecent();
  }

  closePopover(): void {
    this.isPopoverOpen.set(false);
  }

  togglePopover(): void {
    if (this.isPopoverOpen()) {
      this.closePopover();
    } else {
      this.openPopover();
    }
  }

  refreshUnreadCount(): void {
    this.api.unreadCount().pipe(catchError(() => of(null))).subscribe((res) => {
      if (res?.success) {
        this.unreadCount.set(res.data.unread_count);
      }
    });
  }

  loadRecent(): void {
    this.loadingRecent.set(true);
    this.api
      .list({ view: 'all', per_page: 12 })
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        this.loadingRecent.set(false);
        if (res?.success) {
          this.recentItems.set(res.data);
        }
      });
  }

  markReadOptimistic(item: UserNotification): void {
    if (item.status === 'read') {
      return;
    }
    const prev = item.status;
    item.status = 'read';
    this.decrementUnread();
    this.patchRecent(item);
    this.api.markRead(item.id).pipe(catchError(() => of(null))).subscribe((res) => {
      if (!res?.success) {
        item.status = prev;
        this.refreshUnreadCount();
        this.toast.error('Could not mark as read. Try again.');
      } else {
        this.broadcastSync('read', item.id);
      }
    });
  }

  markAllRead(): void {
    this.api.markAllRead().pipe(catchError(() => of(null))).subscribe((res) => {
      if (res?.success) {
        this.unreadCount.set(0);
        this.recentItems.update((items) =>
          items.map((i) => ({ ...i, status: 'read' as const }))
        );
        this.broadcastSync('read_all', null);
        this.toast.success('All notifications marked as read.');
      } else {
        this.toast.error('Could not mark all as read.');
      }
    });
  }

  navigateToOpen(item: UserNotification): void {
    this.api.open(item.id).pipe(catchError(() => of(null))).subscribe((res) => {
      this.markReadOptimistic(item);
      this.closePopover();
      if (res?.success && res.data?.route) {
        const route = res.data.route.startsWith('/') ? res.data.route : `/${res.data.route}`;
        const params = res.data.params ?? {};
        const query = new URLSearchParams(params).toString();
        void this.router.navigateByUrl(query ? `${route}?${query}` : route);
        return;
      }
      void this.router.navigate(['/notifications', item.id]);
    });
  }

  clear(): void {
    this.unreadCount.set(0);
    this.recentItems.set([]);
    this.isPopoverOpen.set(false);
    this.userId = null;
    this.pollSub?.unsubscribe();
    this.pollSub = null;
    this.broadcast?.close();
    this.broadcast = null;
  }

  private startPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = interval(30_000)
      .pipe(
        switchMap(() => this.api.unreadCount().pipe(catchError(() => of(null)))),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((res) => {
        if (res?.success) {
          this.unreadCount.set(res.data.unread_count);
        }
        if (this.isPopoverOpen()) {
          this.loadRecent();
        }
      });
  }

  private initBroadcast(userId: number): void {
    if (typeof BroadcastChannel === 'undefined') {
      return;
    }
    this.broadcast?.close();
    this.broadcast = new BroadcastChannel(`${BROADCAST_CHANNEL}:${userId}`);
    this.broadcast.onmessage = (event) => {
      const data = event.data as { type: string; id?: string };
      if (data.type === 'read_all') {
        this.unreadCount.set(0);
        this.loadRecent();
      } else if (data.type === 'read' && data.id) {
        this.refreshUnreadCount();
      }
    };
  }

  private broadcastSync(type: string, id: string | null): void {
    this.broadcast?.postMessage({ type, id });
  }

  private decrementUnread(): void {
    this.unreadCount.update((n) => Math.max(0, n - 1));
  }

  private patchRecent(updated: UserNotification): void {
    this.recentItems.update((items) =>
      items.map((i) => (i.id === updated.id ? { ...i, ...updated } : i))
    );
  }
}
