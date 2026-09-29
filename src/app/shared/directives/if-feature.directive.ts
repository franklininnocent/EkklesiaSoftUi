import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { EntitlementService } from '@core/services/entitlement.service';

/**
 * Renders content only when the church's plan includes the feature(s).
 * Display only — the API enforces the same features.
 *
 *   <button *appIfFeature="'RBAC_ADVANCED'">New role</button>
 *   <section *appIfFeature="['ADVANCED_FINANCIAL_REPORTING']; else upsell">…</section>
 */
@Directive({
  selector: '[appIfFeature]',
  standalone: true,
})
export class IfFeatureDirective {
  private readonly entitlements = inject(EntitlementService);
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);

  readonly appIfFeature = input.required<string | readonly string[]>();
  readonly appIfFeatureElse = input<TemplateRef<unknown> | null>(null);

  private shown: 'main' | 'else' | null = null;

  constructor() {
    this.entitlements.load().subscribe();
    effect(() => {
      this.entitlements.entitlements();
      const raw = this.appIfFeature();
      const codes = (Array.isArray(raw) ? raw : [raw]) as string[];
      const allowed = this.entitlements.hasAllFeatures(codes.filter(Boolean));
      this.render(allowed ? 'main' : 'else');
    });
  }

  private render(next: 'main' | 'else'): void {
    const elseTemplate = this.appIfFeatureElse();
    if (next === this.shown) return;
    this.container.clear();
    if (next === 'main') {
      this.container.createEmbeddedView(this.template);
    } else if (elseTemplate) {
      this.container.createEmbeddedView(elseTemplate);
    }
    this.shown = next;
  }
}
