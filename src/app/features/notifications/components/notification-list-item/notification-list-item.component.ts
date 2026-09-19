import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { formatRelativeTime } from '@shared/utils/relative-time.util';
import { UserNotification } from '../../models/notification.model';
import {
  isActionRequired,
  notificationModuleInitial,
  notificationPriorityTone,
} from '../../utils/notification-display.util';

@Component({
  selector: 'app-notification-list-item',
  standalone: true,
  imports: [CommonModule, RouterModule, StatusBadgeComponent],
  templateUrl: './notification-list-item.component.html',
  styleUrl: './notification-list-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationListItemComponent {
  @Input({ required: true }) item!: UserNotification;
  @Input() variant: 'compact' | 'workspace' = 'workspace';
  @Input() selectable = false;
  @Input() selected = false;
  @Input() detailLink: string | null = null;

  @Output() open = new EventEmitter<UserNotification>();
  @Output() markRead = new EventEmitter<UserNotification>();
  @Output() selectionChange = new EventEmitter<boolean>();

  relativeTime = formatRelativeTime;
  moduleInitial = notificationModuleInitial;
  priorityTone = notificationPriorityTone;
  actionRequired = isActionRequired;

  onRowClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('[data-notification-action]')) {
      return;
    }
    if (this.detailLink) {
      return;
    }
    this.open.emit(this.item);
  }

  onMarkRead(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.markRead.emit(this.item);
  }

  onSelectChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectionChange.emit(checked);
  }
}
