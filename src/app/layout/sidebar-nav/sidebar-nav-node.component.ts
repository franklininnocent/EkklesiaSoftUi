import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  Input,
  inject,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { SidebarNavNode } from './sidebar-nav.model';
import { SidebarNavStateService } from './sidebar-nav-state.service';
import { SidebarNavIconComponent } from './sidebar-nav-icon.component';

@Component({
  selector: 'app-sidebar-nav-node',
  standalone: true,
  imports: [CommonModule, RouterModule, SidebarNavNodeComponent, SidebarNavIconComponent],
  templateUrl: './sidebar-nav-node.component.html',
  styleUrl: './sidebar-nav-node.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarNavNodeComponent {
  protected readonly navState = inject(SidebarNavStateService);

  @Input({ required: true }) node!: SidebarNavNode;
  @Input() depth = 0;
  @Input() collapsed = false;

  flyoutOpen = false;

  get hasChildren(): boolean {
    return (this.node.children?.length ?? 0) > 0;
  }

  get submenuId(): string {
    return `sidebar-nav-${this.node.id}`;
  }

  get navDepthStyle(): Record<string, string> {
    return { '--nav-depth': String(this.depth) };
  }

  get depthClass(): string {
    if (this.depth === 0) {
      return 'nav-depth-0';
    }
    if (this.depth === 1) {
      return 'nav-depth-1';
    }
    return 'nav-depth-n';
  }

  get leafClassMap(): Record<string, boolean> {
    return {
      'nav-item': this.depth === 0,
      'nav-subitem': this.depth > 0,
      'nav-item--root': this.depth === 0,
      'nav-item--active': this.isActive(),
      'nav-item--ancestor': this.isAncestor(),
      'nav-depth-1': this.depth === 1,
      'nav-depth-n': this.depth > 1,
    };
  }

  isExpanded(): boolean {
    return this.navState.isExpanded(this.node.id);
  }

  isActive(): boolean {
    return this.navState.isActive(this.node.id);
  }

  isAncestor(): boolean {
    return this.navState.isAncestor(this.node.id);
  }

  showIcon(): boolean {
    return this.depth === 0 && !!this.node.icon;
  }

  showMarker(): boolean {
    return this.depth > 0;
  }

  toggleExpand(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.navState.toggleExpand(this.node.id);
  }

  onParentRowClick(event: Event): void {
    if (this.node.route) {
      return;
    }
    event.preventDefault();
    this.navState.toggleExpand(this.node.id);
  }

  openFlyout(): void {
    if (this.collapsed && this.depth === 0 && this.hasChildren) {
      this.flyoutOpen = true;
    }
  }

  closeFlyout(): void {
    this.flyoutOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeFlyout();
  }
}
