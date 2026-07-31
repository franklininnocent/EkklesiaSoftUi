# Tenant RBAC UAT Template

Use this checklist per environment and per tenant during user acceptance testing.

## UAT Metadata

- Date:
- Environment: (Local / QA / Staging / Production)
- Build/Commit:
- API Base URL:
- Tester:
- Tenant Name:
- Tenant ID:
- Test User Email:
- Test User Role Context: (Platform Admin / Tenant Admin / Tenant User)

---

## 1) Access and Guard Validation

| ID | Scenario | Expected Result | Status (Pass/Fail/Blocked) | Notes |
|---|---|---|---|---|
| A1 | Unauthenticated user opens `/settings/roles-permissions` | Redirected to `/auth/login` |  |  |
| A2 | Tenant user without RBAC view permission opens page | Redirected to `/dashboard` with forbidden context |  |  |
| A3 | Tenant admin with RBAC view permission opens page | Access granted |  |  |
| A4 | Platform admin opens page | Access granted |  |  |

---

## 2) Roles Tab

| ID | Scenario | Expected Result | Status | Notes |
|---|---|---|---|---|
| R1 | Roles load successfully | Table/list visible with total count |  |  |
| R2 | Apply role filters | Filter chips + filtered list update correctly |  |  |
| R3 | Clear role filters | Full list restored |  |  |
| R4 | Tenant mode layout | Tenant column hidden, status toggle unavailable |  |  |
| R5 | Protected role visibility | Protected role shows non-editable safeguards |  |  |
| R6 | Create new role | Success toast and list refresh |  |  |
| R7 | Edit non-protected role | Success toast and updated data shown |  |  |
| R8 | Delete non-protected role | Success toast and role removed from list |  |  |

---

## 3) Permissions Tab

| ID | Scenario | Expected Result | Status | Notes |
|---|---|---|---|---|
| P1 | Permissions load and group by module | Module sections visible |  |  |
| P2 | Expand/Collapse all modules | Group visibility toggles correctly |  |  |
| P3 | Permission filtering | Chips and list update correctly |  |  |
| P4 | Tenant mode permission CRUD controls | Create/Edit/Delete hidden or unavailable |  |  |
| P5 | Empty state (no filter match) | Filtered empty message shown |  |  |

---

## 4) Assign Permissions Matrix

| ID | Scenario | Expected Result | Status | Notes |
|---|---|---|---|---|
| AP1 | Select role in Assign tab | Matrix opens for selected role |  |  |
| AP2 | Risk labels | Module shows High/Medium/Standard risk labels |  |  |
| AP3 | Mandatory admin badge | Required admin permissions marked clearly |  |  |
| AP4 | Protected admin role missing mandatory permission | Save blocked with conflict banner |  |  |
| AP5 | Valid permission save | Success toast and role state refreshed |  |  |
| AP6 | Tenant escalation safeguard message | Hint visible in tenant mode |  |  |

---

## 5) User Role Assignments (Tenant Mode)

| ID | Scenario | Expected Result | Status | Notes |
|---|---|---|---|---|
| U1 | KPI summary cards | Correct totals for active/assigned/unassigned/admin users |  |  |
| U2 | Select user and assign roles | Checkbox state reflects current roles |  |  |
| U3 | Save user role changes | Success toast and list refresh |  |  |
| U4 | Last-admin guardrail (negative case) | Friendly `422` guardrail message shown |  |  |
| U5 | Selection stability after refresh | Selected context stays valid or resets safely |  |  |

---

## 6) Role Form Safeguards

| ID | Scenario | Expected Result | Status | Notes |
|---|---|---|---|---|
| F1 | Edit `Administrator` / `Church Administrator` in tenant mode | Name + level locked |  |  |
| F2 | Safeguard banner visibility | Protection message visible in modal |  |  |
| F3 | Description update on protected role | Save succeeds for allowed fields |  |  |
| F4 | Permission assignment on protected role | Allowed with mandatory safeguards |  |  |

---

## 7) Error Handling Validation

| ID | Scenario | Expected Result | Status | Notes |
|---|---|---|---|---|
| E1 | Simulated network failure | Friendly network message shown |  |  |
| E2 | `403` API response | Permission denied message shown |  |  |
| E3 | `422` API response | Validation message extracted and shown |  |  |
| E4 | `500` API response | Generic server error retry message shown |  |  |

---

## 8) Defect Log

| Defect ID | Severity (Low/Med/High/Critical) | Module | Description | Repro Steps | Screenshot/Link | Status |
|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |

---

## 9) Sign-off

- QA Lead:
- Product Owner:
- Engineering Owner:
- Overall UAT Result: (Pass / Conditionally Pass / Fail)
- Deployment Recommendation:

