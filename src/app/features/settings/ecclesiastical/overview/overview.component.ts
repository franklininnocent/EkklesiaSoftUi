import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DioceseService, BishopService } from '@core/services/ecclesiastical';
import { DioceseStatistics, BishopStatistics } from '@core/models/ecclesiastical';
import { ToastService } from '@core/services';

@Component({
  selector: 'app-ecclesiastical-overview',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="overview-container">
      <!-- Statistics Cards -->
      <div class="stats-grid">
        <!-- Diocese Statistics -->
        <div class="stat-card">
          <div class="stat-icon diocese">⛪</div>
          <div class="stat-content">
            <h3 class="stat-label">Total Dioceses</h3>
            <p class="stat-value">{{ dioceseStats?.total_dioceses || 0 }}</p>
            <p class="stat-detail">{{ dioceseStats?.active_dioceses || 0 }} active</p>
          </div>
        </div>

        <!-- Bishop Statistics -->
        <div class="stat-card">
          <div class="stat-icon bishop">👤</div>
          <div class="stat-content">
            <h3 class="stat-label">Total Bishops</h3>
            <p class="stat-value">{{ bishopStats?.total_bishops || 0 }}</p>
            <p class="stat-detail">{{ bishopStats?.active_bishops || 0 }} active</p>
          </div>
        </div>

        <!-- Quick Action Cards -->
        <div class="action-card" (click)="navigateToDioceses()">
          <div class="action-icon">➕</div>
          <div class="action-content">
            <h3>Add Diocese</h3>
            <p>Create new diocese or archdiocese</p>
          </div>
        </div>

        <div class="action-card" (click)="navigateToBishops()">
          <div class="action-icon">➕</div>
          <div class="action-content">
            <h3>Add Bishop</h3>
            <p>Register new bishop or archbishop</p>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div *ngIf="loading" class="loading-overlay">
        <div class="spinner"></div>
        <p>Loading statistics...</p>
      </div>

      <!-- Error State -->
      <div *ngIf="error" class="error-message">
        <span class="error-icon">⚠️</span>
        <p>{{ error }}</p>
        <button (click)="loadStatistics()" class="retry-btn">Retry</button>
      </div>
    </div>
  `,
  styles: [`
    .overview-container {
      position: relative;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .stat-card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      gap: 1rem;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .stat-icon {
      width: 64px;
      height: 64px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
    }

    .stat-icon.diocese {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .stat-icon.bishop {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }

    .stat-content {
      flex: 1;
    }

    .stat-label {
      font-size: 0.875rem;
      color: #6b7280;
      margin: 0 0 0.25rem 0;
      font-weight: 500;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      color: #1f2937;
      margin: 0;
    }

    .stat-detail {
      font-size: 0.875rem;
      color: #10b981;
      margin: 0.25rem 0 0 0;
    }

    .action-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      padding: 1.5rem;
      color: white;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .action-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
    }

    .action-icon {
      width: 48px;
      height: 48px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
    }

    .action-content h3 {
      margin: 0 0 0.25rem 0;
      font-size: 1.125rem;
      font-weight: 600;
    }

    .action-content p {
      margin: 0;
      font-size: 0.875rem;
      opacity: 0.9;
    }

    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.9);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      border-radius: 12px;
    }

    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid #e5e7eb;
      border-top-color: #6B2C91;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .error-message {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 1.5rem;
      text-align: center;
      color: #991b1b;
    }

    .error-icon {
      font-size: 2rem;
      display: block;
      margin-bottom: 0.5rem;
    }

    .retry-btn {
      margin-top: 1rem;
      padding: 0.5rem 1.5rem;
      background: #dc2626;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      transition: background 0.2s;
    }

    .retry-btn:hover {
      background: #b91c1c;
    }

    @media (max-width: 768px) {
      .stats-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
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
        this.error = 'Failed to load statistics. Please try again.';
        this.loading = false;
        this.toastService.error('Failed to load statistics');
      });
  }

  navigateToDioceses(): void {
    this.router.navigate(['/settings/ecclesiastical/dioceses']);
  }

  navigateToBishops(): void {
    this.router.navigate(['/settings/ecclesiastical/bishops']);
  }
}

