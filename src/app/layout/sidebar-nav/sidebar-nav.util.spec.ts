import {
  collapseNodeAndDescendants,
  collectAutoExpandIds,
  collectAutoExpandIdsForForest,
  findSiblingIds,
  flattenForest,
  normalizeUrl,
  pathMatches,
  resolveNavActivation,
} from './sidebar-nav.util';
import { DONATIONS_SIDEBAR_TREE } from '@features/donations/config/stewardship-sidebar.adapter';
import { buildAppSidebarSections } from './app-sidebar.config';
import { SidebarNavNode } from './sidebar-nav.model';

describe('sidebar-nav.util', () => {
  describe('pathMatches', () => {
    it('matches exact dashboard', () => {
      expect(pathMatches('/donations', '/donations', true)).toBe(true);
      expect(pathMatches('/donations/campaigns', '/donations', true)).toBe(false);
    });

    it('matches prefix with boundary', () => {
      expect(pathMatches('/donations/campaigns', '/donations/campaigns')).toBe(true);
      expect(pathMatches('/donations/campaigns/edit', '/donations/campaigns')).toBe(true);
    });

    it('does not match projects prefix against project-installments', () => {
      expect(pathMatches('/donations/project-installments', '/donations/projects')).toBe(false);
      expect(pathMatches('/donations/projects', '/donations/projects')).toBe(true);
    });
  });

  describe('normalizeUrl', () => {
    it('strips tenant prefix for matching', () => {
      expect(normalizeUrl('/tenant/9/donations/campaigns')).toBe('/donations/campaigns');
    });
  });

  describe('resolveNavActivation', () => {
    const forest = flattenForest(buildAppSidebarSections());

    it('selects exactly one active leaf for campaigns', () => {
      const activation = resolveNavActivation(forest, '/donations/campaigns');
      expect(activation.activeId).toBe('donations-projects-campaigns');
      expect(activation.ancestorIds.has('donations')).toBe(true);
      expect(activation.ancestorIds.has('donations-projects')).toBe(true);
    });

    it('prefers canonical families over donations cross-link', () => {
      const activation = resolveNavActivation(forest, '/families');
      expect(activation.activeId).toBe('families');
      expect(activation.ancestorIds.size).toBe(0);
    });

    it('uses longest match for settings child routes', () => {
      const activation = resolveNavActivation(forest, '/settings/data-export');
      expect(activation.activeId).toBe('settings-data-export');
    });

    it('highlights bishops leaf for ecclesiastical deep links', () => {
      const activation = resolveNavActivation(forest, '/settings/ecclesiastical/bishops');
      expect(activation.activeId).toBe('settings-ecclesiastical-bishops');
      expect(activation.ancestorIds.has('settings')).toBe(true);
      expect(activation.ancestorIds.has('settings-ecclesiastical')).toBe(true);
    });

    it('selects RBAC tab from query string', () => {
      const activation = resolveNavActivation(forest, '/settings/roles-permissions?tab=assign');
      expect(activation.activeId).toBe('roles-permissions-assign');
    });

    it('defaults RBAC to roles tab when query is missing', () => {
      const activation = resolveNavActivation(forest, '/settings/roles-permissions');
      expect(activation.activeId).toBe('roles-permissions-roles');
    });

    it('selects ministries guests leaf without matching organizations', () => {
      const activation = resolveNavActivation(forest, '/ministries/guests');
      expect(activation.activeId).toBe('ministries-guests');
    });

    it('defaults church profile to overview tab', () => {
      const activation = resolveNavActivation(forest, '/church-profile');
      expect(activation.activeId).toBe('church-profile-profile');
    });

    it('selects church profile social tab from query', () => {
      const activation = resolveNavActivation(forest, '/church-profile?tab=social');
      expect(activation.activeId).toBe('church-profile-social');
      expect(activation.ancestorIds.has('church-profile')).toBe(true);
    });

    it('does not expand church profile when ministries cross-link is active', () => {
      const ids = collectAutoExpandIdsForForest(forest, '/ministries');
      expect(ids.has('church-profile')).toBe(false);
    });

    it('selects edit profile overview action from query', () => {
      const activation = resolveNavActivation(forest, '/church-profile?tab=profile&action=edit');
      expect(activation.activeId).toBe('church-profile-edit');
      expect(activation.ancestorIds.has('church-profile-profile')).toBe(true);
      expect(activation.ancestorIds.has('church-profile')).toBe(true);
    });

    it('resolves arbitrary depth with longest prefix', () => {
      const deepForest: SidebarNavNode[] = [
        {
          id: 'settings',
          label: 'Settings',
          route: '/settings',
          children: [
            {
              id: 'ecclesiastical',
              label: 'Ecclesiastical',
              route: '/settings/ecclesiastical',
              children: [
                {
                  id: 'bishops',
                  label: 'Bishops',
                  route: '/settings/ecclesiastical/bishops',
                },
              ],
            },
          ],
        },
      ];

      const activation = resolveNavActivation(deepForest, '/settings/ecclesiastical/bishops');
      expect(activation.activeId).toBe('bishops');
      expect(activation.ancestorIds.has('settings')).toBe(true);
      expect(activation.ancestorIds.has('ecclesiastical')).toBe(true);
    });
  });

  describe('collectAutoExpandIds', () => {
    const root = DONATIONS_SIDEBAR_TREE;

    it('expands donations and projects for campaigns', () => {
      const ids = collectAutoExpandIds(root, '/donations/campaigns');
      expect(ids.has('donations')).toBe(true);
      expect(ids.has('donations-projects')).toBe(true);
    });

    it('expands configure for categories', () => {
      const ids = collectAutoExpandIds(root, '/donations/categories');
      expect(ids.has('donations')).toBe(true);
      expect(ids.has('donations-configure')).toBe(true);
    });

    it('does not expand donations for /families', () => {
      const ids = collectAutoExpandIds(root, '/families');
      expect(ids.has('donations')).toBe(false);
    });

    it('matches tenant-prefixed donation URLs', () => {
      const ids = collectAutoExpandIds(root, '/tenant/9/donations/categories');
      expect(ids.has('donations-configure')).toBe(true);
    });

    it('finds matching leaf for installments without projects false positive', () => {
      expect(resolveNavActivation([root], '/donations/project-installments').activeId).toBe(
        'donations-projects-project-installments'
      );
      expect(pathMatches('/donations/project-installments', '/donations/projects')).toBe(false);
    });
  });

  describe('collectAutoExpandIdsForForest', () => {
    it('does not expand donations when families is active', () => {
      const forest = flattenForest(buildAppSidebarSections());
      const ids = collectAutoExpandIdsForForest(forest, '/families');
      expect(ids.has('donations')).toBe(false);
    });
  });

  describe('accordion helpers', () => {
    it('finds forest-root siblings when parentId is null', () => {
      const forest = flattenForest(buildAppSidebarSections());
      const siblings = findSiblingIds(forest, null, 'donations');
      expect(siblings).toContain('families');
      expect(siblings).toContain('members');
      expect(siblings).not.toContain('donations');
    });

    it('collapses a node and its descendants', () => {
      const expanded = new Set(['donations', 'donations-projects', 'donations-collect']);
      collapseNodeAndDescendants(expanded, [DONATIONS_SIDEBAR_TREE], 'donations');
      expect(expanded.size).toBe(0);
    });
  });
});
