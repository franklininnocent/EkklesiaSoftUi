import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Injector,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  forwardRef,
  inject,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR, NgControl } from '@angular/forms';
import { Editor } from '@tiptap/core';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { createRichTextExtensions, isSafeRichTextUrl } from '../rich-text.config';
import {
  isEmptyRichText,
  normalizeRichTextOutgoing,
  prepareRichTextForEditor,
} from '../rich-text.utils';

type ToolbarMenu = 'heading' | 'align' | 'format' | 'lists' | 'more' | null;
type AlignValue = 'left' | 'center' | 'right' | 'justify';

@Component({
  selector: 'app-rich-text-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalShellComponent],
  templateUrl: './rich-text-editor.component.html',
  styleUrl: './rich-text-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichTextEditorComponent),
      multi: true,
    },
  ],
  host: {
    class: 'rich-text-editor-host',
    '[class.rich-text-editor-host--disabled]': 'isDisabled',
    '[class.rich-text-editor-host--invalid]': 'showInvalid',
  },
})
export class RichTextEditorComponent
  implements ControlValueAccessor, AfterViewInit, OnDestroy, OnChanges
{
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly injector = inject(Injector);
  private readonly hostEl = inject(ElementRef<HTMLElement>);

  @ViewChild('editorHost', { static: true }) editorHost!: ElementRef<HTMLDivElement>;
  @ViewChild('editorBody', { static: true }) editorBodyRef!: ElementRef<HTMLDivElement>;
  @ViewChild('bubbleMenu', { static: true }) bubbleMenuRef!: ElementRef<HTMLDivElement>;

  @Input() placeholder = '';
  /** Fixed editable viewport height (CSS length). Content scrolls internally. */
  @Input() height = '16.5rem';
  @Input() id = 'rich-text-editor';
  @Input() ariaLabel?: string;

  editor: Editor | null = null;
  isDisabled = false;
  openMenu: ToolbarMenu = null;

  bubbleVisible = false;
  bubbleLeft = 0;
  bubbleTop = 0;

  linkDialogOpen = false;
  linkUrl = '';
  linkError: string | null = null;

  private pendingValue: string | null = null;
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private ngControl: NgControl | null = null;
  private touched = false;

  get heightSm(): string {
    const match = /^([\d.]+)rem$/i.exec(this.height.trim());
    if (match) {
      const value = Number(match[1]);
      if (!Number.isNaN(value)) {
        return `${Math.max(12, Math.min(value, 14))}rem`;
      }
    }
    return '14rem';
  }

  get showInvalid(): boolean {
    const control = this.ngControl?.control;
    if (!control) {
      return false;
    }
    return control.invalid && (control.touched || control.dirty);
  }

  get blockLabel(): string {
    if (this.isActive('heading', { level: 1 })) {
      return 'Heading 1';
    }
    if (this.isActive('heading', { level: 2 })) {
      return 'Heading 2';
    }
    if (this.isActive('heading', { level: 3 })) {
      return 'Heading 3';
    }
    return 'Paragraph';
  }

  get alignLabel(): string {
    if (this.isActive({ textAlign: 'center' })) {
      return 'Center';
    }
    if (this.isActive({ textAlign: 'right' })) {
      return 'Right';
    }
    if (this.isActive({ textAlign: 'justify' })) {
      return 'Justify';
    }
    return 'Left';
  }

  ngAfterViewInit(): void {
    this.ngControl = this.injector.get(NgControl, null, { optional: true, self: true });
    this.zone.runOutsideAngular(() => {
      this.editor = new Editor({
        element: this.editorHost.nativeElement,
        extensions: createRichTextExtensions({
          placeholder: this.placeholder,
          editable: !this.isDisabled,
        }),
        editable: !this.isDisabled,
        content: prepareRichTextForEditor(this.pendingValue),
        editorProps: {
          attributes: {
            id: this.id,
            class: 'rich-text-editor__content',
            role: 'textbox',
            'aria-multiline': 'true',
            ...(this.ariaLabel ? { 'aria-label': this.ariaLabel } : {}),
          },
        },
        onUpdate: ({ editor }) => {
          const html = editor.isEmpty ? '' : normalizeRichTextOutgoing(editor.getHTML());
          this.zone.run(() => {
            this.onChange(html);
            this.syncBubbleMenu();
            this.cdr.markForCheck();
          });
        },
        onSelectionUpdate: () => {
          this.zone.run(() => {
            this.syncBubbleMenu();
            this.cdr.markForCheck();
          });
        },
        onTransaction: () => {
          this.zone.run(() => {
            this.syncBubbleMenu();
            this.cdr.markForCheck();
          });
        },
        onBlur: ({ event }) => {
          const related = (event as FocusEvent | undefined)?.relatedTarget as Node | null;
          if (related && this.bubbleMenuRef?.nativeElement.contains(related)) {
            return;
          }
          this.zone.run(() => {
            this.markTouched();
            this.hideBubbleSoon();
            this.cdr.markForCheck();
          });
        },
        onFocus: () => {
          this.zone.run(() => {
            this.syncBubbleMenu();
            this.cdr.markForCheck();
          });
        },
      });
    });

    this.pendingValue = null;
    this.cdr.markForCheck();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['height']) {
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
    this.editor = null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.openMenu) {
      return;
    }
    const target = event.target as Node | null;
    if (target && this.hostEl.nativeElement.contains(target)) {
      return;
    }
    this.openMenu = null;
    this.cdr.markForCheck();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (this.bubbleVisible) {
      this.syncBubbleMenu();
    }
  }

  writeValue(value: string | null): void {
    const prepared = prepareRichTextForEditor(value);
    if (!this.editor) {
      this.pendingValue = prepared;
      return;
    }
    const current = this.editor.isEmpty ? '' : normalizeRichTextOutgoing(this.editor.getHTML());
    if (current === prepared || (isEmptyRichText(current) && isEmptyRichText(prepared))) {
      return;
    }
    this.zone.runOutsideAngular(() => {
      this.editor?.commands.setContent(prepared || '', { emitUpdate: false });
    });
    this.syncBubbleMenu();
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
    this.editor?.setEditable(!isDisabled);
    if (isDisabled) {
      this.openMenu = null;
      this.linkDialogOpen = false;
      this.bubbleVisible = false;
    }
    this.cdr.markForCheck();
  }

  isActive(nameOrAttrs: string | Record<string, unknown>, attrs?: Record<string, unknown>): boolean {
    if (!this.editor) {
      return false;
    }
    if (typeof nameOrAttrs === 'string') {
      return this.editor.isActive(nameOrAttrs, attrs);
    }
    return this.editor.isActive(nameOrAttrs);
  }

  canUndo(): boolean {
    return !!this.editor && !this.isDisabled && this.editor.can().chain().focus().undo().run();
  }

  canRedo(): boolean {
    return !!this.editor && !this.isDisabled && this.editor.can().chain().focus().redo().run();
  }

  toggleMenu(menu: Exclude<ToolbarMenu, null>, event?: Event): void {
    event?.stopPropagation();
    if (this.isDisabled) {
      return;
    }
    this.openMenu = this.openMenu === menu ? null : menu;
  }

  closeMenus(): void {
    this.openMenu = null;
  }

  run(command: () => boolean): void {
    if (!this.editor || this.isDisabled) {
      return;
    }
    this.zone.runOutsideAngular(() => {
      command();
    });
    this.markTouched();
    this.syncBubbleMenu();
    this.cdr.markForCheck();
  }

  undo(): void {
    this.run(() => !!this.editor?.chain().focus().undo().run());
  }

  redo(): void {
    this.run(() => !!this.editor?.chain().focus().redo().run());
  }

  setParagraph(): void {
    this.run(() => !!this.editor?.chain().focus().setParagraph().run());
    this.closeMenus();
  }

  setHeading(level: 1 | 2 | 3): void {
    this.run(() => !!this.editor?.chain().focus().toggleHeading({ level }).run());
    this.closeMenus();
  }

  toggleBold(): void {
    this.run(() => !!this.editor?.chain().focus().toggleBold().run());
  }

  toggleItalic(): void {
    this.run(() => !!this.editor?.chain().focus().toggleItalic().run());
  }

  toggleUnderline(): void {
    this.run(() => !!this.editor?.chain().focus().toggleUnderline().run());
  }

  toggleStrike(): void {
    this.run(() => !!this.editor?.chain().focus().toggleStrike().run());
  }

  setAlign(align: AlignValue): void {
    this.run(() => !!this.editor?.chain().focus().setTextAlign(align).run());
    this.closeMenus();
  }

  toggleBulletList(): void {
    this.run(() => !!this.editor?.chain().focus().toggleBulletList().run());
    this.closeMenus();
  }

  toggleOrderedList(): void {
    this.run(() => !!this.editor?.chain().focus().toggleOrderedList().run());
    this.closeMenus();
  }

  sinkListItem(): void {
    this.run(() => !!this.editor?.chain().focus().sinkListItem('listItem').run());
    this.closeMenus();
  }

  liftListItem(): void {
    this.run(() => !!this.editor?.chain().focus().liftListItem('listItem').run());
    this.closeMenus();
  }

  toggleBlockquote(): void {
    this.run(() => !!this.editor?.chain().focus().toggleBlockquote().run());
    this.closeMenus();
  }

  insertHorizontalRule(): void {
    this.run(() => !!this.editor?.chain().focus().setHorizontalRule().run());
    this.closeMenus();
  }

  clearFormatting(): void {
    this.run(() => !!this.editor?.chain().focus().unsetAllMarks().clearNodes().run());
    this.closeMenus();
  }

  openLinkDialog(): void {
    if (!this.editor || this.isDisabled) {
      return;
    }
    this.closeMenus();
    const previous = this.editor.getAttributes('link')['href'] as string | undefined;
    this.linkUrl = previous || 'https://';
    this.linkError = null;
    this.linkDialogOpen = true;
    this.bubbleVisible = false;
  }

  closeLinkDialog(): void {
    this.linkDialogOpen = false;
    this.linkError = null;
  }

  applyLink(): void {
    const trimmed = this.linkUrl.trim();
    if (!trimmed) {
      this.removeLink();
      return;
    }
    if (!isSafeRichTextUrl(trimmed)) {
      this.linkError = 'Use an http(s) or mailto link.';
      return;
    }
    this.run(() =>
      !!this.editor?.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run()
    );
    this.closeLinkDialog();
  }

  removeLink(): void {
    this.run(() => !!this.editor?.chain().focus().extendMarkRange('link').unsetLink().run());
    this.closeLinkDialog();
  }

  onToolbarKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.openMenu) {
      this.openMenu = null;
      event.stopPropagation();
      this.cdr.markForCheck();
    }
  }

  private syncBubbleMenu(): void {
    if (!this.editor || this.isDisabled || this.linkDialogOpen) {
      this.bubbleVisible = false;
      return;
    }

    const { state, view } = this.editor;
    const { empty, from, to } = state.selection;
    if (empty || from === to || !view.hasFocus()) {
      this.bubbleVisible = false;
      return;
    }

    const start = view.coordsAtPos(from);
    const end = view.coordsAtPos(to);
    const bodyRect = this.editorBodyRef.nativeElement.getBoundingClientRect();
    const midX = (start.left + end.left) / 2 - bodyRect.left;
    const top = Math.min(start.top, end.top) - bodyRect.top - 44;

    this.bubbleLeft = Math.max(24, Math.min(midX, bodyRect.width - 24));
    this.bubbleTop = Math.max(8, top);
    this.bubbleVisible = true;
  }

  private hideBubbleSoon(): void {
    // Small delay so bubble buttons can receive click before blur hides them.
    window.setTimeout(() => {
      if (!this.editor?.view.hasFocus()) {
        this.bubbleVisible = false;
        this.cdr.markForCheck();
      }
    }, 120);
  }

  private markTouched(): void {
    if (!this.touched) {
      this.touched = true;
      this.onTouched();
    }
  }
}
