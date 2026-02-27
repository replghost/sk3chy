import { ref, computed } from 'vue'
import {
  registerUsername,
  checkUsernameAvailability,
  pollForRegistration,
  validateUsername,
  deriveAttestationParamsRaw,
  type UsernameRegistrationOptions,
} from '~/lib/usernameRegistration'
import type { RegistrationProgressUpdate } from '~/lib/blockchainClient'
import { setEndpoint, disconnectBlockchainClient } from '~/lib/blockchainClient'

type RegistrationStatus = 'idle' | 'checking' | 'registering' | 'polling' | 'done' | 'error'
type AvailabilityStatus = 'AVAILABLE' | 'TAKEN' | 'INVALID' | null

const STORAGE_KEY_FULL_USERNAME = 'sk3tchy-full-username'
const STORAGE_KEY_REGISTERED = 'sk3tchy-registered'
const STORAGE_KEY_REGISTERED_ENDPOINT = 'sk3tchy-registered-endpoint'

// Module-level state (singleton)
const status = ref<RegistrationStatus>('idle')
const errorMessage = ref('')
const availabilityStatus = ref<AvailabilityStatus>(null)
const fullUsername = ref('')
const chainRegistered = ref(false)
const registeredEndpoint = ref('')
const registrationProgress = ref(0)
const registrationProgressLabel = ref('')
const registrationEtaSeconds = ref<number | null>(null)
const isRegistered = computed(() => status.value === 'done' || !!fullUsername.value)
const isChainRegistered = computed(() => chainRegistered.value)
const isRegisteredForCurrentEndpoint = computed(() => {
  if (!isChainRegistered.value) return false
  if (!registeredEndpoint.value) return false
  if (!currentEndpoint.value) return true
  return registeredEndpoint.value === currentEndpoint.value
})

let checkTimeout: ReturnType<typeof setTimeout> | null = null
let currentEndpoint = ''

function resetProgress() {
  registrationProgress.value = 0
  registrationProgressLabel.value = ''
  registrationEtaSeconds.value = null
}

function applyProgress(progress: RegistrationProgressUpdate) {
  registrationProgress.value = Math.max(registrationProgress.value, Math.min(100, progress.percent))
  registrationProgressLabel.value = progress.label
  registrationEtaSeconds.value = progress.etaSeconds ?? null
}

function withTimeout<T>(promise: Promise<T>, ms: number, message = 'Timeout'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ])
}

export function useUsernameRegistration() {
  function init(endpoint?: string) {
    resetProgress()
    if (endpoint) {
      setEndpoint(endpoint)
      currentEndpoint = endpoint
    }
    // Restore from localStorage
    const stored = localStorage.getItem(STORAGE_KEY_FULL_USERNAME)
    const storedEndpoint = localStorage.getItem(STORAGE_KEY_REGISTERED_ENDPOINT) || ''
    registeredEndpoint.value = storedEndpoint

    chainRegistered.value = localStorage.getItem(STORAGE_KEY_REGISTERED) === 'true'
    const endpointMatches = !currentEndpoint || !storedEndpoint || storedEndpoint === currentEndpoint

    if (stored) {
      fullUsername.value = stored
      status.value = chainRegistered.value && endpointMatches ? 'done' : 'idle'
    } else {
      fullUsername.value = ''
      status.value = 'idle'
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
    registrationProgress.value = 4
    registrationProgressLabel.value = 'Preparing registration...'
    registrationEtaSeconds.value = 60

    try {
      const options: UsernameRegistrationOptions = {
        onProgress: (progress) => applyProgress(progress)
      }
      const response = await registerUsername(mnemonic, username, options)
      fullUsername.value = response.username

      // Poll for on-chain confirmation
      status.value = 'polling'
      registrationProgress.value = Math.max(registrationProgress.value, 95)
      registrationProgressLabel.value = 'Verifying username assignment...'
      registrationEtaSeconds.value = 8
      const rawParams = await deriveAttestationParamsRaw(mnemonic, response.username)
      await pollForRegistration(
        response.username,
        rawParams.candidateAccountId,
        30,
        (attempt) => {
          registrationProgress.value = Math.max(registrationProgress.value, 95 + Math.min(attempt, 4))
          registrationEtaSeconds.value = Math.max(2, 8 - attempt * 2)
        }
      )

      // Save to localStorage
      localStorage.setItem(STORAGE_KEY_FULL_USERNAME, response.username)
      localStorage.setItem(STORAGE_KEY_REGISTERED, 'true')
      chainRegistered.value = true
      if (currentEndpoint) {
        localStorage.setItem(STORAGE_KEY_REGISTERED_ENDPOINT, currentEndpoint)
        registeredEndpoint.value = currentEndpoint
      }
      registrationProgress.value = 100
      registrationProgressLabel.value = 'Registration complete'
      registrationEtaSeconds.value = 0
      status.value = 'done'
    } catch (err) {
      console.error('Registration failed:', err)
      errorMessage.value = err instanceof Error ? err.message : 'Registration failed'
      status.value = 'error'

      // Graceful fallback: save as local-only username
      if (fullUsername.value) {
        localStorage.setItem(STORAGE_KEY_FULL_USERNAME, fullUsername.value)
      }
      resetProgress()
    }
  }

  /**
   * Use local-only mode (skip on-chain registration)
   */
  function useLocalOnly(username: string) {
    fullUsername.value = username
    localStorage.setItem(STORAGE_KEY_FULL_USERNAME, username)
    localStorage.removeItem(STORAGE_KEY_REGISTERED)
    localStorage.removeItem(STORAGE_KEY_REGISTERED_ENDPOINT)
    chainRegistered.value = false
    registeredEndpoint.value = ''
    status.value = 'done'
    resetProgress()
  }

  function reset() {
    status.value = 'idle'
    errorMessage.value = ''
    availabilityStatus.value = null
    fullUsername.value = ''
    chainRegistered.value = false
    registeredEndpoint.value = ''
    localStorage.removeItem(STORAGE_KEY_FULL_USERNAME)
    localStorage.removeItem(STORAGE_KEY_REGISTERED)
    localStorage.removeItem(STORAGE_KEY_REGISTERED_ENDPOINT)
    resetProgress()
  }

  function clearChainRegistration() {
    chainRegistered.value = false
    registeredEndpoint.value = ''
    status.value = 'idle'
    localStorage.removeItem(STORAGE_KEY_REGISTERED)
    localStorage.removeItem(STORAGE_KEY_REGISTERED_ENDPOINT)
    resetProgress()
  }

  return {
    status,
    errorMessage,
    availabilityStatus,
    fullUsername,
    registrationProgress,
    registrationProgressLabel,
    registrationEtaSeconds,
    isRegistered,
    isChainRegistered,
    isRegisteredForCurrentEndpoint,
    registeredEndpoint,
    init,
    checkAvailability,
    register,
    useLocalOnly,
    clearChainRegistration,
    reset,
  }
}
