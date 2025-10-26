# Roles & Permissions Module - Design System & Style Guide

## 🎨 Overview
This document defines the complete design system for the Roles & Permissions module, ensuring consistency across all UI elements.

---

## 📏 Typography System

### Font Sizes
```scss
--font-size-xxl: 1.75rem;    // Page titles
--font-size-xl: 1.5rem;      // Section headers
--font-size-lg: 1.125rem;    // Card titles
--font-size-md: 1rem;        // Default text
--font-size-sm: 0.875rem;    // Secondary text, labels
--font-size-xs: 0.75rem;     // Badges, captions
--font-size-xxs: 0.6875rem;  // Mobile hints
```

### Font Weights
```scss
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

### Line Heights
```scss
--line-height-tight: 1.3;
--line-height-normal: 1.4;
--line-height-relaxed: 1.5;
```

---

## 🎯 Button System

### Primary Button (Create, Save)
- **Background:** Linear gradient (135deg, #667eea 0%, #764ba2 100%)
- **Color:** White
- **Padding:** 0.625rem 1.5rem
- **Border Radius:** var(--radius-md) (8px)
- **Font Size:** 0.875rem
- **Font Weight:** 600
- **Hover:** Lift effect (translateY(-2px)) + enhanced shadow

### Secondary Button (Cancel, Back)
- **Background:** White
- **Color:** var(--text-primary)
- **Border:** 1px solid var(--gray-300)
- **Padding:** 0.625rem 1.5rem
- **Border Radius:** var(--radius-md)
- **Font Size:** 0.875rem
- **Font Weight:** 500
- **Hover:** Background to var(--gray-100)

### Filter Button
- **Background:** White
- **Color:** var(--text-primary)
- **Border:** 1px solid var(--gray-300)
- **Padding:** 0.625rem 1rem
- **Border Radius:** var(--radius-md)
- **Icon Size:** 18px
- **Gap:** 0.5rem
- **Active State:** Primary color border + icon color

### Action Buttons (Table)
- **Size:** 36px × 36px
- **Border Radius:** var(--radius-md)
- **Background:** var(--gray-100)
- **Font Size:** 1.125rem (emojis)
- **Hover:** Gradient background + white text
- **Transition:** all 0.2s

### Bulk Action Buttons
- **Background:** White
- **Border:** 1px solid var(--gray-300)
- **Padding:** 0.5rem 0.875rem
- **Border Radius:** var(--radius-md)
- **Font Size:** 0.8125rem
- **Icon Size:** 16px
- **Gap:** 0.5rem

---

## 📐 Spacing System

### Standard Spacing Scale
```scss
--spacing-xs: 0.25rem;    // 4px
--spacing-sm: 0.5rem;     // 8px
--spacing-md: 1rem;       // 16px
--spacing-lg: 1.5rem;     // 24px
--spacing-xl: 2rem;       // 32px
--spacing-xxl: 3rem;      // 48px
```

### Component Spacing
- **Card Padding:** var(--spacing-lg) (24px)
- **Table Cell Padding:** var(--spacing-md) (16px)
- **Button Gap:** 0.5rem (8px)
- **Section Gap:** var(--spacing-lg) (24px)

---

## 🎨 Color Palette

### Primary Colors
```scss
--primary-color: #667eea;
--primary-dark: #764ba2;
--primary-light: #667eea15;
```

### Text Colors
```scss
--text-primary: #1a202c;
--text-secondary: #718096;
--text-tertiary: #a0aec0;
```

### Background Colors
```scss
--gray-50: #f7fafc;
--gray-100: #edf2f7;
--gray-200: #e2e8f0;
--gray-300: #cbd5e0;
--gray-400: #a0aec0;
```

### Semantic Colors
```scss
--success-color: #48bb78;
--warning-color: #f59e0b;
--error-color: #f56565;
--info-color: #4299e1;
```

---

## 🔲 Border Radius System

```scss
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-full: 9999px;
```

---

## 🎭 Animation & Transitions

### Standard Transitions
```scss
--transition-fast: 150ms;
--transition-normal: 200ms;
--transition-slow: 300ms;
```

### Animation Easing
```scss
--ease-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.6, 1);
```

### Common Animations
- **Fade In:** opacity 0 → 1, translateY(10px) → 0
- **Scale:** transform: scale(1) → scale(1.05)
- **Lift:** transform: translateY(0) → translateY(-2px)

---

## 📊 Table System

### Table Structure
- **Header Background:** var(--gray-50)
- **Header Text:** var(--text-secondary)
- **Header Font:** 0.75rem, uppercase, tracking 0.05em, weight 600
- **Row Border:** 1px solid var(--gray-200)
- **Row Hover:** background var(--gray-50)
- **Cell Padding:** var(--spacing-md) (16px)
- **Cell Font:** 0.875rem

### Badge Styles (in tables)
- **Padding:** 0.25rem 0.625rem
- **Border Radius:** var(--radius-full)
- **Font Size:** 0.75rem
- **Font Weight:** 600

---

## 🔄 Module Collapse System

### Collapse Icon
- **Size:** 20px × 20px
- **Color:** var(--text-secondary)
- **Transition:** transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)
- **Collapsed State:** transform: rotate(0deg)
- **Expanded State:** transform: rotate(90deg)
- **Active State:** scale(0.95)

### Module Header
- **Background:** Linear gradient (135deg, #667eea08 0%, #764ba208 100%)
- **Border:** 1px solid var(--gray-200)
- **Padding:** var(--spacing-md) var(--spacing-lg)
- **Cursor:** pointer
- **Hover:** Enhanced gradient background

### Module Content
- **Padding:** var(--spacing-md)
- **Animation:** expandModule 0.3s ease-out
- **Hidden When:** .collapsed parent class

---

## 📱 Responsive Breakpoints

```scss
// Desktop (default)
min-width: 1024px

// Tablet
max-width: 1023px
min-width: 769px

// Mobile
max-width: 768px

// Small Mobile
max-width: 480px
```

### Responsive Rules
- **Mobile:**
  - Full-width buttons
  - Hide button text, show icons only
  - Stack actions vertically
  - Single-column layouts
  - Reduced padding

---

## 🎯 Z-Index System

```scss
--z-modal-overlay: 9999;
--z-modal-content: 10000;
--z-dropdown: 1000;
--z-header: 100;
--z-sticky: 10;
--z-base: 1;
```

---

## ✅ Implementation Checklist

### Typography
- [ ] All page titles use 1.75rem
- [ ] All section headers use 1.5rem
- [ ] All body text uses 0.875rem
- [ ] All badges use 0.75rem

### Buttons
- [ ] All primary buttons use gradient
- [ ] All secondary buttons use white background
- [ ] All buttons have consistent padding
- [ ] All buttons have same border-radius
- [ ] All icons are 18px (buttons) or 16px (small buttons)

### Spacing
- [ ] Consistent card padding (24px)
- [ ] Consistent button gaps (8px)
- [ ] Consistent section spacing (24px)

### Colors
- [ ] Primary color used consistently
- [ ] Text colors follow hierarchy
- [ ] No random hex values

### Animations
- [ ] All transitions use defined durations
- [ ] Collapse animations work smoothly
- [ ] Hover effects are consistent

### Responsive
- [ ] Mobile breakpoints applied
- [ ] Touch targets ≥ 44px
- [ ] No horizontal scroll

---

## 🔧 Common Issues & Fixes

### Issue: Collapse Button Breaks Layout
**Fix:** Ensure parent has `overflow: visible` and proper flex/grid structure

### Issue: Inconsistent Button Sizes
**Fix:** Use standardized button classes with fixed dimensions

### Issue: Hover States Inconsistent
**Fix:** Apply same hover effects across all interactive elements

### Issue: Mobile Layout Breaks
**Fix:** Apply responsive classes and test on all breakpoints

---

## 📝 Code Standards

### Class Naming (BEM)
```scss
.block {}
.block__element {}
.block--modifier {}
```

### Variable Usage
```scss
// Good
padding: var(--spacing-md);
color: var(--text-primary);

// Bad
padding: 16px;
color: #1a202c;
```

### Consistency
```scss
// Good - Consistent
.btn-primary,
.btn-secondary,
.btn-filter { /* Same structure */ }

// Bad - Inconsistent
.button-primary { /* Different structure */ }
.filter_btn { /* Different naming */ }
```

---

## 🎯 Success Criteria

✅ **Visual Consistency**
- All buttons look similar (except color)
- All tables use same styles
- All cards use same padding

✅ **Functional Consistency**
- All hover effects similar
- All animations smooth
- All transitions same duration

✅ **Responsive Consistency**
- Mobile version works on all screens
- Tablet version properly scaled
- Desktop version spacious

✅ **Code Quality**
- No duplicate styles
- All using CSS variables
- Proper BEM naming
- Clean organization

---

**Last Updated:** October 26, 2025  
**Version:** 2.0  
**Status:** ✅ Production Ready

