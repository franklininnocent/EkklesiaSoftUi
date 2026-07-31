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
npx playwright install --with-deps chromium
```

Run RBAC smoke suite (requires authenticated storage state files):

```bash
RBAC_E2E_BASE_URL=http://localhost:4200 \
RBAC_PLATFORM_ADMIN_STORAGE_STATE=.auth/platform-admin.json \
RBAC_TENANT_ADMIN_STORAGE_STATE=.auth/tenant-admin.json \
RBAC_TENANT_MEMBER_STORAGE_STATE=.auth/tenant-member.json \
npm run e2e:rbac
```

## 12) Release sign-off checklist

- [ ] Guard and route access validated for all user contexts
- [ ] Roles/Permissions/Assign/User tabs validated in tenant mode
- [ ] Protected role and mandatory permission safeguards validated
- [ ] Friendly error states validated (`403`, `422`, `500`, network)
- [ ] Focused unit specs added and executed in local CI-ready environment
- [ ] Product owner approval for UX copy and safeguard messaging

