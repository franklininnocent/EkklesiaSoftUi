import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { of, throwError } from 'rxjs';
import { ProfileComponent } from './profile.component';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { User } from '@core/models';
import * as AuthActions from '@core/store/auth/auth.actions';
import * as UserProfileImageUtil from '@core/utils/user-profile-image.util';

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;
  let store: MockStore;

  const user: User = {
    id: 7,
    name: 'Admin User',
    email: 'admin@example.com',
    user_type: 1,
    tenant_id: 1,
    active: 1,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    profile_image_full_url: null,
    tenant: {
      id: 1,
      name: 'St. Mary Parish',
      tenant_tier: 'parish',
    },
    roles: [{
      id: 1,
      name: 'Administrator',
      level: 1,
      active: 1,
      is_custom: false,
      permissions: [],
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    }],
  };

  const authStub = {
    isAuthenticated: jest.fn().mockReturnValue(true),
    canManageOwnProfileImage: jest.fn().mockReturnValue(true),
    uploadMyProfileImage: jest.fn().mockReturnValue(of({
      success: true,
      message: 'Profile image uploaded successfully.',
      data: { ...user, profile_image_full_url: 'https://example.test/photo.jpg' },
    })),
    deleteMyProfileImage: jest.fn().mockReturnValue(of({
      success: true,
      message: 'Profile image removed successfully.',
      data: { ...user, profile_image_full_url: null },
    })),
    syncCurrentUser: jest.fn(),
  } as unknown as AuthService;

  const toastStub = {
    success: jest.fn(),
    error: jest.fn(),
  } as unknown as ToastService;

  beforeEach(async () => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(() => 'blob:preview'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideMockStore({
          initialState: {
            auth: {
              user,
              isAuthenticated: true,
              loading: false,
              error: null,
              token: 'token',
            },
          },
        }),
        { provide: AuthService, useValue: authStub },
        { provide: ToastService, useValue: toastStub },
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: of(convertToParamMap({})) },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(MockStore);
    jest.spyOn(store, 'dispatch');
    jest.spyOn(UserProfileImageUtil, 'validateUserProfileImageFileAsync').mockResolvedValue(null);
    (authStub.canManageOwnProfileImage as jest.Mock).mockReturnValue(true);
    (authStub.uploadMyProfileImage as jest.Mock).mockClear();
    (authStub.deleteMyProfileImage as jest.Mock).mockClear();
    (authStub.syncCurrentUser as jest.Mock).mockClear();
    (toastStub.success as jest.Mock).mockClear();
    (toastStub.error as jest.Mock).mockClear();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows photo controls for tenant administrators', () => {
    expect(component.canManageOwnProfileImage(user)).toBe(true);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('#profile_photo')).toBeTruthy();
    expect(compiled.textContent).toContain('Change photo');
  });

  it('hides photo controls for non-tenant administrators', () => {
    (authStub.canManageOwnProfileImage as jest.Mock).mockReturnValue(false);
    const restrictedFixture = TestBed.createComponent(ProfileComponent);
    restrictedFixture.detectChanges();
    expect(restrictedFixture.componentInstance.canManageOwnProfileImage(user)).toBe(false);
    const compiled = restrictedFixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('#profile_photo')).toBeFalsy();
  });

  it('renders account status from user.active', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Active');
    expect(component.getAccountStatusLabel(user)).toBe('Active');
    expect(component.getAccountStatusTone(user)).toBe('success');
  });

  it('renders role and parish information', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Administrator');
    expect(compiled.textContent).toContain('St. Mary Parish');
    expect(compiled.textContent).toContain('Parish');
    expect(component.getRoleNames(user)).toEqual(['Administrator']);
    expect(component.formatTenantTier('parish')).toBe('Parish');
  });

  it('uploads profile image immediately after a valid file is selected', async () => {
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 1024 });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });

    component.onProfilePhotoSelected({ target: input } as unknown as Event, user);
    await Promise.resolve();
    await Promise.resolve();

    expect(authStub.uploadMyProfileImage).toHaveBeenCalledWith(file);
    expect(authStub.syncCurrentUser).toHaveBeenCalled();
    expect(store.dispatch).toHaveBeenCalledWith(
      AuthActions.loadUserSuccess({
        user: { ...user, profile_image_full_url: 'https://example.test/photo.jpg' },
      })
    );
    expect(toastStub.success).toHaveBeenCalled();
  });

  it('surfaces upload errors and restores the saved photo preview', async () => {
    (authStub.uploadMyProfileImage as jest.Mock).mockReturnValueOnce(
      throwError(() => ({ error: { message: 'Upload failed' } }))
    );

    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 1024 });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });

    component.onProfilePhotoSelected({ target: input } as unknown as Event, user);
    await Promise.resolve();
    await Promise.resolve();

    expect(component.profileImageError).toBe('Upload failed');
    expect(component.profileImagePreviewUrl).toBeNull();
    expect(toastStub.error).toHaveBeenCalled();
  });

  it('removes profile image through auth self-service endpoint', () => {
    component.removeProfilePhoto({ ...user, profile_image_full_url: 'https://example.test/photo.jpg' });

    expect(authStub.deleteMyProfileImage).toHaveBeenCalled();
    expect(authStub.syncCurrentUser).toHaveBeenCalled();
    expect(store.dispatch).toHaveBeenCalledWith(
      AuthActions.loadUserSuccess({
        user: { ...user, profile_image_full_url: null },
      })
    );
    expect(toastStub.success).toHaveBeenCalled();
  });
});
