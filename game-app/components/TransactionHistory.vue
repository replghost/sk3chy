<script setup lang="ts">
import { computed } from 'vue'

interface TransactionLog {
  hash: `0x${string}`
  type: 'createGame' | 'joinGame' | 'commitWord' | 'revealAndScore'
  timestamp: number
  status: 'pending' | 'success' | 'failed'
  error?: string
  blockNumber?: bigint
  gasUsed?: bigint
  explorerUrl: string
  details?: any
}

const props = defineProps<{
  transactions: TransactionLog[]
}>()

const emit = defineEmits<{
  clear: []
}>()

// Format timestamp
function formatTime(timestamp: number) {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return date.toLocaleDateString()
}

// Format transaction type
function formatType(type: string) {
  const types: Record<string, string> = {
    createGame: 'Create Game',
    joinGame: 'Join Game',
    commitWord: 'Commit Word',
    revealAndScore: 'Reveal & Score'
  }
  return types[type] || type
}

// Get status color
function getStatusColor(status: string) {
  switch (status) {
    case 'pending': return 'blue'
    case 'success': return 'green'
    case 'failed': return 'red'
    default: return 'gray'
  }
}

// Get status icon
function getStatusIcon(status: string) {
  switch (status) {
    case 'pending': return '⏳'
    case 'success': return '✓'
    case 'failed': return '✗'
    default: return '?'
  }
}

// Copy to clipboard
function copyHash(hash: string) {
  navigator.clipboard.writeText(hash)
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold flex items-center gap-2">
        <span>📜</span>
        <span>Transaction History</span>
        <span v-if="transactions.length > 0" class="text-sm font-normal text-gray-500">
          ({{ transactions.length }})
        </span>
      </h3>
      <UButton
        v-if="transactions.length > 0"
        @click="emit('clear')"
        size="xs"
        color="gray"
        variant="ghost"
      >
        Clear
      </UButton>
    </div>

    <div v-if="transactions.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
      <p class="text-sm">No transactions yet</p>
      <p class="text-xs mt-1">Blockchain interactions will appear here</p>
    </div>

    <div v-else class="space-y-2 max-h-96 overflow-y-auto">
      <div
        v-for="tx in transactions"
        :key="tx.hash"
        class="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <!-- Header -->
        <div class="flex items-start justify-between gap-2 mb-2">
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <span class="text-lg">{{ getStatusIcon(tx.status) }}</span>
            <div class="flex-1 min-w-0">
              <div class="font-medium text-sm">{{ formatType(tx.type) }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">{{ formatTime(tx.timestamp) }}</div>
            </div>
          </div>
          <UBadge :color="getStatusColor(tx.status)" size="xs">
            {{ tx.status }}
          </UBadge>
        </div>

        <!-- Transaction Hash -->
        <div class="flex items-center gap-2 mb-2">
          <code class="text-xs font-mono bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded flex-1 truncate">
            {{ tx.hash }}
          </code>
          <UButton
            @click="copyHash(tx.hash)"
            size="xs"
            color="gray"
            variant="ghost"
            icon="i-heroicons-clipboard-document"
            title="Copy hash"
          />
          <UButton
            :to="tx.explorerUrl"
            target="_blank"
            size="xs"
            color="gray"
            variant="ghost"
            icon="i-heroicons-arrow-top-right-on-square"
            title="View on explorer"
          />
        </div>

        <!-- Details -->
        <div v-if="tx.blockNumber || tx.gasUsed || tx.error" class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <div v-if="tx.blockNumber" class="flex items-center gap-2">
            <span class="font-medium">Block:</span>
            <span>{{ tx.blockNumber.toString() }}</span>
          </div>
          <div v-if="tx.gasUsed" class="flex items-center gap-2">
            <span class="font-medium">Gas:</span>
            <span>{{ tx.gasUsed.toString() }}</span>
          </div>
          <div v-if="tx.error" class="text-red-600 dark:text-red-400">
            <span class="font-medium">Error:</span>
            <span>{{ tx.error }}</span>
          </div>
          <div v-if="tx.details" class="text-xs opacity-75">
            <details>
              <summary class="cursor-pointer hover:underline">Details</summary>
              <pre class="mt-1 bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-x-auto">{{ JSON.stringify(tx.details, null, 2) }}</pre>
            </details>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
