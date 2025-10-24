# 🎯 UI Components & Features

**EkklesiaSoft Frontend** - Reusable Components & UI Features

---

## 📚 Contents

1. [Toast Notifications](#toast-notifications)
2. [Breadcrumb Navigation](#breadcrumb-navigation)
3. [Sidebar Menu](#sidebar-menu)
4. [Card Component](#card-component)
5. [Modal Components](#modal-components)

---

## 🔔 Toast Notifications

### Toast Service

```typescript
@Injectable({ providedIn: 'root' })
export class ToastService {
  private toastsSubject = new BehaviorSubject<Toast[]>([]);
  toasts$ = this.toastsSubject.asObservable();
  
  success(message: string, duration: number = 3000) {
    this.show('success', message, duration);
  }
  
  error(message: string, duration: number = 5000) {
    this.show('error', message, duration);
  }
  
  warning(message: string, duration: number = 4000) {
    this.show('warning', message, duration);
  }
  
  info(message: string, duration: number = 3000) {
    this.show('info', message, duration);
  }
  
  private show(type: ToastType, message: string, duration: number) {
    const toast: Toast = {
      id: Date.now(),
      type,
      message,
      duration
    };
    
    const current = this.toastsSubject.value;
    this.toastsSubject.next([...current, toast]);
    
    // Auto dismiss
    setTimeout(() => {
      this.dismiss(toast.id);
    }, duration);
  }
  
  dismiss(id: number) {
    const current = this.toastsSubject.value;
    this.toastsSubject.next(current.filter(t => t.id !== id));
  }
}
```

### Toast Container Component

```typescript
@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      @for (toast of toasts$ | async; track toast.id) {
        <div [class]="'toast toast-' + toast.type" [@slideIn]>
          <div class="toast-content">
            <span class="toast-icon">{{ getIcon(toast.type) }}</span>
            <span class="toast-message">{{ toast.message }}</span>
            <button class="toast-close" (click)="dismiss(toast.id)">×</button>
          </div>
        </div>
      }
    </div>
  `,
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(100%)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateX(100%)' }))
      ])
    ])
  ]
})
export class ToastContainerComponent {
  toasts$ = inject(ToastService).toasts$;
  
  dismiss(id: number) {
    inject(ToastService).dismiss(id);
  }
  
  getIcon(type: ToastType): string {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '⚠';
      case 'info': return 'ℹ';
      default: return '';
    }
  }
}
```

### Toast Styles

```scss
.toast-container {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 99999;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toast {
  min-width: 300px;
  max-width: 500px;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  
  &.toast-success {
    background: #10B981;
    color: white;
  }
  
  &.toast-error {
    background: #EF4444;
    color: white;
  }
  
  &.toast-warning {
    background: #F59E0B;
    color: white;
  }
  
  &.toast-info {
    background: #3B82F6;
    color: white;
  }
}
```

---

## 🍞 Breadcrumb Navigation

### Breadcrumb Component

```typescript
@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class BreadcrumbComponent implements OnInit {
  breadcrumbs: Breadcrumb[] = [];
  
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  
  ngOnInit() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.breadcrumbs = this.buildBreadcrumbs(this.route.root);
    });
  }
  
  private buildBreadcrumbs(route: ActivatedRoute, url: string = '', breadcrumbs: Breadcrumb[] = []): Breadcrumb[] {
    const children: ActivatedRoute[] = route.children;
    
    if (children.length === 0) {
      return breadcrumbs;
    }
    
    for (const child of children) {
      const routeURL: string = child.snapshot.url.map(segment => segment.path).join('/');
      if (routeURL !== '') {
        url += `/${routeURL}`;
      }
      
      const label = this.getLabel(routeURL);
      if (label) {
        breadcrumbs.push({ label, url });
      }
      
      return this.buildBreadcrumbs(child, url, breadcrumbs);
    }
    
    return breadcrumbs;
  }
  
  private getLabel(segment: string): string {
    const labels: Record<string, string> = {
      'dashboard': 'Dashboard',
      'tenants': 'Tenants',
      'settings': 'Settings',
      'profile': 'Profile',
      'users': 'Users'
    };
    return labels[segment] || segment;
  }
}
```

### Breadcrumb Template

```html
<nav class="breadcrumb">
  <a routerLink="/" class="breadcrumb-item">
    <svg><!-- Home icon --></svg>
  </a>
  
  @for (crumb of breadcrumbs; track crumb.url; let last = $last) {
    <span class="breadcrumb-separator">→</span>
    @if (last) {
      <span class="breadcrumb-item active">{{ crumb.label }}</span>
    } @else {
      <a [routerLink]="crumb.url" class="breadcrumb-item">{{ crumb.label }}</a>
    }
  }
</nav>
```

---

## 📊 Sidebar Menu

### Sidebar Component

```typescript
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class SidebarComponent {
  menuItems = [
    {
      icon: '📊',
      label: 'Dashboard',
      route: '/dashboard',
      active: true
    },
    {
      icon: '🏢',
      label: 'Tenants',
      route: '/tenants',
      active: false
    },
    {
      icon: '👥',
      label: 'Users',
      route: '/users',
      active: false
    },
    {
      icon: '⚙️',
      label: 'Settings',
      route: '/settings',
      active: false,
      children: [
        { label: 'General', route: '/settings/general' },
        { label: 'Teams', route: null }
      ]
    }
  ];
  
  isItemActive(route: string): boolean {
    return this.router.url.startsWith(route);
  }
}
```

---

## 📦 Card Component

### Card Component

```typescript
@Component({
  selector: 'app-card',
  standalone: true,
  template: `
    <div class="card" [class.hoverable]="hoverable" [class.clickable]="clickable">
      <ng-content></ng-content>
    </div>
  `
})
export class CardComponent {
  @Input() hoverable = false;
  @Input() clickable = false;
}
```

### Card Styles

```scss
.card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: var(--spacing-md);
  overflow: hidden;
  
  &.hoverable {
    transition: all 0.3s ease;
    
    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
    }
  }
  
  &.clickable {
    cursor: pointer;
  }
}
```

---

## 🔔 Modal Components

### Base Modal

```typescript
@Component({
  selector: 'app-modal',
  standalone: true,
  template: `
    <div class="modal-backdrop" (click)="onBackdropClick()">
      <div class="modal-container" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>{{ title }}</h2>
          <button class="close-btn" (click)="close.emit()">×</button>
        </div>
        <div class="modal-body">
          <ng-content></ng-content>
        </div>
        <div class="modal-footer">
          <ng-content select="[footer]"></ng-content>
        </div>
      </div>
    </div>
  `
})
export class ModalComponent {
  @Input() title = '';
  @Output() close = new EventEmitter<void>();
  
  onBackdropClick() {
    this.close.emit();
  }
}
```

---

**Last Updated:** October 24, 2025  
**Consolidated from:** Toast, Breadcrumb, Sidebar, Card components
