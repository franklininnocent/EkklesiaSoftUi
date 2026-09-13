import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  inject,
} from '@angular/core';
import { SidebarNavSection } from './sidebar-nav.model';
import { SidebarNavStateService } from './sidebar-nav-state.service';
import { flattenForest } from './sidebar-nav.util';
import { SidebarNavNodeComponent } from './sidebar-nav-node.component';

@Component({
  selector: 'app-sidebar-nav-forest',
  standalone: true,
  imports: [SidebarNavNodeComponent],
  providers: [SidebarNavStateService],
  templateUrl: './sidebar-nav-forest.component.html',
  styleUrl: './sidebar-nav-forest.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarNavForestComponent implements OnInit, OnChanges {
  private readonly navState = inject(SidebarNavStateService);

  @Input({ required: true }) sections: SidebarNavSection[] = [];
  @Input() collapsed = false;

  ngOnInit(): void {
    this.syncRoots();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sections']) {
      this.syncRoots();
    }
  }

  private syncRoots(): void {
    this.navState.setRoots(flattenForest(this.sections));
  }
}
