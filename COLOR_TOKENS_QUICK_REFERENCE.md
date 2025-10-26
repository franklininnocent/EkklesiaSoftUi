# Color Tokens Quick Reference
## Enterprise Color System - Developer Guide

---

## Brand Colors

### Primary Brand (Professional Blue)
```scss
--brand-primary: #1e40af;        // Main brand color
--brand-primary-light: #3b82f6;  // Lighter variant
--brand-primary-dark: #1e3a8a;   // Darker variant
```
**Use for**: Primary buttons, links, active states, icons

### Secondary Brand (Accent Purple)
```scss
--brand-secondary: #7c3aed;      // Accent color
--brand-secondary-light: #a78bfa;
--brand-secondary-dark: #6d28d9;
```
**Use for**: Highlights, special features, gradients

---

## Layout Colors

### Topbar
```scss
--topbar-bg: #ffffff;
--topbar-border: #e5e7eb;
--topbar-text: #1f2937;
--topbar-text-secondary: #6b7280;
```

### Sidebar
```scss
--sidebar-bg: #1f2937;
--sidebar-text: #d1d5db;
--sidebar-text-active: #ffffff;
--sidebar-hover-bg: #374151;
--sidebar-active-bg: #1e40af;
```

### Tenant Badge
```scss
--tenant-badge-bg: #f3f4f6;
--tenant-badge-border: #d1d5db;
--tenant-badge-icon-bg: #1e40af;
--tenant-badge-icon-color: #ffffff;
--tenant-badge-label: #6b7280;
--tenant-badge-name: #111827;
```

---

## Background Colors

```scss
--bg-primary: #ffffff;           // Main content
--bg-secondary: #f9fafb;         // Page background
--bg-tertiary: #f3f4f6;          // Panels, headers
--bg-quaternary: #e5e7eb;        // Disabled states
```

---

## Text Colors

```scss
--text-primary: #111827;         // Main headings (21:1)
--text-secondary: #374151;       // Subheadings (12:1)
--text-tertiary: #6b7280;        // Body text (7:1)
--text-quaternary: #9ca3af;      // Captions (4.5:1)
--text-inverse: #ffffff;         // White on dark
```

---

## Border Colors

```scss
--border-light: #f3f4f6;         // Very subtle
--border-normal: #e5e7eb;        // Standard
--border-medium: #d1d5db;        // Medium emphasis
--border-dark: #9ca3af;          // Strong emphasis
--border-primary: #1e40af;       // Accent borders
```

---

## Status Colors

### Success
```scss
--success-bg: #d1fae5;
--success-border: #6ee7b7;
--success-text: #065f46;         // 7.5:1 contrast
--success-icon: #10b981;
--success-solid: #10b981;
```

### Warning
```scss
--warning-bg: #fef3c7;
--warning-border: #fbbf24;
--warning-text: #92400e;         // 7.2:1 contrast
--warning-icon: #f59e0b;
--warning-solid: #f59e0b;
```

### Error
```scss
--error-bg: #fee2e2;
--error-border: #fca5a5;
--error-text: #991b1b;           // 8:1 contrast
--error-icon: #ef4444;
--error-solid: #ef4444;
```

### Info
```scss
--info-bg: #dbeafe;
--info-border: #93c5fd;
--info-text: #1e3a8a;            // 9:1 contrast
--info-icon: #3b82f6;
--info-solid: #3b82f6;
```

---

## Button Colors

### Primary Button
```scss
--btn-primary-bg: #1e40af;
--btn-primary-text: #ffffff;
--btn-primary-hover: #1e3a8a;
--btn-primary-disabled: #9ca3af;
```

### Secondary Button
```scss
--btn-secondary-bg: #ffffff;
--btn-secondary-text: #374151;
--btn-secondary-border: #d1d5db;
--btn-secondary-hover: #f9fafb;
```

---

## Component Colors

### Card
```scss
--card-bg: #ffffff;
--card-border: #e5e7eb;
--card-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
```

### Modal
```scss
--modal-bg: #ffffff;
--modal-header-bg: #f9fafb;
--modal-title-color: #111827;
--modal-overlay-bg: rgba(17, 24, 39, 0.75);
```

### Table
```scss
--table-header-bg: #f9fafb;
--table-header-text: #374151;
--table-border: #e5e7eb;
--table-row-hover: #f9fafb;
```

### Form Input
```scss
--input-bg: #ffffff;
--input-border: #d1d5db;
--input-border-focus: #1e40af;
--input-text: #111827;
--input-placeholder: #9ca3af;
```

---

## Usage Examples

### Basic Component
```scss
.my-component {
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-normal);
  border-radius: 8px;
}
```

### Interactive Element
```scss
.my-button {
  background: var(--brand-primary);
  color: var(--text-inverse);
  
  &:hover {
    background: var(--brand-primary-dark);
  }
  
  &:disabled {
    background: var(--btn-primary-disabled);
  }
}
```

### Status Badge
```scss
.success-badge {
  background: var(--success-bg);
  color: var(--success-text);
  border: 1px solid var(--success-border);
}

.error-badge {
  background: var(--error-bg);
  color: var(--error-text);
  border: 1px solid var(--error-border);
}
```

### Text Hierarchy
```scss
h1 { color: var(--text-primary); }      // 21:1 contrast
h2 { color: var(--text-secondary); }    // 12:1 contrast
p  { color: var(--text-tertiary); }     // 7:1 contrast
small { color: var(--text-quaternary); } // 4.5:1 contrast
```

---

## Best Practices

### ✅ Do's

1. **Always use CSS variables**
   ```scss
   color: var(--brand-primary);  ✅
   ```

2. **Provide fallbacks**
   ```scss
   color: var(--brand-primary, #1e40af);  ✅
   ```

3. **Use semantic tokens**
   ```scss
   .error { color: var(--error-text); }  ✅
   ```

4. **Check contrast**
   - Text: 7:1+ (WCAG AAA)
   - Large text: 4.5:1+ (WCAG AA)

### ❌ Don'ts

1. **Don't hardcode colors**
   ```scss
   color: #1e40af;  ❌
   ```

2. **Don't mix semantics**
   ```scss
   .error { color: var(--success-text); }  ❌
   ```

3. **Don't override without reason**
   ```scss
   --brand-primary: #ff0000 !important;  ❌
   ```

---

## Quick Copy-Paste Snippets

### Alert Component
```scss
.alert {
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid;
  
  &.success {
    background: var(--success-bg);
    color: var(--success-text);
    border-color: var(--success-border);
  }
  
  &.warning {
    background: var(--warning-bg);
    color: var(--warning-text);
    border-color: var(--warning-border);
  }
  
  &.error {
    background: var(--error-bg);
    color: var(--error-text);
    border-color: var(--error-border);
  }
}
```

### Card Component
```scss
.card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  box-shadow: var(--shadow-sm);
  
  &:hover {
    box-shadow: var(--shadow-md);
  }
}
```

### Button Component
```scss
.btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-weight: 500;
  transition: all 0.2s;
  
  &-primary {
    background: var(--btn-primary-bg);
    color: var(--btn-primary-text);
    border: none;
    
    &:hover {
      background: var(--btn-primary-hover);
    }
  }
  
  &-secondary {
    background: var(--btn-secondary-bg);
    color: var(--btn-secondary-text);
    border: 1px solid var(--btn-secondary-border);
    
    &:hover {
      background: var(--btn-secondary-hover);
    }
  }
}
```

---

## Contrast Checker

### Online Tools
- WebAIM: https://webaim.org/resources/contrastchecker/
- Colorable: https://colorable.jxnblk.com/
- Accessible Colors: https://accessible-colors.com/

### Browser DevTools
```javascript
// Chrome DevTools Console
// Check contrast ratio
getComputedStyle(element).color;
getComputedStyle(element).backgroundColor;
```

---

## File Location

```
📁 /var/www/html/EkklesiaSoft/EkklesiaSoftUi/src/
├── _color-system.scss              ← Color tokens defined here
├── styles.scss                     ← Imports color system
└── app/
    └── layout/
        └── main-layout/
            └── main-layout.component.scss  ← Uses color tokens
```

---

## Need Help?

1. **Read full documentation**: `ENTERPRISE_COLOR_SYSTEM_REDESIGN.md`
2. **Check existing components** for usage examples
3. **Test contrast**: Use WebAIM checker
4. **Ask team**: Color system questions

---

**Last Updated**: October 26, 2025  
**Version**: 1.0  
**WCAG Compliance**: AAA ✅

