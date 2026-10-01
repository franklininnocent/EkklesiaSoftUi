import { Component, inject, OnDestroy, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, Subject, finalize } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AppState } from '@core/store';
import { User } from '@core/models';
import { selectCurrentUser } from '@core/store/auth/auth.selectors';
import * as AuthActions from '@core/store/auth/auth.actions';
import {
  PageHeaderComponent,
  UserAvatarComponent,
  ImageViewerComponent,
  StatusBadgeComponent,
  SectionCardComponent,
} from '@shared/components';
import type { StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import {
  resolveUserProfileImageUrl,
  USER_PROFILE_IMAGE_ACCEPT,
  validateUserProfileImageFileAsync,
} from '@core/utils/user-profile-image.util';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { ChangePasswordModalComponent } from './components/change-password-modal/change-password-modal.component';
import { CfDatePipe } from '@shared/pipes/cf-date.pipe';

const TENANT_TIER_LABELS: Record<string, string> = {
  platform: 'Platform',
  diocese: 'Diocese',
  parish: 'Parish',
  branch: 'Branch',
};

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CfDatePipe,
    CommonModule,
    FormsModule,
    PageHeaderComponent,
    UserAvatarComponent,
    ImageViewerComponent,
    StatusBadgeComponent,
    SectionCardComponent,
    ChangePasswordModalComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileComponent implements OnInit, OnDestroy {
  private store = inject(Store<AppState>);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private destroy$ = new Subject<void>();

  currentUser$: Observable<User | null>;
  photoViewer: { src: string; alt: string; title: string; subtitle: string } | null = null;

  readonly profileImageAccept = USER_PROFILE_IMAGE_ACCEPT;

  profileImagePreviewUrl: string | null = null;
  profileImageError: string | null = null;
  isSavingProfileImage = false;

  showChangePasswordModal = false;
  forcePasswordChangeRequired = false;

  private profileImageObjectUrl: string | null = null;
  private savedProfileImageUrl: string | null = null;

  constructor() {
    this.currentUser$ = this.store.select(selectCurrentUser).pipe(takeUntil(this.destroy$));
    this.currentUser$.subscribe((user) => {
      this.savedProfileImageUrl = user ? resolveUserProfileImageUrl(user) : null;
      this.forcePasswordChangeRequired = !!user?.force_password_change;
      this.maybeOpenForcedPasswordModal();
      this.cdr.markForCheck();
    });
  }

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.store.dispatch(AuthActions.loadUser());
    }

    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      if (params.get('forcePassword') === '1') {
        this.forcePasswordChangeRequired = true;
        this.maybeOpenForcedPasswordModal();
        this.cdr.markForCheck();
        return;
      }

      if (params.get('changePassword') === '1') {
        this.openChangePasswordModal();
      }
    });
  }

  ngOnDestroy(): void {
    this.revokeProfileImageObjectUrl();
    this.destroy$.next();
    this.destroy$.complete();
  }

  canManageOwnProfileImage(user: User | null): boolean {
    return this.authService.canManageOwnProfileImage(user);
  }

  getUserPhotoUrl(user: User): string | null {
    if (this.profileImagePreviewUrl) {
      return this.profileImagePreviewUrl;
    }

    return resolveUserProfileImageUrl(user);
  }

  getRoleNames(user: User): string[] {
    const fromRoles = (user.roles ?? [])
      .map((role) => role.name?.trim())
      .filter((name): name is string => !!name);

    if (fromRoles.length) {
      return fromRoles;
    }

    const legacy = user.role_name?.trim() || user.role?.name?.trim();
    return legacy ? [legacy] : [];
  }

  getAccountStatusLabel(user: User): string {
    return user.active === 1 ? 'Active' : 'Inactive';
  }

  getAccountStatusTone(user: User): StatusBadgeTone {
    return user.active === 1 ? 'success' : 'neutral';
  }

  getContactTypeLabel(user: User): string | null {
    if (user.user_type === 1) {
      return 'Primary contact';
    }

    if (user.user_type === 2) {
      return 'Secondary contact';
    }

    return null;
  }

  formatTenantTier(tier?: string | null): string | null {
    if (!tier) {
      return null;
    }

    return TENANT_TIER_LABELS[tier] ?? tier;
  }

  hasTenantName(user: User): boolean {
    return !!user.tenant?.name?.trim();
  }

  openChangePasswordModal(): void {
    this.showChangePasswordModal = true;
    this.cdr.markForCheck();
  }

  onChangePasswordModalClosed(): void {
    if (this.forcePasswordChangeRequired) {
      return;
    }

    this.showChangePasswordModal = false;
    this.clearChangePasswordQueryParam();
    this.cdr.markForCheck();
  }

  onChangePasswordSaved(): void {
    const wasForced = this.forcePasswordChangeRequired;
    this.forcePasswordChangeRequired = false;
    this.showChangePasswordModal = false;
    this.clearChangePasswordQueryParam();
    if (wasForced) {
      void this.router.navigate(['/dashboard']);
    }
    this.cdr.markForCheck();
  }

  openPhotoViewer(user: User): void {
    const url = this.getUserPhotoUrl(user);
    if (!url) {
      return;
    }

    this.photoViewer = {
      src: url,
      alt: user.name,
      title: user.name,
      subtitle: user.email,
    };
    this.cdr.markForCheck();
  }

  closePhotoViewer(): void {
    this.photoViewer = null;
    this.cdr.markForCheck();
  }

  onProfilePhotoSelected(event: Event, user: User): void {
    void this.handleProfilePhotoSelected(event, user);
  }

  removeProfilePhoto(user: User): void {
    if (!this.canManageOwnProfileImage(user) || this.isSavingProfileImage || !this.getUserPhotoUrl(user)) {
      return;
    }

    this.isSavingProfileImage = true;
    this.profileImageError = null;
    this.cdr.markForCheck();

    this.authService.deleteMyProfileImage()
      .pipe(
        finalize(() => {
          this.isSavingProfileImage = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (response) => {
          this.clearProfileImagePreview();
          this.savedProfileImageUrl = resolveUserProfileImageUrl(response.data);
          this.authService.syncCurrentUser(response.data);
          this.store.dispatch(AuthActions.loadUserSuccess({ user: response.data }));
          this.toastService.success(response.message || 'Profile photo removed.', 'Profile photo');
          this.cdr.markForCheck();
        },
        error: (error) => {
          const message = error.error?.message || 'Unable to remove profile photo. Please try again.';
          this.profileImageError = message;
          this.toastService.error(message, 'Profile photo');
          this.cdr.markForCheck();
        },
      });
  }

  private async handleProfilePhotoSelected(event: Event, user: User): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file || !this.canManageOwnProfileImage(user) || this.isSavingProfileImage) {
      return;
    }

    const error = await validateUserProfileImageFileAsync(file);
    if (error) {
      this.profileImageError = error;
      this.cdr.markForCheck();
      return;
    }

    this.profileImageError = null;
    this.revokeProfileImageObjectUrl();
    this.profileImageObjectUrl = URL.createObjectURL(file);
    this.profileImagePreviewUrl = this.profileImageObjectUrl;
    this.cdr.markForCheck();

    this.isSavingProfileImage = true;
    this.authService.uploadMyProfileImage(file)
      .pipe(
        finalize(() => {
          this.isSavingProfileImage = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (response) => {
          this.clearProfileImagePreview();
          this.savedProfileImageUrl = resolveUserProfileImageUrl(response.data);
          this.authService.syncCurrentUser(response.data);
          this.store.dispatch(AuthActions.loadUserSuccess({ user: response.data }));
          this.toastService.success(response.message || 'Profile photo updated.', 'Profile photo');
          this.cdr.markForCheck();
        },
        error: (uploadError) => {
          this.clearProfileImagePreview();
          const message = uploadError.error?.message || 'Unable to update profile photo. Please try again.';
          this.profileImageError = message;
          this.toastService.error(message, 'Profile photo');
          this.cdr.markForCheck();
        },
      });
  }

  private clearProfileImagePreview(): void {
    this.revokeProfileImageObjectUrl();
    this.profileImagePreviewUrl = null;
  }

  private maybeOpenForcedPasswordModal(): void {
    if (this.forcePasswordChangeRequired) {
      this.showChangePasswordModal = true;
    }
  }

  private clearChangePasswordQueryParam(): void {
    if (this.route.snapshot.queryParamMap.get('changePassword') !== '1') {
      return;
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { changePassword: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private revokeProfileImageObjectUrl(): void {
    if (this.profileImageObjectUrl) {
      URL.revokeObjectURL(this.profileImageObjectUrl);
      this.profileImageObjectUrl = null;
    }
  }
}
