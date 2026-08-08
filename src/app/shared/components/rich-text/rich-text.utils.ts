/**
 * Helpers for TipTap HTML strings stored as nullable API text fields.
 */

const EMPTY_HTML_RE = /^(\s|&nbsp;|<p><\/p>|<p>\s*<\/p>|<p><br\s*\/?><\/p>|<br\s*\/?>)*$/i;
const HAS_HTML_TAG_RE = /<\/?[a-z][\s\S]*>/i;

/** True when the editor produced no meaningful content. */
export function isEmptyRichText(value: string | null | undefined): boolean {
  if (value == null) {
    return true;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return true;
  }
  return EMPTY_HTML_RE.test(trimmed);
}

/**
 * Normalize outgoing form values for API payloads:
 * empty / placeholder HTML → ''.
 */
export function normalizeRichTextOutgoing(value: string | null | undefined): string {
  if (isEmptyRichText(value)) {
    return '';
  }
  return String(value).trim();
}

/** API payload helper: empty rich text → null. */
export function richTextToPayload(value: string | null | undefined): string | null {
  const normalized = normalizeRichTextOutgoing(value);
  return normalized || null;
}

/** Detect legacy plain-text values that predate HTML storage. */
export function looksLikeHtml(value: string): boolean {
  return HAS_HTML_TAG_RE.test(value.trim());
}

/**
 * Convert plain text (with newlines) into safe TipTap-friendly HTML paragraphs.
 * Escapes HTML entities so raw `<` in legacy text is not interpreted as tags.
 */
export function plainTextToHtml(value: string): string {
  const escaped = value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`);

  return paragraphs.length ? paragraphs.join('') : '';
}

/**
 * Prepare a stored value for TipTap `setContent`.
 * Legacy plain text is converted; empty becomes ''.
 */
export function prepareRichTextForEditor(value: string | null | undefined): string {
  if (isEmptyRichText(value)) {
    return '';
  }
  const raw = String(value);
  if (!looksLikeHtml(raw)) {
    return plainTextToHtml(raw);
  }
  return raw.trim();
}
