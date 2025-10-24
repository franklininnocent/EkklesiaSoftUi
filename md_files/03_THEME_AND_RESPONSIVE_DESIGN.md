# 🎨 Theme & Responsive Design

**EkklesiaSoft Frontend** - Complete Responsive Theme System

---

## 📚 Contents

1. [Theme System](#theme-system)
2. [Font Size Management](#font-size-management)
3. [Responsive Design](#responsive-design)
4. [Color Scheme](#color-scheme)
5. [Animations](#animations)

---

## 🎨 Theme System

### Theme Service

```typescript
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private fontSizeSubject = new BehaviorSubject<FontSize>('standard');
  fontSize$ = this.fontSizeSubject.asObservable();
  
  constructor() {
    this.loadFontSize();
  }
  
  private loadFontSize() {
    const saved = localStorage.getItem('fontSize') as FontSize;
    if (saved) {
      this.setFontSize(saved);
    }
  }
  
  setFontSize(size: FontSize) {
    this.fontSizeSubject.next(size);
    localStorage.setItem('fontSize', size);
    document.documentElement.className = `font-${size}`;
  }
  
  getFontSize() {
    return this.fontSizeSubject.value;
  }
}
```

---

## 📏 Font Size Management

### Global Font Sizes

```scss
// styles.scss
html.font-small {
  font-size: 13px;
}

html.font-standard {
  font-size: 14px;
}

html.font-large {
  font-size: 16px;
}
```

### Component-Specific Overrides

```scss
html.font-large {
  .sidebar { width: 280px; }
  .topbar { height: 70px; }
  .user-avatar { width: 45px; height: 45px; }
  .stat-card { padding: 2rem; }
  .setting-section { padding: 2rem; }
}
```

---

## 📱 Responsive Design

### Breakpoints

```scss
:root {
  --breakpoint-xs: 480px;
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
  --breakpoint-2xl: 1536px;
  --breakpoint-3xl: 1920px;
  --breakpoint-4xl: 2560px;
}
```

### Media Queries

```scss
// Mobile first approach
.sidebar {
  width: 240px;
  
  @media (max-width: 768px) {
    width: 100%;
    position: fixed;
  }
  
  @media (min-width: 1024px) {
    width: 260px;
  }
  
  @media (min-width: 1920px) {
    width: 280px;
  }
}
```

### Responsive Grid

```scss
.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: var(--spacing-lg);
  
  @media (min-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
  }
  
  @media (min-width: 1536px) {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

---

## 🎨 Color Scheme

### CSS Variables

```scss
:root {
  --primary-color: #3B82F6;
  --secondary-color: #10B981;
  --danger-color: #EF4444;
  --warning-color: #F59E0B;
  --success-color: #10B981;
  --text-primary: #1F2937;
  --text-secondary: #6B7280;
  --bg-primary: #FFFFFF;
  --bg-secondary: #F9FAFB;
  --border-color: #E5E7EB;
}
```

### Topbar Gradient

```scss
.topbar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

### Avatar Colors

```scss
.user-avatar {
  background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
  color: white;
}
```

---

## ✨ Animations

### Dropdown Animation

```scss
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dropdown-panel {
  animation: slideDown 0.2s ease-out;
}
```

### Hover Effects

```scss
.card {
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
  }
}
```

### Input Focus

```scss
.form-input {
  transition: all 0.3s ease;
  
  &:focus {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    transform: scale(1.02);
  }
}
```

---

## 📐 Layout Components

### Main Layout

```scss
.main-layout {
  display: flex;
  min-height: 100vh;
  
  .sidebar {
    flex-shrink: 0;
  }
  
  .content-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  
  .topbar {
    flex-shrink: 0;
  }
  
  .page-content {
    flex: 1;
    overflow-y: auto;
  }
  
  .footer {
    flex-shrink: 0;
  }
}
```

---

## 🔧 Responsive Fixes

### Settings Page

```scss
.setting-section {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-height: auto;
  padding: var(--spacing-lg);
  
  .section-description {
    overflow-wrap: break-word;
    word-wrap: break-word;
    white-space: normal;
  }
}
```

### Dashboard Cards

```scss
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
  gap: var(--spacing-md);
}
```

---

## ✅ Checklist

- [ ] Mobile responsive (320px - 480px)
- [ ] Tablet responsive (481px - 1024px)
- [ ] Desktop responsive (1025px+)
- [ ] Large screens (1920px+)
- [ ] Ultra-wide (2560px+)
- [ ] Font scaling works (Small, Standard, Large)
- [ ] No horizontal scrolling
- [ ] Touch-friendly controls
- [ ] Readable text at all sizes

---

**Last Updated:** October 24, 2025  
**Consolidated from:** 6 theme/responsive files
