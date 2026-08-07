import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { SectionCollapseToggleComponent } from '../section-collapse-toggle/section-collapse-toggle.component';

/**
 * SectionCard
 *
 * Single wrapper for panel-style content blocks, built on the existing
 * global `.cf-panel` class. Supports an optional collapsible mode backed
 * by the existing `app-section-collapse-toggle` component, replacing
 * bespoke per-feature collapse/expand toggles (e.g. the leadership tab's
 * private "Show/Hide history" `▴`/`▾` toggle).
 */
@Component({
  selector: 'app-section-card',
  standalone: true,
  imports: [CommonModule, SectionCollapseToggleComponent],
  templateUrl: './section-card.component.html',
  styleUrl: './section-card.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class SectionCardComponent {
  @Input() title?: string;
  @Input() collapsible = false;
  @Input() expanded = true;
  @Input() expandLabel = 'Expand section';
  @Input() collapseLabel = 'Collapse section';

  @Output() expandedChange = new EventEmitter<boolean>();

  onToggle(): void {
    this.expanded = !this.expanded;
    this.expandedChange.emit(this.expanded);
  }
}
