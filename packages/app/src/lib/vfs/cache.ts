/**
 * Content-addressed blob cache for the VFS.
 *
 * Keys are blob SHAs — the same SHA always returns the same content,
 * so entries never go stale. We use a very long TTL (30 days) as a
 * pragmatic eviction strategy rather than disabling TTL entirely,
 * since the underlying CacheStore requires a TTL parameter.
 *
 * Namespace: aegis-vfs-blobs (separate from the Jira cache).
 */

import { CacheStore } from '@/lib/cache/indexeddb'

/** 30 days in milliseconds — effectively "never expires" for content-addressed data. */
const BLOB_TTL_MS = 30 * 24 * 60 * 60 * 1000

const blobCache = new CacheStore('aegis-vfs-blobs', 'blobs')

/**
 * Get file content by blob SHA. Returns null on cache miss.
 */
export async function getCachedBlob(sha: string): Promise<string | null> {
  return blobCache.get<string>(sha)
}

/**
 * Store file content keyed by blob SHA.
 */
export async function setCachedBlob(sha: string, content: string): Promise<void> {
  await blobCache.set(sha, content, BLOB_TTL_MS)
}

/**
 * Check if a blob is in the cache.
 */
export async function hasCachedBlob(sha: string): Promise<boolean> {
  return blobCache.has(sha)
}

/**
 * Clear the entire blob cache.
 */
export async function clearBlobCache(): Promise<void> {
  await blobCache.clear()
}
