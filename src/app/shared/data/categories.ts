export interface CategoryTopic {
  readonly id: number;
  readonly name: string;
  readonly categoryId: number;
}

export interface Category {
  readonly id: number;
  readonly name: string;
  readonly bgColor: string | null;
  readonly fontColor: string | null;
  readonly topics: readonly CategoryTopic[];
}
