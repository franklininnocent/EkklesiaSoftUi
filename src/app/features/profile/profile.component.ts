import { Component, inject, OnDestroy, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { Observable, Subject, finalize } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AppState } from '@core/store';
import { User } from '@core/models';
import { selectCurrentUser } from '@core/store/auth/auth.selectors';
import * as AuthActions from '@core/store/auth/auth.actions';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { UserAvatarComponent, ImageViewerComponent, CfMediaUploadComponent } from '@shared/components';
import {
  resolveUserProfileImageUrl,
  USER_PROFILE_IMAGE_ACCEPT,
  validateUserProfileImageFileAsync,
} from '@core/utils/user-profile-image.util';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, UserAvatarComponent, ImageViewerComponent, CfMediaUploadComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileComponent implements OnInit, OnDestroy {
  @ViewChild('profileMediaUpload') profileMediaUpload?: CfMediaUploadComponent;

  private store = inject(Store<AppState>);
  private cdr = inject(ChangeDetectorRef);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private destroy$ = new Subject<void>();

  currentUser$: Observable<User | null>;
  photoViewer: { src: string; alt: string; title: string; subtitle: string } | null = null;

  readonly profileImageAccept = USER_PROFILE_IMAGE_ACCEPT;

  selectedProfileImage: File | null = null;
  profileImagePreviewUrl: string | null = null;
  removeProfileImage = false;
  profileImageError: string | null = null;
  isSavingProfileImage = false;

  private profileImageObjectUrl: string | null = null;
  private savedProfileImageUrl: string | null = null;

  constructor() {
    this.currentUser$ = this.store.select(selectCurrentUser).pipe(takeUntil(this.destroy$));
    this.currentUser$.subscribe((user) => {
      this.savedProfileImageUrl = user ? resolveUserProfileImageUrl(user) : null;
      this.cdr.markForCheck();
    });
  }

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.store.dispatch(AuthActions.loadUser());
    }
  }

  ngOnDestroy(): void {
    this.revokeProfileImageObjectUrl();
    this.destroy$.next();
    this.destroy$.complete();
  }

  canManageOwnProfileImage(user: User | null): boolean {
    return this.authService.canManageOwnProfileImage(user);
  }

  get displayProfileImageUrl(): string | null {
    if (this.profileImagePreviewUrl) {
      return this.profileImagePreviewUrl;
    }

    if (this.removeProfileImage) {
      return null;
    }

    return this.savedProfileImageUrl;
  }

  get savedProfileImagePreviewUrl(): string | null {
    return this.removeProfileImage ? null : this.savedProfileImageUrl;
  }

  get hasPendingProfileImageChange(): boolean {
    return !!this.selectedProfileImage || this.removeProfileImage;
  }

  get hasSavedProfileImage(): boolean {
    return !!this.savedProfileImageUrl;
  }

  getUserPhotoUrl(user: User): string | null {
    if (this.hasPendingProfileImageChange) {
      return this.displayProfileImageUrl;
    }

    return resolveUserProfileImageUrl(user);
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

  onProfileImageValidationError(message: string): void {
    this.profileImageError = message;
    this.cdr.markForCheck();
  }

  onCfProfileImageSelected(file: File): void {
    void this.applyProfileImageFile(file);
  }

  private async applyProfileImageFile(file: File): Promise<void> {
    const error = await validateUserProfileImageFileAsync(file);
    if (error) {
      this.profileImageError = error;
      this.profileMediaUpload?.clearLocalPreview();
      this.cdr.markForCheck();
      return;
    }

    this.revokeProfileImageObjectUrl();
    this.selectedProfileImage = file;
    this.removeProfileImage = false;
    this.profileImageError = null;
    this.profileImageObjectUrl = URL.createObjectURL(file);
    this.profileImagePreviewUrl = this.profileImageObjectUrl;
    this.cdr.markForCheck();
  }

  cancelProfileImageChanges(): void {
    this.profileMediaUpload?.clearLocalPreview();
    this.revokeProfileImageObjectUrl();
    this.selectedProfileImage = null;
    this.profileImagePreviewUrl = null;
    this.removeProfileImage = false;
    this.profileImageError = null;
    this.cdr.markForCheck();
  }

  markProfileImageForRemoval(): void {
    this.profileMediaUpload?.clearLocalPreview();
    this.revokeProfileImageObjectUrl();
    this.selectedProfileImage = null;
    this.profileImagePreviewUrl = null;
    this.removeProfileImage = !!this.savedProfileImageUrl;
    this.profileImageError = null;
    this.cdr.markForCheck();
  }

  saveProfileImageChanges(user: User): void {
    if (!this.canManageOwnProfileImage(user) || !this.hasPendingProfileImageChange || this.isSavingProfileImage) {
      return;
    }

    this.isSavingProfileImage = true;
    this.profileImageError = null;
    this.cdr.markForCheck();

    const request$ = this.selectedProfileImage
      ? this.authService.uploadMyProfileImage(this.selectedProfileImage)
      : this.authService.deleteMyProfileImage();

    request$
      .pipe(
        finalize(() => {
          this.isSavingProfileImage = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (response) => {
          this.profileMediaUpload?.clearLocalPreview();
          this.revokeProfileImageObjectUrl();
          this.selectedProfileImage = null;
          this.profileImagePreviewUrl = null;
          this.removeProfileImage = false;
          this.savedProfileImageUrl = resolveUserProfileImageUrl(response.data);
          this.authService.syncCurrentUser(response.data);
          this.store.dispatch(AuthActions.loadUserSuccess({ user: response.data }));
          this.toastService.success(response.message || 'Profile photo updated.', 'Profile photo');
          this.cdr.markForCheck();
        },
        error: (error) => {
          const message = error.error?.message || 'Unable to update profile photo. Please try again.';
          this.profileImageError = message;
          this.toastService.error(message, 'Profile photo');
          this.cdr.markForCheck();
        },
      });
  }

  private revokeProfileImageObjectUrl(): void {
    if (this.profileImageObjectUrl) {
      URL.revokeObjectURL(this.profileImageObjectUrl);
      this.profileImageObjectUrl = null;
    }
  }
}
