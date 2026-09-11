import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { of, throwError } from 'rxjs';
import { ProfileComponent } from './profile.component';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { User } from '@core/models';
import * as AuthActions from '@core/store/auth/auth.actions';

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
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(MockStore);
    jest.spyOn(store, 'dispatch');
    (authStub.canManageOwnProfileImage as jest.Mock).mockReturnValue(true);
    (authStub.uploadMyProfileImage as jest.Mock).mockClear();
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
  });

  it('hides photo controls for non-tenant administrators', () => {
    (authStub.canManageOwnProfileImage as jest.Mock).mockReturnValue(false);
    fixture.detectChanges();
    expect(component.canManageOwnProfileImage(user)).toBe(false);
  });

  it('uploads profile image through auth self-service endpoint', () => {
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 1024 });
    component.selectedProfileImage = file;
    component.saveProfileImageChanges(user);

    expect(authStub.uploadMyProfileImage).toHaveBeenCalledWith(file);
    expect(authStub.syncCurrentUser).toHaveBeenCalled();
    expect(store.dispatch).toHaveBeenCalledWith(
      AuthActions.loadUserSuccess({
        user: { ...user, profile_image_full_url: 'https://example.test/photo.jpg' },
      })
    );
    expect(toastStub.success).toHaveBeenCalled();
  });

  it('surfaces upload errors', () => {
    (authStub.uploadMyProfileImage as jest.Mock).mockReturnValueOnce(
      throwError(() => ({ error: { message: 'Upload failed' } }))
    );

    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 1024 });
    component.selectedProfileImage = file;
    component.saveProfileImageChanges(user);

    expect(component.profileImageError).toBe('Upload failed');
    expect(toastStub.error).toHaveBeenCalled();
  });
});
