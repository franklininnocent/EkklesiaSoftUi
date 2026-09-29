import {
  resolveSignedDisplayUrl,
  resolveSignedThumbUrl,
  validateMediaImageFile,
} from './media-url.util';

export const USER_PROFILE_IMAGE_MAX_BYTES = 3 * 1024 * 1024;

export const USER_PROFILE_IMAGE_ACCEPT = 'image/jpeg,image/jpg,image/png,image/webp';

export function resolveUserProfileImageUrl(
  source?: { profile_image_full_url?: string | null; profile_image_thumb_url?: string | null } | null
): string | null {
  return resolveSignedDisplayUrl(source);
}

export function resolveUserProfileImageThumbUrl(
  source?: { profile_image_thumb_url?: string | null } | null
): string | null {
  return resolveSignedThumbUrl(source);
}

export function getUserInitials(name?: string | null): string {
  if (!name?.trim()) {
    return '?';
  }

  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  return name.substring(0, 2).toUpperCase();
}

export function getUserAvatarColorClass(name?: string | null): string {
  if (!name?.trim()) {
    return 'avatar-color-1';
  }

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return `avatar-color-${(Math.abs(hash) % 8) + 1}`;
}

export function validateUserProfileImageFile(file: File): string | null {
  return validateMediaImageFile(file, USER_PROFILE_IMAGE_MAX_BYTES);
}

export async function validateUserProfileImageFileAsync(file: File): Promise<string | null> {
  const syncError = validateUserProfileImageFile(file);
  if (syncError) {
    return syncError;
  }

  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file);
      bitmap.close();
    } else {
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('invalid'));
        img.src = URL.createObjectURL(file);
      });
    }
  } catch {
    return 'The selected file is not a valid image.';
  }

  return null;
}
