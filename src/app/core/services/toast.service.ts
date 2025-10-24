/**
 * Toast Notification Service
 * Provides methods to show toast notifications (success, error, info, warning)
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
  title?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastsSubject = new BehaviorSubject<Toast[]>([]);
  public toasts$: Observable<Toast[]> = this.toastsSubject.asObservable();

  private defaultDuration = 4000; // 4 seconds

  /**
   * Show a success toast
   */
  success(message: string, title?: string, duration?: number): void {
    console.log('Toast service - success called:', { message, title, duration });
    this.show({
      type: 'success',
      message,
      title: title || 'Success',
      duration: duration || this.defaultDuration
    });
  }

  /**
   * Show an error toast
   */
  error(message: string, title?: string, duration?: number): void {
    this.show({
      type: 'error',
      message,
      title: title || 'Error',
      duration: duration || this.defaultDuration
    });
  }

  /**
   * Show an info toast
   */
  info(message: string, title?: string, duration?: number): void {
    this.show({
      type: 'info',
      message,
      title: title || 'Information',
      duration: duration || this.defaultDuration
    });
  }

  /**
   * Show a warning toast
   */
  warning(message: string, title?: string, duration?: number): void {
    this.show({
      type: 'warning',
      message,
      title: title || 'Warning',
      duration: duration || this.defaultDuration
    });
  }

  /**
   * Show a toast notification
   */
  private show(toast: Omit<Toast, 'id'>): void {
    const id = this.generateId();
    const newToast: Toast = { ...toast, id };
    
    const currentToasts = this.toastsSubject.value;
    console.log('Toast service - showing toast:', newToast);
    console.log('Current toasts:', currentToasts);
    this.toastsSubject.next([...currentToasts, newToast]);
    console.log('Toasts after update:', this.toastsSubject.value);

    // Auto-remove after duration
    if (toast.duration && toast.duration > 0) {
      setTimeout(() => {
        this.remove(id);
      }, toast.duration);
    }
  }

  /**
   * Remove a toast by ID
   */
  remove(id: string): void {
    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next(currentToasts.filter(toast => toast.id !== id));
  }

  /**
   * Clear all toasts
   */
  clear(): void {
    this.toastsSubject.next([]);
  }

  /**
   * Generate unique ID for toast
   */
  private generateId(): string {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current toasts (synchronous)
   */
  get currentToasts(): Toast[] {
    return this.toastsSubject.value;
  }
}

