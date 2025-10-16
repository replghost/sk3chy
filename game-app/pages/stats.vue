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
                class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow"
              >
                <div class="flex items-start justify-between flex-wrap gap-4">
                  <!-- Game Info -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-3 mb-2">
                      <h3 class="text-2xl font-bold">{{ game.word }}</h3>
                      <UBadge color="gray" variant="subtle">
                        Game #{{ game.gameId }}
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
                <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
                  <UButton 
                    size="xs" 
                    variant="ghost"
                    @click="viewOnExplorer(game.transactionHash)"
                  >
                    View on Explorer
                  </UButton>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- NFT Gallery Tab -->
        <template #nfts>
          <div class="space-y-4 py-6">
            <div v-if="loadingNFTs" class="text-center py-12">
              <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p class="mt-4 text-gray-600 dark:text-gray-400">Loading NFTs...</p>
            </div>

            <div v-else-if="nfts.length === 0" class="text-center py-12">
              <p class="text-gray-600 dark:text-gray-400">No NFTs minted yet.</p>
              <p class="text-sm text-gray-500 mt-2">Play a game and mint your first drawing!</p>
            </div>

            <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div 
                v-for="nft in nfts" 
                :key="nft.tokenId"
                class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
              >
                <!-- NFT Image -->
                <div class="aspect-square bg-gray-100 dark:bg-gray-900 relative">
                  <img 
                    v-if="nft.imageUrl"
                    :src="nft.imageUrl" 
                    :alt="nft.name"
                    class="w-full h-full object-contain"
                    @error="(e) => (e.target as HTMLImageElement).src = '/placeholder-nft.png'"
                  />
                  <div v-else class="w-full h-full flex items-center justify-center">
                    <span class="text-4xl">🎨</span>
                  </div>
                  
                  <!-- Token ID Badge -->
                  <div class="absolute top-2 right-2">
                    <UBadge color="primary" variant="solid">
                      #{{ nft.tokenId }}
                    </UBadge>
                  </div>
                </div>

                <!-- NFT Info -->
                <div class="p-4 space-y-3">
                  <div>
                    <h3 class="font-bold text-lg">{{ nft.name }}</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                      {{ nft.description }}
                    </p>
                  </div>

                  <!-- Attributes -->
                  <div v-if="nft.attributes && nft.attributes.length > 0" class="space-y-1">
                    <div 
                      v-for="attr in nft.attributes.slice(0, 3)" 
                      :key="attr.trait_type"
                      class="flex justify-between text-xs"
                    >
                      <span class="text-gray-500 dark:text-gray-400">{{ attr.trait_type }}:</span>
                      <span class="font-medium">{{ attr.value }}</span>
                    </div>
                  </div>

                  <!-- Owner -->
                  <div class="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p class="text-xs text-gray-500 dark:text-gray-400">Owner</p>
                    <NuxtLink 
                      :to="`/player/${nft.owner}`"
                      class="text-sm font-medium hover:text-primary underline"
                    >
                      {{ formatAddress(nft.owner) }}
                    </NuxtLink>
                  </div>

                  <!-- Actions -->
                  <div class="flex gap-2">
                    <UButton 
                      size="xs" 
                      variant="ghost"
                      block
                      @click="viewNFTOnExplorer(nft.tokenId)"
                    >
                      View on Explorer
                    </UButton>
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
  </div>
</template>

<script setup lang="ts">
const { getRecentGames, getLeaderboard } = useGameContract()
const { getAllNFTs } = useNFTGallery()
const config = useRuntimeConfig()

const selectedTab = ref(0)
const tabs = [
  { label: 'Recent Games', slot: 'recent' },
  { label: 'Leaderboard', slot: 'leaderboard' },
  { label: 'NFT Gallery', slot: 'nfts' }
]

const recentGames = ref<any[]>([])
const leaderboard = ref<any[]>([])
const nfts = ref<any[]>([])
const loadingGames = ref(true)
const loadingLeaderboard = ref(true)
const loadingNFTs = ref(true)

onMounted(async () => {
  // Load recent games
  loadingGames.value = true
  recentGames.value = await getRecentGames(20)
  loadingGames.value = false

  // Load leaderboard
  loadingLeaderboard.value = true
  leaderboard.value = await getLeaderboard()
  loadingLeaderboard.value = false

  // Load NFTs
  loadingNFTs.value = true
  nfts.value = await getAllNFTs()
  loadingNFTs.value = false
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
