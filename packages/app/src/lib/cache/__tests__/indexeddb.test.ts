import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CacheStore } from '../indexeddb'

/**
 * In-memory mock for IndexedDB.
 *
 * This provides just enough of the IDB API for CacheStore to work
 * without requiring a real browser IndexedDB implementation.
 */

class MockIDBObjectStore {
  private data = new Map<string, unknown>()

  get(key: string) {
    return mockRequest(this.data.get(key))
  }

  put(value: unknown, key: string) {
    this.data.set(key, value)
    return mockRequest(undefined)
  }

  delete(key: string) {
    this.data.delete(key)
    return mockRequest(undefined)
  }

  clear() {
    this.data.clear()
    return mockRequest(undefined)
  }

  openCursor() {
    const entries = Array.from(this.data.entries())
    let index = 0
    const store = this

    const cursorRequest = {
      result: null as unknown,
      onsuccess: null as ((event?: unknown) => void) | null,
      onerror: null as ((event?: unknown) => void) | null,
    }

    // Schedule cursor iteration
    queueMicrotask(() => {
      function advance() {
        if (index < entries.length) {
          const [key, value] = entries[index]
          cursorRequest.result = {
            key,
            value,
            delete: () => {
              store.data.delete(key)
            },
            continue: () => {
              index++
              queueMicrotask(advance)
            },
          }
        } else {
          cursorRequest.result = null
        }
        cursorRequest.onsuccess?.()
      }
      advance()
    })

    return cursorRequest
  }
}

class MockIDBTransaction {
  private stores: Map<string, MockIDBObjectStore>
  oncomplete: ((event?: unknown) => void) | null = null
  onerror: ((event?: unknown) => void) | null = null
  error: Error | null = null

  constructor(stores: Map<string, MockIDBObjectStore>) {
    this.stores = stores
    // Auto-complete the transaction on next microtask
    queueMicrotask(() => {
      this.oncomplete?.()
    })
  }

  objectStore(name: string): MockIDBObjectStore {
    const store = this.stores.get(name)
    if (!store) {
      throw new Error(`Object store "${name}" not found`)
    }
    return store
  }
}

class MockIDBDatabase {
  objectStoreNames: { contains: (name: string) => boolean }
  private stores = new Map<string, MockIDBObjectStore>()

  constructor() {
    const stores = this.stores
    this.objectStoreNames = {
      contains: (name: string) => stores.has(name),
    }
  }

  createObjectStore(name: string): MockIDBObjectStore {
    const store = new MockIDBObjectStore()
    this.stores.set(name, store)
    return store
  }

  transaction(_storeName: string, _mode?: string): MockIDBTransaction {
    return new MockIDBTransaction(this.stores)
  }
}

function mockRequest(result: unknown) {
  const request = {
    result,
    onsuccess: null as ((event?: unknown) => void) | null,
    onerror: null as ((event?: unknown) => void) | null,
    error: null as Error | null,
  }

  queueMicrotask(() => {
    request.onsuccess?.()
  })

  return request
}

// Install the global mock
function installIndexedDBMock() {
  const databases = new Map<string, MockIDBDatabase>()

  const mockIndexedDB = {
    open(name: string, _version?: number) {
      let db = databases.get(name)
      if (!db) {
        db = new MockIDBDatabase()
        databases.set(name, db)
      }

      const request = {
        result: db,
        onupgradeneeded: null as ((event?: unknown) => void) | null,
        onsuccess: null as ((event?: unknown) => void) | null,
        onerror: null as ((event?: unknown) => void) | null,
        error: null as Error | null,
      }

      queueMicrotask(() => {
        request.onupgradeneeded?.()
        queueMicrotask(() => {
          request.onsuccess?.()
        })
      })

      return request
    },
    deleteDatabase(name: string) {
      databases.delete(name)
      return mockRequest(undefined)
    },
  }

  // @ts-expect-error — replacing global indexedDB with mock
  globalThis.indexedDB = mockIndexedDB

  return () => {
    databases.clear()
  }
}

describe('CacheStore', () => {
  let store: CacheStore
  let cleanup: () => void

  beforeEach(() => {
    cleanup = installIndexedDBMock()
    store = new CacheStore('test-db', 'test-store')
  })

  afterEach(() => {
    cleanup()
  })

  describe('set and get', () => {
    it('stores and retrieves a value', async () => {
      await store.set('key1', { name: 'test' }, 60_000)
      const result = await store.get<{ name: string }>('key1')
      expect(result).toEqual({ name: 'test' })
    })

    it('stores and retrieves primitive values', async () => {
      await store.set('num', 42, 60_000)
      const result = await store.get<number>('num')
      expect(result).toBe(42)
    })

    it('overwrites existing values', async () => {
      await store.set('key1', 'first', 60_000)
      await store.set('key1', 'second', 60_000)
      const result = await store.get<string>('key1')
      expect(result).toBe('second')
    })
  })

  describe('get', () => {
    it('returns null for missing key', async () => {
      const result = await store.get('nonexistent')
      expect(result).toBeNull()
    })

    it('returns null for expired entry', async () => {
      // Use vi.useFakeTimers to simulate time passing
      vi.useFakeTimers()
      const now = Date.now()

      await store.set('expiring', 'value', 1000) // 1 second TTL

      // Advance time past TTL
      vi.setSystemTime(now + 2000)

      const result = await store.get('expiring')
      expect(result).toBeNull()

      vi.useRealTimers()
    })
  })

  describe('has', () => {
    it('returns true for existing non-expired entry', async () => {
      await store.set('exists', 'yes', 60_000)
      expect(await store.has('exists')).toBe(true)
    })

    it('returns false for missing entry', async () => {
      expect(await store.has('nope')).toBe(false)
    })

    it('returns false for expired entry', async () => {
      vi.useFakeTimers()
      const now = Date.now()

      await store.set('expiring', 'value', 500)
      vi.setSystemTime(now + 1000)

      expect(await store.has('expiring')).toBe(false)

      vi.useRealTimers()
    })
  })

  describe('delete', () => {
    it('removes an entry', async () => {
      await store.set('key1', 'value', 60_000)
      await store.delete('key1')
      const result = await store.get('key1')
      expect(result).toBeNull()
    })

    it('does not throw when deleting a nonexistent key', async () => {
      await expect(store.delete('nonexistent')).resolves.toBeUndefined()
    })
  })

  describe('clear', () => {
    it('removes all entries', async () => {
      await store.set('key1', 'val1', 60_000)
      await store.set('key2', 'val2', 60_000)
      await store.set('key3', 'val3', 60_000)

      await store.clear()

      expect(await store.get('key1')).toBeNull()
      expect(await store.get('key2')).toBeNull()
      expect(await store.get('key3')).toBeNull()
    })
  })

  describe('getMany', () => {
    it('returns a Map of existing non-expired entries', async () => {
      await store.set('a', 1, 60_000)
      await store.set('b', 2, 60_000)

      const result = await store.getMany<number>(['a', 'b', 'c'])
      expect(result.size).toBe(2)
      expect(result.get('a')).toBe(1)
      expect(result.get('b')).toBe(2)
      expect(result.has('c')).toBe(false)
    })

    it('returns empty Map for empty keys array', async () => {
      const result = await store.getMany([])
      expect(result.size).toBe(0)
    })
  })

  describe('setMany', () => {
    it('sets multiple entries in a single transaction', async () => {
      await store.setMany([
        { key: 'x', value: 10, ttlMs: 60_000 },
        { key: 'y', value: 20, ttlMs: 60_000 },
        { key: 'z', value: 30, ttlMs: 60_000 },
      ])

      expect(await store.get<number>('x')).toBe(10)
      expect(await store.get<number>('y')).toBe(20)
      expect(await store.get<number>('z')).toBe(30)
    })
  })

  describe('evictExpired', () => {
    it('removes only expired entries and returns count', async () => {
      vi.useFakeTimers()
      const now = Date.now()

      await store.set('short', 'expires-soon', 500)
      await store.set('long', 'stays', 60_000)

      // Advance past the short TTL but not the long one
      vi.setSystemTime(now + 1000)

      const evicted = await store.evictExpired()
      expect(evicted).toBe(1)

      // The short-lived entry should be gone
      expect(await store.get('short')).toBeNull()
      // The long-lived entry should remain
      expect(await store.get('long')).toBe('stays')

      vi.useRealTimers()
    })

    it('returns 0 when no entries are expired', async () => {
      await store.set('fresh', 'value', 60_000)
      const evicted = await store.evictExpired()
      expect(evicted).toBe(0)
    })
  })
})
