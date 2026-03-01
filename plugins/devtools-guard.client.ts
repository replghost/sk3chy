import { defineNuxtPlugin } from '#app'

// Disable Nuxt DevTools when running inside a cross-origin iframe.
// DevTools tries to access window.parent which throws SecurityError
// and can crash the app during plugin initialization.
export default defineNuxtPlugin({
  name: 'devtools-guard',
  enforce: 'pre',
  setup() {
    if (typeof window !== 'undefined' && window.parent !== window) {
      // Signal to Nuxt DevTools that it should not initialize
      ;(window as any).__NUXT_DEVTOOLS_DISABLE__ = true
    }
  },
})
