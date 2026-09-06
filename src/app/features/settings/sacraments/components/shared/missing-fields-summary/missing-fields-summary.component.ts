import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-missing-fields-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './missing-fields-summary.component.html',
  styleUrl: './missing-fields-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MissingFieldsSummaryComponent {
  @Input() items: Array<{ field: string; classification: string; label: string }> = [];
  @Output() focusField = new EventEmitter<string>();

  get requiredCount(): number {
    return this.items.filter((i) => i.classification === 'required').length;
  }

  get advisoryCount(): number {
    return this.items.filter((i) => i.classification === 'advisory').length;
  }

  get leadText(): string {
    const required = this.requiredCount;
    const advisory = this.advisoryCount;
    if (required > 0 && advisory > 0) {
      return `${required} required item${required === 1 ? '' : 's'} and ${advisory} note${advisory === 1 ? '' : 's'} need your attention`;
    }
    if (required > 0) {
      return `${required} item${required === 1 ? '' : 's'} need your attention`;
    }
    return `${advisory} note${advisory === 1 ? '' : 's'} for your review`;
  }

  isAdvisory(item: { classification: string }): boolean {
    return item.classification === 'advisory';
  }
}
