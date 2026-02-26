<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useLogger } from '~/composables/useLogger'

const { logs, clearLogs } = useLogger()

const expanded = ref(false)
const logContainer = ref<HTMLElement | null>(null)

const TYPE_COLORS: Record<string, string> = {
  error: '#ef4444',
  success: '#22c55e',
  blockchain: '#8b5cf6',
  warning: '#f59e0b',
  info: '#3b82f6',
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour12: false })
}

// Auto-scroll to bottom on new entries
watch(
  () => logs.value.length,
  async () => {
    if (expanded.value) {
      await nextTick()
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight
      }
    }
  }
)
</script>

<template>
  <!-- Toggle button -->
  <button
    @click="expanded = !expanded"
    class="fixed bottom-4 right-4 z-[99990] w-8 h-8 rounded-full bg-gray-800 text-white text-xs flex items-center justify-center shadow-lg hover:bg-gray-700 transition-colors"
    :class="{ 'bg-blue-600 hover:bg-blue-500': expanded }"
    title="Toggle debug panel"
  >
    {{ expanded ? 'X' : logs.length }}
  </button>

  <!-- Panel -->
  <div
    v-if="expanded"
    class="fixed bottom-14 right-4 z-[99990] w-96 max-w-[90vw] bg-gray-900 text-white rounded-lg shadow-2xl border border-gray-700 flex flex-col"
    style="max-height: 50vh"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-gray-700">
      <span class="text-xs font-semibold text-gray-400">Debug Logs ({{ logs.length }})</span>
      <button
        @click="clearLogs"
        class="text-xs text-gray-500 hover:text-white transition-colors"
      >
        Clear
      </button>
    </div>

    <!-- Log list -->
    <div
      ref="logContainer"
      class="flex-1 overflow-y-auto p-2 space-y-0.5 text-xs font-mono"
    >
      <div v-if="logs.length === 0" class="text-gray-600 text-center py-4">
        No logs yet
      </div>
      <div
        v-for="(log, i) in logs"
        :key="i"
        class="flex gap-2 leading-relaxed"
      >
        <span class="text-gray-600 flex-shrink-0">{{ formatTime(log.timestamp) }}</span>
        <span
          class="break-all"
          :style="{ color: TYPE_COLORS[log.type] || '#9ca3af' }"
        >
          {{ log.message }}
        </span>
      </div>
    </div>
  </div>
</template>
