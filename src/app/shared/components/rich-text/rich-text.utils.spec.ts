import {
  isEmptyRichText,
  looksLikeHtml,
  normalizeRichTextOutgoing,
  plainTextToHtml,
  prepareRichTextForEditor,
  richTextToPayload,
} from './rich-text.utils';

describe('rich-text.utils', () => {
  describe('isEmptyRichText', () => {
    it('treats null, blank, and empty paragraph markup as empty', () => {
      expect(isEmptyRichText(null)).toBe(true);
      expect(isEmptyRichText('')).toBe(true);
      expect(isEmptyRichText('   ')).toBe(true);
      expect(isEmptyRichText('<p></p>')).toBe(true);
      expect(isEmptyRichText('<p><br></p>')).toBe(true);
      expect(isEmptyRichText('<p><br/></p>')).toBe(true);
    });

    it('treats meaningful html as non-empty', () => {
      expect(isEmptyRichText('<p>Hello</p>')).toBe(false);
      expect(isEmptyRichText('<ul><li>One</li></ul>')).toBe(false);
    });
  });

  describe('normalizeRichTextOutgoing / richTextToPayload', () => {
    it('normalizes empty markup to empty string / null', () => {
      expect(normalizeRichTextOutgoing('<p></p>')).toBe('');
      expect(richTextToPayload('<p></p>')).toBeNull();
      expect(richTextToPayload('<p>Goals</p>')).toBe('<p>Goals</p>');
    });
  });

  describe('plain text handling', () => {
    it('detects html vs plain text', () => {
      expect(looksLikeHtml('<p>Hi</p>')).toBe(true);
      expect(looksLikeHtml('Hello\nWorld')).toBe(false);
    });

    it('converts plain text newlines into paragraphs', () => {
      const html = plainTextToHtml('Line one\n\nLine two\nmore');
      expect(html).toContain('<p>Line one</p>');
      expect(html).toContain('<p>Line two<br>more</p>');
    });

    it('escapes html special characters in plain text', () => {
      expect(plainTextToHtml('a < b & c')).toBe('<p>a &lt; b &amp; c</p>');
    });

    it('prepares legacy plain text for the editor', () => {
      expect(prepareRichTextForEditor('Objectives:\nOne')).toBe(
        '<p>Objectives:<br>One</p>'
      );
      expect(prepareRichTextForEditor('<p>Already html</p>')).toBe('<p>Already html</p>');
      expect(prepareRichTextForEditor('<p></p>')).toBe('');
    });
  });
});
