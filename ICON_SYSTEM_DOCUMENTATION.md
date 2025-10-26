# Icon System Documentation

## Overview

This document describes the standardized icon system implemented across the **Roles & Permissions** module. All icons follow a consistent design language using **Feather Icons** style (stroke-based SVG icons) for a clean, modern, and professional appearance.

## Icon Standards

### Technical Specifications

- **Format**: Inline SVG
- **Viewbox**: `0 0 24 24`
- **Stroke Width**: `2px`
- **Style**: Outlined (stroke-based), no fills
- **Size**: 16px × 16px in buttons, 20-24px in headers
- **Color**: Inherits from parent element (`currentColor`)

### Design Principles

1. **Intuitive**: Icons clearly represent their action
2. **Consistent**: Same style and size throughout
3. **Accessible**: Always paired with text labels and tooltips
4. **Responsive**: Icons remain visible on mobile, text may hide

## Icon Inventory

### Action Icons

#### 1. **Select All**
**Purpose**: Select all items (permissions, roles, etc.)  
**Visual**: Circular checkmark (check-circle)  
**Usage**: Bulk selection operations

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
  <polyline points="22 4 12 14.01 9 11.01"></polyline>
</svg>
```

**Locations**:
- Permissions Tab (hidden on modal)
- Assign Permissions Tab (inline header)
- Assign Permissions Modal (controls bar)

---

#### 2. **Deselect All**
**Purpose**: Clear all selections  
**Visual**: Circle with X (x-circle)  
**Usage**: Remove all selections in bulk operations

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="10"></circle>
  <line x1="15" y1="9" x2="9" y2="15"></line>
  <line x1="9" y1="9" x2="15" y2="15"></line>
</svg>
```

**Locations**:
- Permissions Tab (hidden on modal)
- Assign Permissions Tab (inline header)
- Assign Permissions Modal (controls bar)

---

#### 3. **Expand All**
**Purpose**: Expand all collapsible module groups  
**Visual**: Chevron up (chevron-up)  
**Usage**: Show all hidden content

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="18 15 12 9 6 15"></polyline>
</svg>
```

**Locations**:
- Permissions Tab (inline header)
- Assign Permissions Tab (inline header)
- Assign Permissions Modal (controls bar)

---

#### 4. **Collapse All**
**Purpose**: Collapse all module groups  
**Visual**: Chevron down (chevron-down)  
**Usage**: Hide all expanded content

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="6 9 12 15 18 9"></polyline>
</svg>
```

**Locations**:
- Permissions Tab (inline header)
- Assign Permissions Tab (inline header)
- Assign Permissions Modal (controls bar)

---

#### 5. **Filters**
**Purpose**: Open filter panel  
**Visual**: Funnel (filter)  
**Usage**: Access filtering options

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
</svg>
```

**Locations**:
- Permissions Tab (inline header)
- Assign Permissions Tab (inline header)
- Assign Permissions Modal (controls bar)

**Special Feature**: Shows a colored dot (●) when filters are active

---

#### 6. **Create Permission**
**Purpose**: Create a new permission  
**Visual**: Circle with plus (plus-circle)  
**Usage**: Add new item action

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="10"></circle>
  <line x1="12" y1="8" x2="12" y2="16"></line>
  <line x1="8" y1="12" x2="16" y2="12"></line>
</svg>
```

**Locations**:
- Permissions Tab (inline header)

**Special Styling**: Gradient background (primary → secondary), elevated shadow

---

### Section Header Icons

#### 7. **Permissions Lock**
**Purpose**: Identify Permissions section  
**Visual**: Lock icon  
**Usage**: Section headers

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
</svg>
```

**Locations**:
- Permissions Tab (header title)

---

#### 8. **Module Collapse Toggle**
**Purpose**: Expand/collapse individual module groups  
**Visual**: Right-pointing chevron (rotates when expanded)  
**Usage**: Interactive module headers

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="9 18 15 12 9 6"></polyline>
</svg>
```

**Animation**: Rotates 90° clockwise when expanded

**Locations**:
- All module group headers
- Permissions Tab
- Assign Permissions Modal

---

## Implementation Guidelines

### 1. Adding Icons to Buttons

Always include:
- SVG icon (first child)
- Text label (second child)
- Title attribute for tooltip

```html
<button 
  class="btn-action-inline" 
  (click)="performAction()"
  type="button"
  title="Descriptive tooltip">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <!-- icon paths -->
  </svg>
  <span>Button Text</span>
</button>
```

### 2. Icon Sizing in CSS

```scss
.btn-action-inline,
.btn-filter-inline {
  svg {
    width: 16px;
    height: 16px;
  }
}

.permissions-title {
  svg {
    width: 24px;
    height: 24px;
  }
}
```

### 3. Responsive Behavior

On mobile (≤768px), hide text labels but keep icons:

```scss
@media (max-width: 768px) {
  .btn-action-inline span:not(.filter-badge) {
    display: none;
  }
}
```

### 4. Color Inheritance

Icons inherit color from parent:

```scss
.btn-action-inline {
  color: var(--text-primary);
  
  svg {
    color: inherit; // or currentColor
  }
  
  &:hover {
    color: var(--primary-color);
    // icon color changes automatically
  }
}
```

## Icon Sources

All icons are based on **Feather Icons** design language:
- Source: https://feathericons.com/
- License: MIT (Free for commercial use)
- Style: Minimal, stroke-based, 24×24 grid

## Best Practices

### ✅ DO
- Use consistent stroke width (2px)
- Always pair icons with text labels
- Provide tooltip titles for accessibility
- Use semantic, intuitive icons
- Maintain viewBox="0 0 24 24"

### ❌ DON'T
- Mix filled and outlined icon styles
- Use icons without text labels
- Scale icons disproportionately
- Use overly complex icons
- Forget mobile responsiveness

## Accessibility

### ARIA Support
```html
<button 
  type="button"
  aria-label="Select all permissions"
  title="Select all permissions">
  <svg aria-hidden="true">...</svg>
  <span>Select All</span>
</button>
```

### Screen Reader Considerations
- Text labels provide context
- Tooltips reinforce understanding
- Icons marked `aria-hidden="true"` (optional)

## Future Extensions

### Additional Icons to Consider

1. **Save**: Floppy disk or check-circle
2. **Cancel**: X or arrow-left
3. **Edit**: Edit-2 (pen/pencil)
4. **Delete**: Trash-2
5. **Search**: Magnifying glass (already used in filters)
6. **Refresh**: Rotate-cw
7. **Download**: Download icon
8. **Upload**: Upload icon

### Icon Libraries
If more icons are needed:
- **Feather Icons**: https://feathericons.com/
- **Heroicons**: https://heroicons.com/
- **Lucide**: https://lucide.dev/ (Feather fork, more icons)

## Browser Compatibility

SVG icons work in all modern browsers:
- Chrome/Edge: ✅
- Firefox: ✅
- Safari: ✅
- Opera: ✅
- IE11: ⚠️ (fallback to text only)

## Performance

- **Inline SVG**: Fast, no extra HTTP requests
- **CSS `currentColor`**: Efficient color changes
- **No icon fonts**: Better rendering, accessibility, and control

## Maintenance

### Icon Audit Checklist
- [ ] All icons use viewBox="0 0 24 24"
- [ ] All icons have stroke-width="2"
- [ ] All buttons have title attributes
- [ ] Text labels present for all icons
- [ ] Consistent sizing in CSS
- [ ] Responsive behavior tested
- [ ] Colors inherit properly
- [ ] No accessibility warnings

## Version History

**v1.0.0** (2025-10-26)
- Initial icon system implementation
- 8 standard icons defined
- Consistent styling across module
- Responsive design support
- Documentation created

---

**Maintained by**: EkklesiaSoft Development Team  
**Last Updated**: October 26, 2025

