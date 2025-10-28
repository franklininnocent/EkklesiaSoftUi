import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Loading Skeleton Component
 * 
 * Displays animated skeleton placeholders while content is loading.
 * Provides better UX than spinners for table/card content.
 * 
 * Usage:
 * ```html
 * <app-loading-skeleton 
 *   type="table" 
 *   [rows]="5" 
 *   [columns]="4">
 * </app-loading-skeleton>
 * ```
 */
@Component({
  selector: 'app-loading-skeleton',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loading-skeleton.component.html',
  styleUrl: './loading-skeleton.component.scss'
})
export class LoadingSkeletonComponent {
  /**
   * Type of skeleton to display
   */
  @Input() type: 'table' | 'card' | 'list' | 'text' | 'circle' | 'rectangle' = 'rectangle';
  
  /**
   * Number of rows to display (for table/list types)
   */
  @Input() rows: number = 3;
  
  /**
   * Number of columns to display (for table type)
   */
  @Input() columns: number = 4;
  
  /**
   * Height of skeleton element
   */
  @Input() height: string = '20px';
  
  /**
   * Width of skeleton element
   */
  @Input() width: string = '100%';
  
  /**
   * Border radius
   */
  @Input() borderRadius: string = '4px';
  
  /**
   * Generate array for ngFor
   */
  getArray(length: number): number[] {
    return Array(length).fill(0).map((_, i) => i);
  }
}

