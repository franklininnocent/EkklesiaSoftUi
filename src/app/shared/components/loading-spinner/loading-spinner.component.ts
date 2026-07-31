import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Loading Spinner Component
 * 
 * Displays animated spinner for loading states.
 * Supports different sizes and colors.
 * 
 * Usage:
 * ```html
 * <app-loading-spinner 
 *   size="small" 
 *   color="primary">
 * </app-loading-spinner>
 * ```
 */
@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loading-spinner.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './loading-spinner.component.scss'
})
export class LoadingSpinnerComponent {
  /**
   * Size of the spinner
   */
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  
  /**
   * Color variant
   */
  @Input() color: 'primary' | 'secondary' | 'white' = 'primary';
  
  /**
   * Show loading text
   */
  @Input() showText: boolean = false;
  
  /**
   * Custom loading text
   */
  @Input() text: string = 'Loading...';
  
  /**
   * Center the spinner
   */
  @Input() centered: boolean = false;
}

