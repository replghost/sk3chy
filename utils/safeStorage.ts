/**
 * localStorage wrapper that degrades to in-memory storage.
 *
 * Sandboxed product iframes (dothost/product-view, `sandbox="allow-scripts"`)
 * run at an opaque origin where accessing `window.localStorage` throws a
 * SecurityError — the host blocks it in favor of the host bridge. Values
 * stored in memory last for the page's lifetime only.
 */

const memory = new Map<string, string>()

function nativeStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    const s = window.localStorage
    s.getItem('__sk3chy_probe__')
    return s
  } catch {
    return null
  }
}

export const safeStorage = {
  getItem(key: string): string | null {
    const s = nativeStorage()
    if (s) {
      try {
        return s.getItem(key)
      } catch {
        /* fall through to memory */
      }
    }
    return memory.has(key) ? memory.get(key)! : null
  },
  setItem(key: string, value: string): void {
    const s = nativeStorage()
    if (s) {
      try {
        s.setItem(key, value)
        return
      } catch {
        /* fall through to memory */
      }
    }
    memory.set(key, value)
  },
  removeItem(key: string): void {
    const s = nativeStorage()
    if (s) {
      try {
        s.removeItem(key)
        return
      } catch {
        /* fall through to memory */
      }
    }
    memory.delete(key)
  },
}
