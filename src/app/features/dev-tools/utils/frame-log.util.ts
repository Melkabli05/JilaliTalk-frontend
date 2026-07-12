import { describeCmd, describeFlag, type FrameLogEntry } from '@core/realtime';

export type FrameDirectionFilter = 'all' | 'in' | 'out';

export function filterFrames(
  frames: readonly FrameLogEntry[],
  direction: FrameDirectionFilter,
  query: string,
): readonly FrameLogEntry[] {
  const q = query.trim().toLowerCase();
  return frames.filter((f) => {
    if (direction !== 'all' && f.direction !== direction) return false;
    if (!q) return true;
    const haystack =
      `${f.header.cmdId} ${describeCmd(f.header.cmdId)} ${f.header.flag} ${describeFlag(f.header.flag)}`.toLowerCase();
    return haystack.includes(q);
  });
}

export function formatFrameTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

export function parseHexByte(value: string): number {
  const cleaned = value.trim().replace(/^0x/i, '');
  const parsed = parseInt(cleaned, 16);
  return Number.isFinite(parsed) ? parsed : 0;
}

export type FrameKind = 'login' | 'heartbeat' | 'message' | 'ack' | 'typing' | 'sync' | 'push' | 'other';

export function classifyFrame(cmdName: string, flagName: string): FrameKind {
  const cmd = cmdName.toUpperCase();
  if (cmd === 'LOGIN') return 'login';
  if (cmd.includes('HEARTBEAT')) return 'heartbeat';
  if (cmd === 'PRIVATE_MSG') return 'message';
  if (cmd === 'MSG_ACK') return 'ack';
  if (cmd.includes('TYPING')) return 'typing';
  if (cmd.includes('SYNC')) return 'sync';
  if (flagName.toUpperCase() === 'PUSH') return 'push';
  return 'other';
}
