import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { NotificationApiService } from '../services/notification-api.service';
import { NotificationInboxService } from '../services/notification-inbox.service';
import { UserNotification } from '../models/notification.model';
import { formatRelativeTime } from '@shared/utils/relative-time.util';
import {
  isActionRequired,
  notificationCategoryLabel,
  notificationDefinitionLabel,
  notificationPriorityTone,
} from '../utils/notification-display.util';

@Component({
  selector: 'app-notification-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PageHeaderComponent,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './notification-detail.page.html',
  styleUrl: './notification-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(NotificationApiService);
  private readonly inbox = inject(NotificationInboxService);

  item = signal<UserNotification | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  archiving = signal(false);

  relativeTime = formatRelativeTime;
  definitionLabel = notificationDefinitionLabel;
  categoryLabel = notificationCategoryLabel;
  priorityTone = notificationPriorityTone;
  actionRequired = isActionRequired;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Notification not found.');
      this.loading.set(false);
      return;
    }
    this.api.get(id).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (!res.success) {
          this.error.set('Notification not found.');
          return;
        }
        this.item.set(res.data);
        if (res.data.status === 'unread') {
          this.inbox.markReadOptimistic(res.data);
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Notification not found.');
      },
    });
  }

  goToSource(): void {
    const item = this.item();
    if (!item) {
      return;
    }
    this.inbox.navigateToOpen(item);
  }

  archive(): void {
    const item = this.item();
    if (!item) {
      return;
    }
    this.archiving.set(true);
    this.api.archive(item.id).subscribe({
      next: () => {
        this.archiving.set(false);
        this.router.navigate(['/notifications']);
      },
      error: () => {
        this.archiving.set(false);
        this.error.set('Could not archive notification.');
      },
    });
  }
}
