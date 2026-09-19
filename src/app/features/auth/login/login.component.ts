import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';

import { ButtonComponent, InputComponent, CardComponent } from '@shared/components';
import { AppState } from '@core/store';
import * as AuthActions from '@core/store/auth/auth.actions';
import { selectAuthLoading, selectAuthError } from '@core/store/auth/auth.selectors';
import {
  PasswordRecoveryService,
  PasswordRecoveryViewState,
} from '@core/services/password-recovery.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    ButtonComponent,
    InputComponent,
    CardComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(Store<AppState>);
  private readonly recoveryService = inject(PasswordRecoveryService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  loginForm!: FormGroup;
  forgotEmailForm!: FormGroup;

  loading$: Observable<boolean>;
  error$: Observable<string | null>;

  viewState: PasswordRecoveryViewState = 'LOGIN';
  recoveryLoading = false;
  recoveryError: string | null = null;
  recoveryMessage: string | null = null;

  constructor() {
    this.loading$ = this.store.select(selectAuthLoading).pipe(takeUntil(this.destroy$));
    this.error$ = this.store.select(selectAuthError).pipe(takeUntil(this.destroy$));
    this.loading$.subscribe(() => this.cdr.markForCheck());
    this.error$.subscribe(() => this.cdr.markForCheck());
  }

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });

    this.forgotEmailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.store.dispatch(AuthActions.login({
        credentials: this.loginForm.value,
      }));
    } else {
      this.markFormGroupTouched(this.loginForm);
    }
  }

  showForgotPassword(): void {
    this.recoveryError = null;
    this.recoveryMessage = null;
    this.viewState = 'FORGOT_EMAIL';
    this.cdr.markForCheck();
  }

  backToLogin(): void {
    this.recoveryError = null;
    this.recoveryMessage = null;
    this.forgotEmailForm.reset();
    this.viewState = 'LOGIN';
    this.cdr.markForCheck();
  }

  submitForgotEmail(): void {
    if (this.recoveryLoading || this.forgotEmailForm.invalid) {
      this.forgotEmailForm.markAllAsTouched();
      return;
    }

    this.recoveryLoading = true;
    this.recoveryError = null;
    this.cdr.markForCheck();

    const email = String(this.forgotEmailForm.value.email ?? '').trim().toLowerCase();

    this.recoveryService
      .requestRecovery(email)
      .pipe(
        finalize(() => {
          this.recoveryLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (response) => {
          this.recoveryMessage = response.message;
          this.viewState = 'FORGOT_SUCCESS';
        },
        error: () => {
          this.recoveryError = 'Unable to process your request. Please try again.';
        },
      });
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

  getForgotEmailError(): string | undefined {
    const control = this.forgotEmailForm.get('email');
    if (control?.invalid && control?.touched) {
      if (control.errors?.['required']) {
        return 'Email is required';
      }
      if (control.errors?.['email']) {
        return 'Please enter a valid email address';
      }
    }
    return undefined;
  }

  private getFieldLabel(fieldName: string): string {
    const labels: Record<string, string> = {
      email: 'Email',
      password: 'Password',
    };
    return labels[fieldName] || fieldName;
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach((key) => {
      formGroup.get(key)?.markAsTouched();
    });
  }
}
