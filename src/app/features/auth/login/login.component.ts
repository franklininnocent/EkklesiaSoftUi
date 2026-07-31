import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ButtonComponent, InputComponent, CardComponent } from '@shared/components';
import { AppState } from '@core/store';
import * as AuthActions from '@core/store/auth/auth.actions';
import { selectAuthLoading, selectAuthError } from '@core/store/auth/auth.selectors';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    ButtonComponent,
    InputComponent,
    CardComponent
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private store = inject(Store<AppState>);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  loginForm!: FormGroup;
  loading$: Observable<boolean>;
  error$: Observable<string | null>;

  constructor() {
    this.loading$ = this.store.select(selectAuthLoading).pipe(takeUntil(this.destroy$));
    this.error$ = this.store.select(selectAuthError).pipe(takeUntil(this.destroy$));
    this.loading$.subscribe(() => this.cdr.markForCheck());
    this.error$.subscribe(() => this.cdr.markForCheck());
  }

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]]
    });
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.store.dispatch(AuthActions.login({ 
        credentials: this.loginForm.value 
      }));
    } else {
      this.markFormGroupTouched(this.loginForm);
    }
  }

  getErrorMessage(fieldName: string): string | undefined {
    const control = this.loginForm.get(fieldName);
    if (control?.invalid && control?.touched) {
      if (control.errors?.['required']) {
        return `${this.getFieldLabel(fieldName)} is required`;
      }
      if (control.errors?.['email']) {
        return 'Please enter a valid email address';
      }
      if (control.errors?.['minlength']) {
        return `${this.getFieldLabel(fieldName)} must be at least ${control.errors?.['minlength'].requiredLength} characters`;
      }
    }
    return undefined;
  }

  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      email: 'Email',
      password: 'Password'
    };
    return labels[fieldName] || fieldName;
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

