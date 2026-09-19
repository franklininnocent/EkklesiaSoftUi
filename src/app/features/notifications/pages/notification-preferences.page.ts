import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { ToastService } from '@core/services/toast.service';
import { NotificationApiService } from '../services/notification-api.service';
import { NotificationPreference } from '../models/notification.model';
import {
  notificationCategoryLabel,
  notificationDefinitionLabel,
} from '../utils/notification-display.util';

interface PreferenceGroup {
  category: string;
  label: string;
  items: NotificationPreference[];
}

@Component({
  selector: 'app-notification-preferences-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PageHeaderComponent,
    LoadingSkeletonComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './notification-preferences.page.html',
  styleUrl: './notification-preferences.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationPreferencesPage implements OnInit {
  private readonly api = inject(NotificationApiService);
  private readonly toast = inject(ToastService);

  preferences = signal<NotificationPreference[]>([]);
  loading = signal(true);
  saving = signal(false);
  loadError = signal<string | null>(null);

  definitionLabel = notificationDefinitionLabel;

  grouped = computed<PreferenceGroup[]>(() => {
    const map = new Map<string, NotificationPreference[]>();
    for (const pref of this.preferences()) {
      const key = pref.category || 'general';
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(pref);
    }
    return Array.from(map.entries()).map(([category, items]) => ({
      category,
      label: notificationCategoryLabel(category),
      items,
    }));
  });

  ngOnInit(): void {
    this.retryLoad();
  }

  retryLoad(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.getPreferences().subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) {
          this.preferences.set(res.data);
        } else {
          this.loadError.set('Could not load preferences.');
        }
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set('Could not load preferences.');
      },
    });
  }

  toggle(pref: NotificationPreference, channel: 'in_app' | 'email' | 'push'): void {
    if (pref.mandatory) {
      return;
    }
    pref[channel] = !pref[channel];
    this.preferences.set([...this.preferences()]);
  }

  save(): void {
    this.saving.set(true);
    this.api.updatePreferences(this.preferences()).subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.toast.success('Preferences saved.');
        }
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Could not save preferences.');
      },
    });
  }
}
