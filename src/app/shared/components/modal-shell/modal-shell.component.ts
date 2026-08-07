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

  /** Dialog title, rendered as the modal's accessible `<h2>` heading. */
  @Input() title = '';
  /** Overrides the generated `aria-labelledby` id (rarely needed). */
  @Input() titleId?: string;
  /** Used for `aria-label` when no visible `title` is provided. */
  @Input() ariaLabel?: string;
  /** Dialog width variant. */
  @Input() size: 'sm' | 'md' = 'md';
  /**
   * Blocks Escape, backdrop-click, and the close button while a submit is
   * in flight, matching the existing `saving`/`loading` guard pattern used
   * across the app's modals.
   */
  @Input() isSubmitting = false;
  /** Accessible label for the close ("X") button. */
  @Input() closeAriaLabel = 'Close';

  /** Emitted on Escape, backdrop click, or close-button click. */
  @Output() closeRequested = new EventEmitter<void>();

  @ViewChild('dialogEl', { static: true }) private dialogRef?: ElementRef<HTMLElement>;

  private readonly generatedTitleId = `cf-modal-title-${ModalShellComponent.idCounter++}`;
  private previousActiveElement: HTMLElement | null = null;
  private focusTrapCleanup: (() => void) | null = null;

  get resolvedTitleId(): string {
    return this.titleId || this.generatedTitleId;
  }

  ngOnInit(): void {
    this.previousActiveElement = saveActiveElement();
    document.addEventListener('keydown', this.handleKeyDown);
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
