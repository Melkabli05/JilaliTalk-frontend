import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  LucideActivity,
  LucideArrowDownToLine,
  LucideArrowUpToLine,
  LucideEraser,
  LucidePlug,
  LucideRefreshCw,
  LucideSend,
  LucideWifiOff,
} from '@lucide/angular';
import { describeCmd, describeFlag, HtImConnectionService, type FrameLogEntry } from '@core/realtime';
import {
  classifyFrame,
  filterFrames,
  formatFrameTime,
  parseHexByte,
  type FrameDirectionFilter,
  type FrameKind,
} from '../../utils/frame-log.util';

@Component({
  selector: 'app-packet-inspector-page',
  imports: [
    LucideActivity,
    LucideArrowDownToLine,
    LucideArrowUpToLine,
    LucideEraser,
    LucidePlug,
    LucideRefreshCw,
    LucideSend,
    LucideWifiOff,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './packet-inspector-page.html',
  styleUrl: './packet-inspector-page.scss',
})
export class PacketInspectorPageComponent {
  private readonly im = inject(HtImConnectionService);

  protected readonly status = this.im.status;
  protected readonly frames = this.im.frames;
  protected readonly describeCmd = describeCmd;
  protected readonly describeFlag = describeFlag;
  protected readonly formatFrameTime = formatFrameTime;

  protected readonly direction = signal<FrameDirectionFilter>('all');
  protected readonly query = signal('');
  protected readonly expanded = signal<ReadonlySet<number>>(new Set());

  protected readonly visibleFrames = computed(() =>
    [...filterFrames(this.frames(), this.direction(), this.query())].reverse(),
  );

  protected readonly flagInput = signal('f0');
  protected readonly versionInput = signal(4);
  protected readonly keyTypeInput = signal(0);
  protected readonly termTypeInput = signal(1);
  protected readonly cmdIdInput = signal(0);
  protected readonly toIdInput = signal(0);
  protected readonly bodyJsonInput = signal('{}');
  protected readonly compressInput = signal(true);
  protected readonly lastIdInput = signal(0);
  protected readonly sendResult = signal<string | null>(null);

  protected connect(): void {
    this.im.connect();
  }

  protected disconnect(): void {
    this.im.disconnect();
  }

  protected clearLog(): void {
    this.im.clearFrames();
  }

  protected isExpanded(id: number): boolean {
    return this.expanded().has(id);
  }

  protected toggleExpand(id: number): void {
    this.expanded.update((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected trackFrame(_index: number, entry: FrameLogEntry): number {
    return entry.id;
  }

  protected frameKind(entry: FrameLogEntry): FrameKind {
    return classifyFrame(describeCmd(entry.header.cmdId), describeFlag(entry.header.flag));
  }

  protected onDirectionChange(value: string): void {
    this.direction.set(value as FrameDirectionFilter);
  }

  protected onQueryInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected onFlagInput(event: Event): void {
    this.flagInput.set((event.target as HTMLInputElement).value);
  }

  protected onVersionInput(event: Event): void {
    this.versionInput.set(Number((event.target as HTMLInputElement).value) || 0);
  }

  protected onKeyTypeInput(event: Event): void {
    this.keyTypeInput.set(Number((event.target as HTMLInputElement).value) || 0);
  }

  protected onTermTypeInput(event: Event): void {
    this.termTypeInput.set(Number((event.target as HTMLInputElement).value) || 0);
  }

  protected onCmdIdInput(event: Event): void {
    this.cmdIdInput.set(Number((event.target as HTMLInputElement).value) || 0);
  }

  protected onToIdInput(event: Event): void {
    this.toIdInput.set(Number((event.target as HTMLInputElement).value) || 0);
  }

  protected onBodyJsonInput(event: Event): void {
    this.bodyJsonInput.set((event.target as HTMLTextAreaElement).value);
  }

  protected onCompressChange(event: Event): void {
    this.compressInput.set((event.target as HTMLInputElement).checked);
  }

  protected onLastIdInput(event: Event): void {
    this.lastIdInput.set(Number((event.target as HTMLInputElement).value) || 0);
  }

  protected retriggerSync(): void {
    const ok = this.im.retriggerOfflineSync(this.lastIdInput());
    this.sendResult.set(ok ? `offline-sync trigger sent (last_id=${this.lastIdInput()})` : 'not connected');
  }

  protected sendRaw(): void {
    const ok = this.im.sendRawPacket({
      flag: parseHexByte(this.flagInput()),
      version: this.versionInput(),
      keyType: this.keyTypeInput(),
      termType: this.termTypeInput(),
      cmdId: this.cmdIdInput(),
      toId: this.toIdInput(),
      bodyJson: this.bodyJsonInput(),
      compress: this.compressInput(),
    });
    this.sendResult.set(ok ? 'packet sent' : 'not connected');
  }
}
