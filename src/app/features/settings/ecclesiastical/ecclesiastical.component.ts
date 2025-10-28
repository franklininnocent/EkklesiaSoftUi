import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-ecclesiastical',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="ecclesiastical-container">
      <!-- Header -->
      <div class="ecclesiastical-header">
        <h1 class="ecclesiastical-title">Ecclesiastical Data Management</h1>
        <p class="ecclesiastical-subtitle">Manage dioceses, bishops, and church hierarchy</p>
      </div>

      <!-- Navigation Tabs -->
      <div class="ecclesiastical-nav">
        <a 
          routerLink="overview" 
          routerLinkActive="active"
          class="nav-tab">
          <span class="tab-icon">📊</span>
          <span>Overview</span>
        </a>
        <a 
          routerLink="dioceses" 
          routerLinkActive="active"
          class="nav-tab">
          <span class="tab-icon">⛪</span>
          <span>Dioceses</span>
        </a>
        <a 
          routerLink="bishops" 
          routerLinkActive="active"
          class="nav-tab">
          <span class="tab-icon">👤</span>
          <span>Bishops</span>
        </a>
      </div>

      <!-- Content Area -->
      <div class="ecclesiastical-content">
        <router-outlet></router-outlet>
      </div>
    </div>
  `,
  styles: [`
    .ecclesiastical-container {
      padding: 1.5rem;
      max-width: 1400px;
      margin: 0 auto;
    }

    .ecclesiastical-header {
      margin-bottom: 1.5rem;
    }

    .ecclesiastical-title {
      font-size: 1.75rem;
      font-weight: 700;
      color: #1f2937;
      margin: 0 0 0.5rem 0;
    }

    .ecclesiastical-subtitle {
      font-size: 1rem;
      color: #6b7280;
      margin: 0;
    }

    .ecclesiastical-nav {
      display: flex;
      gap: 1rem;
      border-bottom: 2px solid #e5e7eb;
      margin-bottom: 1.5rem;
    }

    .nav-tab {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.25rem;
      color: #6b7280;
      text-decoration: none;
      font-weight: 500;
      border-bottom: 3px solid transparent;
      margin-bottom: -2px;
      transition: all 0.2s;
      cursor: pointer;
    }

    .nav-tab:hover {
      color: #6B2C91;
      background: #f9fafb;
    }

    .nav-tab.active {
      color: #6B2C91;
      border-bottom-color: #6B2C91;
      background: #f9fafb;
    }

    .tab-icon {
      font-size: 1.25rem;
    }

    .ecclesiastical-content {
      animation: fadeIn 0.3s ease-in;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (max-width: 768px) {
      .ecclesiastical-container {
        padding: 1rem;
      }

      .ecclesiastical-title {
        font-size: 1.5rem;
      }

      .nav-tab {
        padding: 0.625rem 1rem;
        font-size: 0.875rem;
      }

      .tab-icon {
        font-size: 1rem;
      }
    }
  `]
})
export class EcclesiasticalComponent {}

