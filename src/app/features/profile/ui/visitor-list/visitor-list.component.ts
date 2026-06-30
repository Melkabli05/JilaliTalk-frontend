import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { VisitorsService } from '../../data-access/visitors.service';

@Component({
  selector: 'app-visitor-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (svc.loading() && !svc.visitors()) {
      <div class="tab-loading">Loading…</div>
    } @else if (!svc.visitors()?.length) {
      <p class="empty-msg">No visitors yet.</p>
    } @else {
      <div class="visitor-list">
        @for (v of svc.visitors() ?? []; track v.userId) {
          <div class="visitor-card">
            <img class="visitor-avatar" [src]="v.headUrl ?? '/assets/default-avatar.png'" [alt]="v.nickname" />
            <div class="visitor-info">
              <span class="visitor-name">{{ v.nickname }}</span>
              @if (v.isSecretVisit) {
                <span class="secret-badge">Secret</span>
              } @else {
                <span class="visit-count">{{ v.visitCnt }} visit{{ v.visitCnt > 1 ? 's' : '' }}</span>
              }
            </div>
          </div>
        }
      </div>
      @if (svc.nextCursor()) {
        <button class="load-more-btn" (click)="svc.loadMore()">Load more</button>
      }
    }
  `,
  styles: [`
    .visitor-list { display: flex; flex-direction: column; gap: 8px; }
    .visitor-card { display: flex; align-items: center; gap: 12px; padding: 8px; background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-lg); }
    .visitor-avatar { width: 40px; height: 40px; border-radius: var(--radius-full); object-fit: cover; }
    .visitor-info { display: flex; flex-direction: column; gap: 2px; }
    .visitor-name { font-size: var(--text-sm); font-weight: 500; }
    .visit-count, .secret-badge { font-size: 10px; color: var(--color-text-muted); }
    .tab-loading, .empty-msg { text-align: center; color: var(--color-text-muted); padding: var(--space-8) 0; font-size: var(--text-sm); }
    .load-more-btn { display: block; width: 100%; margin-top: var(--space-3); padding: var(--space-2); border: 1px dashed var(--color-border); border-radius: var(--radius-md); background: transparent; color: var(--color-text-muted); cursor: pointer; }
  `],
})
export class VisitorListComponent implements OnInit {
  protected readonly svc = inject(VisitorsService);

  ngOnInit(): void {
    this.svc.loadMore();
  }
}