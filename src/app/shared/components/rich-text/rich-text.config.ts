import type { AnyExtension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';

export interface RichTextExtensionsOptions {
  placeholder?: string;
  /** When false, links open on click (read-only surfaces). */
  editable?: boolean;
}

/**
 * Shared TipTap OSS extension set for the enterprise rich-text editor.
 * Excludes images, tables, mentions, code blocks, colors, embeds, and paid features.
 */
export function createRichTextExtensions(options: RichTextExtensionsOptions = {}): AnyExtension[] {
  const editable = options.editable !== false;

  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: false,
      code: false,
    }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
      alignments: ['left', 'center', 'right', 'justify'],
    }),
    Link.configure({
      openOnClick: !editable,
      autolink: true,
      linkOnPaste: true,
      HTMLAttributes: {
        rel: 'noopener noreferrer',
        target: '_blank',
      },
      protocols: ['http', 'https', 'mailto'],
      validate: (href) => /^(https?:|mailto:)/i.test(href),
    }),
    Placeholder.configure({
      placeholder: options.placeholder ?? '',
      emptyEditorClass: 'is-editor-empty',
    }),
  ];
}

/** Allowed link schemes for UI validation (backend allowlist is authoritative). */
export function isSafeRichTextUrl(url: string): boolean {
  return /^(https?:\/\/|mailto:)/i.test(url.trim());
}
