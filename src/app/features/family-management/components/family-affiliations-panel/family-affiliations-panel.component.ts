import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import {
  FamilyAffiliation,
  FamilyAffiliationLeadership,
  FamilyAffiliationMembership,
  LeadershipStatus,
  MembershipStatus,
  Organization,
} from '@features/ministries-associations/models/ministries.model';
import { MinistriesApiService } from '@features/ministries-associations/services/ministries-api.service';
import { EnrollFromFamilyModalComponent } from '../enroll-from-family-modal/enroll-from-family-modal.component';

@Component({
  selector: 'app-family-affiliations-panel',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    EnrollFromFamilyModalComponent,
  ],
  templateUrl: './family-affiliations-panel.component.html',
  styleUrl: './family-affiliations-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FamilyAffiliationsPanelComponent implements OnInit, OnChanges, OnDestroy {
  private static moduleEnabledCache: boolean | null = null;

  private readonly destroy$ = new Subject<void>();
  private readonly api = inject(MinistriesApiService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) familyMemberId!: string;

  panelVisible = false;
  canEnroll = false;
  showEnrollModal = false;

  affiliations: FamilyAffiliation[] = [];
  loading = false;
  loaded = false;
  loadError: string | null = null;

  ngOnInit(): void {
    this.resolveAccess();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['familyMemberId'] && this.panelVisible) {
      this.closeEnrollModal();
      this.loadAffiliations();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  retryLoad(): void {
    this.loadAffiliations();
  }

  openEnrollModal(): void {
    if (!this.canEnroll || !this.familyMemberId?.trim()) {
      return;
    }
    this.showEnrollModal = true;
    this.cdr.markForCheck();
  }

  closeEnrollModal(): void {
    this.showEnrollModal = false;
    this.cdr.markForCheck();
  }

  onMemberEnrolled(): void {
    this.showEnrollModal = false;
    this.toastService.success('Member enrolled successfully.');
    this.loadAffiliations();
    this.cdr.markForCheck();
  }

  isActiveMembership(membership: FamilyAffiliationMembership): boolean {
    return membership.status === 'active';
  }

  isActiveLeadership(term: FamilyAffiliationLeadership): boolean {
    return term.status === 'active';
  }

  membershipStatusLabel(status: MembershipStatus): string {
    switch (status) {
      case 'active':
        return 'Active';
      case 'inactive':
        return 'Inactive';
      case 'suspended':
        return 'Suspended';
      case 'resigned':
        return 'Resigned';
      case 'exited':
        return 'Exited';
      case 'deceased':
        return 'Deceased';
      default:
        return status;
    }
  }

  leadershipStatusLabel(status: LeadershipStatus): string {
    switch (status) {
      case 'active':
        return 'Active';
      case 'completed':
        return 'Completed';
      case 'vacated':
        return 'Vacated';
      case 'terminated':
        return 'Terminated';
      default:
        return status;
    }
  }

  organizationStatusLabel(status: Organization['status']): string {
    switch (status) {
      case 'active':
        return 'Active';
      case 'inactive':
        return 'Inactive';
      default:
        return status;
    }
  }

  termRange(term: FamilyAffiliationLeadership): string {
    const from = this.formatDate(term.effective_from);
    if (!term.effective_to) {
      return `${from} – Open`;
    }
    return `${from} – ${this.formatDate(term.effective_to)}`;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  private resolveAccess(): void {
    // Backend FamilyMinistriesPolicy::viewAffiliations + route middleware require ministries.view
    // (super/platform admins bypass). Broader canAccessMinistries alone is too permissive.
    if (!this.canViewAffiliations()) {
      this.hidePanel();
      return;
    }

    this.canEnroll = this.canEnrollFromFamily();

    if (FamilyAffiliationsPanelComponent.moduleEnabledCache !== null) {
      if (FamilyAffiliationsPanelComponent.moduleEnabledCache) {
        this.showPanelAndLoad();
      } else {
        this.hidePanel();
      }
      return;
    }

    this.api
      .getModuleStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const enabled = response.data?.enabled === true;
          FamilyAffiliationsPanelComponent.moduleEnabledCache = enabled;
          if (enabled) {
            this.showPanelAndLoad();
          } else {
            this.hidePanel();
          }
        },
        error: () => {
          // Fail closed if module status cannot be determined.
          FamilyAffiliationsPanelComponent.moduleEnabledCache = false;
          this.hidePanel();
        },
      });
  }

  private canViewAffiliations(): boolean {
    if (this.authService.isSuperAdmin() || this.authService.isEkklesiaAdmin()) {
      return true;
    }
    return this.authService.hasPermission('ministries.view');
  }

  private canEnrollFromFamily(): boolean {
    // Backend FamilyMinistriesPolicy::enroll — super-admin bypass or manage_members.
    if (this.authService.isSuperAdmin()) {
      return true;
    }
    return this.authService.hasPermission('ministries.manage_members');
  }

  private showPanelAndLoad(): void {
    this.panelVisible = true;
    this.loadAffiliations();
    this.cdr.markForCheck();
  }

  private hidePanel(): void {
    this.panelVisible = false;
    this.canEnroll = false;
    this.showEnrollModal = false;
    this.cdr.markForCheck();
  }

  private loadAffiliations(): void {
    const memberId = this.familyMemberId?.trim();
    if (!memberId || !this.panelVisible) {
      this.affiliations = [];
      this.loaded = false;
      this.loadError = null;
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.loadError = null;
    this.cdr.markForCheck();

    this.api
      .getFamilyAffiliations(memberId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.affiliations = response.data?.affiliations ?? [];
          this.loaded = true;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.affiliations = [];
          this.loaded = false;
          this.loading = false;
          this.loadError = 'Could not load ministry affiliations. Please try again.';
          this.cdr.markForCheck();
        },
      });
  }
}
