<template>
  <div class="fixed inset-0 flex items-center justify-center p-4 overflow-hidden">
    <!-- Animated gradient background -->
    <div class="gradient-bg absolute inset-0 -z-10" />

    <div class="max-w-3xl w-full text-center relative z-10 flex flex-col items-center gap-6 md:gap-8">
      <!-- Hero -->
      <div>
        <h1 class="text-6xl sm:text-7xl md:text-9xl font-black tracking-tight text-white hero-title leading-none">
          sk3chy
        </h1>
        <p class="text-lg md:text-2xl text-white/60 font-medium mt-2">
          Draw. Guess. Win.
        </p>
      </div>

      <!-- User greeting or Get Started -->
      <div v-if="keys.username.value" class="text-base font-semibold text-green-400">
        Welcome back, {{ keys.username.value }}
      </div>
      <button
        v-else-if="keys.initialized.value && !keys.isInHost.value"
        @click="showOnboarding = true"
        class="px-6 py-2 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 hover:text-white text-sm font-medium transition-all backdrop-blur-sm"
      >
        Set up profile
      </button>

      <!-- Play Now CTA -->
      <button
        @click="playNow"
        class="play-now-btn inline-flex items-center gap-3 px-10 py-4 bg-white text-black font-bold text-lg rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_rgba(255,255,255,0.15)]"
      >
        Play Now
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
      </button>

      <!-- Room Cards + Custom — compact row -->
      <div class="flex items-center gap-3 flex-wrap justify-center">
        <NuxtLink
          v-for="room in rooms"
          :key="room.id"
          :to="`/play/${room.id}`"
          class="group flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 hover:border-white/20 transition-all"
        >
          <span class="w-2 h-2 rounded-full bg-green-400" />
          <span class="text-sm font-semibold text-white/70 group-hover:text-white transition-colors">Room {{ room.id }}</span>
        </NuxtLink>

        <!-- Inline custom room -->
        <div class="flex items-center gap-1.5 px-2 py-1.5 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
          <input
            v-model="customRoom"
            placeholder="#"
            type="number"
            class="w-12 bg-transparent border-none text-sm text-white/70 placeholder-white/30 text-center outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            @keyup.enter="joinCustomRoom"
          />
          <button
            @click="joinCustomRoom"
            :disabled="!customRoom"
            class="text-xs text-white/40 hover:text-white disabled:opacity-30 transition-colors px-1"
          >
            Go
          </button>
        </div>
      </div>
    </div>

    <!-- Bottom subtle badge -->
    <div class="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
      <span class="text-[10px] text-white/15 tracking-wide">Built on Polkadot</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useBrowserKeys } from '~/composables/useBrowserKeys'

const keys = useBrowserKeys()
const showOnboarding = useState<boolean>('showOnboarding')
const customRoom = ref('')
const router = useRouter()

const rooms = [
  { id: 1 },
  { id: 2 },
  { id: 3 },
]

onMounted(() => {
  keys.init()
  // When embedded in a host, skip the landing page and go straight to a game room
  if (keys.isInHost.value) {
    router.push('/play/1')
  }
})

function playNow() {
  router.push('/play/1')
}

function joinCustomRoom() {
  if (customRoom.value) {
    router.push(`/play/${customRoom.value}`)
  }
}
</script>

<style scoped>
.gradient-bg {
  background: linear-gradient(135deg, #0a0a0a 0%, #1a0a2e 25%, #0d1b2a 50%, #0a2a1a 75%, #0a0a0a 100%);
  background-size: 400% 400%;
  animation: gradient-shift 15s ease infinite;
}

@keyframes gradient-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.hero-title {
  background: linear-gradient(135deg, #fff 0%, #a78bfa 50%, #60a5fa 100%);
  background-size: 200% 200%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: title-gradient 4s ease infinite;
}

@keyframes title-gradient {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.play-now-btn {
  animation: pulse-glow 3s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 40px rgba(255,255,255,0.15); }
  50% { box-shadow: 0 0 60px rgba(255,255,255,0.25), 0 0 80px rgba(167,139,250,0.1); }
}
</style>
