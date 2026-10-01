import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ActionBarIconComponent, ActionBarIconId } from './action-bar-icon.component';

export type ActionBarTier = 'primary' | 'secondary' | 'ghost' | 'danger' | 'text';
export type ActionBarSize = 'md' | 'sm';
export type { ActionBarIconId };

export interface ActionBarItem {
  id: string;
  label: string;
  tier?: ActionBarTier;
  icon?: ActionBarIconId;
  disabled?: boolean;
  hidden?: boolean;
}

/**
 * ActionBar
 *
 * Renders a declarative list of row/section actions with the correct
 * button tier applied automatically (primary / secondary / danger / text),
 * so destructive actions (e.g. "Terminate") are never visually identical
 * to routine ones (e.g. "Hand over") — the button-hierarchy gap identified
 * in the UX audit.
 *
 * Use `size="sm"` for compact table row actions (enterprise density).
 */
@Component({
  selector: 'app-action-bar',
  standalone: true,
  imports: [CommonModule, ActionBarIconComponent],
  templateUrl: './action-bar.component.html',
  styleUrl: './action-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ActionBarComponent {
  @Input() actions: ActionBarItem[] = [];
  @Input() layout: 'inline' | 'stacked' = 'inline';
  /** `sm` for dense table rows; `md` for section-level action groups. */
  @Input() size: ActionBarSize = 'md';
  /** Icon-only buttons; label shown as native tooltip and aria-label. */
  @Input() iconOnly = false;

  @Output() actionClicked = new EventEmitter<string>();

  get visibleActions(): ActionBarItem[] {
    return this.actions.filter((action) => !action.hidden);
  }

  buttonClass(action: ActionBarItem): string {
    if (this.iconOnly) {
      const sizeClass = this.size === 'sm' ? ' cf-btn--sm' : '';
      return `cf-btn cf-btn-icon${sizeClass}`;
    }

    const sizeClass = this.size === 'sm' ? ' cf-btn--sm' : '';
    switch (action.tier) {
      case 'primary':
        return `cf-btn cf-btn-primary${sizeClass}`;
      case 'danger':
        return `cf-btn-danger${sizeClass}`;
      case 'ghost':
        return `cf-btn-ghost${sizeClass}`;
      case 'text':
        return `cf-btn-text${sizeClass}`;
      case 'secondary':
      default:
        return `cf-btn${sizeClass}`;
    }
  }

  onClick(action: ActionBarItem): void {
    if (!action.disabled) {
      this.actionClicked.emit(action.id);
    }
  }
}
