# 🏢 Tenant Management - Complete Implementation

**EkklesiaSoft Frontend** - Tenant CRUD & Features

---

## 📚 Contents

1. [Tenant Manager](#tenant-manager)
2. [Create Tenant Modal](#create-tenant-modal)
3. [Tenant Service](#tenant-service)
4. [Form Validation](#form-validation)
5. [API Integration](#api-integration)
6. [Troubleshooting](#troubleshooting)

---

## 📋 Tenant Manager

### Component

```typescript
@Component({
  selector: 'app-tenant-manager',
  standalone: true,
  imports: [CommonModule, TenantCreateModalComponent]
})
export class TenantManagerComponent {
  private tenantService = inject(TenantService);
  private toastService = inject(ToastService);
  
  tenants: Tenant[] = [];
  loading = false;
  error: string | null = null;
  isCreateModalOpen = false;
  
  ngOnInit() {
    this.loadTenants();
  }
  
  loadTenants() {
    this.loading = true;
    this.tenantService.listTenants().subscribe({
      next: (response) => {
        this.tenants = response.data || [];
        this.loading = false;
      },
      error: (error) => {
        this.error = error.message;
        this.loading = false;
        this.toastService.error('Failed to load tenants');
      }
    });
  }
  
  openCreateModal() {
    this.isCreateModalOpen = true;
  }
  
  closeCreateModal() {
    this.isCreateModalOpen = false;
  }
  
  onTenantCreated() {
    this.closeCreateModal();
    this.loadTenants();
    this.toastService.success('Tenant created successfully!');
  }
  
  get totalTenants() {
    return this.tenants.length;
  }
  
  get activeTenants() {
    return this.tenants.filter(t => t.active === 1).length;
  }
  
  get totalUsers() {
    return this.tenants.reduce((sum, t) => sum + (t.user_count || 0), 0);
  }
}
```

---

## ➕ Create Tenant Modal

### Component

```typescript
@Component({
  selector: 'app-tenant-create-modal',
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class TenantCreateModalComponent {
  @Output() close = new EventEmitter<void>();
  @Output() tenantCreated = new EventEmitter<void>();
  
  private tenantService = inject(TenantService);
  private toastService = inject(ToastService);
  
  formData: CreateTenantRequest = {
    tenant_name: '',
    primary_user_name: '',
    primary_user_email: '',
    primary_contact_number: '',
    official_address: {
      line1: '',
      line2: '',
      district: '',
      state_province: '',
      country: '',
      pin_zip_code: ''
    }
  };
  
  tenantLogo: File | null = null;
  logoPreviewUrl: string | null = null;
  isSubmitting = false;
  touched: Record<string, boolean> = {};
  formErrors: Record<string, string> = {};
  
  onLogoSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    
    // Validate file
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      this.toastService.error('Only JPEG, PNG, GIF, WebP allowed');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      this.toastService.error('File must be less than 5MB');
      return;
    }
    
    this.tenantLogo = file;
    
    // Preview
    const reader = new FileReader();
    reader.onload = (e) => {
      this.logoPreviewUrl = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
  
  removeLogo() {
    this.tenantLogo = null;
    this.logoPreviewUrl = null;
  }
  
  validateForm(): boolean {
    this.formErrors = {};
    
    if (!this.formData.tenant_name) {
      this.formErrors['tenant_name'] = 'Tenant name is required';
    }
    
    if (!this.formData.primary_user_email) {
      this.formErrors['primary_user_email'] = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.formData.primary_user_email)) {
      this.formErrors['primary_user_email'] = 'Invalid email format';
    }
    
    // Validate address
    if (!this.formData.official_address.line1) {
      this.formErrors['official_address.line1'] = 'Address is required';
    }
    
    return Object.keys(this.formErrors).length === 0;
  }
  
  onSubmit() {
    // Mark all as touched
    Object.keys(this.formData).forEach(key => {
      this.touched[key] = true;
    });
    
    if (!this.validateForm()) {
      this.toastService.error('Please fix validation errors');
      return;
    }
    
    this.isSubmitting = true;
    
    this.tenantService.createTenant(this.formData, this.tenantLogo).subscribe({
      next: (response) => {
        this.toastService.success('Tenant created successfully!');
        setTimeout(() => {
          this.tenantCreated.emit();
          this.isSubmitting = false;
        }, 500);
      },
      error: (error) => {
        this.toastService.error(error.message || 'Failed to create tenant');
        this.isSubmitting = false;
      }
    });
  }
  
  onClose() {
    this.close.emit();
  }
}
```

---

## 🔌 Tenant Service

```typescript
@Injectable({ providedIn: 'root' })
export class TenantService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/tenant`;
  
  listTenants(): Observable<TenantListResponse> {
    return this.http.get<TenantListResponse>(`${this.apiUrl}/list`);
  }
  
  getTenant(id: number): Observable<TenantResponse> {
    return this.http.get<TenantResponse>(`${this.apiUrl}/${id}`);
  }
  
  createTenant(data: CreateTenantRequest, logo?: File | null): Observable<TenantResponse> {
    const formData = this.buildFormData(data, logo);
    return this.http.post<TenantResponse>(this.apiUrl, formData);
  }
  
  updateTenant(id: number, data: CreateTenantRequest, logo?: File | null): Observable<TenantResponse> {
    const formData = this.buildFormData(data, logo);
    return this.http.put<TenantResponse>(`${this.apiUrl}/${id}`, formData);
  }
  
  deleteTenant(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
  
  private buildFormData(data: CreateTenantRequest, logo?: File | null): FormData {
    const formData = new FormData();
    
    // Add basic fields
    formData.append('tenant_name', data.tenant_name);
    formData.append('primary_user_name', data.primary_user_name);
    formData.append('primary_user_email', data.primary_user_email);
    formData.append('primary_contact_number', data.primary_contact_number);
    
    // Add address as nested FormData keys
    Object.keys(data.official_address).forEach(key => {
      const value = data.official_address[key as keyof Address];
      if (value) {
        formData.append(`official_address[${key}]`, value);
      }
    });
    
    // Add logo if present
    if (logo) {
      formData.append('tenant_logo', logo);
    }
    
    return formData;
  }
}
```

---

## ✅ Form Validation

### Validation Rules

```typescript
validators = {
  tenant_name: [Validators.required, Validators.maxLength(255)],
  primary_user_email: [Validators.required, Validators.email],
  primary_contact_number: [Validators.required, Validators.pattern(/^\+?[0-9-]+$/)],
  'official_address.line1': [Validators.required],
  'official_address.country': [Validators.required]
};
```

### Display Errors

```html
<div *ngIf="touched['tenant_name'] && formErrors['tenant_name']" class="error">
  {{ formErrors['tenant_name'] }}
</div>
```

---

## 🔧 Troubleshooting

### Issue: API Call Not Happening

**Cause:** Form validation failing silently or event not binding

**Solution:**
```typescript
// Add debug logging
onSubmit() {
  console.log('🔵 onSubmit() called!');
  console.log('Form data:', this.formData);
  console.log('Is valid:', this.validateForm());
  // ... rest of method
}
```

### Issue: Compilation Errors

**Cause:** TypeScript errors preventing build

**Solutions:**
1. Check NgRx store methods match interface
2. Fix tenant.service.ts method signatures
3. Update tenant.guard.ts to use correct API response
4. Comment out unused tenant.interceptor.ts

### Issue: Toast Not Showing

**Cause:** Incorrect positioning or z-index

**Solution:**
```scss
.toast-container {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 99999;
}
```

---

**Last Updated:** October 24, 2025  
**Consolidated from:** 10 tenant-related files
