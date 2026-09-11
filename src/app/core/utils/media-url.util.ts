export const MEDIA_IMAGE_ACCEPT = 'image/jpeg,image/jpg,image/png,image/webp';

export const MEDIA_IMAGE_MAX_BYTES_DEFAULT = 3 * 1024 * 1024;

export const MEDIA_LOGO_MAX_BYTES = 5 * 1024 * 1024;

export interface SignedMediaUrls {
  displayUrl?: string | null;
  thumbUrl?: string | null;
}

export function resolveSignedDisplayUrl(
  source?: { profile_image_full_url?: string | null; photo_url?: string | null; logo_full_url?: string | null; patron_image_url?: string | null } | null
): string | null {
  const url =
    source?.profile_image_full_url ??
    source?.photo_url ??
    source?.logo_full_url ??
    source?.patron_image_url ??
    null;

  return url && url.trim() ? url.trim() : null;
}

export function resolveSignedThumbUrl(
  source?: { profile_image_thumb_url?: string | null; photo_thumb_url?: string | null; logo_thumb_url?: string | null } | null
): string | null {
  const url = source?.profile_image_thumb_url ?? source?.photo_thumb_url ?? source?.logo_thumb_url ?? null;

  return url && url.trim() ? url.trim() : null;
}

export function validateMediaImageFile(file: File, maxBytes = MEDIA_IMAGE_MAX_BYTES_DEFAULT): string | null {
  if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/i)) {
    return 'Please select a JPG, PNG, or WebP image.';
  }

  if (file.size > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    return `Image must be ${maxMb} MB or smaller.`;
  }

  return null;
}
