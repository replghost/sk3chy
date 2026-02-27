<template>
  <!-- Floating minimal nav — only shows on non-play pages or as a tiny pill on play pages -->
  <div class="fixed top-0 left-0 right-0 z-50 pointer-events-none p-3 flex items-start justify-between">
    <!-- Left: Logo/home -->
    <NuxtLink
      to="/"
      class="pointer-events-auto"
      :class="isPlayPage
        ? 'opacity-0 hover:opacity-100 transition-opacity duration-300'
        : ''"
    >
      <div
        class="px-3 py-1.5 rounded-full backdrop-blur-md transition-all"
        :class="isPlayPage
          ? 'bg-black/40 hover:bg-black/60'
          : 'bg-black/30 hover:bg-black/50'"
      >
        <span class="text-sm font-bold text-white/80 hover:text-white transition-colors">sk3tchy</span>
      </div>
    </NuxtLink>

    <!-- Right: User identity pill -->
    <div class="pointer-events-auto" v-if="!isPlayPage">
      <div v-if="keys.username.value" class="px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-md">
        <span class="text-sm text-white/60 truncate max-w-[120px] inline-block">
          {{ keys.username.value }}
        </span>
      </div>
      <button
        v-else-if="keys.initialized.value"
        @click="showOnboarding = true"
        class="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-sm text-white/60 hover:text-white hover:bg-white/20 transition-all"
      >
        Set up
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useBrowserKeys } from '~/composables/useBrowserKeys'

const route = useRoute()
const keys = useBrowserKeys()
const showOnboarding = useState<boolean>('showOnboarding')

const isPlayPage = computed(() => route.path.startsWith('/play/'))

onMounted(() => keys.init())
</script>
