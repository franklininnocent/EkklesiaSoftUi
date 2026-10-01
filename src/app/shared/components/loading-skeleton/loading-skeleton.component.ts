import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CfBrandLoaderComponent,
  CfBrandLoaderSize,
} from '../cf-brand-loader/cf-brand-loader.component';

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
  imports: [CommonModule, CfBrandLoaderComponent],
  templateUrl: './loading-skeleton.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
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

  /** Shown above the skeleton with the brand mark (omit duplicate cf-loading-block__label). */
  @Input() label = '';

  @Input() loaderSize: CfBrandLoaderSize = 'inline';

  /**
   * When unset, the brand mark is shown for table/card/list (and whenever a label is set).
   * Tiny text/circle/rectangle placeholders stay skeleton-only unless explicitly enabled.
   */
  @Input() showBrandHeader?: boolean;

  get brandHeaderVisible(): boolean {
    if (this.showBrandHeader === false) {
      return false;
    }
    if (this.showBrandHeader === true) {
      return true;
    }
    return this.type === 'table' || this.type === 'card' || this.type === 'list' || !!this.label;
  }
  
  /**
   * Generate array for ngFor
   */
  getArray(length: number): number[] {
    return Array(length).fill(0).map((_, i) => i);
  }
}

