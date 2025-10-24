# API Integration Guide

## ✅ Login API Endpoint Configuration

Your Angular app is now fully configured to connect to your Laravel backend.

### 🔗 API Endpoint

```
POST http://127.0.0.1:8000/api/auth/login
```

---

## 📋 Login Flow (Step by Step)

### 1️⃣ **User enters credentials**
```
Email: user@example.com
Password: ********
```

### 2️⃣ **Form submission** (`login.component.ts`)
```typescript
onSubmit(): void {
  if (this.loginForm.valid) {
    this.store.dispatch(AuthActions.login({ 
      credentials: this.loginForm.value 
    }));
  }
}
```

### 3️⃣ **NgRx Action dispatched**
```typescript
AuthActions.login({ 
  credentials: { 
    email: 'user@example.com', 
    password: '********' 
  } 
})
```

### 4️⃣ **Effect catches action** (`auth.effects.ts`)
```typescript
login$ = createEffect(() =>
  this.actions$.pipe(
    ofType(AuthActions.login),
    switchMap(({ credentials }) =>
      this.authService.login(credentials)
    )
  )
);
```

### 5️⃣ **Service makes HTTP call** (`auth.service.ts`)
```typescript
login(credentials: LoginRequest): Observable<AuthResponse> {
  return this.http.post<AuthResponse>(
    `http://127.0.0.1:8000/api/auth/login`, // ← YOUR API
    credentials
  );
}
```

### 6️⃣ **HTTP Request sent**
```http
POST /api/auth/login HTTP/1.1
Host: 127.0.0.1:8000
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### 7️⃣ **Laravel responds** (Expected)
```json
{
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "user@example.com",
    "created_at": "2025-10-24T00:00:00.000000Z",
    "updated_at": "2025-10-24T00:00:00.000000Z"
  },
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### 8️⃣ **Success action dispatched**
```typescript
AuthActions.loginSuccess({ response })
```

### 9️⃣ **User data saved**
- Token stored in `localStorage` with key: `ekklesia_access_token`
- User stored in `localStorage` with key: `ekklesia_user`
- State updated in NgRx store

### 🔟 **Navigate to dashboard**
```typescript
this.router.navigate(['/tenant/1/dashboard']);
```

---

## 🔍 Request/Response Details

### Request Headers (Auto-added)
```http
Content-Type: application/json
Accept: application/json
```

### Request Body (from form)
```json
{
  "email": "string",
  "password": "string"
}
```

### Success Response (200)
```json
{
  "user": {
    "id": number,
    "name": "string",
    "email": "string",
    "email_verified_at": "string | null",
    "created_at": "string",
    "updated_at": "string"
  },
  "access_token": "string"
}
```

### Error Response (401)
```json
{
  "message": "The provided credentials are incorrect.",
  "errors": {
    "email": ["The provided credentials are incorrect."]
  }
}
```

---

## 🛡️ HTTP Interceptors

### 1. Auth Interceptor (`auth.interceptor.ts`)
```typescript
// Adds Authorization header to all requests (after login)
Authorization: Bearer {access_token}
```

### 2. Tenant Interceptor (`tenant.interceptor.ts`)
```typescript
// Adds tenant ID header (for multi-tenant requests)
X-Tenant-ID: {tenant_id}
```

### 3. Error Interceptor (`error.interceptor.ts`)
```typescript
// Catches HTTP errors and displays user-friendly messages
// 401 → Redirects to login
// 422 → Shows validation errors
// 500 → Shows server error message
```

---

## 🧪 Testing the Login

### 1. **Start Laravel Backend**
```bash
cd /var/www/html/EkklesiaSoft/EkklesiaSoftApi
php artisan serve
# Should be running on http://127.0.0.1:8000
```

### 2. **Start Angular Frontend**
```bash
cd /var/www/html/EkklesiaSoft/EkklesiaSoftUi
npm start
# Running on http://localhost:4200
```

### 3. **Test Login**
- Navigate to: `http://localhost:4200/auth/login`
- Enter credentials
- Click "Sign In"

### 4. **Check Browser DevTools**
```javascript
// Open Console (F12)
// Check Network tab for:
// - Request URL: http://127.0.0.1:8000/api/auth/login
// - Request Method: POST
// - Status: 200 OK
// - Response: { user, access_token }

// Check Application > Local Storage:
// - ekklesia_access_token: "jwt_token..."
// - ekklesia_user: "{...user data...}"
```

---

## 🐛 Debugging

### Enable Console Logging
Add to `auth.effects.ts`:

```typescript
login$ = createEffect(() =>
  this.actions$.pipe(
    ofType(AuthActions.login),
    tap(action => console.log('🔐 Login attempt:', action.credentials.email)),
    switchMap(({ credentials }) =>
      this.authService.login(credentials).pipe(
        tap(response => console.log('✅ Login success:', response)),
        map(response => AuthActions.loginSuccess({ response })),
        catchError(error => {
          console.error('❌ Login error:', error);
          return of(AuthActions.loginFailure({ error: error.message }));
        })
      )
    )
  )
);
```

---

## 🔧 CORS Configuration (Laravel)

Make sure your Laravel backend allows requests from Angular:

**File: `config/cors.php`**
```php
return [
    'paths' => ['api/*'],
    'allowed_origins' => ['http://localhost:4200'],
    'allowed_methods' => ['*'],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,
];
```

---

## 📊 Current Configuration

| Setting | Value |
|---------|-------|
| API Base URL | `http://127.0.0.1:8000/api` |
| Login Endpoint | `POST /auth/login` |
| Full URL | `http://127.0.0.1:8000/api/auth/login` |
| Token Storage | `localStorage.ekklesia_access_token` |
| User Storage | `localStorage.ekklesia_user` |
| State Management | NgRx Store |

---

## ✅ Checklist

- [x] Environment configured: `http://127.0.0.1:8000/api`
- [x] Auth service connected to API
- [x] Login component dispatches actions
- [x] NgRx effects handle API calls
- [x] Success handler saves token & user
- [x] Error handler displays messages
- [x] Auto-redirect on success
- [x] HTTP interceptors configured

---

## 🎯 Next Steps

1. ✅ Make sure Laravel backend is running on `http://127.0.0.1:8000`
2. ✅ Test user registration or create a test user in database
3. ✅ Open Angular app: `http://localhost:4200/auth/login`
4. ✅ Enter credentials and login
5. ✅ Check browser DevTools Network tab
6. ✅ Verify token is saved in localStorage
7. ✅ Confirm redirect to dashboard

---

**Your login is fully integrated! Just make sure your Laravel backend is running.** 🚀

