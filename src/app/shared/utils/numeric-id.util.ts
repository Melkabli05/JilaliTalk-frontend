export const asNumericPeerId = (value: string | number): number =>
  typeof value === 'number' ? value : Number(value);
