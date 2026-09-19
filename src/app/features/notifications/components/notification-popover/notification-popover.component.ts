import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  effect,
  inject,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { NotificationInboxService } from '../../services/notification-inbox.service';
import { UserNotification } from '../../models/notification.model';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { NotificationListItemComponent } from '../notification-list-item/notification-list-item.component';
import {
  restoreActiveElement,
  saveActiveElement,
  trapFocus,
} from '@shared/utils/focus-trap.util';

@Component({
  selector: 'app-notification-popover',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    NotificationListItemComponent,
  ],
  templateUrl: './notification-popover.component.html',
  styleUrl: './notification-popover.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationPopoverComponent implements OnDestroy {
  readonly inbox = inject(NotificationInboxService);

  @ViewChild('panel') panelRef?: ElementRef<HTMLElement>;

  private releaseFocusTrap: (() => void) | null = null;
  private previousFocus: HTMLElement | null = null;

  constructor() {
    effect(() => {
      if (this.inbox.isPopoverOpen()) {
        queueMicrotask(() => this.activateFocus());
      } else {
        this.deactivateFocus();
      }
    });
  }

  ngOnDestroy(): void {
    this.deactivateFocus();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.inbox.isPopoverOpen()) {
      this.inbox.closePopover();
      this.deactivateFocus();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.inbox.isPopoverOpen()) {
      return;
    }
    const target = event.target as Node;
    const panel = this.panelRef?.nativeElement;
    if (panel && !panel.contains(target) && !(target as Element).closest?.('.notification-bell')) {
      this.inbox.closePopover();
      this.deactivateFocus();
    }
  }

  markRead(item: UserNotification): void {
    this.inbox.markReadOptimistic(item);
  }

  openItem(item: UserNotification): void {
    this.inbox.navigateToOpen(item);
    this.deactivateFocus();
  }

  viewAll(): void {
    this.inbox.closePopover();
    this.deactivateFocus();
  }

  onMarkAllRead(): void {
    this.inbox.markAllRead();
  }

  onClose(): void {
    this.inbox.closePopover();
    this.deactivateFocus();
  }

  unreadLabel(): string {
    const count = this.inbox.unreadCount();
    if (count > 99) {
      return '99+ unread';
    }
    return `${count} unread`;
  }

  private activateFocus(): void {
    const panel = this.panelRef?.nativeElement;
    if (!panel) {
      return;
    }
    this.previousFocus = saveActiveElement();
    this.releaseFocusTrap = trapFocus(panel);
  }

  private deactivateFocus(): void {
    this.releaseFocusTrap?.();
    this.releaseFocusTrap = null;
    if (this.previousFocus) {
      restoreActiveElement(this.previousFocus);
      this.previousFocus = null;
    }
  }
}
