import { CommonModule, DOCUMENT } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  Renderer2,
  ViewChild,
  inject
} from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { FinancialCommandCenterPayload } from '../../../models/donation.model';
import {
  buildOperationsHubViewModel,
  HubInsightCard,
  HubPriorityCard,
  HubTimelineItem,
  HubWorkflowItem,
  OperationsHubViewModel
} from '../../utils/operations-hub.view-model';

@Component({
  selector: 'app-foc-operations-hub',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './foc-workspace-menu.component.html',
  styleUrl: './foc-workspace-menu.component.scss'
})
export class FocOperationsHubComponent implements AfterViewInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly renderer = inject(Renderer2);
  private readonly document = inject(DOCUMENT);
  private readonly navSubscription: Subscription;

  @ViewChild('drawerRoot') drawerRoot?: ElementRef<HTMLElement>;

  @Input({ required: true }) data!: FinancialCommandCenterPayload;
  @Input() currencyCode = 'INR';

  @Output() quickCollect = new EventEmitter<void>();
  @Output() recordExpense = new EventEmitter<void>();

  open = false;
  vm: OperationsHubViewModel | null = null;
  private portalHost: HTMLElement | null = null;
  private drawerMoved = false;

  constructor() {
    this.navSubscription = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe(() => this.close());
  }

  ngAfterViewInit(): void {
    this.portalHost = this.renderer.createElement('div');
    this.renderer.addClass(this.portalHost, 'foc-ops-portal');
    this.renderer.appendChild(this.document.body, this.portalHost);
  }

  ngOnDestroy(): void {
    this.navSubscription.unsubscribe();
    this.unlockBodyScroll();
    if (this.portalHost) {
      this.renderer.removeChild(this.document.body, this.portalHost);
    }
  }

  get attentionBadge(): string | null {
    const count = this.vm?.attentionCount ?? buildOperationsHubViewModel(this.data, this.currencyCode).attentionCount;
    return count > 0 ? String(count) : null;
  }

  toggle(): void {
    if (this.open) {
      this.close();
      return;
    }
    this.vm = buildOperationsHubViewModel(this.data, this.currencyCode);
    this.open = true;
    this.lockBodyScroll();
    this.cdr.detectChanges();
    this.moveDrawerToPortal();
    queueMicrotask(() => this.focusCloseButton());
  }

  close(): void {
    if (!this.open) {
      return;
    }
    this.open = false;
    this.unlockBodyScroll();
    this.restoreDrawerToHost();
    this.cdr.markForCheck();
  }

  onWorkflowItem(item: HubWorkflowItem): void {
    if (item.kind === 'emit') {
      if (item.target === 'collect') {
        this.quickCollect.emit();
      }
      if (item.target === 'expense') {
        this.recordExpense.emit();
      }
      this.close();
      return;
    }
    this.navigate(item.route);
  }

  navigate(route: string): void {
    if (!route) {
      return;
    }
    void this.router.navigateByUrl(route);
    this.close();
  }

  priorityClass(card: HubPriorityCard): string {
    return `foc-ops__priority--${card.level}`;
  }

  insightClass(card: HubInsightCard): string {
    return `foc-ops__insight--${card.tone}`;
  }

  timelineDotClass(item: HubTimelineItem): string {
    return `foc-ops__timeline-dot--${item.category}`;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  private moveDrawerToPortal(): void {
    const drawer = this.drawerRoot?.nativeElement;
    if (!drawer || !this.portalHost || this.drawerMoved) {
      return;
    }
    this.renderer.appendChild(this.portalHost, drawer);
    this.drawerMoved = true;
  }

  private restoreDrawerToHost(): void {
    const drawer = this.drawerRoot?.nativeElement;
    if (!drawer || !this.drawerMoved) {
      return;
    }
    this.renderer.appendChild(this.host.nativeElement, drawer);
    this.drawerMoved = false;
  }

  private lockBodyScroll(): void {
    this.renderer.setStyle(this.document.body, 'overflow', 'hidden');
  }

  private unlockBodyScroll(): void {
    this.renderer.removeStyle(this.document.body, 'overflow');
  }

  private focusCloseButton(): void {
    const closeBtn = this.drawerRoot?.nativeElement?.querySelector<HTMLButtonElement>('[data-ops-close]');
    closeBtn?.focus();
  }
}
