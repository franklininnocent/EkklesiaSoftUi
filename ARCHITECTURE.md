# EkklesiaSoft UI - Architecture Documentation

## 🏗️ Architecture Overview

This Angular 20 application follows a **modular, feature-based architecture** designed for large-scale SaaS applications with multi-tenant support.

## 📂 Project Structure

```
src/
├── app/
│   ├── core/                    # Core module (singleton services, guards, interceptors)
│   │   ├── guards/             # Route guards (auth, tenant)
│   │   ├── interceptors/       # HTTP interceptors (auth, tenant, error)
│   │   ├── models/             # Data models and interfaces
│   │   ├── services/           # Core services (auth, tenant, storage)
│   │   └── store/              # NgRx state management
│   │       ├── auth/           # Authentication state
│   │       └── tenant/         # Tenant state
│   │
│   ├── shared/                 # Shared module (reusable components)
│   │   └── components/         # Shared UI components
│   │       ├── button/
│   │       ├── input/
│   │       └── card/
│   │
│   ├── features/               # Feature modules (lazy-loaded)
│   │   ├── auth/               # Authentication feature
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── dashboard/          # Dashboard feature
│   │   ├── settings/           # Settings feature
│   │   └── users/              # Users management feature
│   │
│   ├── layout/                 # Layout components
│   │   └── main-layout/        # Main application layout
│   │
│   ├── app.component.ts        # Root component
│   ├── app.routes.ts           # Route configuration
│   └── app.config.ts           # Application configuration
│
├── environments/               # Environment configurations
│   ├── environment.ts          # Development environment
│   └── environment.prod.ts     # Production environment
│
├── assets/                     # Static assets
├── styles.scss                 # Global styles
├── index.html                  # HTML entry point
└── main.ts                     # Application bootstrap
```

## 🎯 Design Patterns & Principles

### 1. **Modular Architecture**
- **Core Module**: Contains singleton services and app-wide functionality
- **Shared Module**: Reusable components, directives, and pipes
- **Feature Modules**: Business logic organized by features, all lazy-loaded

### 2. **State Management (NgRx)**
- Centralized state management using NgRx Store
- Effects for side effects (API calls)
- Selectors for state access
- Actions for state mutations

### 3. **Multi-Tenant Support**
- Tenant-aware routing (`/tenant/:tenantId/*`)
- Tenant interceptor adds tenant ID to all API requests
- Tenant guard validates tenant access
- Tenant service manages current tenant state

### 4. **Authentication Flow**
- JWT token-based authentication (Laravel Passport)
- Auth interceptor adds bearer token to requests
- Auth guard protects authenticated routes
- Auth service manages authentication state
- Tokens stored in localStorage

### 5. **Lazy Loading**
- All feature modules are lazy-loaded
- Route-level code splitting
- Standalone components for better tree-shaking

## 🔒 Security Features

### HTTP Interceptors
1. **Auth Interceptor**: Adds JWT token to all requests
2. **Tenant Interceptor**: Adds tenant ID header
3. **Error Interceptor**: Global error handling

### Guards
1. **Auth Guard**: Protects authenticated routes
2. **Tenant Guard**: Validates tenant access and loads tenant data

## 🔄 Data Flow

```
Component → Action → Effect → API → Response → Reducer → Store → Selector → Component
```

### Example: User Login Flow
1. User submits login form
2. Component dispatches `login` action
3. Effect intercepts action and calls AuthService
4. AuthService makes API call to Laravel backend
5. Success response returns user + token
6. Effect dispatches `loginSuccess` action
7. Reducer updates auth state
8. Component subscribes to auth state via selectors
9. User is redirected to dashboard

## 🌐 API Integration

### Base URL Configuration
- Development: `http://localhost:8000/api`
- Production: `https://api.ekklesiasoft.com/api`

### API Endpoints Used
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `GET /auth/user` - Get current user
- `GET /tenants` - Get user's tenants (to be implemented)
- `GET /tenants/:id` - Get tenant details (to be implemented)

## 📱 Responsive Design

- Mobile-first approach
- Responsive sidebar with mobile menu
- Flexible grid layouts
- Touch-friendly UI elements

## 🎨 Styling Strategy

### CSS Variables (Design Tokens)
- Colors, spacing, shadows defined as CSS variables
- Easy theme customization
- Consistent design system

### Component Styles
- Component-scoped SCSS
- BEM-like naming convention
- Utility classes for common patterns

## 🧪 Testing Strategy (Recommended)

### Unit Tests
- Test services with mocked dependencies
- Test components with TestBed
- Test pure functions (reducers, selectors)

### Integration Tests
- Test feature workflows
- Test navigation flows
- Test API integration

### E2E Tests
- Critical user journeys
- Authentication flows
- Multi-tenant scenarios

## 🚀 Performance Optimization

### Implemented
- Lazy loading for all features
- OnPush change detection (where applicable)
- Standalone components
- Tree-shakeable providers
- HTTP interceptor efficiency

### Recommended
- Virtual scrolling for large lists
- Image optimization
- Service workers for caching
- Code splitting optimization
- Bundle analysis

## 📈 Scalability Considerations

### Code Organization
- Feature-based folder structure
- Clear separation of concerns
- Reusable components in shared module
- Centralized state management

### Multi-Tenant Architecture
- Tenant isolation at routing level
- Tenant-specific data filtering
- Per-tenant feature flags (via subscription)
- Tenant-specific customization

### State Management
- Normalized state structure
- Entity adapters for collections
- Memoized selectors
- Effect isolation

## 🔧 Development Workflow

### Adding a New Feature
1. Create feature folder in `src/app/features/`
2. Create feature routes file
3. Create feature components (lazy-loaded)
4. Add route to main `app.routes.ts`
5. Create feature-specific state (if needed)

### Adding a New Component
1. Decide: Shared or Feature-specific?
2. Use Angular CLI: `ng g c path/component-name`
3. Make standalone if possible
4. Add to appropriate module exports

### Adding New API Integration
1. Define model/interface in `core/models`
2. Create or update service in `core/services`
3. Create NgRx actions, reducer, effects (if complex state)
4. Use service in components via dependency injection

## 🛠️ Build & Deployment

### Development Build
```bash
npm start
# or
ng serve
```

### Production Build
```bash
npm run build:prod
# or
ng build --configuration production
```

### Build Output
- Located in `dist/ekklesia-soft-ui/`
- Optimized and minified
- Ready for deployment to any static hosting

## 📚 Key Technologies

- **Angular 20**: Framework (latest)
- **TypeScript 5.8**: Language
- **NgRx 20**: State management
- **RxJS 7.8**: Reactive programming
- **SCSS**: Styling
- **Standalone Components**: Modern Angular architecture

## 🔗 Integration Points

### Backend (Laravel)
- RESTful API
- JWT authentication (Passport)
- Multi-tenant data isolation
- Standardized error responses

### Future Integrations
- WebSockets for real-time updates
- Payment gateway integration
- Email service integration
- File storage integration

## 📝 Coding Standards

### TypeScript
- Strict mode enabled
- No implicit any
- Proper type definitions

### Components
- Single responsibility principle
- Reactive forms over template-driven
- Smart vs Presentational components
- OnPush change detection where possible

### Services
- Injectable with `providedIn: 'root'`
- Observable-based APIs
- Error handling
- Proper cleanup (unsubscribe)

### State Management
- Actions follow naming convention: `[Feature] Action Name`
- Effects handle side effects only
- Selectors are memoized
- State is normalized

## 🐛 Error Handling

### HTTP Errors
- Interceptor catches all HTTP errors
- User-friendly error messages
- 401 errors redirect to login
- Error state in store

### Form Validation
- Reactive forms validation
- Custom validators
- Real-time error display
- User-friendly error messages

## 🔐 Environment Variables

### Development (`environment.ts`)
- `production: false`
- Local API URL
- DevTools enabled

### Production (`environment.prod.ts`)
- `production: true`
- Production API URL
- DevTools disabled
- Optimized builds

---

## 📖 Additional Documentation

For more information, see:
- [README.md](./README.md) - Getting started guide
- [Angular Documentation](https://angular.dev)
- [NgRx Documentation](https://ngrx.io)

