<template>
  <header class="sticky top-0 z-50 backdrop-blur-lg bg-white/90 dark:bg-neutral-950/90 border-b border-neutral-200 dark:border-neutral-800 shadow-sm">
    <UContainer>
      <div class="flex items-center justify-between h-14 md:h-16 px-2 md:px-0">
        <div class="flex items-center gap-2">
          <!-- Mobile menu dropdown - left side -->
          <UPopover :popper="{ placement: 'bottom-start' }" class="md:hidden">
            <UButton
              icon="i-heroicons-bars-3"
              variant="ghost"
              color="gray"
              size="sm"
            />

            <template #panel="{ close }">
              <div class="p-3 w-64 space-y-3">
                <!-- Quick Rooms -->
                <div class="space-y-1">
                  <p class="text-xs font-medium text-gray-500 dark:text-gray-400 px-2">Quick Rooms</p>
                  <UButton
                    variant="ghost"
                    to="/play/1"
                    size="sm"
                    color="gray"
                    block
                    class="justify-start"
                    @click="close"
                  >
                    <template #leading>
                      <UIcon name="i-heroicons-user-group" />
                    </template>
                    Room 1
                  </UButton>
                  <UButton
                    variant="ghost"
                    to="/play/2"
                    size="sm"
                    color="gray"
                    block
                    class="justify-start"
                    @click="close"
                  >
                    <template #leading>
                      <UIcon name="i-heroicons-user-group" />
                    </template>
                    Room 2
                  </UButton>
                  <UButton
                    variant="ghost"
                    to="/play/3"
                    size="sm"
                    color="gray"
                    block
                    class="justify-start"
                    @click="close"
                  >
                    <template #leading>
                      <UIcon name="i-heroicons-user-group" />
                    </template>
                    Room 3
                  </UButton>
                </div>

                <UDivider />

                <!-- Enter Room -->
                <div>
                  <label class="block text-xs font-medium mb-1.5 text-gray-700 dark:text-gray-300">Enter Room</label>
                  <div class="flex gap-2">
                    <UInput
                      v-model="customRoomId"
                      placeholder="Room ID"
                      size="sm"
                      class="flex-1"
                      @keydown.enter="() => { navigateToRoom(customRoomId); close(); }"
                    />
                    <UButton
                      @click="() => { navigateToRoom(customRoomId); close(); }"
                      :disabled="!customRoomId"
                      size="sm"
                      color="primary"
                    >
                      Go
                    </UButton>
                  </div>
                </div>
              </div>
            </template>
          </UPopover>

          <NuxtLink
            to="/"
            class="text-lg md:text-xl font-bold text-neutral-900 dark:text-white hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
          >
            sk3chy
          </NuxtLink>
        </div>

        <nav class="flex items-center gap-1 md:gap-2">
          <!-- Room buttons - hidden on mobile -->
          <UButton
            variant="ghost"
            to="/play/1"
            size="sm"
            color="gray"
            class="hidden md:inline-flex"
            :class="{ 'underline decoration-2 underline-offset-8': currentPath.startsWith('/play/1') }"
          >
            Room 1
          </UButton>
          <UButton
            variant="ghost"
            to="/play/2"
            size="sm"
            color="gray"
            class="hidden md:inline-flex"
            :class="{ 'underline decoration-2 underline-offset-8': currentPath.startsWith('/play/2') }"
          >
            Room 2
          </UButton>
          <UButton
            variant="ghost"
            to="/play/3"
            size="sm"
            color="gray"
            class="hidden md:inline-flex"
            :class="{ 'underline decoration-2 underline-offset-8': currentPath.startsWith('/play/3') }"
          >
            Room 3
          </UButton>

          <UDivider orientation="vertical" class="h-6 mx-1 md:mx-2 hidden md:block" />

          <!-- User identity -->
          <div class="flex items-center gap-2">
            <span
              v-if="keys.username.value"
              class="text-sm font-medium text-gray-600 dark:text-gray-300 truncate max-w-[120px]"
              :title="keys.username.value"
            >
              {{ keys.username.value }}
            </span>
            <UButton
              v-else-if="keys.initialized.value"
              size="xs"
              color="primary"
              variant="soft"
              @click="showOnboarding = true"
            >
              Set up
            </UButton>
          </div>
        </nav>
      </div>
    </UContainer>
  </header>
</template>

<script setup lang="ts">
import { useBrowserKeys } from '~/composables/useBrowserKeys'

const route = useRoute()
const router = useRouter()
const currentPath = computed(() => route.path)
const keys = useBrowserKeys()
const showOnboarding = useState<boolean>('showOnboarding')

onMounted(() => keys.init())

const customRoomId = ref('')

function navigateToRoom(roomId: string) {
  if (roomId) {
    router.push(`/play/${roomId}`)
    customRoomId.value = ''
  }
}
</script>
