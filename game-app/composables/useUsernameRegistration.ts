import { ref, computed } from 'vue'
import {
  registerUsername,
  checkUsernameAvailability,
  pollForRegistration,
  validateUsername,
  deriveAttestationParamsRaw,
} from '~/lib/usernameRegistration'
import { setEndpoint, disconnectBlockchainClient } from '~/lib/blockchainClient'

type RegistrationStatus = 'idle' | 'checking' | 'registering' | 'polling' | 'done' | 'error'
type AvailabilityStatus = 'AVAILABLE' | 'TAKEN' | 'INVALID' | null

const STORAGE_KEY_FULL_USERNAME = 'sk3tchy-full-username'
const STORAGE_KEY_REGISTERED = 'sk3tchy-registered'

// Module-level state (singleton)
const status = ref<RegistrationStatus>('idle')
const errorMessage = ref('')
const availabilityStatus = ref<AvailabilityStatus>(null)
const fullUsername = ref('')
const isRegistered = computed(() => status.value === 'done' || !!fullUsername.value)

let checkTimeout: ReturnType<typeof setTimeout> | null = null

function withTimeout<T>(promise: Promise<T>, ms: number, message = 'Timeout'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ])
}

export function useUsernameRegistration() {
  function init(endpoint?: string) {
    if (endpoint) {
      setEndpoint(endpoint)
    }
    // Restore from localStorage
    const stored = localStorage.getItem(STORAGE_KEY_FULL_USERNAME)
    if (stored) {
      fullUsername.value = stored
      status.value = 'done'
    }
  }

  /**
   * Debounced on-chain availability check
   */
  function checkAvailability(username: string) {
    if (checkTimeout) clearTimeout(checkTimeout)
    availabilityStatus.value = null

    const { valid, error } = validateUsername(username)
    if (!valid) {
      availabilityStatus.value = 'INVALID'
      errorMessage.value = error || 'Invalid username'
      return
    }

    status.value = 'checking'
    errorMessage.value = ''

    checkTimeout = setTimeout(async () => {
      try {
        const result = await withTimeout(
          checkUsernameAvailability([username]),
          5000,
          'Chain unavailable'
        )
        availabilityStatus.value = result[username] || null
        status.value = 'idle'
      } catch (err) {
        console.warn('Availability check failed (previewnet may be down):', err)
        disconnectBlockchainClient()
        availabilityStatus.value = null
        status.value = 'idle'
        errorMessage.value = 'Could not check availability — chain may be offline'
      }
    }, 600)
  }

  /**
   * Full registration flow: register on-chain -> poll -> save
   */
  async function register(mnemonic: string, username: string) {
    const { valid, error } = validateUsername(username)
    if (!valid) {
      errorMessage.value = error || 'Invalid username'
      status.value = 'error'
      return
    }

    status.value = 'registering'
    errorMessage.value = ''

    try {
      const response = await registerUsername(mnemonic, username)
      fullUsername.value = response.username

      // Poll for on-chain confirmation
      status.value = 'polling'
      const rawParams = await deriveAttestationParamsRaw(mnemonic, response.username)
      await pollForRegistration(
        response.username,
        rawParams.candidateAccountId,
        30
      )

      // Save to localStorage
      localStorage.setItem(STORAGE_KEY_FULL_USERNAME, response.username)
      localStorage.setItem(STORAGE_KEY_REGISTERED, 'true')
      status.value = 'done'
    } catch (err) {
      console.error('Registration failed:', err)
      errorMessage.value = err instanceof Error ? err.message : 'Registration failed'
      status.value = 'error'

      // Graceful fallback: save as local-only username
      if (fullUsername.value) {
        localStorage.setItem(STORAGE_KEY_FULL_USERNAME, fullUsername.value)
      }
    }
  }

  /**
   * Use local-only mode (skip on-chain registration)
   */
  function useLocalOnly(username: string) {
    fullUsername.value = username
    localStorage.setItem(STORAGE_KEY_FULL_USERNAME, username)
    status.value = 'done'
  }

  function reset() {
    status.value = 'idle'
    errorMessage.value = ''
    availabilityStatus.value = null
    fullUsername.value = ''
    localStorage.removeItem(STORAGE_KEY_FULL_USERNAME)
    localStorage.removeItem(STORAGE_KEY_REGISTERED)
  }

  return {
    status,
    errorMessage,
    availabilityStatus,
    fullUsername,
    isRegistered,
    init,
    checkAvailability,
    register,
    useLocalOnly,
    reset,
  }
}
