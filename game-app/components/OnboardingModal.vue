<template>
  <UModal v-model="isOpen" :prevent-close="true">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-semibold">
            <template v-if="step === 1">Welcome to sk3chy</template>
            <template v-else-if="requireOnChain">On-Chain Username Required</template>
            <template v-else>Choose a Username</template>
          </h3>
          <span class="text-xs text-gray-400">{{ step }}/{{ totalSteps }}</span>
        </div>
      </template>

      <!-- Step 1: Welcome & Key Generation -->
      <div v-if="step === 1" class="space-y-4">
        <p class="text-gray-600 dark:text-gray-400">
          Your account has been created. A local wallet was generated in your browser.
        </p>
        <div v-if="keys.shortAddress.value" class="p-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-center">
          <p class="text-xs text-gray-500 mb-1">Your address</p>
          <p class="font-mono text-sm">{{ keys.shortAddress.value }}</p>
        </div>
      </div>

      <!-- Step 2: Choose Username -->
      <div v-if="step === 2" class="space-y-4">
        <p class="text-gray-600 dark:text-gray-400">
          <template v-if="requireOnChain">
            Pick a username to register on-chain before joining this room.
          </template>
          <template v-else>
            Pick a username to identify yourself in games.
          </template>
        </p>

        <UInput
          v-model="usernameInput"
          placeholder="Username (7+ lowercase letters)"
          size="lg"
          :color="inputColor"
          @update:model-value="onUsernameInput"
        />

        <div class="h-5 text-sm">
          <span v-if="usernameInput && !isValidFormat" class="text-red-500">
            Must be 7+ lowercase letters (a-z)
          </span>
          <span v-else-if="registration.status.value === 'checking'" class="text-gray-400">
            Checking availability...
          </span>
          <span v-else-if="registration.availabilityStatus.value === 'AVAILABLE'" class="text-green-500">
            Available
          </span>
          <span v-else-if="registration.availabilityStatus.value === 'TAKEN'" class="text-red-500">
            Taken
          </span>
          <span v-else-if="registration.errorMessage.value && registration.status.value !== 'error'" class="text-yellow-500 text-xs">
            {{ registration.errorMessage.value }}
          </span>
        </div>

        <!-- Error state with fallback -->
        <div v-if="registration.status.value === 'error'" class="text-sm space-y-2">
          <p class="text-red-500">{{ registration.errorMessage.value }}</p>
          <UButton
            v-if="!requireOnChain"
            @click="useLocalFallback"
            size="sm"
            color="gray"
            variant="soft"
          >
            Use locally instead
          </UButton>
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-between">
          <!-- Left side -->
          <div>
            <UButton
              v-if="step === 2 && !requireOnChain"
              @click="skipUsername"
              variant="link"
              color="gray"
              size="sm"
            >
              Skip for now
            </UButton>
          </div>

          <!-- Right side -->
          <div class="flex gap-2">
            <UButton
              v-if="step === 2 && totalSteps > 1"
              @click="step = 1"
              variant="ghost"
              color="gray"
            >
              Back
            </UButton>

            <UButton
              v-if="step === 1 && totalSteps > 1"
              @click="step = 2"
              color="primary"
            >
              Next
            </UButton>

            <UButton
              v-if="step === 2 && isValidFormat"
              @click="claimUsername"
              color="primary"
              :loading="isRegistering"
              :disabled="isRegistering || registration.availabilityStatus.value === 'TAKEN'"
            >
              <template v-if="registration.status.value === 'registering'">Registering...</template>
              <template v-else-if="registration.status.value === 'polling'">Confirming...</template>
              <template v-else>Claim Username</template>
            </UButton>
          </div>
        </div>
      </template>
    </UCard>
  </UModal>
</template>

<script setup lang="ts">
import { useBrowserKeys } from '~/composables/useBrowserKeys'
import { useUsernameRegistration } from '~/composables/useUsernameRegistration'
import { useLogger } from '~/composables/useLogger'
import { validateUsername } from '~/lib/usernameRegistration'

const props = withDefaults(defineProps<{
  requireOnChain?: boolean
  chainEndpoint?: string
}>(), {
  requireOnChain: false,
  chainEndpoint: ''
})

const isOpen = defineModel<boolean>({ default: false })
const config = useRuntimeConfig()
const keys = useBrowserKeys()
const registration = useUsernameRegistration()
const { addLog } = useLogger()

const step = ref(1)
const usernameInput = ref('')
const totalSteps = computed(() => props.requireOnChain ? 1 : 2)
const requireOnChain = computed(() => props.requireOnChain)
const registrationEndpoint = computed(() => {
  return props.chainEndpoint
    || (config.public.statementStoreWs as string)
    || (config.public.peopleChainWs as string)
})

const isValidFormat = computed(() => validateUsername(usernameInput.value).valid)

const isRegistering = computed(() => {
  return registration.status.value === 'registering' || registration.status.value === 'polling'
})

const inputColor = computed(() => {
  if (!usernameInput.value) return undefined
  if (!isValidFormat.value) return 'red' as const
  if (registration.availabilityStatus.value === 'AVAILABLE') return 'green' as const
  if (registration.availabilityStatus.value === 'TAKEN') return 'red' as const
  return undefined
})

onMounted(() => {
  keys.init()
  step.value = props.requireOnChain ? 2 : 1
  registration.init(registrationEndpoint.value)
})

watch(() => props.chainEndpoint, (next) => {
  if (next) registration.init(next)
})

watch(() => props.requireOnChain, (required) => {
  if (required) step.value = 2
})

watch(isOpen, (open) => {
  if (!open) return
  registration.init(registrationEndpoint.value)
  step.value = props.requireOnChain ? 2 : 1
})

function onUsernameInput() {
  const val = usernameInput.value.toLowerCase().replace(/[^a-z]/g, '')
  usernameInput.value = val

  if (validateUsername(val).valid) {
    registration.checkAvailability(val)
  } else {
    registration.availabilityStatus.value = null
  }
}

async function claimUsername() {
  if (!keys.wallet.value?.mnemonic) return

  addLog(`Claiming username: ${usernameInput.value}`, 'blockchain')

  await registration.register(keys.wallet.value.mnemonic, usernameInput.value)

  if (registration.status.value === 'done' && registration.fullUsername.value) {
    addLog(`Username registered: ${registration.fullUsername.value}`, 'success')
    keys.setUsername(registration.fullUsername.value)
    isOpen.value = false
  }
}

function useLocalFallback() {
  const name = usernameInput.value || 'anonymous'
  registration.useLocalOnly(name)
  keys.setUsername(name)
  addLog(`Using local-only username: ${name}`, 'warning')
  isOpen.value = false
}

function skipUsername() {
  const defaultName = 'player' + Math.random().toString(36).slice(2, 6)
  registration.useLocalOnly(defaultName)
  keys.setUsername(defaultName)
  addLog(`Skipped username, using: ${defaultName}`, 'info')
  isOpen.value = false
}
</script>
