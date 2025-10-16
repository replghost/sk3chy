<template>
  <div class="min-h-screen p-6">
    <div class="max-w-7xl mx-auto space-y-8">
      <!-- Header -->
      <div class="text-center space-y-2">
        <h1 class="text-4xl md:text-5xl font-bold">NFT Gallery [Under Construction]</h1>
        <p class="text-gray-600 dark:text-gray-400">
          Browse all minted sk3tchy NFTs
        </p>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p class="mt-4 text-gray-600 dark:text-gray-400">Loading NFTs...</p>
        <p class="text-sm text-gray-500 mt-2">This may take a moment as we fetch from IPFS</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="nfts.length === 0" class="text-center py-12">
        <div class="text-6xl mb-4">🎨</div>
        <p class="text-gray-600 dark:text-gray-400">No NFTs minted yet.</p>
        <p class="text-sm text-gray-500 mt-2">Play a game and mint your first drawing!</p>
      </div>

      <!-- NFT Grid -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <div
          v-for="nft in nfts"
          :key="nft.tokenId"
          class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-all hover:scale-105 cursor-pointer"
          @click="() => { selectedNFT = nft; showModal = true }"
        >
          <!-- NFT Image -->
          <div class="aspect-square bg-gray-100 dark:bg-gray-900 relative">
            <!-- Actual image -->
            <img
              v-if="nft.imageUrl"
              :src="nft.imageUrl"
              :alt="nft.name"
              crossorigin="anonymous"
              referrerpolicy="no-referrer"
              class="w-full h-full object-cover"
              loading="lazy"
              @error="(e) => handleImageError(e, nft)"
            />
            <!-- Placeholder SVG -->
            <svg
              v-else
              class="w-full h-full"
              viewBox="0 0 400 400"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="400" height="400" fill="#e5e7eb" class="dark:fill-gray-700"/>
              <!-- Image icon -->
              <g transform="translate(125, 125)">
                <rect x="0" y="0" width="150" height="150" rx="8" fill="none" stroke="#9ca3af" stroke-width="4"/>
                <circle cx="45" cy="45" r="15" fill="#9ca3af"/>
                <path d="M10 120 L60 80 L90 110 L140 60 L140 140 L10 140 Z" fill="#9ca3af"/>
              </g>
            </svg>
          </div>

          <!-- NFT Info -->
          <div class="p-4">
            <h3 class="font-bold text-lg mb-1 truncate">{{ nft.name }}</h3>
            <div class="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>Token #{{ nft.tokenId }}</span>
              <span v-if="nft.gameId">Game #{{ nft.gameId }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- NFT Details Modal -->
    <UModal v-model="showModal" :ui="{ width: 'max-w-4xl' }">
      <div v-if="selectedNFT" class="p-6">
        <div class="flex items-start justify-between mb-4">
          <h2 class="text-2xl font-bold">{{ selectedNFT.name }}</h2>
          <UButton
            icon="i-heroicons-x-mark"
            color="gray"
            variant="ghost"
            @click="showModal = false"
          />
        </div>

        <div class="grid md:grid-cols-2 gap-6">
          <!-- NFT Image -->
          <div class="aspect-square bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden">
            <img
              v-if="selectedNFT.imageUrl"
              :src="selectedNFT.imageUrl"
              :alt="selectedNFT.name"
              crossorigin="anonymous"
              referrerpolicy="no-referrer"
              class="w-full h-full object-contain"
            />
            <!-- Placeholder SVG -->
            <svg
              v-else
              class="w-full h-full"
              viewBox="0 0 400 400"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="400" height="400" fill="#e5e7eb" class="dark:fill-gray-700"/>
              <!-- Image icon -->
              <g transform="translate(125, 125)">
                <rect x="0" y="0" width="150" height="150" rx="8" fill="none" stroke="#9ca3af" stroke-width="4"/>
                <circle cx="45" cy="45" r="15" fill="#9ca3af"/>
                <path d="M10 120 L60 80 L90 110 L140 60 L140 140 L10 140 Z" fill="#9ca3af"/>
              </g>
            </svg>
          </div>

          <!-- NFT Details -->
          <div class="space-y-4">
            <!-- Description -->
            <div v-if="selectedNFT.description">
              <h3 class="font-semibold mb-2">Description</h3>
              <p class="text-gray-600 dark:text-gray-400 text-sm">
                {{ selectedNFT.description }}
              </p>
            </div>

            <!-- Basic Info -->
            <div>
              <h3 class="font-semibold mb-2">Details</h3>
              <div class="grid grid-cols-2 gap-2 text-sm">
                <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                  <p class="text-gray-500 dark:text-gray-400 text-xs">Token ID</p>
                  <p class="font-mono font-bold">{{ selectedNFT.tokenId }}</p>
                </div>
                <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                  <p class="text-gray-500 dark:text-gray-400 text-xs">Game ID</p>
                  <p class="font-mono font-bold">{{ selectedNFT.gameId || 'N/A' }}</p>
                </div>
              </div>
            </div>

            <!-- Attributes -->
            <div v-if="selectedNFT.attributes && selectedNFT.attributes.length > 0">
              <h3 class="font-semibold mb-2">Attributes</h3>
              <div class="grid grid-cols-2 gap-2 text-sm max-h-60 overflow-y-auto">
                <div
                  v-for="attr in selectedNFT.attributes"
                  :key="attr.trait_type"
                  class="bg-gray-50 dark:bg-gray-800 p-3 rounded"
                >
                  <p class="text-gray-500 dark:text-gray-400 text-xs">{{ attr.trait_type }}</p>
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
                  class="font-mono text-sm hover:text-primary underline break-all"
                >
                  {{ selectedNFT.owner }}
                </NuxtLink>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              <UButton
                block
                variant="soft"
                @click="viewOnBlockScout(selectedNFT.tokenId)"
              >
                View on BlockScout
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
const { getAllNFTs } = useNFTGallery()
const config = useRuntimeConfig()

const nfts = ref<any[]>([])
const loading = ref(true)
const selectedNFT = ref<any>(null)
const showModal = ref(false)

onMounted(async () => {
  loading.value = true
  const allNFTs = await getAllNFTs()
  // Sort in reverse chronological order (newest first, highest token ID first)
  nfts.value = allNFTs.sort((a, b) => b.tokenId - a.tokenId)
  loading.value = false
})

function handleImageError(e: Event, nft: any) {
  console.warn(`Failed to load image for NFT #${nft.tokenId}`)
  // Hide broken image
  ;(e.target as HTMLImageElement).style.display = 'none'
}

function viewOnBlockScout(tokenId: number) {
  const nftAddress = config.public.nftContractAddress
  window.open(
    `https://blockscout-passet-hub.parity-testnet.parity.io/token/${nftAddress}/instance/${tokenId}`,
    '_blank'
  )
}

useHead({
  title: 'NFT Gallery - sk3chy',
  meta: [
    { name: 'description', content: 'Browse all minted sk3tchy NFT drawings' }
  ]
})
</script>
