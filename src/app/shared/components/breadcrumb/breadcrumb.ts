import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter, distinctUntilChanged } from 'rxjs/operators';

interface Breadcrumb {
  label: string;
  url: string;
  icon?: string;
}

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './breadcrumb.html',
  styleUrls: ['./breadcrumb.scss']
})
export class BreadcrumbComponent implements OnInit {
  breadcrumbs: Breadcrumb[] = [];

  // Route label mappings
  private routeLabels: { [key: string]: string } = {
    'dashboard': 'Dashboard',
    'settings': 'Settings',
    'profile': 'Profile',
    'users': 'Users',
    'tenants': 'Tenants',
    'auth': 'Authentication',
    'login': 'Login',
    'register': 'Register'
  };

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        distinctUntilChanged()
      )
      .subscribe(() => {
        this.breadcrumbs = this.buildBreadcrumbs(this.activatedRoute.root);
      });
  }

  private buildBreadcrumbs(
    route: ActivatedRoute,
    url: string = '',
    breadcrumbs: Breadcrumb[] = []
  ): Breadcrumb[] {
    // Always start with home
    if (breadcrumbs.length === 0) {
      breadcrumbs.push({
        label: 'Home',
        url: '/dashboard',
        icon: '🏠'
      });
    }

    // Get the child routes
    const children: ActivatedRoute[] = route.children;

    // Return if there are no more children
    if (children.length === 0) {
      return breadcrumbs;
    }

    // Iterate over each children
    for (const child of children) {
      // Verify the custom data property "breadcrumb" is specified on the route
      const routeURL: string = child.snapshot.url.map(segment => segment.path).join('/');
      
      if (routeURL !== '') {
        url += `/${routeURL}`;

        // Prefer resolver-provided label (e.g., family_code)
        let label = (child.snapshot.data && child.snapshot.data['breadcrumbLabel'])
          ? child.snapshot.data['breadcrumbLabel']
          : this.getRouteLabel(routeURL);
        
        // Skip auth routes from breadcrumbs
        if (routeURL === 'auth' || this.isAuthRoute(url)) {
          continue;
        }

        // Only add to breadcrumbs if it's not already there
        // Ensure parent list crumb appears for detail pages like families/:id
        if (url.startsWith('/families/') && !breadcrumbs.find(b => b.url === '/families')) {
          breadcrumbs.push({ label: this.getRouteLabel('families'), url: '/families' });
        }

        if (!breadcrumbs.find(b => b.url === url)) {
          breadcrumbs.push({
            label: label,
            url: url
          });
        }
      }

      // Recursive call
      return this.buildBreadcrumbs(child, url, breadcrumbs);
    }

    return breadcrumbs;
  }

  private getRouteLabel(route: string): string {
    // Check if we have a custom label
    if (this.routeLabels[route]) {
      return this.routeLabels[route];
    }

    // Otherwise, capitalize the route
    return route
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private isAuthRoute(url: string): boolean {
    return url.includes('/auth/') || url === '/auth';
  }

  navigateTo(url: string): void {
    this.router.navigate([url]);
  }

  isLast(index: number): boolean {
    return index === this.breadcrumbs.length - 1;
  }
}
