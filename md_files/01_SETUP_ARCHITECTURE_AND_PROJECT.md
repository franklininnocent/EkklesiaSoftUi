# 🏗️ Frontend Setup, Architecture & Project Overview

**EkklesiaSoft Angular 20 Frontend** - Complete Setup and Architecture Guide

---

## 📚 Table of Contents

1. [Quick Start](#quick-start)
2. [Project Architecture](#project-architecture)
3. [Complete Setup Guide](#complete-setup-guide)
4. [Project Structure](#project-structure)
5. [Technology Stack](#technology-stack)
6. [Backend Integration](#backend-integration)
7. [Development Workflow](#development-workflow)

---

## 🚀 Quick Start

### Prerequisites

- ✅ Node.js 18+ and npm
- ✅ Angular CLI 20
- ✅ Backend API running on http://127.0.0.1:8000

### 5-Minute Setup

```bash
cd /var/www/html/EkklesiaSoft/EkklesiaSoftUi

# Install dependencies
npm install

# Start development server
npm start

# App runs on: http://localhost:4200
```

### First Login

```
Email: franklininnocent.fs@gmail.com
Password: Secrete*999
```

---

## 🏛️ Project Architecture

### Modern Angular Architecture

```
EkklesiaSoftUi/
├── src/
│   ├── app/
│   │   ├── core/                    # Singleton services, guards, interceptors
│   │   │   ├── guards/              # Route guards (auth, tenant)
│   │   │   ├── interceptors/        # HTTP interceptors (auth, error)
│   │   │   ├── models/              # TypeScript interfaces
│   │   │   ├── services/            # Business logic services
│   │   │   └── store/               # NgRx state management
│   │   │
│   │   ├── features/                # Feature modules (lazy-loaded)
│   │   │   ├── auth/                # Login, Register
│   │   │   ├── dashboard/           # Main dashboard
│   │   │   ├── tenants/             # Tenant management
│   │   │   ├── settings/            # Settings page
│   │   │   ├── profile/             # User profile
│   │   │   └── users/               # User management
│   │   │
│   │   ├── layout/                  # Layout components
│   │   │   └── main-layout/         # Main app layout
│   │   │
│   │   ├── shared/                  # Shared components
│   │   │   └── components/          # Reusable UI components
│   │   │
│   │   ├── app.component.ts         # Root component
│   │   ├── app.config.ts            # App configuration
│   │   └── app.routes.ts            # Route definitions
│   │
│   ├── assets/                      # Static assets
│   ├── environments/                # Environment configs
│   └── styles.scss                  # Global styles
│
├── angular.json                     # Angular workspace config
├── package.json                     # Dependencies
└── tsconfig.json                    # TypeScript config
```

### Design Patterns

**1. Feature-Based Organization**
- Each feature is self-contained
- Lazy loading for optimal performance
- Clear separation of concerns

**2. State Management (NgRx)**
```
State → Actions → Reducers → Effects → Selectors
```

**3. Service Layer**
```
Component → Service → HTTP → Backend API
```

---

## 📦 Complete Setup Guide

### Step 1: Install Dependencies

```bash
cd /var/www/html/EkklesiaSoft/EkklesiaSoftUi
npm install
```

**Key Dependencies:**
- `@angular/core@20` - Angular framework
- `@ngrx/store` - State management
- `@angular/router` - Routing
- `rxjs` - Reactive programming

### Step 2: Environment Configuration

```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://127.0.0.1:8000/api',
  appName: 'EkklesiaSoft',
  tokenKey: 'ekklesia_token',
  refreshTokenKey: 'ekklesia_refresh_token',
  expiryTimeKey: 'ekklesia_expiry_time',
  userIdKey: 'ekklesia_user_id',
  roleIdKey: 'ekklesia_role_id'
};
```

### Step 3: Start Development Server

```bash
npm start
# or
ng serve
```

### Step 4: Build for Production

```bash
npm run build
# Output: dist/ekklesia-soft-ui/
```

---

## 🗂️ Project Structure

### Core Module

**Purpose:** Singleton services used throughout the app

```typescript
core/
├── guards/
│   ├── auth.guard.ts              # Protect routes
│   └── tenant.guard.ts            # Tenant-specific protection
│
├── interceptors/
│   ├── auth.interceptor.ts        # Add Bearer token
│   ├── error.interceptor.ts       # Handle errors
│   └── tenant.interceptor.ts      # Add tenant context
│
├── models/
│   ├── auth.model.ts              # Auth interfaces
│   ├── user.model.ts              # User interfaces
│   └── tenant.model.ts            # Tenant interfaces
│
├── services/
│   ├── auth.service.ts            # Authentication
│   ├── tenant.service.ts          # Tenant operations
│   ├── theme.service.ts           # Theme management
│   └── toast.service.ts           # Toast notifications
│
└── store/                         # NgRx state
    ├── auth/
    ├── tenant/
    └── ui/
```

### Feature Modules

**Lazy-Loaded for Performance**

```typescript
features/
├── auth/                          # Authentication
│   ├── login/
│   ├── register/
│   └── auth.routes.ts
│
├── dashboard/                     # Main dashboard
│   ├── dashboard.component.ts
│   └── dashboard.routes.ts
│
├── tenants/                       # Tenant management
│   ├── tenant-manager/
│   ├── tenant-create-modal/
│   └── tenants.routes.ts
│
├── settings/                      # Settings
│   ├── settings.component.ts
│   └── settings.routes.ts
│
├── profile/                       # User profile
│   ├── profile.component.ts
│   └── profile.routes.ts
│
└── users/                         # User management
    ├── users.component.ts
    └── users.routes.ts
```

### Shared Module

**Reusable Components**

```typescript
shared/
└── components/
    ├── card/                      # Card component
    ├── breadcrumb/                # Breadcrumb navigation
    └── toast-container/           # Toast notifications
```

---

## 💻 Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Angular** | 20 | Frontend framework |
| **TypeScript** | 5.5+ | Type-safe JavaScript |
| **NgRx** | Latest | State management |
| **RxJS** | 7+ | Reactive programming |
| **SCSS** | Latest | Styling |
| **Angular Router** | 20 | Routing & navigation |

### Key Features

✅ **Standalone Components** - Modern Angular architecture  
✅ **Lazy Loading** - Optimal performance  
✅ **Signal-based State** - Reactive state management  
✅ **HTTP Interceptors** - Global request/response handling  
✅ **Route Guards** - Protected routes  
✅ **Responsive Design** - Mobile-first approach  
✅ **Dark Mode Ready** - Theme system implemented  

---

## 🔗 Backend Integration

### API Configuration

```typescript
// src/environments/environment.ts
apiUrl: 'http://127.0.0.1:8000/api'
```

### HTTP Service Example

```typescript
// tenant.service.ts
import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment';

@Injectable({ providedIn: 'root' })
export class TenantService {
  private apiUrl = `${environment.apiUrl}/tenant`;
  
  constructor(private http: HttpClient) {}
  
  listTenants() {
    return this.http.get<TenantResponse>(`${this.apiUrl}/list`);
  }
  
  createTenant(data: CreateTenantRequest) {
    return this.http.post<TenantResponse>(this.apiUrl, data);
  }
}
```

### Authentication Flow

```
1. User logs in → POST /api/auth/login
2. Backend returns: access_token, refresh_token, expiry_time
3. Frontend stores in localStorage
4. HTTP Interceptor adds Bearer token to requests
5. On 401 error → Refresh token automatically
6. On logout → POST /api/auth/logout → Clear storage
```

---

## 🛠️ Development Workflow

### Running the App

```bash
# Development
npm start

# Production build
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

### Creating New Features

```bash
# Generate component
ng generate component features/my-feature

# Generate service
ng generate service core/services/my-service

# Generate guard
ng generate guard core/guards/my-guard
```

### Code Style

```typescript
// ✅ Good: Use interfaces
interface User {
  id: number;
  name: string;
  email: string;
}

// ✅ Good: Use services for business logic
export class MyComponent {
  constructor(private myService: MyService) {}
  
  loadData() {
    this.myService.getData().subscribe(data => {
      // Handle data
    });
  }
}

// ✅ Good: Use async pipe
<div *ngIf="data$ | async as data">
  {{ data.name }}
</div>
```

---

## 📊 Performance Optimization

### 1. Lazy Loading

```typescript
// app.routes.ts
{
  path: 'dashboard',
  loadChildren: () => import('./features/dashboard/dashboard.routes')
}
```

### 2. OnPush Change Detection

```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush
})
```

### 3. TrackBy Functions

```typescript
trackByFn(index: number, item: any) {
  return item.id;
}
```

---

## 🎓 Learning Resources

- [Angular Documentation](https://angular.dev)
- [NgRx Documentation](https://ngrx.io)
- [RxJS Documentation](https://rxjs.dev)

---

**Last Updated:** October 24, 2025  
**Status:** Complete and Production-Ready

**See also:**
- `02_AUTHENTICATION_AND_STATE_MANAGEMENT.md` - Auth implementation
- `03_THEME_AND_RESPONSIVE_DESIGN.md` - Theme system
- `04_TENANT_MANAGEMENT_COMPLETE.md` - Tenant features
- `05_UI_COMPONENTS_AND_FEATURES.md` - UI components
- `06_TROUBLESHOOTING_AND_DEBUGGING.md` - Fixes & debugging
