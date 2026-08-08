import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import {
  SubscriptionAccessService,
  SubscriptionAccessSnapshot,
} from '@core/services/subscription-access.service';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-subscription-status-banner',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './subscription-status-banner.component.html',
  styleUrl: './subscription-status-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionStatusBannerComponent implements OnInit, OnDestroy {
  private readonly access = inject(SubscriptionAccessService);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  snapshot: SubscriptionAccessSnapshot | null = null;
  canViewDetails = false;

  ngOnInit(): void {
    this.access.ensureLoaded();

    this.auth.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.canViewDetails = this.auth.canViewMySubscription(user);
      this.cdr.markForCheck();
    });

    this.access.snapshot$.pipe(takeUntil(this.destroy$)).subscribe((snap) => {
      this.snapshot = snap && this.access.shouldShowBanner ? snap : null;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  message(status: string): string {
    switch (status) {
      case 'EXPIRING':
        return 'Your subscription is ending soon. Ask your administrator to renew access.';
      case 'GRACE_PERIOD':
        return 'Your subscription end date has passed. You are in a grace period. Contact your administrator to renew.';
      case 'EXPIRED':
        return 'Your subscription has ended. Some features are unavailable. Contact EkklesiaSoft or your administrator.';
      case 'SUSPENDED':
        return 'Subscription access is suspended. Contact EkklesiaSoft or your administrator.';
      default:
        return '';
    }
  }
}
