<template>
  <div class="min-h-screen flex items-center justify-center p-6 pt-12">
    <div class="max-w-4xl w-full text-center space-y-8">
      <!-- Hero Section -->
      <div class="space-y-4">
        <h1 class="text-7xl md:text-8xl font-bold tracking-tight">
          sk3chy
        </h1>
        <p class="text-xl md:text-2xl text-gray-600 dark:text-gray-400">
          Draw. Guess. Win.
        </p>
      </div>

      <!-- User greeting or Get Started -->
      <div class="max-w-xs mx-auto">
        <template v-if="keys.username.value">
          <div class="text-lg font-semibold text-green-600 dark:text-green-400">
            Welcome, {{ keys.username.value }}
          </div>
          <p v-if="keys.shortAddress.value" class="text-xs text-gray-400 mt-1">
            {{ keys.shortAddress.value }}
          </p>
        </template>
        <template v-else>
          <UButton
            @click="showOnboarding = true"
            size="xl"
            color="primary"
            variant="solid"
          >
            Get Started
          </UButton>
        </template>
      </div>

      <!-- Quick Join Rooms -->
      <div class="space-y-6">
        <h2 class="text-2xl font-semibold">Join a Room</h2>
        <div class="flex flex-wrap justify-center gap-4">
          <UButton to="/play/1" size="xl" color="primary" variant="solid" class="min-w-32 justify-center">
            Room 1
          </UButton>
          <UButton to="/play/2" size="xl" color="primary" variant="solid" class="min-w-32 justify-center">
            Room 2
          </UButton>
          <UButton to="/play/3" size="xl" color="primary" variant="solid" class="min-w-32 justify-center">
            Room 3
          </UButton>
        </div>
      </div>

      <!-- Custom Room -->
      <div class="space-y-4">
        <div class="flex items-center justify-center gap-4">
          <div class="h-px bg-gray-300 dark:bg-gray-700 flex-1 max-w-xs"></div>
          <span class="text-sm text-gray-500 dark:text-gray-400">or</span>
          <div class="h-px bg-gray-300 dark:bg-gray-700 flex-1 max-w-xs"></div>
        </div>

        <div class="flex items-center justify-center gap-3 max-w-md mx-auto">
          <UInput
            v-model="customRoom"
            placeholder="Enter room number"
            size="lg"
            type="number"
            class="flex-1"
          />
          <UButton
            @click="joinCustomRoom"
            size="lg"
            color="gray"
            :disabled="!customRoom"
          >
            Join
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useBrowserKeys } from '~/composables/useBrowserKeys'

const keys = useBrowserKeys()
const showOnboarding = useState<boolean>('showOnboarding')
const customRoom = ref('')
const router = useRouter()

onMounted(() => {
  keys.init()
})

function joinCustomRoom() {
  if (customRoom.value) {
    router.push(`/play/${customRoom.value}`)
  }
}
</script>
