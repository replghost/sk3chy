<template>
  <footer class="border-t border-neutral-200 dark:border-neutral-800 mt-auto bg-neutral-100 dark:bg-neutral-950">
    <UContainer>
      <div class="py-4">
        <div class="flex items-center justify-between">
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            © {{ currentYear }} Peers
          </p>
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            Built on Polkadot
          </p>
        </div>
      </div>
    </UContainer>
  </footer>
</template>

<script setup lang="ts">
const currentYear = new Date().getFullYear()
</script>
