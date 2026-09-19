/**
 * Imperative confirmation dialog API.
 * Renders through app-confirmation-dialog-host at app root.
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type ConfirmationDialogVariant = 'primary' | 'danger';

export interface ConfirmationDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmationDialogVariant;
  showDescriptionInput?: boolean;
  descriptionLabel?: string;
  descriptionPlaceholder?: string;
  descriptionRequired?: boolean;
  nested?: boolean;
}

export interface ConfirmationDialogResult {
  confirmed: boolean;
  description?: string;
}

export interface ConfirmationDialogState {
  show: boolean;
  options: ConfirmationDialogOptions | null;
  submitting: boolean;
}

const INITIAL_STATE: ConfirmationDialogState = {
  show: false,
  options: null,
  submitting: false,
};

@Injectable({
  providedIn: 'root',
})
export class ConfirmationDialogService {
  private readonly stateSubject = new BehaviorSubject<ConfirmationDialogState>(INITIAL_STATE);
  readonly state$ = this.stateSubject.asObservable();

  private pendingResolve: ((result: ConfirmationDialogResult) => void) | null = null;

  confirm(options: ConfirmationDialogOptions): Observable<ConfirmationDialogResult> {
    return new Observable<ConfirmationDialogResult>((subscriber) => {
      this.pendingResolve = (result) => {
        subscriber.next(result);
        subscriber.complete();
      };

      this.stateSubject.next({
        show: true,
        options: {
          confirmText: 'Confirm',
          cancelText: 'Cancel',
          variant: 'primary',
          nested: true,
          ...options,
        },
        submitting: false,
      });

      return () => {
        if (this.pendingResolve) {
          this.close({ confirmed: false });
        }
      };
    });
  }

  confirmDelete(label: string, entityName = 'item'): Observable<ConfirmationDialogResult> {
    return this.confirm({
      title: `Delete ${entityName}`,
      message: `Are you sure you want to delete ${label}? This action cannot be undone.`,
      confirmText: 'Confirm Delete',
      variant: 'danger',
    });
  }

  confirmDeactivate(entityLabel: string): Observable<ConfirmationDialogResult> {
    return this.confirm({
      title: `Deactivate ${entityLabel}`,
      message: `Are you sure you want to deactivate this ${entityLabel.toLowerCase()}?`,
      confirmText: 'Confirm Deactivate',
      variant: 'danger',
    });
  }

  confirmActivate(entityLabel: string): Observable<ConfirmationDialogResult> {
    return this.confirm({
      title: `Activate ${entityLabel}`,
      message: `Are you sure you want to activate this ${entityLabel.toLowerCase()}?`,
      confirmText: 'Confirm Activate',
      variant: 'primary',
    });
  }

  confirmDiscardChanges(message = 'You have unsaved changes. Are you sure you want to close?'): Observable<ConfirmationDialogResult> {
    return this.confirm({
      title: 'Discard changes?',
      message,
      confirmText: 'Discard changes',
      variant: 'primary',
    });
  }

  resolve(result: ConfirmationDialogResult): void {
    this.close(result);
  }

  setSubmitting(submitting: boolean): void {
    const current = this.stateSubject.value;
    if (!current.show) {
      return;
    }
    this.stateSubject.next({ ...current, submitting });
  }

  private close(result: ConfirmationDialogResult): void {
    const current = this.stateSubject.value;
    if (!current.show) {
      return;
    }

    this.stateSubject.next({
      show: false,
      options: null,
      submitting: false,
    });

    const resolve = this.pendingResolve;
    this.pendingResolve = null;
    resolve?.(result);
  }
}
