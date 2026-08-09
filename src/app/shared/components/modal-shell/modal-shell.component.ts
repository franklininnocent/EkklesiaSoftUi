import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import {
  restoreActiveElement,
  saveActiveElement,
  trapFocus,
} from '@shared/utils/focus-trap.util';

export type ModalShellSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';

/**
 * ModalShell
 *
 * Single dialog chrome (overlay, container, header, close button, footer
 * slot) shared by every modal in the app. Replaces per-feature hand-rolled
 * modal shells so focus trapping, focus restoration, and Escape-to-close
 * only need to be implemented once.
 *
 * Consumers project their own body content (default slot) and footer
 * buttons (`[modalFooter]` slot); the shell owns overlay/dialog chrome and
 * accessibility behavior only. Mount/unmount via `*ngIf` at the call site —
 * the shell is considered "open" for as long as it is present in the DOM.
 */
@Component({
  selector: 'app-modal-shell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal-shell.component.html',
  styleUrl: './modal-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ModalShellComponent implements OnInit, AfterViewInit, OnDestroy {
  private static idCounter = 0;
  private static openCount = 0;

  /** Dialog title, rendered as the modal's accessible `<h2>` heading. */
  @Input() title = '';
  /** Optional subtitle / description under the title. */
  @Input() description = '';
  /** Overrides the generated `aria-labelledby` id (rarely needed). */
  @Input() titleId?: string;
  /** Used for `aria-label` when no visible `title` is provided. */
  @Input() ariaLabel?: string;
  /** Dialog width variant. */
  @Input() size: ModalShellSize = 'md';
  /**
   * Blocks Escape, backdrop-click, and the close button while a submit is
   * in flight, matching the existing `saving`/`loading` guard pattern used
   * across the app's modals.
   */
  @Input() isSubmitting = false;
  /** Accessible label for the close ("X") button. */
  @Input() closeAriaLabel = 'Close';
  /**
   * When true, uses the nested modal z-index (e.g. confirmation above a form).
   */
  @Input() nested = false;
  /**
   * Header density. 'compact' matches the CF split-card header used by
   * inline stewardship forms (e.g. Offering Categories "Add category") for
   * modals that host that same form language — tighter title scale, tinted
   * background, no vertical inset beyond the header's own padding.
   */
  @Input() headerVariant: 'default' | 'compact' = 'default';
  /**
   * Body padding. 'none' lets projected content (e.g. `.cf-split-form-body`)
   * own its own padding instead of double-padding inside the shell body.
   */
  @Input() bodyPadding: 'default' | 'none' = 'default';

  /** Emitted on Escape, backdrop click, or close-button click. */
  @Output() closeRequested = new EventEmitter<void>();

  @ViewChild('dialogEl', { static: true }) private dialogRef?: ElementRef<HTMLElement>;

  private readonly generatedTitleId = `cf-modal-title-${ModalShellComponent.idCounter++}`;
  private readonly generatedDescId = `cf-modal-desc-${ModalShellComponent.idCounter}`;
  private previousActiveElement: HTMLElement | null = null;
  private focusTrapCleanup: (() => void) | null = null;
  private previousBodyOverflow = '';

  get resolvedTitleId(): string {
    return this.titleId || this.generatedTitleId;
  }

  get resolvedDescId(): string {
    return this.generatedDescId;
  }

  ngOnInit(): void {
    this.previousActiveElement = saveActiveElement();
    document.addEventListener('keydown', this.handleKeyDown);
    ModalShellComponent.openCount += 1;
    if (ModalShellComponent.openCount === 1) {
      this.previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
  }

  ngAfterViewInit(): void {
    if (this.dialogRef?.nativeElement) {
      this.focusTrapCleanup = trapFocus(this.dialogRef.nativeElement);
    }
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
    this.focusTrapCleanup?.();
    this.focusTrapCleanup = null;
    restoreActiveElement(this.previousActiveElement);
    ModalShellComponent.openCount = Math.max(0, ModalShellComponent.openCount - 1);
    if (ModalShellComponent.openCount === 0) {
      document.body.style.overflow = this.previousBodyOverflow;
    }
  }

  onBackdropClick(): void {
    if (!this.isSubmitting) {
      this.closeRequested.emit();
    }
  }

  onCloseClick(): void {
    if (!this.isSubmitting) {
      this.closeRequested.emit();
    }
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && !this.isSubmitting) {
      event.preventDefault();
      this.closeRequested.emit();
    }
  };
}
