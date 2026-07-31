# EkklesiaSoft UI

A large-scale, multi-tenant SaaS application built with Angular 20 (latest) and designed for enterprise-level scalability.

## 🏗️ Architecture

This application follows a modular, feature-based architecture with:

- **Multi-tenant support** - Tenant-aware routing and data isolation
- **Lazy loading** - All feature modules are lazy-loaded for optimal performance
- **State Management** - NgRx for predictable state management
- **Feature isolation** - Each feature is a standalone module
- **Scalable structure** - Designed for long-term maintainability

## 📁 Project Structure

```
src/
├── app/
│   ├── core/              # Singleton services, guards, interceptors
│   ├── shared/            # Shared components, directives, pipes
│   ├── features/          # Feature modules (lazy-loaded)
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── tenants/
│   │   └── settings/
│   └── layout/            # Layout components
├── assets/                # Static assets
└── environments/          # Environment configurations
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- npm or yarn
- Angular CLI (`npm install -g @angular/cli`)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build:prod
```

## 🔧 Configuration

Update environment files in `src/environments/`:

- `environment.ts` - Development configuration
- `environment.prod.ts` - Production configuration

### Backend API Integration

The application is configured to connect to the Laravel backend at:
- **Default**: `http://localhost:8000/api`

## 📦 Key Features

- ✅ Authentication & Authorization (Laravel Passport integration)
- ✅ Multi-tenant architecture
- ✅ Role-based access control
- ✅ Responsive design
- ✅ HTTP interceptors for auth and error handling
- ✅ Lazy-loaded feature modules
- ✅ State management with NgRx
- ✅ Route guards for protected routes

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run e2e tests
npm run e2e
```

### Tenant RBAC Frontend

Frontend rollout and QA checklist for tenant roles/permissions UI:

- `TENANT_RBAC_FRONTEND_RUNBOOK.md`
- `TENANT_RBAC_UAT_TEMPLATE.md`

## 📝 License

Proprietary - EkklesiaSoft

