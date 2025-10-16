<template>
  <div class="min-h-screen p-6">
    <div class="max-w-7xl mx-auto space-y-8">
      <!-- Header -->
      <div class="text-center space-y-2">
        <h1 class="text-4xl md:text-5xl font-bold">Game Stats</h1>
        <p class="text-gray-600 dark:text-gray-400">
          On-chain game history and leaderboard
        </p>
      </div>

      <!-- Tabs -->
      <UTabs v-model="selectedTab" :items="tabs" class="w-full">
        <!-- Recent Games Tab -->
        <template #recent>
          <div class="space-y-4 py-6">
            <div v-if="loadingGames" class="text-center py-12">
              <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p class="mt-4 text-gray-600 dark:text-gray-400">Loading games...</p>
            </div>

            <div v-else-if="recentGames.length === 0" class="text-center py-12">
              <p class="text-gray-600 dark:text-gray-400">No games found on-chain yet.</p>
              <p class="text-sm text-gray-500 mt-2">Play a game with blockchain integration to see it here!</p>
            </div>

            <div v-else class="space-y-4">
              <div 
                v-for="game in recentGames" 
                :key="game.gameId"
                class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
              >
                <div class="flex flex-col md:flex-row gap-4">
                  <!-- NFT Image (if exists) -->
                  <div 
                    v-if="game.nft?.imageUrl" 
                    class="md:w-48 md:h-48 w-full h-64 bg-gray-100 dark:bg-gray-900 flex-shrink-0"
                  >
                    <img 
                      :src="game.nft.imageUrl" 
                      :alt="game.word"
                      class="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      @click="() => { selectedNFT = game.nft; showNFTModal = true }"
                    />
                  </div>

                  <!-- Game Info -->
                  <div class="flex-1 p-6 min-w-0">
                    <div class="flex items-start justify-between flex-wrap gap-4 mb-4">
                      <div class="flex-1">
                        <div class="flex items-center gap-3 mb-2">
                          <h3 class="text-2xl font-bold">{{ game.word }}</h3>
                          <UBadge color="gray" variant="subtle">
                            Game #{{ game.gameId }}
                          </UBadge>
                          <UBadge v-if="game.nft" color="green" variant="subtle">
                            🎨 NFT #{{ game.nft.tokenId }}
                          </UBadge>
                        </div>
                        
                        <div class="space-y-1 text-sm">
                          <p class="text-gray-600 dark:text-gray-400">
                            <span class="font-semibold">Artist:</span>
                            <NuxtLink 
                              :to="`/player/${game.host}`"
                              class="ml-1 hover:text-primary underline"
                            >
                              {{ formatAddress(game.host) }}
                            </NuxtLink>
                          </p>
                          <p class="text-gray-500 dark:text-gray-500 text-xs">
                            {{ formatDate(game.timestamp) }}
                          </p>
                        </div>
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
                            <NuxtLink 
                              :to="`/player/${winner}`"
                              class="hover:text-primary underline"
                            >
                              {{ formatAddress(winner) }}
                            </NuxtLink>
                            <span class="text-gray-500 ml-1">({{ game.scores[i] }} pts)</span>
                          </div>
                          <p v-if="game.winners.length > 3" class="text-xs text-gray-500">
                            +{{ game.winners.length - 3 }} more
                          </p>
                        </div>
                      </div>
                    </div>

                    <!-- Actions -->
                    <div class="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <UButton 
                        size="xs" 
                        variant="ghost"
                        @click="viewOnExplorer(game.transactionHash)"
                      >
                        View Transaction
                      </UButton>
                      <UButton 
                        v-if="game.nft"
                        size="xs" 
                        variant="soft"
                        @click="() => { selectedNFT = game.nft; showNFTModal = true }"
                      >
                        View NFT Details
                      </UButton>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- Leaderboard Tab -->
        <template #leaderboard>
          <div class="space-y-4 py-6">
            <div v-if="loadingLeaderboard" class="text-center py-12">
              <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p class="mt-4 text-gray-600 dark:text-gray-400">Loading leaderboard...</p>
            </div>

            <div v-else-if="leaderboard.length === 0" class="text-center py-12">
              <p class="text-gray-600 dark:text-gray-400">No players on leaderboard yet.</p>
            </div>

            <div v-else class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
              <table class="w-full">
                <thead class="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Rank
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Player
                    </th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Wins
                    </th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Games
                    </th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Avg Score
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                  <tr 
                    v-for="(player, index) in leaderboard" 
                    :key="player.address"
                    class="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                  >
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <span 
                          v-if="index < 3"
                          class="text-2xl mr-2"
                        >
                          {{ ['🥇', '🥈', '🥉'][index] }}
                        </span>
                        <span 
                          v-else
                          class="text-sm font-medium text-gray-500 dark:text-gray-400"
                        >
                          #{{ index + 1 }}
                        </span>
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <NuxtLink 
                        :to="`/player/${player.address}`"
                        class="text-sm font-medium hover:text-primary underline"
                      >
                        {{ formatAddress(player.address) }}
                      </NuxtLink>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right">
                      <span class="text-sm font-bold text-primary">
                        {{ player.wins }}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right">
                      <span class="text-sm text-gray-600 dark:text-gray-400">
                        {{ player.gamesPlayed }}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right">
                      <span class="text-sm text-gray-600 dark:text-gray-400">
                        {{ player.avgScore }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
      </UTabs>
    </div>

    <!-- NFT Details Modal -->
    <UModal v-model="showNFTModal" :ui="{ width: 'max-w-2xl' }">
      <div v-if="selectedNFT" class="p-6">
        <div class="flex items-start justify-between mb-4">
          <h2 class="text-2xl font-bold">{{ selectedNFT.name }}</h2>
          <UButton
            icon="i-heroicons-x-mark"
            color="gray"
            variant="ghost"
            @click="showNFTModal = false"
          />
        </div>

        <!-- NFT Image -->
        <div class="aspect-square bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden mb-4">
          <img 
            v-if="selectedNFT.imageUrl"
            :src="selectedNFT.imageUrl" 
            :alt="selectedNFT.name"
            class="w-full h-full object-contain"
          />
        </div>

        <!-- Description -->
        <p class="text-gray-600 dark:text-gray-400 mb-4">
          {{ selectedNFT.description }}
        </p>

        <!-- Metadata -->
        <div class="space-y-4">
          <div>
            <h3 class="font-semibold mb-2">Details</h3>
            <div class="grid grid-cols-2 gap-2 text-sm">
              <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                <p class="text-gray-500 dark:text-gray-400">Token ID</p>
                <p class="font-mono font-bold">{{ selectedNFT.tokenId }}</p>
              </div>
              <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                <p class="text-gray-500 dark:text-gray-400">Game ID</p>
                <p class="font-mono font-bold">{{ selectedNFT.gameId || 'N/A' }}</p>
              </div>
            </div>
          </div>

          <!-- Attributes -->
          <div v-if="selectedNFT.attributes && selectedNFT.attributes.length > 0">
            <h3 class="font-semibold mb-2">Attributes</h3>
            <div class="grid grid-cols-2 gap-2 text-sm">
              <div 
                v-for="attr in selectedNFT.attributes" 
                :key="attr.trait_type"
                class="bg-gray-50 dark:bg-gray-800 p-2 rounded"
              >
                <p class="text-gray-500 dark:text-gray-400">{{ attr.trait_type }}</p>
                <p class="font-medium">{{ attr.value }}</p>
              </div>
            </div>
          </div>

          <!-- Owner -->
          <div>
            <h3 class="font-semibold mb-2">Owner</h3>
            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded">
              <NuxtLink 
                :to="`/player/${selectedNFT.owner}`"
                class="font-mono text-sm hover:text-primary underline"
              >
                {{ selectedNFT.owner }}
              </NuxtLink>
            </div>
          </div>

          <!-- Raw Metadata -->
          <div v-if="selectedNFT.metadata">
            <h3 class="font-semibold mb-2">Metadata JSON</h3>
            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded overflow-auto max-h-60">
              <pre class="text-xs font-mono">{{ JSON.stringify(selectedNFT.metadata, null, 2) }}</pre>
            </div>
          </div>

          <!-- IPFS Links -->
          <div>
            <h3 class="font-semibold mb-2">IPFS Links</h3>
            <div class="space-y-2 text-xs">
              <div class="flex items-center gap-2">
                <span class="text-gray-500 dark:text-gray-400">Metadata:</span>
                <a 
                  :href="`https://gateway.pinata.cloud/ipfs/${selectedNFT.tokenURI.replace('ipfs://', '')}`"
                  target="_blank"
                  class="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View on IPFS →
                </a>
              </div>
              <div v-if="selectedNFT.metadata?.image" class="flex items-center gap-2">
                <span class="text-gray-500 dark:text-gray-400">Image:</span>
                <a 
                  :href="selectedNFT.imageUrl"
                  target="_blank"
                  class="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View on IPFS →
                </a>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <UButton 
              block
              variant="soft"
              @click="viewNFTOnExplorer(selectedNFT.tokenId)"
            >
              View on BlockScout
            </UButton>
          </div>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
const { getRecentGames, getLeaderboard } = useGameContract()
const { getAllNFTs } = useNFTGallery()
const config = useRuntimeConfig()

const selectedTab = ref(0)
const tabs = [
  { label: 'Recent Games', slot: 'recent' },
  { label: 'Leaderboard', slot: 'leaderboard' }
]

const recentGames = ref<any[]>([])
const leaderboard = ref<any[]>([])
const nfts = ref<any[]>([])
const loadingGames = ref(true)
const loadingLeaderboard = ref(true)
const loadingNFTs = ref(true)
const selectedNFT = ref<any>(null)
const showNFTModal = ref(false)

onMounted(async () => {
  // Load recent games and NFTs in parallel
  loadingGames.value = true
  const [games, allNFTs] = await Promise.all([
    getRecentGames(20),
    getAllNFTs()
  ])
  
  console.log('[Stats] Raw games:', games)
  console.log('[Stats] All NFTs:', allNFTs)
  
  // Deduplicate games by gameId (keep the most recent one)
  const uniqueGamesMap = new Map()
  games.forEach(game => {
    const existing = uniqueGamesMap.get(game.gameId)
    if (!existing || game.timestamp > existing.timestamp) {
      uniqueGamesMap.set(game.gameId, game)
    }
  })
  const uniqueGames = Array.from(uniqueGamesMap.values())
  
  console.log('[Stats] Unique games after dedup:', uniqueGames)
  
  // Match NFTs to games by gameId
  recentGames.value = uniqueGames.map(game => {
    const nft = allNFTs.find(n => n.gameId === game.gameId)
    return {
      ...game,
      nft // Add NFT data if it exists
    }
  })
  
  console.log('[Stats] Final recent games with NFTs:', recentGames.value)
  
  loadingGames.value = false

  // Load leaderboard
  loadingLeaderboard.value = true
  leaderboard.value = await getLeaderboard()
  loadingLeaderboard.value = false
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

function viewOnExplorer(txHash: string) {
  window.open(
    `https://blockscout-passet-hub.parity-testnet.parity.io/tx/${txHash}`,
    '_blank'
  )
}

function viewNFTOnExplorer(tokenId: number) {
  const nftAddress = config.public.nftContractAddress
  window.open(
    `https://blockscout-passet-hub.parity-testnet.parity.io/token/${nftAddress}/instance/${tokenId}`,
    '_blank'
  )
}

useHead({
  title: 'Game Stats - sk3chy',
  meta: [
    { name: 'description', content: 'View on-chain game history and leaderboard for sk3chy drawing game' }
  ]
})
</script>
