import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterModule } from '@angular/router';

export interface TabStripItem {
  id: string;
  label: string;
  /** Required when `mode="router"`. */
  routerLink?: string | any[];
  /** Passed to `routerLinkActiveOptions` when `mode="router"`. Defaults to `false`. */
  exact?: boolean;
  /** DOM id for the tab button, so a tabpanel can reference it via `aria-labelledby`. */
  domId?: string;
  /** `aria-controls` value pointing at the associated tabpanel's id. */
  ariaControls?: string;
}

/**
 * TabStrip
 *
 * Single horizontal tab-bar component consolidating the module's 3
 * near-identical tab-strip treatments (`organization-detail` tabs,
 * `taxonomy-settings` tabs, `ministries-sub-nav`). Supports both in-page
 * tab switching (button-based, emits `tabChange`) and router-link
 * navigation (`routerLinkActive`-based) via a single `mode` input.
 */
@Component({
  selector: 'app-tab-strip',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './tab-strip.component.html',
  styleUrl: './tab-strip.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class TabStripComponent {
  @Input() tabs: TabStripItem[] = [];
  @Input() activeId?: string;
  @Input() mode: 'inpage' | 'router' = 'inpage';
  /** Applied to the wrapping `<nav>` as `aria-label`. */
  @Input() ariaLabel?: string;

  /** Only emitted in `mode="inpage"`. */
  @Output() tabChange = new EventEmitter<string>();

  onTabClick(id: string): void {
    if (this.mode === 'inpage') {
      this.activeId = id;
      this.tabChange.emit(id);
    }
  }
}
