const COMBINING_DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

export function initialsFrom(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

export function formatClockTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .toLowerCase()
    .trim();
}

export interface SearchMatcher {
  /**
   * Checks that every whitespace-separated token of the query is a substring of at least
   * one `haystack` (case- and accent-insensitive). An empty/blank query matches everything.
   */
  matches(haystacks: readonly (string | null | undefined)[]): boolean;
  /**
   * Relevance rank for sorting search results: `0` if any haystack *starts with* the
   * normalized query, `1` otherwise (a mid-string-only match). Lower sorts first.
   */
  rank(haystacks: readonly (string | null | undefined)[]): number;
}

/**
 * Precomputes the normalized query and its tokens once, so repeated `matches`/`rank` calls
 * across many items (e.g. filtering and sorting a list) don't re-normalize the query every time.
 */
export function createSearchMatcher(query: string): SearchMatcher {
  const normalizedQuery = normalizeForSearch(query);
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);

  return {
    matches(haystacks) {
      if (tokens.length === 0) return true;
      const normalized = haystacks.filter((h): h is string => !!h).map(normalizeForSearch);
      return tokens.every((token) => normalized.some((h) => h.includes(token)));
    },
    rank(haystacks) {
      if (!normalizedQuery) return 1;
      const normalized = haystacks.filter((h): h is string => !!h).map(normalizeForSearch);
      return normalized.some((h) => h.startsWith(normalizedQuery)) ? 0 : 1;
    },
  };
}
