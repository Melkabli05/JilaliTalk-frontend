import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { CountryFlagComponent } from '@shared/ui/host-flag/country-flag';
import { CaptionEntry } from '../models/room-model';
import { formatClockTime } from '@shared/utils';
import { LucideCaptions } from '@lucide/angular';
import { EmptyStateComponent } from '@shared/ui/empty-state/empty-state.component';

const formatTime = formatClockTime;

@Component({
  selector: 'app-caption-list',
  imports: [AvatarComponent, CountryFlagComponent, LucideCaptions, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="caption-list" role="log" aria-label="Captions">
      @for (caption of captions(); track caption._id) {
        <div class="entry">
          <app-avatar
            class="entry-avatar"
            [initials]="caption.nickName.slice(0, 2)"
            size="sm"
            [alt]="caption.nickName"
          />
          <div class="entry-body">
            <div class="entry-meta">
              <span class="name">{{ caption.nickName }}</span>
              @if (caption.nationality) {
                <app-country-flag [code]="caption.nationality" [compact]="true" />
              }
              <span class="time">{{ formatTime(caption.createAt * 1000) }}</span>
            </div>
            <p class="text">{{ caption.text }}</p>
          </div>
        </div>
      }

      @if (captions().length === 0) {
        <app-empty-state [style.flex]="1" [compact]="true" title="No captions yet" body="Speech-to-text transcripts will appear here">
          <svg empty-state-icon aria-hidden="true" lucideCaptions [size]="20"></svg>
        </app-empty-state>
      }
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; flex: 1; min-height: 0; }

    /* ─── Design tokens ─── */
    :host {
      --cl-bg:      var(--color-neutral-50);
      --cl-border:  var(--color-border);
      --cl-text:    var(--color-text);
      --cl-muted:   var(--color-text-muted);
      --cl-name:    var(--color-text);
      --cl-scroll:  var(--color-neutral-300);
    }
    :host-context(.dark) {
      --cl-bg:     var(--color-neutral-800);
      --cl-border: var(--color-neutral-700);
      --cl-text:   var(--color-neutral-100);
      --cl-muted:  var(--color-neutral-500);
      --cl-name:   var(--color-neutral-200);
      --cl-scroll: var(--color-neutral-600);
    }

    .caption-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-2);
      overflow-y: auto;
      flex: 1;
      scrollbar-width: thin;
      scrollbar-color: var(--cl-scroll) transparent;
    }
    .caption-list::-webkit-scrollbar { width: 4px; }
    .caption-list::-webkit-scrollbar-thumb { background: var(--cl-scroll); border-radius: 2px; }

    .entry {
      display: flex;
      gap: var(--space-2);
      align-items: flex-start;
    }
    .entry-avatar { flex-shrink: 0; margin-top: 2px; }
    .entry-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }

    .entry-meta {
      display: flex;
      align-items: baseline;
      gap: var(--space-1);
      margin-bottom: 2px;
    }
    .name {
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      color: var(--cl-name);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 70%;
    }
    .time {
      margin-left: auto;
      font-size: var(--text-2xs);
      color: var(--cl-muted);
      flex-shrink: 0;
    }

    .text {
      font-size: var(--text-sm);
      color: var(--cl-text);
      line-height: 1.5;
      word-break: break-word;
      margin: 0;
      padding: 3px var(--space-2);
      border-radius: var(--radius-md);
      background: var(--cl-bg);
      display: inline-block;
      max-width: 100%;
    }

  `],
})
export class CaptionListComponent {
  readonly captions = input<readonly CaptionEntry[]>([]);
  formatTime = formatTime;
}
