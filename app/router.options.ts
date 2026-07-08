import type { RouterConfig } from '@nuxt/schema'
import { createMemoryHistory } from 'vue-router'

// In sandboxed product iframes (opaque "null" origin — dothost/product-view)
// history.pushState throws a SecurityError, and vue-router's fallback is
// location.assign() — a full document navigation that the host detects as
// losing the injected product bridge. Route in memory there instead; the
// frame URL never changes, which is exactly what the sandbox requires.
export default <RouterConfig>{
  history: (base) => {
    if (typeof window !== 'undefined' && window.origin === 'null') {
      return createMemoryHistory(base)
    }
    return null
  },
}
