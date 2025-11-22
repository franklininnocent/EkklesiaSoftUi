/**
 * Confirmation Modal Component
 * A reusable modal for confirming actions with optional description/reason input
 * 
 * Features:
 * - Customizable title and message
 * - Optional description input field
 * - Confirm/Cancel actions
 * - Keyboard shortcuts (Enter to confirm, Escape to cancel)
 * - Accessible (ARIA labels, focus management)
 * - Click outside to cancel
 */

import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { trapFocus, saveActiveElement, restoreActiveElement } from '@shared/utils/focus-trap.util';

export interface ConfirmationResult {
  confirmed: boolean;
  description?: string;
}

@Component({
  selector: 'app-confirmation-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './confirmation-modal.component.html',
  styleUrls: ['./confirmation-modal.component.scss'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('200ms ease-out', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0 }))
      ])
    ]),
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'translateY(-20px) scale(0.95)', opacity: 0 }),
        animate('250ms cubic-bezier(0.4, 0, 0.2, 1)', style({ transform: 'translateY(0) scale(1)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ transform: 'translateY(-10px)', opacity: 0 }))
      ])
    ])
  ]
})
export class ConfirmationModalComponent implements OnInit, OnDestroy, AfterViewChecked {
  @Input() show = false;
  @Input() title = 'Confirm Action';
  @Input() message = 'Are you sure you want to proceed?';
  @Input() confirmText = 'Confirm';
  @Input() cancelText = 'Cancel';
  @Input() confirmButtonClass = 'btn-primary';
  @Input() showDescriptionInput = false;
  @Input() descriptionLabel = 'Description (Optional)';
  @Input() descriptionPlaceholder = 'Enter a reason or note...';
  @Input() descriptionMaxLength = 500;
  
  @Output() confirmed = new EventEmitter<ConfirmationResult>();
  @Output() cancelled = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('modalContainer', { static: false }) modalContainerRef?: ElementRef<HTMLElement>;

  description = '';
  isSubmitting = false;
  
  // Focus management
  private previousActiveElement: HTMLElement | null = null;
  private focusTrapCleanup: (() => void) | null = null;
  private modalWasOpen = false;

  ngOnInit(): void {
    // Add keyboard event listeners when modal opens
    if (this.show) {
      document.addEventListener('keydown', this.handleKeyDown);
      this.previousActiveElement = saveActiveElement();
    }
  }

  ngOnDestroy(): void {
    // Clean up event listeners
    document.removeEventListener('keydown', this.handleKeyDown);
    
    // Clean up focus trap
    if (this.focusTrapCleanup) {
      this.focusTrapCleanup();
    }
    
    // Restore previous focus
    if (this.previousActiveElement) {
      restoreActiveElement(this.previousActiveElement);
    }
  }
  
  ngAfterViewChecked(): void {
    // Set up focus trap when modal opens
    if (this.show && !this.modalWasOpen && this.modalContainerRef?.nativeElement) {
      this.focusTrapCleanup = trapFocus(this.modalContainerRef.nativeElement);
      this.modalWasOpen = true;
    } else if (!this.show && this.modalWasOpen) {
      if (this.focusTrapCleanup) {
        this.focusTrapCleanup();
        this.focusTrapCleanup = null;
      }
      this.modalWasOpen = false;
      
      // Restore previous focus
      if (this.previousActiveElement) {
        setTimeout(() => {
          restoreActiveElement(this.previousActiveElement);
          this.previousActiveElement = null;
        }, 100);
      }
    }
  }

  /**
   * Handle keyboard shortcuts
   */
  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.show || this.isSubmitting) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.onCancel();
    } else if (event.key === 'Enter' && event.ctrlKey) {
      // Ctrl+Enter to confirm (prevents accidental confirmation while typing)
      event.preventDefault();
      this.onConfirm();
    }
  };

  /**
   * Handle backdrop click (click outside modal)
   */
  onBackdropClick(event: MouseEvent): void {
    // Only close if clicking the backdrop itself, not the modal content
    if (event.target === event.currentTarget) {
      this.onCancel();
    }
  }

  /**
   * Handle confirm action
   */
  onConfirm(): void {
    if (this.isSubmitting) return;

    this.isSubmitting = true;
    
    const result: ConfirmationResult = {
      confirmed: true,
      description: this.description.trim() || undefined
    };

    this.confirmed.emit(result);
    this.reset();
    
    // Clean up focus trap
    if (this.focusTrapCleanup) {
      this.focusTrapCleanup();
      this.focusTrapCleanup = null;
    }
    
    // Restore previous focus
    if (this.previousActiveElement) {
      setTimeout(() => {
        restoreActiveElement(this.previousActiveElement);
        this.previousActiveElement = null;
      }, 100);
    }
  }

  /**
   * Handle cancel action
   */
  onCancel(): void {
    if (this.isSubmitting) return;

    this.cancelled.emit();
    this.closed.emit();
    this.reset();
  }

  /**
   * Reset modal state
   */
  private reset(): void {
    this.description = '';
    this.isSubmitting = false;
  }

  /**
   * Get remaining characters for description
   */
  get remainingCharacters(): number {
    return this.descriptionMaxLength - this.description.length;
  }

  /**
   * Check if description is too long
   */
  get isDescriptionTooLong(): boolean {
    return this.description.length > this.descriptionMaxLength;
  }
}

