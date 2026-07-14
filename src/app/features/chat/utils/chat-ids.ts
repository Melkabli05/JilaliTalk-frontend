export function asPeerId(value: string | number): string {
  return typeof value === 'string' ? value : String(value);
}

export function asNumericPeerId(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}