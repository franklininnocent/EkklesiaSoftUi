import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CfBrandLoaderComponent, CfBrandLoaderSize } from '../cf-brand-loader/cf-brand-loader.component';
import { LoadingSkeletonComponent } from '../loading-skeleton/loading-skeleton.component';

export type CfLoadingSkeletonType = LoadingSkeletonComponent['type'];

/**
 * Standard loading region: brand mark + optional skeleton, or projected content when idle.
 */
@Component({
  selector: 'app-cf-loading-block',
  standalone: true,
  imports: [CommonModule, CfBrandLoaderComponent, LoadingSkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *ngIf="active; else ready">
      <div
        class="cf-loading-block"
        [class.cf-panel]="panel"
        [class.cf-loading-block--overlay-host]="overlay"
        role="status"
        aria-live="polite"
        [attr.aria-busy]="true"
        [attr.aria-label]="label"
      >
        <app-cf-brand-loader
          [size]="loaderSize"
          [label]="label"
          [showLabel]="showLabel"
          [overlay]="overlay"
        />
        <app-loading-skeleton
          *ngIf="skeleton"
          [type]="skeleton"
          [rows]="skeletonRows"
          [columns]="skeletonColumns"
          [showBrandHeader]="false"
        />
      </div>
    </ng-container>
    <ng-template #ready>
      <ng-content />
    </ng-template>
  `,
  styles: [
    `
      .cf-loading-block--overlay-host {
        position: relative;
        min-height: 6rem;
      }
    `,
  ],
})
export class CfLoadingBlockComponent {
  @Input() active = false;
  @Input() label = 'Loading';
  @Input() showLabel = true;
  @Input() loaderSize: CfBrandLoaderSize = 'section';
  @Input() panel = false;
  @Input() overlay = false;
  @Input() skeleton: CfLoadingSkeletonType | null = 'card';
  @Input() skeletonRows = 3;
  @Input() skeletonColumns = 4;
}
