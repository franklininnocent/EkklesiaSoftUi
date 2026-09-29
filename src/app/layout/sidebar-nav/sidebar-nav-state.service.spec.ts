import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Component } from '@angular/core';
import { SidebarNavStateService } from './sidebar-nav-state.service';
import { buildAppSidebarSections } from './app-sidebar.config';
import { flattenForest } from './sidebar-nav.util';

@Component({ template: '', standalone: true })
class StubPageComponent {}

describe('SidebarNavStateService', () => {
  let service: SidebarNavStateService;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        SidebarNavStateService,
        provideRouter([
          { path: 'donations/campaigns', component: StubPageComponent },
          { path: 'members', component: StubPageComponent },
          { path: '**', component: StubPageComponent },
        ]),
      ],
    }).compileComponents();

    service = TestBed.inject(SidebarNavStateService);
    router = TestBed.inject(Router);
    service.setRoots(flattenForest(buildAppSidebarSections()));
  });

  it('auto-expands ancestor trail for deep routes', async () => {
    await router.navigateByUrl('/donations/campaigns');
    TestBed.flushEffects();

    expect(service.activeId()).toBe('donations-projects-campaigns');
    expect(service.isExpanded('donations')).toBe(true);
    expect(service.isExpanded('donations-projects')).toBe(true);
  });

  it('collapses sibling workspace when another is expanded manually', () => {
    service.toggleExpand('donations');
    service.toggleExpand('donations-projects');
    service.toggleExpand('donations-collect');

    expect(service.isExpanded('donations')).toBe(true);
    expect(service.isExpanded('donations-projects')).toBe(false);
    expect(service.isExpanded('donations-collect')).toBe(true);
  });

  it('closes previous sibling even when it is the active ancestor', async () => {
    await router.navigateByUrl('/donations/campaigns');
    TestBed.flushEffects();
    expect(service.isExpanded('donations-projects')).toBe(true);

    service.toggleExpand('donations-collect');

    expect(service.isExpanded('donations-projects')).toBe(false);
    expect(service.isExpanded('donations-collect')).toBe(true);
    expect(service.isExpanded('donations')).toBe(true);
  });

  it('collapses donations when navigating to a sibling top-level menu', async () => {
    await router.navigateByUrl('/donations/campaigns');
    TestBed.flushEffects();
    expect(service.isExpanded('donations')).toBe(true);

    await router.navigateByUrl('/members');
    TestBed.flushEffects();

    expect(service.isExpanded('donations')).toBe(false);
    expect(service.isExpanded('donations-projects')).toBe(false);
  });

  it('clears stale active state after navigation', async () => {
    await router.navigateByUrl('/donations/campaigns');
    TestBed.flushEffects();
    expect(service.isActive('donations-projects-campaigns')).toBe(true);

    await router.navigateByUrl('/members');
    TestBed.flushEffects();
    expect(service.isActive('donations-projects-campaigns')).toBe(false);
  });
});
