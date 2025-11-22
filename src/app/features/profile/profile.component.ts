import { Component, inject, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AppState } from '@core/store';
import { User } from '@core/models';
import { selectCurrentUser } from '@core/store/auth/auth.selectors';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileComponent implements OnDestroy {
  private store = inject(Store<AppState>);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  currentUser$: Observable<User | null>;

  constructor() {
    this.currentUser$ = this.store.select(selectCurrentUser).pipe(takeUntil(this.destroy$));
    this.currentUser$.subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getInitials(name: string): string {
    if (!name) return '?';
    
    const parts = name.trim().split(' ');
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
}

