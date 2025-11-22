import { Component, inject, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { CardComponent } from '@shared/components';
import { AppState } from '@core/store';
import { User } from '@core/models';
import { selectCurrentUser } from '@core/store/auth/auth.selectors';
import { FamilyService } from '@core/services/family.service';
import { BCCService } from '@core/services/bcc.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, CardComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit, OnDestroy {
  private store = inject(Store<AppState>);
  private familyService = inject(FamilyService);
  private bccService = inject(BCCService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();
  currentUser$: Observable<User | null>;
  today = new Date();
  totalFamilies = 0;
  totalMembers = 0;
  totalBCCs = 0;
  loadingFamilies = false;
  loadingBCCs = false;

  stats = [
    { title: 'Total Families', value: '0', change: '', icon: 'family', trend: 'up', clickable: true },
    { title: 'Total Members', value: '0', change: '', icon: 'users', trend: 'up', clickable: true },
    { title: 'Total BCC', value: '0', change: '', icon: 'church', trend: 'up', clickable: true },
    { title: 'New Signups', value: '89', change: '+23%', icon: 'target', trend: 'up', clickable: false }
  ];

  recentActivities = [
    { icon: 'check', title: 'User Registration', description: 'John Doe registered', time: '2 minutes ago', type: 'success' },
    { icon: 'edit', title: 'Profile Updated', description: 'Jane Smith updated profile', time: '15 minutes ago', type: 'info' },
    { icon: 'bell', title: 'New Comment', description: 'Mike Johnson commented', time: '1 hour ago', type: 'info' },
    { icon: 'alert', title: 'System Alert', description: 'Low disk space warning', time: '2 hours ago', type: 'warning' },
    { icon: 'lightbulb', title: 'Feature Request', description: 'New feature suggested', time: '3 hours ago', type: 'success' }
  ];

  quickActions = [
    { icon: '➕', label: 'Add User', action: 'addUser', color: 'primary' },
    { icon: '📊', label: 'View Reports', action: 'viewReports', color: 'secondary' },
    { icon: '⚙️', label: 'Settings', action: 'settings', color: 'info' },
    { icon: '📧', label: 'Send Email', action: 'sendEmail', color: 'success' }
  ];

  constructor() {
    this.currentUser$ = this.store.select(selectCurrentUser);
  }

  ngOnInit(): void {
    this.loadFamilyStatistics();
    this.loadBCCStatistics();
  }

  /**
   * Load family statistics to get total families and members count
   */
  loadFamilyStatistics(): void {
    this.loadingFamilies = true;
    this.cdr.markForCheck();
    this.familyService.getStatistics()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            // Update total families
            this.totalFamilies = response.data.total_families || 0;
            this.stats[0].value = this.formatNumber(this.totalFamilies);
            
            // Update total members
            this.totalMembers = response.data.total_members || 0;
            this.stats[1].value = this.formatNumber(this.totalMembers);
            
            this.loadingFamilies = false;
          }
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error loading family statistics:', error);
          this.loadingFamilies = false;
          // Keep default value of 0 on error
          this.stats[0].value = '0';
          this.stats[1].value = '0';
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Format number with commas for display
   */
  private formatNumber(num: number): string {
    return num.toLocaleString('en-US');
  }

  /**
   * Load BCC statistics to get total BCC count
   */
  loadBCCStatistics(): void {
    this.loadingBCCs = true;
    this.cdr.markForCheck();
    this.bccService.getStatistics()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.totalBCCs = response.data.total_bccs || 0;
            // Update the stats array with the actual count (third card)
            this.stats[2].value = this.formatNumber(this.totalBCCs);
            this.loadingBCCs = false;
          } else {
            this.loadingBCCs = false;
            this.stats[2].value = '0';
          }
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error loading BCC statistics:', error);
          this.loadingBCCs = false;
          // Keep default value of 0 on error
          this.stats[2].value = '0';
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Navigate to families list page
   */
  navigateToFamilies(): void {
    this.router.navigate(['/families']);
  }

  /**
   * Navigate to BCC list page
   */
  navigateToBCCs(): void {
    this.router.navigate(['/bccs']);
  }

  /**
   * Handle stat card click
   */
  onStatCardClick(stat: any): void {
    if (!stat.clickable) {
      return;
    }

    if (stat.title === 'Total Families' || stat.title === 'Total Members') {
      this.navigateToFamilies();
    } else if (stat.title === 'Total BCC') {
      this.navigateToBCCs();
    }
  }

  handleAction(action: string): void {
    console.log(`Action triggered: ${action}`);
    // Implement action handlers here
  }

  /**
   * Get SVG icon for stat card
   */
  getStatIcon(iconType: string): string {
    const icons: { [key: string]: string } = {
      'family': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
      'users': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
      'church': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
      'target': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>'
    };
    return icons[iconType] || '';
  }

  /**
   * Get SVG icon for activity item
   */
  getActivityIcon(iconType: string): string {
    const icons: { [key: string]: string } = {
      'check': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><polyline points="20 6 9 17 4 12"></polyline></svg>',
      'edit': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
      'bell': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
      'alert': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
      'lightbulb': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><line x1="9" y1="18" x2="15" y2="18"></line><line x1="10" y1="22" x2="14" y2="22"></line><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"></path></svg>'
    };
    return icons[iconType] || '';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

