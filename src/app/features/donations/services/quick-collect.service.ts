import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { Family } from '@core/models/family.model';

export interface QuickCollectRecentFamily {
  id: string;
  family_name: string;
  family_code: string;
  head_of_family?: string;
}

const RECENT_KEY = 'qc_recent_families';
const KEEP_OPEN_KEY = 'qc_keep_open';
const DEFAULT_METHOD_KEY = 'qc_default_method';
const MAX_RECENT = 6;

@Injectable({ providedIn: 'root' })
export class QuickCollectService {
  private readonly openSubject = new Subject<void>();
  private readonly openForFamilySubject = new Subject<string>();

  readonly open$ = this.openSubject.asObservable();
  readonly openForFamily$ = this.openForFamilySubject.asObservable();

  open(): void {
    this.openSubject.next();
  }

  openForFamily(familyId: string): void {
    this.openForFamilySubject.next(familyId);
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
