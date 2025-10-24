# 🧪 Testing Login - Quick Guide

## ✅ What's Been Configured

Your Angular login is **fully connected** to your Laravel API:

```
API Endpoint: POST http://127.0.0.1:8000/api/auth/login
```

---

## 🚀 Step-by-Step Testing

### 1️⃣ **Start Laravel Backend**

```bash
# Open Terminal 1
cd /var/www/html/EkklesiaSoft/EkklesiaSoftApi
php artisan serve

# Expected output:
# Server started on http://127.0.0.1:8000
```

### 2️⃣ **Verify Laravel is Running**

Open browser: `http://127.0.0.1:8000`

You should see the Laravel welcome page ✅

### 3️⃣ **Test API Endpoint Manually (Optional)**

```bash
# Use curl or Postman
curl -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

### 4️⃣ **Angular is Already Running**

Your Angular dev server should still be running on `http://localhost:4200`

If not:
```bash
# Open Terminal 2
cd /var/www/html/EkklesiaSoft/EkklesiaSoftUi
npm start
```

### 5️⃣ **Open Login Page**

Browser: `http://localhost:4200/auth/login`

### 6️⃣ **Open Browser DevTools**

Press `F12` or right-click → Inspect

- **Console Tab**: See login flow logs
- **Network Tab**: See HTTP requests
- **Application Tab**: Check localStorage after login

### 7️⃣ **Enter Test Credentials**

Use a user from your Laravel database:

```
Email: test@example.com
Password: password123
```

If you don't have a user, create one in Laravel:
```bash
php artisan tinker

$user = new App\Models\User();
$user->name = 'Test User';
$user->email = 'test@example.com';
$user->password = bcrypt('password123');
$user->save();
```

### 8️⃣ **Click "Sign In"**

---

## 🔍 What to Look For

### ✅ **In Console Tab** (F12 → Console)

You should see:

```
🔐 Login attempt for: test@example.com
✅ Login success: {user: {...}, access_token: "..."}
🎉 Login successful! Redirecting to dashboard...
👤 User: {id: 1, name: "Test User", email: "test@example.com"}
```

### ✅ **In Network Tab** (F12 → Network)

Look for a request to `auth/login`:

- **Request URL**: `http://127.0.0.1:8000/api/auth/login`
- **Method**: POST
- **Status**: 200 (OK)
- **Request Payload**:
  ```json
  {
    "email": "test@example.com",
    "password": "password123"
  }
  ```
- **Response**:
  ```json
  {
    "user": {
      "id": 1,
      "name": "Test User",
      "email": "test@example.com",
      "created_at": "...",
      "updated_at": "..."
    },
    "access_token": "eyJ0eXAiOiJKV1QiLCJh..."
  }
  ```

### ✅ **In Application Tab** (F12 → Application → Local Storage)

After successful login, you should see:

- `http://localhost:4200` → Local Storage:
  - `ekklesia_access_token`: `"eyJ0eXAiOiJKV1Qi..."`
  - `ekklesia_user`: `"{\"id\":1,\"name\":\"Test User\",...}"`

### ✅ **Page Redirect**

After successful login, you should be redirected to:
```
http://localhost:4200/tenant/1/dashboard
```

---

## ❌ Common Issues & Solutions

### Issue 1: CORS Error

**Error in Console:**
```
Access to XMLHttpRequest at 'http://127.0.0.1:8000/api/auth/login' 
from origin 'http://localhost:4200' has been blocked by CORS policy
```

**Solution:**

In Laravel, check `config/cors.php`:

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

Also ensure the CORS middleware is enabled in `bootstrap/app.php`:

```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->api(prepend: [
        \Illuminate\Http\Middleware\HandleCors::class,
    ]);
})
```

### Issue 2: 401 Unauthorized

**Error in Console:**
```
❌ Login failed: Unauthorized
```

**Solution:**

- Verify the email/password are correct
- Check if user exists in database
- Verify password is hashed with bcrypt in database

### Issue 3: Network Error

**Error in Console:**
```
❌ Login failed: Http failure response for http://127.0.0.1:8000/api/auth/login: 0 Unknown Error
```

**Solution:**

- Make sure Laravel is running: `php artisan serve`
- Check if port 8000 is not blocked
- Verify URL is exactly: `http://127.0.0.1:8000`

### Issue 4: 404 Not Found

**Error:**
```
POST http://127.0.0.1:8000/api/auth/login 404 (Not Found)
```

**Solution:**

Check Laravel routes:
```bash
php artisan route:list | grep login
```

Should show:
```
POST    api/auth/login ... AuthenticationController@login
```

If not, check `Modules/Authentication/routes/api.php`

---

## 🎯 Expected Complete Flow

1. ✅ User enters email & password
2. ✅ Form validates (email format, password min 8 chars)
3. ✅ Console: `🔐 Login attempt for: test@example.com`
4. ✅ HTTP POST to `http://127.0.0.1:8000/api/auth/login`
5. ✅ Laravel validates credentials
6. ✅ Laravel returns user + JWT token
7. ✅ Console: `✅ Login success: {...}`
8. ✅ Token saved to localStorage
9. ✅ User saved to localStorage
10. ✅ NgRx state updated
11. ✅ Console: `🎉 Login successful! Redirecting...`
12. ✅ Redirect to `/tenant/1/dashboard`
13. ✅ Dashboard page shows user info

---

## 📊 Current Configuration Summary

| Item | Value |
|------|-------|
| **Backend URL** | `http://127.0.0.1:8000` |
| **Frontend URL** | `http://localhost:4200` |
| **Login Endpoint** | `POST /api/auth/login` |
| **Full API URL** | `http://127.0.0.1:8000/api/auth/login` |
| **Environment File** | `src/environments/environment.ts` |
| **Auth Service** | `src/app/core/services/auth.service.ts` |
| **Login Component** | `src/app/features/auth/login/` |
| **NgRx Effects** | `src/app/core/store/auth/auth.effects.ts` |

---

## 🎉 Success Criteria

✅ No CORS errors  
✅ HTTP status 200  
✅ Token in localStorage  
✅ User data in localStorage  
✅ Console shows success logs  
✅ Redirect to dashboard  
✅ User name appears in dashboard  

---

## 🔧 Debug Commands

```bash
# Check if Laravel is running
curl http://127.0.0.1:8000

# Test login endpoint directly
curl -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Check Laravel logs
tail -f /var/www/html/EkklesiaSoft/EkklesiaSoftApi/storage/logs/laravel.log

# Clear Laravel cache
cd /var/www/html/EkklesiaSoft/EkklesiaSoftApi
php artisan cache:clear
php artisan config:clear
php artisan route:clear
```

---

**Happy Testing! 🚀**

If you see the login success logs and get redirected to dashboard, your integration is working perfectly!

