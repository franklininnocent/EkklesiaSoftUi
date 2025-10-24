# EkklesiaSoft UI - Setup Guide

## 🚀 Quick Start

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** (v9 or higher) - comes with Node.js
- **Angular CLI** (v20 or higher) - Install globally:
  ```bash
  npm install -g @angular/cli@latest
  ```

### Installation Steps

1. **Navigate to the frontend directory:**
   ```bash
   cd /var/www/html/EkklesiaSoft/EkklesiaSoftUi
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   
   Edit `src/environments/environment.ts` to point to your Laravel backend:
   ```typescript
   export const environment = {
     production: false,
     apiUrl: 'http://localhost:8000/api',  // Update with your backend URL
     // ... other config
   };
   ```

4. **Start the development server:**
   ```bash
   npm start
   ```
   
   The application will be available at `http://localhost:4200/`

## 🔧 Development Commands

### Start Development Server
```bash
npm start
# or
ng serve
```
Runs the app in development mode at `http://localhost:4200/`

### Build for Production
```bash
npm run build:prod
# or
ng build --configuration production
```
Creates an optimized production build in the `dist/` folder

### Run Unit Tests
```bash
npm test
# or
ng test
```
Launches the test runner in watch mode

### Lint Code
```bash
npm run lint
# or
ng lint
```
Checks code quality and style

### Build and Watch
```bash
npm run watch
# or
ng build --watch
```
Rebuilds on file changes (useful for library development)

## 🏗️ Project Structure

```
EkklesiaSoftUi/
├── src/
│   ├── app/
│   │   ├── core/              # Core services, guards, interceptors
│   │   ├── shared/            # Shared components
│   │   ├── features/          # Feature modules (lazy-loaded)
│   │   ├── layout/            # Layout components
│   │   ├── app.component.ts
│   │   ├── app.routes.ts
│   │   └── app.config.ts
│   ├── environments/          # Environment configurations
│   ├── assets/                # Static assets
│   ├── styles.scss            # Global styles
│   └── index.html
├── public/                    # Public assets
├── angular.json               # Angular CLI configuration
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
└── README.md
```

## 🔐 Backend Integration

### Laravel API Setup

1. **Ensure your Laravel backend is running:**
   ```bash
   cd /var/www/html/EkklesiaSoft/EkklesiaSoftApi
   php artisan serve
   ```
   Backend should be at `http://localhost:8000`

2. **Configure CORS in Laravel:**
   
   Add to `config/cors.php`:
   ```php
   'paths' => ['api/*'],
   'allowed_origins' => ['http://localhost:4200'],
   'allowed_methods' => ['*'],
   'allowed_headers' => ['*'],
   'supports_credentials' => false,
   ```

3. **Run Laravel migrations:**
   ```bash
   php artisan migrate
   php artisan passport:install
   ```

### API Endpoints

The Angular app expects these endpoints:

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/user` - Get current user

## 🎨 Customization

### Theming

Update CSS variables in `src/styles.scss`:

```scss
:root {
  --primary-color: #4f46e5;     // Your brand color
  --secondary-color: #06b6d4;   // Secondary color
  --success-color: #10b981;     // Success states
  --error-color: #ef4444;       // Error states
  // ... more variables
}
```

### Adding New Features

1. **Create a new feature module:**
   ```bash
   ng generate component features/my-feature --standalone
   ```

2. **Create routes file:**
   ```bash
   touch src/app/features/my-feature/my-feature.routes.ts
   ```

3. **Add route to main routes:**
   ```typescript
   // In app.routes.ts
   {
     path: 'my-feature',
     loadChildren: () => import('./features/my-feature/my-feature.routes')
       .then(m => m.MY_FEATURE_ROUTES)
   }
   ```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in headless mode
ng test --browsers=ChromeHeadless --watch=false

# Run tests with coverage
ng test --code-coverage
```

### Writing Tests

Example component test:
```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MyComponent } from './my.component';

describe('MyComponent', () => {
  let component: MyComponent;
  let fixture: ComponentFixture<MyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(MyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
```

## 📦 Building for Production

### Build Steps

1. **Update production environment:**
   
   Edit `src/environments/environment.prod.ts`:
   ```typescript
   export const environment = {
     production: true,
     apiUrl: 'https://api.yourdomain.com/api',
     // ... other config
   };
   ```

2. **Build the application:**
   ```bash
   npm run build:prod
   ```

3. **Output location:**
   ```
   dist/ekklesia-soft-ui/
   ```

### Deployment Options

#### Option 1: Static Hosting (Netlify, Vercel, etc.)

1. Build the app: `npm run build:prod`
2. Deploy the `dist/ekklesia-soft-ui/` folder
3. Configure redirects for Angular routing:
   
   **Netlify** (`_redirects` file):
   ```
   /*    /index.html   200
   ```
   
   **Vercel** (`vercel.json`):
   ```json
   {
     "routes": [
       { "src": "/(.*)", "dest": "/index.html" }
     ]
   }
   ```

#### Option 2: Nginx

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/html/EkklesiaSoft/EkklesiaSoftUi/dist/ekklesia-soft-ui/browser;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

#### Option 3: Apache

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</IfModule>
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Port 4200 already in use
```bash
# Kill the process using port 4200
kill -9 $(lsof -ti:4200)
# Or use a different port
ng serve --port 4201
```

#### 2. CORS errors
- Ensure Laravel CORS is configured correctly
- Check that `apiUrl` in environment matches your backend
- Verify backend is running

#### 3. Module not found errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### 4. TypeScript errors
```bash
# Clear Angular cache
rm -rf .angular/cache
ng serve
```

### Getting Help

- Check the [Angular documentation](https://angular.dev)
- Review the [ARCHITECTURE.md](./ARCHITECTURE.md) file
- Check browser console for errors
- Verify API responses in Network tab

## 📚 Additional Resources

### Documentation
- [Angular Docs](https://angular.dev)
- [NgRx Docs](https://ngrx.io)
- [RxJS Docs](https://rxjs.dev)
- [TypeScript Docs](https://www.typescriptlang.org/docs)

### Recommended VSCode Extensions
- Angular Language Service
- ESLint
- Prettier
- Angular Snippets
- GitLens

### Useful Commands

```bash
# Generate component
ng g c path/component-name --standalone

# Generate service
ng g s path/service-name

# Generate guard
ng g guard path/guard-name

# Generate interface
ng g interface path/interface-name

# Analyze bundle size
npm run build:prod -- --stats-json
npx webpack-bundle-analyzer dist/ekklesia-soft-ui/browser/stats.json
```

## 🎯 Next Steps

1. ✅ Review the application structure
2. ✅ Start the development server
3. ✅ Test the login functionality
4. ✅ Explore the dashboard
5. ✅ Customize the theme
6. ✅ Add your own features
7. ✅ Write tests
8. ✅ Deploy to production

---

**Need help?** Check the [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed technical documentation.

