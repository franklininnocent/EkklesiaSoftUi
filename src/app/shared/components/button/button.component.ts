import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Enterprise-Level Standardized Button Component
 * 
 * This component provides a unified button system across the entire application.
 * All buttons follow consistent design, styling, animations, and behavior.
 * 
 * Supported Action Types:
 * - CRUD: add, edit, delete, save, cancel
 * - Navigation: back, next, previous
 * - Actions: filter, search, refresh, export, import
 * - Status: activate, deactivate
 * - Standard: primary, secondary, danger, success, warning, info
 */
@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './button.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './button.component.scss'
})
export class ButtonComponent {
  /**
   * Button type attribute
   */
  @Input() type: 'button' | 'submit' | 'reset' = 'button';

  /**
   * Button variant/style
   * Standard variants: primary, secondary, danger, success, warning, info
   * Action variants: add, edit, delete, save, cancel, filter, search, refresh, export, import, back, activate, deactivate
   */
  @Input() variant: 
    | 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'info'
    | 'add' | 'edit' | 'delete' | 'save' | 'cancel' 
    | 'filter' | 'search' | 'refresh' | 'export' | 'import'
    | 'back' | 'activate' | 'deactivate'
    = 'primary';

  /**
   * Button size
   */
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  /**
   * Whether the button is disabled
   */
  @Input() disabled = false;

  /**
   * Whether the button is in loading state
   */
  @Input() loading = false;

  /**
   * Whether the button should take full width
   */
  @Input() fullWidth = false;

  /**
   * Whether the button is icon-only (hides text content)
   */
  @Input() iconOnly = false;

  /**
   * ARIA label for accessibility
   */
  @Input() ariaLabel?: string;

  /**
   * Click event emitter
   */
  @Output() clicked = new EventEmitter<void>();

  /**
   * Handle button click
   */
  onClick(): void {
    if (!this.disabled && !this.loading) {
      this.clicked.emit();
    }
  }

  /**
   * Get CSS classes for the button
   */
  get buttonClasses(): string {
    const classes: string[] = ['btn', `btn-${this.variant}`, `btn-${this.size}`];
    
    if (this.fullWidth) {
      classes.push('btn-full');
    }
    
    if (this.iconOnly) {
      classes.push('btn-icon-only');
    }
    
    if (this.loading) {
      classes.push('btn-loading');
    }
    
    return classes.join(' ');
  }

  /**
   * Get action label for icon-only buttons (for accessibility)
   */
  getActionLabel(): string {
    const labels: Record<string, string> = {
      'add': 'Add',
      'edit': 'Edit',
      'delete': 'Delete',
      'save': 'Save',
      'cancel': 'Cancel',
      'filter': 'Filter',
      'search': 'Search',
      'refresh': 'Refresh',
      'export': 'Export',
      'import': 'Import',
      'back': 'Back',
      'activate': 'Activate',
      'deactivate': 'Deactivate'
    };
    return labels[this.variant] || this.variant;
  }
}

