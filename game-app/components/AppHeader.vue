<template>
  <header class="sticky top-0 z-50 backdrop-blur-lg bg-white/90 dark:bg-neutral-950/90 border-b border-neutral-200 dark:border-neutral-800 shadow-sm">
    <UContainer>
      <div class="flex items-center justify-between h-14 md:h-16 px-2 md:px-0">
        <div class="flex items-center gap-2">
          <!-- Mobile menu dropdown - left side -->
          <UDropdown 
            :items="menuItems" 
            :popper="{ placement: 'bottom-start' }"
            class="md:hidden"
          >
            <UButton 
              icon="i-heroicons-bars-3" 
              variant="ghost" 
              color="gray" 
              size="sm"
            />
          </UDropdown>
          
          <NuxtLink 
            to="/" 
            class="text-lg md:text-xl font-bold text-neutral-900 dark:text-white hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
          >
            sk3chy
          </NuxtLink>
        </div>

        <nav class="flex items-center gap-1 md:gap-2">
          
          <!-- Stats - hidden on mobile -->
          <UButton 
            variant="ghost" 
            to="/stats" 
            size="sm" 
            color="gray" 
            class="hidden md:inline-flex"
            :class="{ 'underline decoration-2 underline-offset-8': currentPath === '/stats' }"
          >
            Stats
          </UButton>
          
          <UDivider orientation="vertical" class="h-6 mx-1 md:mx-2 hidden md:block" />
          
          <!-- Room buttons - hidden on mobile -->
          <UButton 
            variant="ghost" 
            to="/game-contract/1" 
            size="sm" 
            color="gray" 
            class="hidden md:inline-flex"
            :class="{ 'underline decoration-2 underline-offset-8': currentPath.startsWith('/game-contract/1') }"
          >
            Room 1
          </UButton>
          <UButton 
            variant="ghost" 
            to="/game-contract/2" 
            size="sm" 
            color="gray" 
            class="hidden md:inline-flex"
            :class="{ 'underline decoration-2 underline-offset-8': currentPath.startsWith('/game-contract/2') }"
          >
            Room 2
          </UButton>
          <UButton 
            variant="ghost" 
            to="/game-contract/3" 
            size="sm" 
            color="gray" 
            class="hidden md:inline-flex"
            :class="{ 'underline decoration-2 underline-offset-8': currentPath.startsWith('/game-contract/3') }"
          >
            Room 3
          </UButton>
          
          <UDivider orientation="vertical" class="h-6 mx-1 md:mx-2 hidden md:block" />
          
          <!-- Wallet always visible -->
          <WalletConnect />
        </nav>
      </div>
    </UContainer>
  </header>
</template>

<script setup lang="ts">
const route = useRoute()
const currentPath = computed(() => route.path)

const menuItems = [
  [{
    label: 'Stats',
    icon: 'i-heroicons-chart-bar',
    to: '/stats'
  }],
  [{
    label: 'Room 1',
    icon: 'i-heroicons-user-group',
    to: '/game-contract/1'
  }, {
    label: 'Room 2',
    icon: 'i-heroicons-user-group',
    to: '/game-contract/2'
  }, {
    label: 'Room 3',
    icon: 'i-heroicons-user-group',
    to: '/game-contract/3'
  }]
]
</script>
