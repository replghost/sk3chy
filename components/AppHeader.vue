<template>
  <header class="sticky top-0 z-50 backdrop-blur-lg bg-white/90 dark:bg-neutral-950/90 border-b border-neutral-200 dark:border-neutral-800 shadow-sm">
    <UContainer>
      <div class="flex items-center justify-between h-16">
        <NuxtLink 
          to="/" 
          class="text-xl font-bold text-neutral-900 dark:text-white hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
        >
          🏆 Hackathon Voting
        </NuxtLink>

        <nav class="flex items-center gap-2">
          <UButton variant="ghost" to="/" size="sm">Home</UButton>
          <UButton variant="ghost" to="/projects" size="sm">Projects</UButton>
          <UButton variant="ghost" to="/organizer" size="sm">Organizer</UButton>
          
          <UDivider orientation="vertical" class="h-6 mx-2" />
          
          <WalletConnect />
        </nav>
      </div>
    </UContainer>
  </header>
</template>

<script setup lang="ts">
// Header component
</script>
