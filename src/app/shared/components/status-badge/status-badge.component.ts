import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type StatusBadgeTone = 'success' | 'neutral' | 'warning' | 'critical' | 'info';

/**
 * StatusBadge
 *
 * Single pill/chip component for status-like labels (record status,
 * "Interim", "Vacant", etc.). Replaces the per-component hand-rolled
 * status-pill CSS duplicated across ministries/donations components.
 * Colors are sourced from the `.cf-badge--*` tone classes in
 * `_church-financial-os-tokens.scss`, which map to the shared semantic
 * tokens (`--cf-forest`, `--cf-amber`, `--cf-critical`, etc.).
 */
@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `<span class="cf-badge" [ngClass]="'cf-badge--' + tone">{{ label }}</span>`,
  styles: [':host { display: inline-flex; }'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class StatusBadgeComponent {
  @Input({ required: true }) label!: string;
  @Input() tone: StatusBadgeTone = 'neutral';
}
