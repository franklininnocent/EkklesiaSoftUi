import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';

@Component({
  selector: 'app-ministries-insights-placeholder-page',
  standalone: true,
  imports: [CommonModule, CfEmptyStateComponent],
  template: `
    <app-cf-empty-state
      [title]="title"
      [description]="description"
      [hasActions]="false"
    ></app-cf-empty-state>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MinistriesInsightsPlaceholderPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);

  title = 'Coming soon';
  description = 'This section is scheduled for a later phase.';

  ngOnInit(): void {
    const data = this.route.snapshot.data;
    this.title = (data['title'] as string) || this.title;
    this.description = (data['description'] as string) || this.description;
  }
}
