import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CacheService {

  private cache: { [key: string]: { data: any; timestamp: number } } = {};
  private maxCacheSize = 50;

  // Bump the version suffix to invalidate every cached entry after a change to
  // what/how we cache (e.g. a new extraction schema shape). Old blobs under a
  // previous key are simply never read.
  private static readonly STORAGE_KEY = 'cache:v2';

  constructor() {
    // Load the cache from localStorage
    const cacheString = localStorage.getItem(CacheService.STORAGE_KEY);
    if (cacheString) {
      try {
        this.cache = JSON.parse(cacheString);
      } catch {
        this.cache = {};
      }
    }
    // Drop the legacy, unversioned cache so it doesn't waste quota.
    localStorage.removeItem('cache');
  }

  addToCache(params: any, value: any) {
    const key = this.cacheKey(params);
    this.cache[key] = { data: value, timestamp: Date.now() };
    this.checkCacheSize();
    this.persist();
  }

  getFromCache(params: any): any {
    const key = this.cacheKey(params);
    const cachedData = this.cache[key];
    if (cachedData) {
      // Update recency in memory only. Persisting on every read meant
      // re-serializing the whole cache to localStorage on each hit
      // (synchronous and O(cache size)); recency across reloads isn't worth it.
      cachedData.timestamp = Date.now();
      return cachedData.data;
    }
    return null;
  }

  clearCache() {
    this.cache = {};
    localStorage.removeItem(CacheService.STORAGE_KEY);
  }

  private persist() {
    try {
      localStorage.setItem(CacheService.STORAGE_KEY, JSON.stringify(this.cache));
    } catch {
      // Likely QuotaExceededError — evict the oldest entry and retry once.
      const oldest = this.oldestKey();
      if (oldest) {
        delete this.cache[oldest];
        try {
          localStorage.setItem(CacheService.STORAGE_KEY, JSON.stringify(this.cache));
        } catch {
          // Give up silently; caching is best-effort.
        }
      }
    }
  }

  private checkCacheSize() {
    // If the cache exceeds the maximum number of elements, remove the oldest.
    if (Object.keys(this.cache).length > this.maxCacheSize) {
      const oldest = this.oldestKey();
      if (oldest) {
        delete this.cache[oldest];
      }
    }
  }

  private oldestKey(): string {
    return Object.keys(this.cache).reduce(
      (oldest, key) => (!oldest || this.cache[key].timestamp < this.cache[oldest].timestamp ? key : oldest),
      ''
    );
  }

  /**
   * Collision-proof cache key: the full canonical JSON of the params. The
   * previous 32-bit string hash could collide and return the wrong cached
   * result; keys built from object literals with a fixed property order
   * serialize deterministically, so equal params always produce equal keys.
   */
  private cacheKey(params: any): string {
    return JSON.stringify(params);
  }
}
