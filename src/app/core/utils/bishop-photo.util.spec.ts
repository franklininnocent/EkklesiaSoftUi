import {
  getBishopInitials,
  hasBishopPhoto,
  resolveBishopPhotoUrl,
  validateBishopPhotoFile,
} from './bishop-photo.util';

describe('bishop-photo.util', () => {
  it('resolves uploaded photo before external url', () => {
    expect(resolveBishopPhotoUrl({
      photo_public_url: 'https://cdn.example.com/uploaded.jpg',
      photo_url: 'https://cdn.example.com/external.jpg',
    })).toBe('https://cdn.example.com/uploaded.jpg');
  });

  it('falls back to photo_url when public url is missing', () => {
    expect(resolveBishopPhotoUrl({
      photo_url: 'https://cdn.example.com/external.jpg',
    })).toBe('https://cdn.example.com/external.jpg');
  });

  it('detects photo presence from has_photo flag', () => {
    expect(hasBishopPhoto({ has_photo: false, photo_url: 'https://example.com/a.jpg' })).toBe(false);
    expect(hasBishopPhoto({ has_photo: true })).toBe(true);
  });

  it('derives initials from bishop name', () => {
    expect(getBishopInitials('Bishop David')).toBe('BD');
  });

  it('validates supported image files', () => {
    const file = new File(['abc'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 1024 });
    expect(validateBishopPhotoFile(file)).toBeNull();
  });

  it('rejects unsupported file types', () => {
    const file = new File(['abc'], 'notes.txt', { type: 'text/plain' });
    expect(validateBishopPhotoFile(file)).toContain('JPG');
  });
});
