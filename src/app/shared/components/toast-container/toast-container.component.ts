/**
 * Toast Container Component
 * Displays toast notifications at the top-right of the screen
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';
import { ToastService, Toast } from '@core/services/toast.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast-container.component.html',
  styleUrls: ['./toast-container.component.scss'],
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'translateX(100%)', opacity: 0 }),
        animate('400ms ease-out', style({ transform: 'translateX(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('320ms ease-in', style({ transform: 'translateX(100%)', opacity: 0 }))
      ])
    ])
  ]
})
export class ToastContainerComponent implements OnInit {
  toasts$!: Observable<Toast[]>;

  constructor(private toastService: ToastService) {
    console.log('Toast container component created');
  }

  ngOnInit(): void {
    console.log('Toast container component initialized');
    this.toasts$ = this.toastService.toasts$;
    
    // Subscribe to see when toasts change
    this.toasts$.subscribe(toasts => {
      console.log('Toast container - toasts changed:', toasts);
    });
  }

  /**
   * Remove a toast
   */
  removeToast(id: string): void {
    this.toastService.remove(id);
  }

  /**
   * Get icon for toast type
   */
  getToastIcon(type: Toast['type']): string {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return 'ℹ';
    }
  }

  /**
   * Get CSS class for toast type
   */
  getToastClass(type: Toast['type']): string {
    return `toast-${type}`;
  }
}

