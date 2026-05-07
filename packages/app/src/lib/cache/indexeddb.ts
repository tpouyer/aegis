/**
 * IndexedDB-backed cache store with TTL-based expiration.
 *
 * Used for Jira API caching (boards, issues, workflow metadata)
 * and other persistent browser-side caches.
 *
 * TTL strategy from design doc section 5.5:
 *   - Board configurations:       1 hour
 *   - Workflow/status metadata:    24 hours
 *   - User/team/component lists:   1 hour
 *   - Issue snapshots:             60 seconds
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

export class CacheStore {
  private dbName: string
  private storeName: string
  private dbPromise: Promise<IDBDatabase> | null = null

  constructor(dbName: string, storeName: string) {
    this.dbName = dbName
    this.storeName = storeName
  }

  /**
   * Open (or reuse) the IndexedDB database connection.
   */
  private getDb(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise
    }

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1)

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName)
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => {
        this.dbPromise = null
        reject(request.error)
      }
    })

    return this.dbPromise
  }

  /**
   * Get a value by key. Returns null if the key is missing or the entry
   * has expired.
   */
  async get<T>(key: string): Promise<T | null> {
    const db = await this.getDb()

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly')
      const store = tx.objectStore(this.storeName)
      const request = store.get(key)

      request.onsuccess = () => {
        const entry = request.result as CacheEntry<T> | undefined

        if (!entry) {
          resolve(null)
          return
        }

        if (Date.now() >= entry.expiresAt) {
          // Entry has expired — return null and schedule cleanup
          resolve(null)
          return
        }

        resolve(entry.value)
      }

      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Set a value with a TTL (time-to-live) in milliseconds.
   */
  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    const db = await this.getDb()
    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + ttlMs,
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite')
      const store = tx.objectStore(this.storeName)
      const request = store.put(entry, key)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Delete a specific key from the cache.
   */
  async delete(key: string): Promise<void> {
    const db = await this.getDb()

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite')
      const store = tx.objectStore(this.storeName)
      const request = store.delete(key)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Clear all entries from the cache store.
   */
  async clear(): Promise<void> {
    const db = await this.getDb()

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite')
      const store = tx.objectStore(this.storeName)
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Check if a key exists AND is not expired.
   */
  async has(key: string): Promise<boolean> {
    const value = await this.get(key)
    return value !== null
  }

  /**
   * Get multiple values by key. Returns a Map of key -> value for
   * entries that exist and are not expired.
   */
  async getMany<T>(keys: string[]): Promise<Map<string, T>> {
    const db = await this.getDb()
    const results = new Map<string, T>()

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly')
      const store = tx.objectStore(this.storeName)
      let remaining = keys.length

      if (remaining === 0) {
        resolve(results)
        return
      }

      for (const key of keys) {
        const request = store.get(key)

        request.onsuccess = () => {
          const entry = request.result as CacheEntry<T> | undefined

          if (entry && Date.now() < entry.expiresAt) {
            results.set(key, entry.value)
          }

          remaining--
          if (remaining === 0) {
            resolve(results)
          }
        }

        request.onerror = () => reject(request.error)
      }
    })
  }

  /**
   * Set multiple entries in a single transaction.
   */
  async setMany<T>(entries: Array<{ key: string; value: T; ttlMs: number }>): Promise<void> {
    const db = await this.getDb()

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite')
      const store = tx.objectStore(this.storeName)

      for (const { key, value, ttlMs } of entries) {
        const cacheEntry: CacheEntry<T> = {
          value,
          expiresAt: Date.now() + ttlMs,
        }
        store.put(cacheEntry, key)
      }

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  /**
   * Remove all expired entries from the store.
   * Returns the count of evicted entries.
   */
  async evictExpired(): Promise<number> {
    const db = await this.getDb()
    const now = Date.now()

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite')
      const store = tx.objectStore(this.storeName)
      const cursorRequest = store.openCursor()
      let evicted = 0

      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result
        if (!cursor) {
          resolve(evicted)
          return
        }

        const entry = cursor.value as CacheEntry<unknown>
        if (entry && now >= entry.expiresAt) {
          cursor.delete()
          evicted++
        }

        cursor.continue()
      }

      cursorRequest.onerror = () => reject(cursorRequest.error)
    })
  }
}
