import {
  getUserAvatarColorClass,
  getUserInitials,
  resolveUserProfileImageUrl,
  USER_PROFILE_IMAGE_MAX_BYTES,
  validateUserProfileImageFile,
} from './user-profile-image.util';

describe('user-profile-image.util', () => {
  it('resolves profile image url', () => {
    expect(resolveUserProfileImageUrl({ profile_image_full_url: 'https://example.test/a.jpg' }))
      .toBe('https://example.test/a.jpg');
    expect(resolveUserProfileImageUrl({ profile_image_full_url: '  ' })).toBeNull();
  });

  it('builds initials and color classes', () => {
    expect(getUserInitials('Jane Doe')).toBe('JD');
    expect(getUserAvatarColorClass('Jane Doe')).toMatch(/^avatar-color-/);
  });

  it('validates supported image files', () => {
    const valid = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(valid, 'size', { value: 1024 });

    expect(validateUserProfileImageFile(valid)).toBeNull();

    const invalid = new File(['x'], 'notes.txt', { type: 'text/plain' });
    expect(validateUserProfileImageFile(invalid)).toContain('JPG');

    const oversized = new File(['x'], 'big.jpg', { type: 'image/jpeg' });
    Object.defineProperty(oversized, 'size', { value: USER_PROFILE_IMAGE_MAX_BYTES + 1 });
    expect(validateUserProfileImageFile(oversized)).toContain('3 MB');
  });
});
