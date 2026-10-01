import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CfBrandLoaderComponent } from '@shared/components/cf-brand-loader/cf-brand-loader.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';

@Component({
  selector: 'app-loader-demo-page',
  standalone: true,
  imports: [CommonModule, CfBrandLoaderComponent, LoadingSkeletonComponent],
  template: `
    <main class="loader-demo">
      <header class="loader-demo__hero">
        <p class="loader-demo__eyebrow">Preview only — not rolled out yet</p>
        <h1>EkklesiaSoft loading system</h1>
        <p>
          Brand mark for waits. Existing skeletons stay for tables and cards so the layout does not jump.
        </p>
      </header>

      <section class="loader-demo__grid" aria-label="Loader sizes">
        <article class="loader-demo__card">
          <h2>Page</h2>
          <p>First paint of a route when there is no layout to skeleton yet.</p>
          <app-cf-brand-loader size="page" label="Loading parish overview" />
        </article>

        <article class="loader-demo__card">
          <h2>Section</h2>
          <p>One panel loading while the rest of the page stays usable.</p>
          <div class="loader-demo__panel">
            <app-cf-brand-loader size="section" label="Loading age distribution" />
          </div>
        </article>

        <article class="loader-demo__card">
          <h2>Table</h2>
          <p>Skeleton keeps the table shape. A short label announces the wait.</p>
          <div class="loader-demo__panel">
            <app-cf-brand-loader size="inline" label="Loading members" />
            <app-loading-skeleton type="table" [rows]="4" [columns]="4" />
          </div>
        </article>

        <article class="loader-demo__card">
          <h2>Form submit</h2>
          <p>Button stays in place. The mark replaces the label while saving.</p>
          <button type="button" class="loader-demo__btn" disabled>
            <app-cf-brand-loader size="button" label="Saving" />
          </button>
        </article>

        <article class="loader-demo__card">
          <h2>Background</h2>
          <p>Quiet refresh. Content stays visible; the mark sits in the toolbar.</p>
          <div class="loader-demo__toolbar">
            <span>Member directory</span>
            <app-cf-brand-loader size="inline" label="Refreshing" [showLabel]="true" />
          </div>
        </article>

        <article class="loader-demo__card loader-demo__card--overlay">
          <h2>Card overlay</h2>
          <p>Existing content dims. Only this card waits.</p>
          <div class="loader-demo__panel loader-demo__panel--relative">
            <p>Collected this month</p>
            <strong>12 families</strong>
            <app-cf-brand-loader size="section" label="Updating totals" [overlay]="true" />
          </div>
        </article>
      </section>
    </main>
  `,
  styles: [
    `
      .loader-demo {
        min-height: 100vh;
        padding: 2rem 1.25rem 3rem;
        background: #f7f4ee;
        color: #1e293b;
        font-family: Inter, "Segoe UI", system-ui, sans-serif;
      }

      .loader-demo__hero {
        max-width: 42rem;
        margin: 0 auto 1.5rem;
      }

      .loader-demo__eyebrow {
        margin: 0 0 0.35rem;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #1d4e89;
      }

      h1 {
        margin: 0 0 0.4rem;
        font-size: 1.75rem;
        color: #1d4e89;
      }

      .loader-demo__hero p:last-child {
        margin: 0;
        color: #475569;
      }

      .loader-demo__grid {
        max-width: 68rem;
        margin: 0 auto;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
        gap: 1rem;
      }

      .loader-demo__card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 1rem 1rem 1.25rem;
      }

      h2 {
        margin: 0 0 0.25rem;
        font-size: 1rem;
        color: #1d4e89;
      }

      .loader-demo__card > p {
        margin: 0 0 0.75rem;
        font-size: 0.85rem;
        color: #64748b;
      }

      .loader-demo__panel {
        border: 1px dashed #cbd5e1;
        border-radius: 10px;
        padding: 0.75rem;
        background: #f8fafc;
      }

      .loader-demo__panel--relative {
        position: relative;
        min-height: 8rem;
      }

      .loader-demo__btn {
        display: inline-flex;
        align-items: center;
        min-height: 2.5rem;
        padding: 0 1rem;
        border: 0;
        border-radius: 8px;
        background: #1d4e89;
        color: #fff;
      }

      .loader-demo__btn .cf-brand-loader {
        color: #fff;
      }

      .loader-demo__toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.75rem;
        padding: 0.65rem 0.75rem;
        border-radius: 8px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        font-weight: 600;
      }
    `,
  ],
})
export class LoaderDemoPageComponent {}
