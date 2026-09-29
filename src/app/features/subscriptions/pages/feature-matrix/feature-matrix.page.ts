import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { FeatureMatrix, MatrixColumn, MatrixFeature } from '../../models/subscription-admin.models';
import { SubscriptionAdminService, subscriptionErrorMessage } from '../../services/subscription-admin.service';

const NUMERIC_TYPES = new Set(['LIMIT', 'QUOTA', 'USAGE']);

interface MatrixGroup {
  category: string;
  features: MatrixFeature[];
}

/** Side-by-side view of every plan's live (or draft) version. Edit from the plan page. */
@Component({
  selector: 'app-feature-matrix-page',
  standalone: true,
  imports: [CommonModule, RouterModule, DataTableComponent, LoadingSkeletonComponent],
  templateUrl: './feature-matrix.page.html',
  styleUrls: ['../../styles/subscription-admin.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureMatrixPage implements OnInit, OnDestroy {
  private readonly api = inject(SubscriptionAdminService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  matrix: FeatureMatrix | null = null;
  groups: MatrixGroup[] = [];
  loading = false;
  error: string | null = null;

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();
    this.api
      .matrix()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (matrix) => {
          this.matrix = matrix;
          const byCategory = new Map<string, MatrixFeature[]>();
          for (const f of matrix.features.filter((x) => x.is_active)) {
            const list = byCategory.get(f.category) ?? [];
            list.push(f);
            byCategory.set(f.category, list);
          }
          this.groups = Array.from(byCategory.entries()).map(([category, features]) => ({
            category: category.replace(/_/g, ' '),
            features,
          }));
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = subscriptionErrorMessage(err, 'Unable to load the plan comparison.');
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  cell(column: MatrixColumn, feature: MatrixFeature): { text: string; included: boolean } {
    const c = column.cells[String(feature.id)];
    const enabled = feature.is_core || !!c?.is_enabled;
    if (!enabled) return { text: '—', included: false };
    if (NUMERIC_TYPES.has(feature.feature_type)) {
      if (c?.numeric_value === null || c?.numeric_value === undefined) return { text: 'Unlimited', included: true };
      return { text: `${c.numeric_value.toLocaleString()}${feature.unit ? ' ' + feature.unit : ''}`, included: true };
    }
    if (feature.feature_type === 'TIER' && c?.tier_value) return { text: c.tier_value, included: true };
    return { text: '✓', included: true };
  }

  trackFeature(_: number, f: MatrixFeature): number {
    return f.id;
  }
}
