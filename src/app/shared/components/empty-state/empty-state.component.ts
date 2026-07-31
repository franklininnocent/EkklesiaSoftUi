import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Empty State Component
 * 
 * Displays a friendly empty state message with optional action button.
 * 
 * Usage:
 * ```html
 * <app-empty-state
 *   icon="📋"
 *   title="No dioceses found"
 *   description="Get started by creating your first diocese"
 *   buttonText="Add Diocese"
 *   (action)="onCreate()">
 * </app-empty-state>
 * ```
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './empty-state.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './empty-state.component.scss'
})
export class EmptyStateComponent {
  /**
   * Icon to display (emoji or class name)
   */
  @Input() icon: string = '📭';
  
  /**
   * Title text
   */
  @Input() title: string = 'No data found';
  
  /**
   * Description text
   */
  @Input() description: string = '';
  
  /**
   * Action button text
   */
  @Input() buttonText: string = '';
  
  /**
   * Show action button
   */
  @Input() showButton: boolean = true;
  
  /**
   * Button variant
   */
  @Input() buttonVariant: 'primary' | 'secondary' = 'primary';
  
  /**
   * Action event emitter
   */
  @Output() action = new EventEmitter<void>();
  
  /**
   * Handle button click
   */
  onAction(): void {
    this.action.emit();
  }
}

