import {
  resolveMediaDisplaySrc,
  resolveSignedDisplayUrl,
  validateMediaImageFile,
  MEDIA_IMAGE_MAX_BYTES_DEFAULT,
} from './media-url.util';

describe('media-url.util', () => {
  it('resolves signed display urls from known fields', () => {
    expect(resolveSignedDisplayUrl({ profile_image_full_url: 'https://signed.example/a.webp' }))
      .toBe('https://signed.example/a.webp');
    expect(resolveSignedDisplayUrl({ logo_full_url: 'https://signed.example/logo.webp' }))
      .toBe('https://signed.example/logo.webp');
  });

  it('rewrites absolute API media urls to same-origin /api paths', () => {
    expect(
      resolveMediaDisplaySrc(
        'http://127.0.0.1:8000/api/tenant/media/serve?token=abc&signature=def'
      )
    ).toBe('/api/tenant/media/serve?token=abc&signature=def');
    expect(resolveMediaDisplaySrc('/api/tenant/media/serve?token=abc')).toBe(
      '/api/tenant/media/serve?token=abc'
    );
  });

  it('validates supported image files', () => {
    const valid = new File(['x'], 'photo.webp', { type: 'image/webp' });
    Object.defineProperty(valid, 'size', { value: 1024 });
    expect(validateMediaImageFile(valid)).toBeNull();

    const invalid = new File(['x'], 'notes.txt', { type: 'text/plain' });
    expect(validateMediaImageFile(invalid)).toContain('WebP');

    const oversized = new File(['x'], 'big.webp', { type: 'image/webp' });
    Object.defineProperty(oversized, 'size', { value: MEDIA_IMAGE_MAX_BYTES_DEFAULT + 1 });
    expect(validateMediaImageFile(oversized)).toContain('3 MB');
  });
});
