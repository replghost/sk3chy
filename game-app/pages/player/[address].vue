<template>
  <div class="min-h-screen p-6">
    <div class="max-w-4xl mx-auto space-y-8">
      <!-- Back Button -->
      <UButton 
        icon="i-heroicons-arrow-left" 
        variant="ghost" 
        @click="$router.back()"
      >
        Back
      </UButton>

      <!-- Player Header -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <div class="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 class="text-3xl font-bold mb-2">Player Profile</h1>
            <p class="text-gray-600 dark:text-gray-400 font-mono text-sm">
              {{ playerAddress }}
            </p>
          </div>

          <div v-if="!loading" class="text-right">
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Wins</p>
            <p class="text-4xl font-bold text-primary">{{ totalWins }}</p>
          </div>
        </div>

        <!-- Stats Grid -->
        <div v-if="!loading" class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div class="text-center">
            <p class="text-2xl font-bold">{{ gamesHosted.length }}</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">Games Hosted</p>
          </div>
          <div class="text-center">
            <p class="text-2xl font-bold">{{ totalWins }}</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">Total Wins</p>
          </div>
          <div class="text-center">
            <p class="text-2xl font-bold">{{ avgScore }}</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">Avg Score</p>
          </div>
          <div class="text-center">
            <p class="text-2xl font-bold">{{ winRate }}%</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">Win Rate</p>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p class="mt-4 text-gray-600 dark:text-gray-400">Loading player stats...</p>
      </div>

      <!-- Games Hosted -->
      <div v-else class="space-y-4">
        <h2 class="text-2xl font-bold">Games Hosted ({{ gamesHosted.length }})</h2>

        <div v-if="gamesHosted.length === 0" class="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <p class="text-gray-600 dark:text-gray-400">No games hosted yet.</p>
        </div>

        <div v-else class="space-y-4">
          <div 
            v-for="game in gamesHosted" 
            :key="game.gameId"
            class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6"
          >
            <div class="flex items-start justify-between flex-wrap gap-4">
              <!-- Game Info -->
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-2">
                  <h3 class="text-xl font-bold">{{ game.word }}</h3>
                  <UBadge color="gray" variant="subtle">
                    Game #{{ game.gameId }}
                  </UBadge>
                </div>
                <p class="text-sm text-gray-500 dark:text-gray-500">
                  {{ formatDate(game.timestamp) }}
                </p>
              </div>

              <!-- Winners -->
              <div class="text-right">
                <p class="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                  Winners ({{ game.winners.length }})
                </p>
                <div class="space-y-1">
                  <div 
                    v-for="(winner, i) in game.winners.slice(0, 3)" 
                    :key="winner"
                    class="text-xs"
                  >
                    {{ formatAddress(winner) }}
                    <span class="text-gray-500 ml-1">({{ game.scores[i] }} pts)</span>
                  </div>
                  <p v-if="game.winners.length > 3" class="text-xs text-gray-500">
                    +{{ game.winners.length - 3 }} more
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Address } from 'viem'

const route = useRoute()
const { getGamesByHost, usePlayerWins } = useGameContract()

const playerAddress = route.params.address as Address

const loading = ref(true)
const gamesHosted = ref<any[]>([])

// Get total wins from contract
const { data: totalWinsData } = usePlayerWins(playerAddress)
const totalWins = computed(() => totalWinsData.value ? Number(totalWinsData.value) : 0)

// Computed stats
const avgScore = computed(() => {
  if (gamesHosted.value.length === 0) return 0
  const totalScore = gamesHosted.value.reduce((sum, game) => {
    return sum + game.scores.reduce((s: number, score: number) => s + score, 0)
  }, 0)
  const totalPlayers = gamesHosted.value.reduce((sum, game) => sum + game.winners.length, 0)
  return totalPlayers > 0 ? Math.round(totalScore / totalPlayers) : 0
})

const winRate = computed(() => {
  if (gamesHosted.value.length === 0) return 0
  return Math.round((totalWins.value / gamesHosted.value.length) * 100)
})

onMounted(async () => {
  loading.value = true
  gamesHosted.value = await getGamesByHost(playerAddress)
  loading.value = false
})

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatDate(timestamp: number) {
  const date = new Date(timestamp * 1000)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return date.toLocaleDateString()
}

useHead({
  title: `Player ${formatAddress(playerAddress)} - sk3chy`,
  meta: [
    { name: 'description', content: 'View player stats and game history on sk3chy' }
  ]
})
</script>
