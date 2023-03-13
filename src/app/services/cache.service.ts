import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CacheService {
  
  private cache: { [key: string]: any } = {};
  private maxCacheSize = 50;

  constructor() {
    // Load the cache from localStorage
    const cacheString = localStorage.getItem('cache');
    if (cacheString) {
      this.cache = JSON.parse(cacheString);
    }
  }

  addToCache(params: any, value: any) {
    const key = this.objectHash(params);
    this.cache[key] = { data: value, timestamp: Date.now() };
    this.checkCacheSize();
    // Save the cache to localStorage
    localStorage.setItem('cache', JSON.stringify(this.cache));
  }

  getFromCache(params: any): any {
    const key = this.objectHash(params);
    const cachedData = this.cache[key];
    if (cachedData) {
      cachedData.timestamp = Date.now(); // Update the timestamp
      localStorage.setItem('cache', JSON.stringify(this.cache));
      return cachedData.data;
    }
    return null;
  }

  clearCache() {
    this.cache = {};
    localStorage.removeItem('cache');
  }

  private checkCacheSize() {
    // If the cache has more than the maximum number of elements, remove the oldest ones
    const cacheKeys = Object.keys(this.cache);
    if (cacheKeys.length > this.maxCacheSize) {
      const oldestKey = cacheKeys.reduce((oldest, key) => {
        if (!oldest) {
          return key;
        }
        const oldestTimestamp = this.cache[oldest].timestamp;
        const currentTimestamp = this.cache[key].timestamp;
        return oldestTimestamp < currentTimestamp ? oldest : key;
      });
      delete this.cache[oldestKey];
    }
  }
  
  objectHash(obj: Record<string, unknown>): string {
    const str = JSON.stringify(obj);
    let hash = 0;
  
    for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + charCode;
      hash |= 0; // Convert to 32-bit integer
    }
  
    return hash.toString(16);
  }
  

//   objectHash(obj: any): number {
//     const str = JSON.stringify(obj);
//     var h: number = 0;
//     for (var i = 0; i < str.length; i++) {
//         h = 31 * h + str.charCodeAt(i);
//     }
//     return h & 0xFFFFFFFF
// }
}
