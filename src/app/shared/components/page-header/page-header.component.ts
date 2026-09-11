import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { StatusBadgeComponent, StatusBadgeTone } from '../status-badge/status-badge.component';

/**
 * PageHeader
 *
 * Single title/subtitle/back-link/status header used by both top-level
 * pages (`variant="page"`, renders an `<h1>` inside `.cf-hero`) and
 * in-page sections such as a detail-page identity block or a tab's section
 * heading (`variant="panel"`, renders an `<h2>`). Right-aligned actions
 * (buttons, CTAs) are projected as default content.
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule, RouterModule, StatusBadgeComponent],
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class PageHeaderComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
  @Input() variant: 'page' | 'panel' = 'page';
  /** Top-level page title heading level. Default `1`; use `3` for compact sub-pages. */
  @Input() titleLevel: 1 | 3 = 1;
  /** Router link for an optional "← Back" link above the title. */
  @Input() backLink?: string | any[];
  @Input() backLabel = 'Back';
  @Input() statusLabel?: string;
  @Input() statusTone: StatusBadgeTone = 'neutral';
}
