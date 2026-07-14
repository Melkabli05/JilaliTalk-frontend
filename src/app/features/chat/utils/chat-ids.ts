export const asPeerId = (value: string | number): string => String(value);
export const asNumericPeerId = (value: string | number): number =>
  typeof value === 'number' ? value : Number(value);