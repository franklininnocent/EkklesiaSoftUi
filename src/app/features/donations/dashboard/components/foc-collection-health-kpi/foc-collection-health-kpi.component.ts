import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CollectionHealthPayload } from '../../../models/donation.model';

@Component({
  selector: 'app-foc-collection-health-kpi',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './foc-collection-health-kpi.component.html',
  styleUrl: './foc-collection-health-kpi.component.scss'
})
export class FocCollectionHealthKpiComponent {
  @Input({ required: true }) health!: CollectionHealthPayload;

  get trendLabel(): string {
    const value = Math.abs(this.health.trend_pct ?? 0);
    const direction = this.health.trend_direction === 'up' ? 'up' : 'down';
    return `${direction === 'up' ? 'Improving' : 'Declining'} ${value.toFixed(1)}% this month`;
  }
}
