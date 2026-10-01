import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Thin wrapper for stewardship list tables (Receipts register pattern).
 * Projects table + pagination via ng-content; optional panel head.
 */
@Component({
  selector: 'app-stewardship-table-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="cf-panel stewardship-table-panel"
      [class.stewardship-table-panel--refreshing]="refreshing"
      [ngClass]="extraPanelClass"
      [attr.aria-busy]="ariaBusy"
    >
      <header class="stewardship-panel-head" *ngIf="title">
        <div class="stewardship-panel-head__copy">
          <h2 class="cf-section-title">{{ title }}</h2>
          <p class="cf-meta" *ngIf="meta">{{ meta }}</p>
        </div>
      </header>
      <ng-content></ng-content>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StewardshipTablePanelComponent {
  @Input() title = '';
  @Input() meta = '';
  @Input() refreshing = false;
  @Input() ariaBusy: boolean | null = null;
  /** Optional extra class on the panel root (e.g. page-specific refresh hook). */
  @Input() extraPanelClass = '';
}
