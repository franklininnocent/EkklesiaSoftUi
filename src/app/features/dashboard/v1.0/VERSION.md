# Dashboard Version 1.0 — Restore Backup

**Status:** Exact copy of the pre–two-tab Operations Dashboard (Phase 0).  
**Captured:** before Dashboard version 2.0 layout refactor.  
**Files use `.bak` extensions** so Angular does not compile them.

## Contents

| File | Purpose |
|------|---------|
| `dashboard.component.ts.bak` | Component logic |
| `dashboard.component.html.bak` | Template |
| `dashboard.component.scss.bak` | Styles |
| `dashboard.routes.ts.bak` | Route (unchanged by v2) |

## Restore to Version 1.0

From the repo root:

```bash
cp EkklesiaSoftUi/src/app/features/dashboard/v1.0/dashboard.component.ts.bak \
   EkklesiaSoftUi/src/app/features/dashboard/dashboard.component.ts
cp EkklesiaSoftUi/src/app/features/dashboard/v1.0/dashboard.component.html.bak \
   EkklesiaSoftUi/src/app/features/dashboard/dashboard.component.html
cp EkklesiaSoftUi/src/app/features/dashboard/v1.0/dashboard.component.scss.bak \
   EkklesiaSoftUi/src/app/features/dashboard/dashboard.component.scss
```

Then rebuild / refresh the Angular app.

Do **not** delete this folder until Version 2.0 is accepted.

## Checksums (at backup)

```
e0e3c5958c8466224baa36b92aea0a5f43acd1042ccf33fbc21b84ef88df285d  dashboard.component.ts
2760a887862bd65e98ba4862963d88ab768c00599a6e5be0031f32b07ffe88d8  dashboard.component.html
b44f097b395837854ba15cbc3f79de56dc663d6b10d91da96cada31e07816f46  dashboard.component.scss
```
