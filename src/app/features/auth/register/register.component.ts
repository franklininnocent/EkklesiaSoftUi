import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ButtonComponent, InputComponent, CardComponent } from '@shared/components';
import { AppState } from '@core/store';
import * as AuthActions from '@core/store/auth/auth.actions';
import { selectAuthLoading, selectAuthError } from '@core/store/auth/auth.selectors';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    ButtonComponent,
    InputComponent,
    CardComponent
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private store = inject(Store<AppState>);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  registerForm!: FormGroup;
  loading$: Observable<boolean>;
  error$: Observable<string | null>;

  constructor() {
    this.loading$ = this.store.select(selectAuthLoading).pipe(takeUntil(this.destroy$));
    this.error$ = this.store.select(selectAuthError).pipe(takeUntil(this.destroy$));
    this.loading$.subscribe(() => this.cdr.markForCheck());
    this.error$.subscribe(() => this.cdr.markForCheck());
  }

  ngOnInit(): void {
    this.registerForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      password_confirmation: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('password_confirmation');

    if (!password || !confirmPassword) {
      return null;
    }

    return password.value === confirmPassword.value ? null : { passwordMismatch: true };
  }

  onSubmit(): void {
    if (this.registerForm.valid) {
      this.store.dispatch(AuthActions.register({ 
        data: this.registerForm.value 
      }));
    } else {
      this.markFormGroupTouched(this.registerForm);
    }
  }

  getErrorMessage(fieldName: string): string | undefined {
    const control = this.registerForm.get(fieldName);
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

    // Check for password mismatch
    if (fieldName === 'password_confirmation' && control?.touched) {
      if (this.registerForm.errors?.['passwordMismatch']) {
        return 'Passwords do not match';
      }
    }

    return undefined;
  }

  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      name: 'Name',
      email: 'Email',
      password: 'Password',
      password_confirmation: 'Confirm Password'
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

