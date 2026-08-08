import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DioceseService, BishopService } from '@core/services/ecclesiastical';
import { ToastService } from '@core/services';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { forkJoin, Subject, of } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';

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
    EmptyStateComponent,
    PageHeaderComponent
  ],
  templateUrl: './overview.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './overview.component.scss'
})
export class EcclesiasticalOverviewComponent implements OnInit, OnDestroy {
  dioceseStats: DioceseStatistics | null = null;
  bishopStats: BishopStatistics | null = null;
  loading = true; // Start with loading true to show skeleton
  error: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private dioceseService: DioceseService,
    private bishopService: BishopService,
    private router: Router,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadStatistics();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadStatistics(forceRefresh: boolean = false): void {
    this.loading = true;
    this.error = null;

    // Load both statistics in parallel using forkJoin (proper RxJS pattern)
    forkJoin({
      dioceseStats: this.dioceseService.getStatistics(forceRefresh).pipe(
        catchError(error => {
          console.error('Error loading diocese statistics:', error);
          // Return error response Observable to allow partial loading
          return of({ 
            success: false, 
            data: null, 
            message: error?.error?.message || 'Failed to load diocese statistics' 
          } as any);
        })
      ),
      bishopStats: this.bishopService.getStatistics(forceRefresh).pipe(
        catchError(error => {
          console.error('Error loading bishop statistics:', error);
          // Return error response Observable to allow partial loading
          return of({ 
            success: false, 
            data: null, 
            message: error?.error?.message || 'Failed to load bishop statistics' 
          } as any);
        })
      )
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (responses) => {
          console.log('Statistics responses received:', responses);
          
          let hasError = false;
          const errorMessages: string[] = [];

          // Handle diocese statistics
          const dioceseResponse = responses.dioceseStats;
          console.log('Diocese response:', dioceseResponse);
          
          if (dioceseResponse) {
            if (dioceseResponse.success === true && dioceseResponse.data) {
              this.dioceseStats = dioceseResponse.data;
              console.log('Diocese stats loaded:', this.dioceseStats);
            } else if (dioceseResponse.success === false) {
              this.dioceseStats = null;
              hasError = true;
              errorMessages.push(dioceseResponse.message || 'Failed to load diocese statistics');
              console.error('Diocese stats failed:', dioceseResponse.message);
            } else {
              // Try direct assignment if response structure is different
              this.dioceseStats = dioceseResponse.data || dioceseResponse as any;
              console.log('Diocese stats loaded (alternative format):', this.dioceseStats);
            }
          } else {
            this.dioceseStats = null;
            console.warn('Diocese response is null or undefined');
          }

          // Handle bishop statistics
          const bishopResponse = responses.bishopStats;
          console.log('Bishop response:', bishopResponse);
          
          if (bishopResponse) {
            if (bishopResponse.success === true && bishopResponse.data) {
              this.bishopStats = bishopResponse.data;
              console.log('Bishop stats loaded:', this.bishopStats);
            } else if (bishopResponse.success === false) {
              this.bishopStats = null;
              hasError = true;
              errorMessages.push(bishopResponse.message || 'Failed to load bishop statistics');
              console.error('Bishop stats failed:', bishopResponse.message);
            } else {
              // Try direct assignment if response structure is different
              this.bishopStats = bishopResponse.data || bishopResponse as any;
              console.log('Bishop stats loaded (alternative format):', this.bishopStats);
            }
          } else {
            this.bishopStats = null;
            console.warn('Bishop response is null or undefined');
          }

          // Set error if both failed or show warning if one failed
          if (!this.dioceseStats && !this.bishopStats) {
            this.error = errorMessages.join('. ') || 'Failed to load statistics. Please try again.';
            this.toastService.error('Failed to load statistics');
            console.error('Both statistics failed to load');
          } else if (hasError) {
            // Partial success - show warning but don't block UI
            this.toastService.warning('Some statistics could not be loaded');
            console.warn('Partial statistics loaded with errors');
          } else {
            console.log('Statistics loaded successfully');
          }

          // Set loading to false FIRST
          this.loading = false;
          
          // Force change detection to update the view immediately
          this.cdr.detectChanges();
          
          // Log final state after change detection
          console.log('Final state - DioceseStats:', this.dioceseStats);
          console.log('Final state - BishopStats:', this.bishopStats);
          console.log('Final state - Loading:', this.loading);
          console.log('Final state - Error:', this.error);
        },
        error: (err) => {
          console.error('Error loading statistics:', err);
          this.error = err?.error?.message || 'Failed to load statistics. Please try again.';
          this.loading = false;
          this.cdr.detectChanges();
          this.toastService.error('Failed to load statistics');
        }
      });
  }

  refreshStatistics(): void {
    this.loadStatistics(true); // Force refresh
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
