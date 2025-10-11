<script setup lang="ts">
import { useAccount, useDisconnect, useConnect, useChainId } from '@wagmi/vue'

const { address, chainId, status } = useAccount()
const { disconnect } = useDisconnect()
const { connect, connectors } = useConnect()
const currentChainId = useChainId()

const isConnected = computed(() => status.value === 'connected')

const shortAddress = computed(() => {
  if (!address.value) return ''
  return `${address.value.slice(0, 6)}...${address.value.slice(-4)}`
})

const accountItems = computed(() => [
  [{
    label: 'Copy Address',
    icon: 'i-heroicons-clipboard-document',
    click: () => {
      if (address.value) {
        navigator.clipboard.writeText(address.value)
      }
    }
  }],
  [{
    label: 'Disconnect',
    icon: 'i-heroicons-arrow-right-on-rectangle',
    click: () => disconnect()
  }]
])

const handleConnect = (connector: any) => {
  connect({ connector, chainId: currentChainId.value })
}

const getConnectorIcon = (connectorName: string) => {
  const name = connectorName.toLowerCase()
  if (name.includes('metamask')) return 'i-simple-icons-metamask'
  if (name.includes('walletconnect')) return 'i-simple-icons-walletconnect'
  if (name.includes('coinbase')) return 'i-simple-icons-coinbase'
  if (name.includes('injected')) return 'i-heroicons-wallet'
  return 'i-heroicons-wallet'
}
</script>

<template>
  <div>
    <!-- Connected State -->
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
          <UAvatar 
            size="2xs" 
            :alt="address || ''"
            icon="i-heroicons-user-circle"
          />
          <span>{{ shortAddress }}</span>
        </div>
      </UButton>
    </UDropdown>

    <!-- Disconnected State -->
    <UPopover v-else :popper="{ placement: 'bottom-end' }">
      <UButton 
        color="primary"
        trailing-icon="i-heroicons-chevron-down-20-solid"
      >
        Connect Wallet
      </UButton>

      <template #panel>
        <div class="p-2 w-48">
          <div class="px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
            Choose Wallet
          </div>
          <UButton
            v-for="connector in connectors"
            :key="connector.id"
            variant="ghost"
            color="gray"
            size="sm"
            class="w-full justify-start mb-0.5"
            @click="handleConnect(connector)"
          >
            <div class="flex items-center gap-2.5">
              <UIcon :name="getConnectorIcon(connector.name)" class="w-4 h-4 flex-shrink-0" />
              <span class="text-sm truncate">{{ connector.name }}</span>
            </div>
          </UButton>
        </div>
      </template>
    </UPopover>
  </div>
</template>
