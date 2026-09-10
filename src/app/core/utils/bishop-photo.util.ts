export interface BishopPhotoSource {
  photo_public_url?: string | null;
  photo_url?: string | null;
  photo_path?: string | null;
  has_photo?: boolean;
}

export function resolveBishopPhotoUrl(source?: BishopPhotoSource | null): string | null {
  if (!source) {
    return null;
  }

  return source.photo_public_url || source.photo_url || null;
}

export function hasBishopPhoto(source?: BishopPhotoSource | null): boolean {
  if (!source) {
    return false;
  }

  if (typeof source.has_photo === 'boolean') {
    return source.has_photo;
  }

  return !!(source.photo_public_url || source.photo_url || source.photo_path);
}

export function getBishopInitials(name?: string | null): string {
  if (!name?.trim()) {
    return '?';
  }

  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  return name.substring(0, 2).toUpperCase();
}

export const BISHOP_PHOTO_MAX_BYTES = 3 * 1024 * 1024;

export const BISHOP_PHOTO_ACCEPT = 'image/jpeg,image/jpg,image/png,image/webp';

export function validateBishopPhotoFile(file: File): string | null {
  if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/i)) {
    return 'Please select a JPG, PNG, or WebP image.';
  }

  if (file.size > BISHOP_PHOTO_MAX_BYTES) {
    return 'Image must be 3 MB or smaller.';
  }

  return null;
}
