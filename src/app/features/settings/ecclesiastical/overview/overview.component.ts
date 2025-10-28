import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DioceseService, BishopService } from '@core/services/ecclesiastical';
import { ToastService } from '@core/services';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';

interface DioceseStatistics {
  total_dioceses: number;
  active_dioceses: number;
  inactive_dioceses: number;
  total_archdioceses: number;
  total_regular_dioceses: number;
  by_country: Array<{ country: string; total: number }>;
  by_denomination: Array<{ denomination: string; total: number }>;
  recent_additions: any[];
}

interface BishopStatistics {
  total_bishops: number;
  active_bishops: number;
  inactive_bishops: number;
  retired_bishops: number;
  by_title: Array<{ title: string; total: number }>;
  by_diocese: Array<{ diocese: string; total: number }>;
  recent_additions: any[];
}

@Component({
  selector: 'app-ecclesiastical-overview',
  standalone: true,
  imports: [
    CommonModule,
    LoadingSkeletonComponent,
    EmptyStateComponent
  ],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.scss'
})
export class EcclesiasticalOverviewComponent implements OnInit {
  dioceseStats: DioceseStatistics | null = null;
  bishopStats: BishopStatistics | null = null;
  loading = false;
  error: string | null = null;

  constructor(
    private dioceseService: DioceseService,
    private bishopService: BishopService,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadStatistics();
  }

  loadStatistics(): void {
    this.loading = true;
    this.error = null;

    // Load both statistics in parallel
    Promise.all([
      this.dioceseService.getStatistics().toPromise(),
      this.bishopService.getStatistics().toPromise()
    ])
      .then(([dioceseResponse, bishopResponse]) => {
        this.dioceseStats = dioceseResponse?.data || null;
        this.bishopStats = bishopResponse?.data || null;
        this.loading = false;
      })
      .catch(err => {
        console.error('Error loading statistics:', err);
        this.error = err?.error?.message || 'Failed to load statistics. Please try again.';
        this.loading = false;
        this.toastService.error('Failed to load statistics');
      });
  }

  refreshStatistics(): void {
    this.loadStatistics();
  }

  navigateToDioceses(): void {
    this.router.navigate(['/settings/ecclesiastical/dioceses']);
  }

  navigateToBishops(): void {
    this.router.navigate(['/settings/ecclesiastical/bishops']);
  }

  getPercentage(value: number, total: number): number {
    if (!total || total === 0) return 0;
    return Math.round((value / total) * 100);
  }

  getMaxBishopsInDiocese(): number {
    if (!this.bishopStats?.by_diocese || this.bishopStats.by_diocese.length === 0) {
      return 1;
    }
    return Math.max(...this.bishopStats.by_diocese.map(item => item.total));
  }
}
