<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useSubstrateWallet } from '~/composables/useSubstrateWallet'

const { extensions, activeAccount, status, error, refreshExtensions, connect, disconnect } = useSubstrateWallet()

const isConnected = computed(() => status.value === 'connected' && !!activeAccount.value)
const shortAddress = computed(() => {
  if (!activeAccount.value?.address) return ''
  const addr = activeAccount.value.address
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
})

const accountItems = computed(() => [
  [{
    label: 'Copy Address',
    icon: 'i-heroicons-clipboard-document',
    click: () => {
      if (activeAccount.value?.address) {
        navigator.clipboard.writeText(activeAccount.value.address)
      }
    }
  }],
  [{
    label: 'Disconnect',
    icon: 'i-heroicons-arrow-right-on-rectangle',
    click: () => disconnect()
  }]
])

async function connectFirstExtension() {
  if (extensions.value.length === 0) {
    await refreshExtensions()
  }
  const target = extensions.value[0]
  if (target) {
    await connect(target)
  }
}

onMounted(() => {
  refreshExtensions()
})
</script>

<template>
  <div>
    <UDropdown 
      v-if="isConnected" 
      :items="accountItems"
      :popper="{ placement: 'bottom-end' }"
    >
      <UButton 
        color="primary" 
        variant="soft"
        trailing-icon="i-heroicons-chevron-down-20-solid"
      >
        <div class="flex items-center gap-2">
          <UAvatar size="2xs" :alt="activeAccount?.address || ''" icon="i-heroicons-user-circle" />
          <span>{{ shortAddress }}</span>
        </div>
      </UButton>
    </UDropdown>

    <UPopover v-else :popper="{ placement: 'bottom-end' }">
      <UButton color="primary" trailing-icon="i-heroicons-chevron-down-20-solid">
        Connect Wallet
      </UButton>

      <template #panel>
        <div class="p-2 w-56 space-y-2">
          <div class="flex items-center gap-2">
            <dc-connection-button />
            <UButton size="xs" variant="outline" @click="refreshExtensions">Refresh</UButton>
            <UButton size="xs" variant="outline" @click="connectFirstExtension">Load</UButton>
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">Detected wallets</div>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="ext in extensions"
              :key="ext"
              size="xs"
              variant="outline"
              @click="() => connect(ext)"
            >
              {{ ext }}
            </UButton>
            <span v-if="extensions.length === 0" class="text-xs text-gray-500">None found</span>
          </div>
          <p v-if="error" class="text-xs text-red-600 dark:text-red-400">{{ error }}</p>
        </div>
      </template>
    </UPopover>
  </div>
</template>
