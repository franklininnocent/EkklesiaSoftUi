import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CfBrandLoaderComponent,
  CfBrandLoaderSize,
} from '../cf-brand-loader/cf-brand-loader.component';

/**
 * Centered loading region using the global `.loading-container` layout + brand mark.
 */
@Component({
  selector: 'app-cf-loading-container',
  standalone: true,
  imports: [CommonModule, CfBrandLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="loading-container" role="status" aria-live="polite" [attr.aria-busy]="true" [attr.aria-label]="label">
      <app-cf-brand-loader [size]="size" [label]="label" [showLabel]="showLabel" />
    </div>
  `,
})
export class CfLoadingContainerComponent {
  @Input() label = 'Loading';
  @Input() showLabel = true;
  @Input() size: CfBrandLoaderSize = 'section';
}
