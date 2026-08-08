import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter, distinctUntilChanged } from 'rxjs/operators';

export interface Breadcrumb {
  label: string;
  url: string;
  icon?: string;
}

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './breadcrumb.html',
  changeDetection: ChangeDetectionStrategy.Eager,
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
    // Build once on init in case NavigationEnd already fired before component mounts
    this.breadcrumbs = this.buildBreadcrumbs(this.activatedRoute.root);

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
        const resolvedLabel = child.snapshot.data && child.snapshot.data['breadcrumbLabel'];
        let label = resolvedLabel
          ? resolvedLabel
          : this.getRouteLabel(routeURL);

        // #region agent log
        fetch('http://127.0.0.1:7631/ingest/5401a346-7001-4033-9c37-4ee605985cd9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c1da6e'},body:JSON.stringify({sessionId:'c1da6e',runId:'post-fix',hypothesisId:'A',location:'breadcrumb.ts:buildBreadcrumbs',message:'breadcrumb label resolution',data:{routeURL,url,hasResolvedLabel:!!resolvedLabel,resolvedLabel:typeof resolvedLabel==='string'?resolvedLabel.slice(0,64):null,finalLabel:typeof label==='string'?String(label).slice(0,64):label,looksLikeUuid:/^[0-9a-f-]{20,}$/i.test(routeURL),finalLooksLikeUuid:/^[0-9a-f-]{20,}$/i.test(String(label||'').replace(/\s/g,'')),dataKeys:Object.keys(child.snapshot.data||{})},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        
        // Skip auth routes from breadcrumbs
        if (routeURL === 'auth' || this.isAuthRoute(url)) {
          continue;
        }

        // Only add to breadcrumbs if it's not already there
        // Ensure parent list crumb appears for detail pages like families/:id
        if (url.startsWith('/families/') && !breadcrumbs.find(b => b.url === '/families')) {
          breadcrumbs.push({ label: this.getRouteLabel('families'), url: '/families' });
        }

        // #region agent log
        if (url.startsWith('/ministries/')) {
          fetch('http://127.0.0.1:7631/ingest/5401a346-7001-4033-9c37-4ee605985cd9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c1da6e'},body:JSON.stringify({sessionId:'c1da6e',runId:'post-fix',hypothesisId:'B',location:'breadcrumb.ts:ministries-branch',message:'ministries crumb path',data:{url,label:typeof label==='string'?label.slice(0,64):label,hasMinistriesParent:!!breadcrumbs.find(b=>b.url==='/ministries'),crumbCountBeforePush:breadcrumbs.length,hasResolvedLabel:!!resolvedLabel},timestamp:Date.now()})}).catch(()=>{});
        }
        // #endregion

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
