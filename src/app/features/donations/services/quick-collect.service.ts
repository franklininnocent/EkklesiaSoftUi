import { inject, Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { Family } from '@core/models/family.model';
import { SubscriptionAccessService } from '@core/services/subscription-access.service';
import { ToastService } from '@core/services/toast.service';

export interface QuickCollectRecentFamily {
  id: string;
  family_name: string;
  family_code: string;
  head_of_family?: string;
}

/**
 * Launch context for Collect Payment. IDs are hints for prefill only —
 * the backend collect-context and payment APIs remain authoritative.
 */
export interface QuickCollectLaunchContext {
  familyId?: string;
  projectId?: string;
  campaignId?: string;
  dueId?: string;
  installmentId?: string;
  memberId?: string;
}

const RECENT_KEY = 'qc_recent_families';
const KEEP_OPEN_KEY = 'qc_keep_open';
const DEFAULT_METHOD_KEY = 'qc_default_method';
const MAX_RECENT = 6;

@Injectable({ providedIn: 'root' })
export class QuickCollectService {
  private readonly subscriptionAccess = inject(SubscriptionAccessService);
  private readonly toast = inject(ToastService);
  private readonly openSubject = new Subject<QuickCollectLaunchContext>();

  readonly open$ = this.openSubject.asObservable();

  open(context: QuickCollectLaunchContext = {}): void {
    if (this.subscriptionAccess.isReadOnly()) {
      this.toast.warning('Read-only mode: renew subscription to collect payments.', 'Read-only');
      return;
    }
    this.openSubject.next({ ...context });
  }

  openForFamily(familyId: string, extra: Omit<QuickCollectLaunchContext, 'familyId'> = {}): void {
    this.open({ ...extra, familyId });
  }

  getRecentFamilies(): QuickCollectRecentFamily[] {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      return raw ? (JSON.parse(raw) as QuickCollectRecentFamily[]) : [];
    } catch {
      return [];
    }
  }

  rememberFamily(family: Family): void {
    const entry: QuickCollectRecentFamily = {
      id: family.id,
      family_name: family.family_name,
      family_code: family.family_code,
      head_of_family: family.head_of_family
    };
    const filtered = this.getRecentFamilies().filter((item) => item.id !== family.id);
    const next = [entry, ...filtered].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  }

  getKeepOpen(): boolean {
    const value = localStorage.getItem(KEEP_OPEN_KEY);
    return value === null ? true : value === 'true';
  }

  setKeepOpen(value: boolean): void {
    localStorage.setItem(KEEP_OPEN_KEY, String(value));
  }

  getDefaultMethod(): string {
    return localStorage.getItem(DEFAULT_METHOD_KEY) || 'cash';
  }

  setDefaultMethod(method: string): void {
    localStorage.setItem(DEFAULT_METHOD_KEY, method);
  }
}
