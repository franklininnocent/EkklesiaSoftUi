import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-cf-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cf-empty" role="status">
      <span class="cf-empty__icon" aria-hidden="true">{{ icon }}</span>
      <h3 class="cf-empty__title">{{ title }}</h3>
      <p class="cf-empty__desc">{{ description }}</p>
      <div class="cf-empty__actions" *ngIf="hasActions">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`:host { display: block; }`]
})
export class CfEmptyStateComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) description!: string;
  @Input() icon = '◇';
  @Input() hasActions = true;
}
