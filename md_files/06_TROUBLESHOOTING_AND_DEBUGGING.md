# 🔧 Troubleshooting & Debugging

**EkklesiaSoft Frontend** - Common Issues & Solutions

---

## 📚 Contents

1. [Compilation Errors](#compilation-errors)
2. [API Issues](#api-issues)
3. [State Management Issues](#state-management-issues)
4. [UI/Styling Issues](#uistyling-issues)
5. [Performance Issues](#performance-issues)

---

## ❌ Compilation Errors

### Issue: Module Not Found

**Error:**
```
ERROR in src/app/features/tenants/tenant.service.ts
Module 'rxjs/operators' has no exported member 'switchMap'
```

**Solution:**
```typescript
// ✅ Correct imports
import { switchMap, map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
```

### Issue: Property Does Not Exist

**Error:**
```
Property 'status' does not exist on type 'Tenant'
```

**Solution:**
```typescript
// Update interface
interface Tenant {
  id: number;
  name: string;
  active: number; // ✅ Use 'active' instead of 'status'
}
```

### Issue: Circular Dependency

**Solution:**
```typescript
// Use index files for exports
// core/services/index.ts
export * from './auth.service';
export * from './tenant.service';

// Import from index
import { AuthService, TenantService } from '@core/services';
```

---

## 🔌 API Issues

### Issue: CORS Error

**Error:**
```
Access to XMLHttpRequest blocked by CORS policy
```

**Solution:**
```typescript
// Backend: config/cors.php
'allowed_origins' => ['http://localhost:4200']

// Frontend: Check API URL
apiUrl: 'http://127.0.0.1:8000/api'
```

### Issue: 401 Unauthorized

**Causes:**
1. Token not being sent
2. Token expired
3. Invalid token

**Solutions:**
```typescript
// Check interceptor
console.log('Token:', localStorage.getItem('ekklesia_token'));

// Refresh token if expired
this.authService.refreshTokens().subscribe();

// Clear and re-login
localStorage.clear();
this.router.navigate(['/auth/login']);
```

### Issue: API Call Not Triggering

**Debug Steps:**
```typescript
// 1. Add console logs
onSubmit() {
  console.log('🔵 Submit called');
  console.log('Form data:', this.formData);
  console.log('Is valid:', this.isValid());
}

// 2. Check network tab
// Open browser DevTools → Network → Filter: XHR

// 3. Check Angular compilation
// Terminal: Look for "Compiled successfully"

// 4. Hard refresh browser
// Ctrl+Shift+R (Windows/Linux)
// Cmd+Shift+R (Mac)
```

---

## 🏪 State Management Issues

### Issue: State Not Updating

**Causes:**
1. Action not dispatched
2. Reducer not handling action
3. Selector not correct

**Solution:**
```typescript
// 1. Verify action dispatch
this.store.dispatch(AuthActions.login({ email, password }));
console.log('Action dispatched');

// 2. Check reducer
export const authReducer = createReducer(
  initialState,
  on(AuthActions.login, (state) => {
    console.log('Reducer: login action received');
    return { ...state, loading: true };
  })
);

// 3. Verify selector
this.store.select(selectCurrentUser).subscribe(user => {
  console.log('Current user:', user);
});
```

### Issue: Effect Not Running

**Solution:**
```typescript
// Ensure effect is provided
export const appConfig: ApplicationConfig = {
  providers: [
    provideEffects([AuthEffects])
  ]
};

// Add logging to effect
login$ = createEffect(() => {
  console.log('Effect registered');
  return this.actions$.pipe(
    ofType(AuthActions.login),
    tap(() => console.log('Login action received in effect')),
    // ... rest of effect
  );
});
```

---

## 🎨 UI/Styling Issues

### Issue: Styles Not Applying

**Solutions:**
```scss
// 1. Check selector specificity
.card { } // Less specific
.tenant-card.card { } // More specific

// 2. Use !important (last resort)
.card {
  background: white !important;
}

// 3. Check if styles are in correct file
// Component styles: component.scss
// Global styles: styles.scss

// 4. Verify SCSS is compiling
// Check angular.json: "styles": ["src/styles.scss"]
```

### Issue: Layout Breaking on Font Change

**Solution:**
```scss
// Use flexible sizing
html.font-large {
  .sidebar { width: 280px; } // Fixed size for large
  .stat-card { padding: 2rem; } // Larger padding
  .card { min-height: auto; } // Auto height
}
```

### Issue: Responsive Design Not Working

**Checklist:**
- [ ] Viewport meta tag in index.html
- [ ] Media queries in correct order (mobile-first)
- [ ] No fixed widths preventing responsiveness
- [ ] Tested at multiple breakpoints

```html
<!-- index.html -->
<meta name="viewport" content="width=device-width, initial-scale=1">
```

---

## ⚡ Performance Issues

### Issue: Slow Rendering

**Solutions:**
```typescript
// 1. Use OnPush change detection
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush
})

// 2. Use trackBy in *ngFor
<div *ngFor="let item of items; trackBy: trackById">
  {{ item.name }}
</div>

trackById(index: number, item: any) {
  return item.id;
}

// 3. Unsubscribe from observables
ngOnDestroy() {
  this.subscriptions.unsubscribe();
}

// 4. Use async pipe (auto unsubscribe)
<div *ngIf="data$ | async as data">
  {{ data.name }}
</div>
```

### Issue: Large Bundle Size

**Solutions:**
```typescript
// 1. Lazy load routes
{
  path: 'tenants',
  loadChildren: () => import('./features/tenants/tenants.routes')
}

// 2. Tree shake unused code
// Use production build
npm run build

// 3. Analyze bundle
npm install -g webpack-bundle-analyzer
ng build --stats-json
webpack-bundle-analyzer dist/stats.json
```

---

## 🔍 Debugging Tools

### Browser DevTools

```javascript
// 1. Console logging
console.log('Data:', data);
console.table(array);
console.group('Group Name');

// 2. Network tab
// Monitor API calls, check request/response

// 3. Sources tab
// Set breakpoints in TypeScript files

// 4. Angular DevTools
// chrome://extensions/ → Angular DevTools
```

### Angular DevTools

```bash
# Install
# Chrome Web Store: Angular DevTools

# Features:
# - Component tree
# - Change detection profiling
# - Injector tree
# - Router tree
```

---

## ✅ Quick Fixes

### Reset Everything

```bash
# 1. Stop dev server (Ctrl+C)

# 2. Clear node modules
rm -rf node_modules package-lock.json

# 3. Clear Angular cache
rm -rf .angular

# 4. Reinstall
npm install

# 5. Start fresh
npm start
```

### Clear Browser Cache

```bash
# Chrome
Ctrl+Shift+Delete

# Or hard refresh
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)
```

---

## 📝 Debug Checklist

- [ ] Angular app compiling? Check terminal
- [ ] Browser console errors? Check DevTools
- [ ] API working? Check Network tab
- [ ] Token present? Check localStorage
- [ ] State updating? Add console logs
- [ ] Styles applying? Check Elements tab
- [ ] Hard refreshed? Ctrl+Shift+R
- [ ] Latest code? git pull

---

**Last Updated:** October 24, 2025  
**Consolidated from:** Multiple debugging/fix files
