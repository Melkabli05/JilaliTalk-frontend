import { Service } from '@angular/core';

/**
 * Typed wrapper around browser localStorage with error handling.
 * Storage operations silently catch quota/errors (private browsing, unavailable storage)
 * so they never throw — callers always stay functional.
 */
@Service()
export class StorageService {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Silently ignore quota exceeded or unavailable storage
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Silently ignore
    }
  }

  clear(): void {
    try {
      localStorage.clear();
    } catch {
      // Silently ignore
    }
  }
}
