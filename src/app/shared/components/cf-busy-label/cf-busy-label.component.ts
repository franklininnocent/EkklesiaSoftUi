import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CfBrandLoaderComponent } from '../cf-brand-loader/cf-brand-loader.component';

/**
 * Button/action busy content: approved brand mark while work is in progress,
 * projected label when idle. Does not change the loader design.
 */
@Component({
  selector: 'app-cf-busy-label',
  standalone: true,
  imports: [CommonModule, CfBrandLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *ngIf="busy; else idle">
      <app-cf-brand-loader size="button" [label]="busyLabel" [showLabel]="showBusyLabel" />
      <span *ngIf="!showBusyLabel" class="sr-only">{{ busyLabel }}</span>
    </ng-container>
    <ng-template #idle>
      <ng-content />
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: inherit;
      }
    `,
  ],
})
export class CfBusyLabelComponent {
  @Input() busy = false;
  @Input() busyLabel = 'Working';
  @Input() showBusyLabel = false;
}
