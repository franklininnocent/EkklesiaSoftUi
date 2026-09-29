# Tenant RBAC Frontend Runbook

## 1) Preconditions

1. Backend tenant RBAC rollout is complete (migrations, seeders, backfill, tenant routes).
2. Login user has one of the supported contexts:
   - Platform admin (`SuperAdmin` / `EkklesiaAdmin`)
   - Tenant admin with `roles.view` and/or `permissions.view`
3. Frontend environment points to the target API host in `src/environments/environment.ts`.

## 2) Start frontend

```bash
npm install
npm start
```

Open: `http://localhost:4200`

## 3) Route and guard verification

1. Navigate to `/settings/roles-permissions`.
2. Validate guard behavior:
   - Unauthenticated user -> redirected to `/auth/login`
   - Tenant user without RBAC view permission -> redirected to `/dashboard` with forbidden context
   - Platform admin / tenant admin with RBAC view permission -> access granted

## 4) Roles tab verification

1. Confirm data loads and filter chips behave independently for Roles tab.
2. In tenant mode:
   - Tenant column is hidden.
   - Role status toggle is hidden/disabled.
   - Protected tenant roles (`Administrator` / `Church Administrator`) display protected state.
   - Edit/Delete actions are blocked for protected roles.
3. Validate empty states:
   - No data state
   - Filtered-empty state after applying filters

## 5) Permissions tab verification

1. Confirm permissions list loads and module grouping works (expand/collapse all).
2. In tenant mode:
   - Permission create/edit/delete actions are not available.
   - Filters/chips work with module-aware context.
3. Validate empty states and retry behavior on transient failures.

## 6) Assign Permissions flow verification

1. Open Assign Permissions tab and select a role.
2. Verify permission matrix behavior:
   - Module risk labels show (`High Risk`, `Medium Risk`, `Standard`)
   - Mandatory admin permission badges appear for protected admin requirements
3. For protected roles:
   - Remove one mandatory permission and verify save is blocked client-side
   - Conflict banner lists missing required permissions
4. In tenant mode:
   - Safeguard hint indicates permission escalation rules
5. Successful save:
   - Success toast shown
   - Role state refreshes correctly

## 7) User Role Assignments tab verification (tenant mode)

1. Verify KPI cards:
   - Active users
   - Assigned users
   - Unassigned users
   - Admin-role users
2. Select a user and update role selection.
3. Save and confirm:
   - Success toast appears
   - User list refreshes
   - Selected user context remains stable (or resets if no longer valid)
4. Confirm backend safeguards:
   - Last-admin removal attempts should fail with friendly `422` messaging.

## 8) Role Form modal safeguard verification

1. Edit protected tenant role (`Administrator` / `Church Administrator`).
2. Confirm:
   - Name and level controls are locked
   - Safeguard banner is visible
   - Description and permission assignment remain editable
3. Save and verify locked identity fields are preserved.

## 9) Error handling verification

Validate friendly messages for:

- `status 0` -> network guidance
- `403` -> permission denied messaging
- `422` -> validation message extraction
- `500+` -> server retry messaging

Verify this across:

- Roles page actions
- Assign Permissions modal
- Role Form modal
- User role assignment save

## 10) Focused unit test targets

Current test files for tenant RBAC frontend hardening:

- `src/app/core/guards/rbac.guard.spec.ts`
- `src/app/features/settings/settings.guard-routing.spec.ts`
- `src/app/layout/main-layout/main-layout.component.spec.ts`
- `src/app/features/settings/roles-permissions/roles-permissions.component.spec.ts`
- `src/app/features/settings/roles-permissions/role-form-modal/role-form-modal.component.spec.ts`
- `src/app/features/settings/roles-permissions/assign-permissions-modal/assign-permissions-modal.component.spec.ts`
- `src/app/features/settings/roles-permissions/roles-permissions.a11y.spec.ts`

Run:

```bash
npm test -- src/app/core/guards/rbac.guard.spec.ts src/app/features/settings/settings.guard-routing.spec.ts src/app/layout/main-layout/main-layout.component.spec.ts src/app/features/settings/roles-permissions/roles-permissions.component.spec.ts src/app/features/settings/roles-permissions/role-form-modal/role-form-modal.component.spec.ts src/app/features/settings/roles-permissions/assign-permissions-modal/assign-permissions-modal.component.spec.ts src/app/features/settings/roles-permissions/roles-permissions.a11y.spec.ts --runInBand
```

If Jest reports missing `jest-environment-jsdom`, install/restore frontend test dependencies, then rerun.

## 11) RBAC Playwright smoke

Install Playwright dependencies (once):

```bash
npx playwright install --with-deps chromium webkit
```

Tablet and mobile sacrament smoke tests use WebKit (iPad / iPhone device profiles). Core marriage and baptism tests run on Chromium only.

Run RBAC smoke suite (requires authenticated storage state files):

```bash
RBAC_E2E_BASE_URL=http://localhost:4200 \
RBAC_PLATFORM_ADMIN_STORAGE_STATE=.auth/platform-admin.json \
RBAC_TENANT_ADMIN_STORAGE_STATE=.auth/tenant-admin.json \
RBAC_TENANT_MEMBER_STORAGE_STATE=.auth/tenant-member.json \
npm run e2e:rbac
```

## 12) Sacrament E2E suite

Prerequisites:

1. Laravel API running and reachable from the Angular dev server proxy.
2. Angular app running (`npm start`).
3. Authenticated tenant-admin Playwright storage state for the target parish tenant.

### Create tenant-admin auth file (one-time)

From `EkklesiaSoftUi`, with Angular running:

```bash
mkdir -p .auth
npx playwright codegen http://localhost:4200 --save-storage=.auth/tenant-admin.json
```

Log in as a **tenant admin** for the parish you will seed (`SACRAMENT_E2E_TENANT_ID`). Close the codegen browser when done — the file is saved automatically.

### Linux browser dependencies (tablet/mobile WebKit)

If Playwright reports missing host dependencies:

```bash
sudo npx playwright install-deps
```

Environment:

```bash
export RBAC_E2E_BASE_URL=http://localhost:4200
export RBAC_TENANT_ADMIN_STORAGE_STATE=.auth/tenant-admin.json
export SACRAMENT_E2E_TENANT_ID=2
```

Use the numeric tenant id (or uuid) that matches the parish in `RBAC_TENANT_ADMIN_STORAGE_STATE`. Example above uses tenant `2` from local dev.

Seed deterministic sacrament E2E members (idempotent; safe to re-run):

```bash
cd ../EkklesiaSoftApi
SACRAMENT_E2E_TENANT_ID=2 php artisan db:seed --class=Modules\\Family\\Database\\Seeders\\SacramentE2eSeeder
```

Replace `2` with your parish tenant id (must match the tenant in `RBAC_TENANT_ADMIN_STORAGE_STATE`). Do **not** type angle brackets — those are documentation placeholders only.

Run sacrament Playwright suite:

```bash
cd EkklesiaSoftUi
npx playwright test e2e/sacraments
```

Core marriage/baptism tests run on Chromium only. Responsive smoke runs on desktop, tablet, and mobile projects.

## 13) Bishop workflow E2E suite

Prerequisites:

1. Laravel API running and reachable from the Angular dev server proxy.
2. Angular app running (`npm start`).
3. Authenticated Playwright storage states:
   - `.auth/tenant-admin.json` (parish tenant admin)
   - `.auth/platform-admin.json` (Ekklesia reviewer with bishop approve permissions)
4. Optional for member permission test: `.auth/tenant-member.json`

Seed deterministic bishop fixtures for the parish tenant (idempotent):

```bash
cd ../EkklesiaSoftApi
BISHOP_E2E_TENANT_ID=2 php artisan db:seed --class=Modules\\EcclesiasticalData\\Database\\Seeders\\BishopE2eSeeder
```

Replace `2` with the tenant id that matches `RBAC_TENANT_ADMIN_STORAGE_STATE`.

Run bishop Playwright suite:

```bash
cd EkklesiaSoftUi
RBAC_E2E_BASE_URL=http://localhost:4200 \
RBAC_TENANT_ADMIN_STORAGE_STATE=.auth/tenant-admin.json \
RBAC_PLATFORM_ADMIN_STORAGE_STATE=.auth/platform-admin.json \
RBAC_TENANT_MEMBER_STORAGE_STATE=.auth/tenant-member.json \
npm run e2e:bishops
```

Coverage:

- Church **Diocesan Bishop** tab (leadership card + report wizard)
- Church submission appears in **Your update requests**
- Platform **Bishop Update Queue** review and approve
- Tenant member without bishop permissions does not see the tab

## 14) Subscription expired read-only E2E suite

Prerequisites:

1. Laravel API running with `TENANT_SUBSCRIPTION_WRITE_POLICY=read_only_when_expired` (default).
2. Angular app running (`npm start`).
3. **Do not** use the RBAC parish tenant — this suite uses isolated `e2e-expired-parish` / `e2e-grace-parish`.

Seed deterministic fixtures (idempotent; safe to re-run before each suite, especially after renewal tests):

```bash
cd ../EkklesiaSoftApi
php artisan db:seed --class=Modules\\Tenants\\Database\\Seeders\\SubscriptionExpiredE2eSeeder
```

Note the printed tenant ids. Admins: `e2e-expired-admin@example.test` / `e2e-grace-admin@example.test` (password: `password`).

Create Playwright storage states (one-time per environment):

```bash
cd EkklesiaSoftUi
mkdir -p .auth
npx playwright codegen http://localhost:4200 --save-storage=.auth/expired-tenant-admin.json
# Log in as e2e-expired-admin@example.test

npx playwright codegen http://localhost:4200 --save-storage=.auth/grace-tenant-admin.json
# Log in as e2e-grace-admin@example.test
```

Run:

```bash
export RBAC_E2E_BASE_URL=http://localhost:4200
export SUBSCRIPTION_EXPIRED_E2E_TENANT_ID=<id-from-seeder>
export SUBSCRIPTION_EXPIRED_E2E_STORAGE_STATE=.auth/expired-tenant-admin.json
export SUBSCRIPTION_GRACE_E2E_STORAGE_STATE=.auth/grace-tenant-admin.json
npm run e2e:subscription-expired
```

Renewal scenario (optional; requires platform admin storage):

```bash
export RBAC_PLATFORM_ADMIN_STORAGE_STATE=.auth/platform-admin.json
npm run e2e:subscription-expired
```

Re-run the seeder after renewal tests to restore expired dates.

## 15) Release sign-off checklist

- [ ] Guard and route access validated for all user contexts
- [ ] Roles/Permissions/Assign/User tabs validated in tenant mode
- [ ] Protected role and mandatory permission safeguards validated
- [ ] Friendly error states validated (`403`, `422`, `500`, network)
- [ ] Focused unit specs added and executed in local CI-ready environment
- [ ] Product owner approval for UX copy and safeguard messaging

