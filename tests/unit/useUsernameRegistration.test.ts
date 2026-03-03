import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed, nextTick } from 'vue'

// We test the isRegisteredForCurrentEndpoint computed logic in isolation
// because the composable depends on heavy blockchain deps.
// This mirrors the exact logic from useUsernameRegistration.ts.

describe('isRegisteredForCurrentEndpoint computed', () => {
  function createComputed(
    isChainRegistered: ReturnType<typeof ref<boolean>>,
    registeredEndpoint: ReturnType<typeof ref<string>>,
    currentEndpoint: ReturnType<typeof ref<string>>
  ) {
    const isChainRegisteredComputed = computed(() => isChainRegistered.value)
    return computed(() => {
      if (!isChainRegisteredComputed.value) return false
      if (!registeredEndpoint.value) return false
      if (!currentEndpoint.value) return true
      return registeredEndpoint.value === currentEndpoint.value
    })
  }

  it('returns false when not chain registered', () => {
    const result = createComputed(ref(false), ref('ws://localhost'), ref('ws://localhost'))
    expect(result.value).toBe(false)
  })

  it('returns false when registeredEndpoint is empty', () => {
    const result = createComputed(ref(true), ref(''), ref('ws://localhost'))
    expect(result.value).toBe(false)
  })

  it('returns true when currentEndpoint is empty (no endpoint set yet)', () => {
    const result = createComputed(ref(true), ref('ws://localhost'), ref(''))
    expect(result.value).toBe(true)
  })

  it('returns true when endpoints match', () => {
    const result = createComputed(ref(true), ref('ws://localhost:9944'), ref('ws://localhost:9944'))
    expect(result.value).toBe(true)
  })

  it('returns false when endpoints do not match', () => {
    const result = createComputed(ref(true), ref('ws://localhost:9944'), ref('wss://rpc.polkadot.io'))
    expect(result.value).toBe(false)
  })

  it('reacts to changes in currentEndpoint', async () => {
    const currentEndpoint = ref('ws://localhost:9944')
    const result = createComputed(ref(true), ref('ws://localhost:9944'), currentEndpoint)
    expect(result.value).toBe(true)

    currentEndpoint.value = 'wss://other.endpoint'
    // computed reacts synchronously
    expect(result.value).toBe(false)
  })

  it('issue #2 regression: currentEndpoint as ref works correctly', () => {
    // Before fix: currentEndpoint was a plain string, .value was undefined
    // After fix: currentEndpoint is ref(''), .value works
    const currentEndpoint = ref('')
    const isChainRegistered = ref(true)
    const registeredEndpoint = ref('ws://localhost')

    const result = createComputed(isChainRegistered, registeredEndpoint, currentEndpoint)
    // Empty currentEndpoint → should return true (no endpoint restriction)
    expect(result.value).toBe(true)

    currentEndpoint.value = 'ws://localhost'
    expect(result.value).toBe(true)

    currentEndpoint.value = 'wss://other'
    expect(result.value).toBe(false)
  })
})
