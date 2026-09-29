import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  inject,
} from '@angular/core';
import { SidebarNavNode } from './sidebar-nav.model';
import { SidebarNavStateService } from './sidebar-nav-state.service';
import { SidebarNavNodeComponent } from './sidebar-nav-node.component';

/** Host: renders a single-root recursive tree (e.g. donations-only embedding). */
@Component({
  selector: 'app-sidebar-nav-tree',
  standalone: true,
  imports: [SidebarNavNodeComponent],
  providers: [SidebarNavStateService],
  templateUrl: './sidebar-nav-tree.component.html',
  styleUrl: './sidebar-nav-tree.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarNavTreeComponent implements OnInit, OnChanges {
  private readonly navState = inject(SidebarNavStateService);

  @Input({ required: true }) root!: SidebarNavNode;
  @Input() collapsed = false;

  ngOnInit(): void {
    this.syncRoot();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['root']) {
      this.syncRoot();
    }
  }

  private syncRoot(): void {
    if (this.root) {
      this.navState.setRoots([this.root]);
    }
  }

  get expandedIds(): Set<string> {
    return this.navState.expandedIds();
  }
}
