import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { ProfileStatsService } from '../../data-access/profile-stats.service';

@Component({
  selector: 'app-stats-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (svc.loading() && !svc.stats()) {
      <div class="tab-loading">Loading…</div>
    } @else if (svc.stats()) {
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-val">{{ svc.stats()!.totalMntCount }}</span>
          <span class="stat-lbl">Moments posted</span>
        </div>
        <div class="stat-card">
          <span class="stat-val">{{ svc.stats()!.totalLikeCount }}</span>
          <span class="stat-lbl">Likes received</span>
        </div>
        <div class="stat-card">
          <span class="stat-val">{{ svc.stats()!.lastMntLikeCount }}</span>
          <span class="stat-lbl">Likes on last post</span>
        </div>
        <div class="stat-card">
          <span class="stat-val">{{ formatDate(svc.stats()!.registeredTs) }}</span>
          <span class="stat-lbl">Member since</span>
        </div>
      </div>
    } @else {
      <p class="empty-msg">Stats unavailable.</p>
    }
  `,
  styles: [`
    .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
    .stat-card { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: var(--space-4); background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-xl); }
    .stat-val { font-size: var(--text-xl); font-weight: var(--font-bold); color: var(--color-text); }
    .stat-lbl { font-size: 10px; color: var(--color-text-muted); text-align: center; }
    .tab-loading, .empty-msg { text-align: center; color: var(--color-text-muted); padding: var(--space-8) 0; }
  `],
})
export class StatsTabComponent implements OnInit {
  protected readonly svc = inject(ProfileStatsService);

  ngOnInit(): void {
    this.svc.load();
  }

  formatDate(ts: number): string {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
}